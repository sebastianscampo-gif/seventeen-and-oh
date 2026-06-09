// generate-ratings.mjs
// Reads data/processed/player_seasons.csv + the team-season registry and runs
// the custom rating engine to produce data/processed/ratings.csv.
//
// Three steps:
//   1. Build engine inputs.
//   2. WITHIN-ROSTER DEPTH RANKING (Phase 2): for each team-season x position
//      group, rank players by the best signal available (recorded starts, then
//      box-score production, then experience/availability) and hand each one a
//      role tier. Where a group has no signal to rank by, mark it `unknown`
//      (ambiguous) instead of inventing a starter — the engine then uses an
//      honest position-based prior and flags the rating low-confidence.
//   3. Finalize using the player's percentile within their season+position
//      cohort ("era percentile").
//
// Players with thin data still receive full ratings plus a needs_review /
// low_confidence tag and a one-line rating_reason in the `note` column.
//
// Run:  node scripts/generate-ratings.mjs   (or: npm run data:ratings)

import { readCsv, writeCsv } from "./lib/csv.mjs";
import {
  RATING_FIELDS, RATINGS_COLUMNS, STAT_COLUMNS, ALL_STATUSES,
  POSITION_GROUP, STARTER_COUNTS, tierFromRank, STATUS,
} from "./lib/schema.mjs";
import { computeContext, finalize, statProduction, projectAttributes } from "./lib/ratings-engine.mjs";
import { clamp, fromRoot, jitter, list, log, num } from "./lib/util.mjs";

// Threshold below which a position group on a roster carries no usable signal to
// tell its players apart (e.g. a bio-only import where everyone shows the same
// flat games count and no starts/stats/experience). Such groups are ranked only
// if they are small enough that every member is plainly a starter.
const SIGNAL_EPSILON = 5;

// --- 1999 depth individualization -------------------------------------------
// The 1999 overhaul brief requires every player rated individually, with no
// roster stacked on one OVR and no statless backup priced like a starter. The
// engine ranks the no-evidence depth (the statless OL/DL/LB/DB it can only order,
// not grade) but lands the whole ambiguous group on a single team-scaled number
// (~71 on weak teams, pushed to ~77 on strong ones). That is exactly the cluster
// the brief forbids. For those rows ONLY — 1999, low-confidence, zero quality
// evidence — we spread the otherwise-identical value deterministically by real
// experience plus a stable per-player seed, centered in the backup band so depth
// on a strong team is never starter-rated. Reproducible (seeded, no RNG) and
// scoped to 1999; curated overrides and any evidence-backed rating are untouched.
const DEPTH_SEASON = 1999;
const DEPTH_CAP = 72;      // no-evidence depth is centered no higher than this
const DEPTH_FLOOR = 54;    // ...and never below this
const DEPTH_CEIL = 78;     // ...nor above this without real evidence
const DEPTH_EXP_TILT = 3;  // experience tilt amplitude (vet > rookie)
const DEPTH_SPREAD = 8;    // deterministic per-player spread amplitude
const DEPTH_DOWN_SKEW = 2; // small bias toward the backup band

function disperseDepthOverall(input, ctx, overall, seed) {
  const exp = num(input.years_exp);
  const expTilt = exp != null ? clamp((exp - 4) / 6, -1, 1) * DEPTH_EXP_TILT : 0;
  const noise = jitter(seed + "|d99"); // stable per-player value in [-1, 1]
  const center = Math.min(overall, DEPTH_CAP);
  const disp = center + expTilt + noise * DEPTH_SPREAD - DEPTH_DOWN_SKEW;
  return clamp(Math.round(disp), DEPTH_FLOOR, DEPTH_CEIL);
}

// A within-roster ranking score. Higher = more likely a starter. Recorded starts
// dominate; real box-score production is next; experience/availability are weak
// tiebreakers. Returns 0-ish and flat when nothing distinguishes a player.
function roleScore(group, input) {
  const gs = num(input.games_started ?? input.gamesStarted);
  const exp = num(input.years_exp);
  const games = num(input.games);
  let s = 0;
  if (gs != null) s += 1000 + gs * 5;                              // recorded starts dominate
  const prod = statProduction(group, input.stats || {});
  if (prod.hasStats) s += 300 + Math.max(0, prod.overallBonus) * 20; // production = real role
  if (exp != null) s += Math.min(exp, 16) * 4;                     // experience (tiebreaker)
  // Games played is the one signal almost every row carries. Let it actually
  // rank a group when starts/stats/experience are absent — starters take more
  // snaps — so a roster gets a believable depth order instead of a flat block.
  // It stays a within-roster ORDER only; the rating remains low-confidence.
  if (games != null) s += clamp(games / 16, 0, 1) * 8;            // availability
  return s;
}

function run() {
  log.step("Generating ratings");

  const playerSeasons = readCsv(fromRoot("data", "processed", "player_seasons.csv"));
  if (playerSeasons.length === 0) {
    log.warn("No player_seasons.csv — run the import first.");
    return;
  }

  const registry = readCsv(fromRoot("data", "team_seasons.csv"));
  const teamMeta = new Map();
  for (const r of registry) {
    teamMeta.set(`${num(r.season)}_${r.team_code}`, {
      strength: num(r.team_strength, 70),
      confidence: num(r.rating_confidence, 0.6),
    });
  }

  // Step 1: build engine inputs.
  const items = playerSeasons.map((p) => {
    const meta = teamMeta.get(`${num(p.season)}_${p.team_code}`) || {};
    const stats = {};
    for (const c of STAT_COLUMNS) if (p[c] !== "" && p[c] != null) stats[c] = p[c];
    const input = {
      player_id: p.player_id,
      name: p.name,
      season: num(p.season),
      team_code: p.team_code,
      position: p.position,
      games: p.games,
      games_started: p.games_started,
      years_exp: p.years_exp,
      awards: list(p.awards),
      stats,
      scout_grade: p.scout_grade,
      teamStrength: meta.strength ?? 70,
    };
    return { p, input, defConfidence: meta.confidence ?? 0.6 };
  });

  // Step 2: within-roster depth ranking. Group by team-season x position group.
  const groups = new Map();
  for (const it of items) {
    const grp = POSITION_GROUP[it.input.position] || "RB";
    const key = `${it.input.season}|${it.input.team_code}|${grp}`;
    let bucket = groups.get(key);
    if (!bucket) groups.set(key, (bucket = { grp, members: [] }));
    bucket.members.push(it);
  }
  let ambiguousGroups = 0;
  for (const { grp, members } of groups.values()) {
    for (const it of members) it._score = roleScore(grp, it.input);
    const scores = members.map((m) => m._score);
    const spread = Math.max(...scores) - Math.min(...scores);
    const starters = STARTER_COUNTS[grp] ?? 2;
    // Ambiguous only when the group is deeper than its starter count AND nothing
    // separates the players. A group no larger than its starter count is plainly
    // all starters, so we rank it even with a flat signal.
    const ambiguous = members.length > starters && spread < SIGNAL_EPSILON;
    if (ambiguous) {
      ambiguousGroups++;
      for (const it of members) {
        it.input.roleTier = "unknown";
        it.input.roleAmbiguous = true;
      }
    } else {
      const sorted = [...members].sort(
        (a, b) => b._score - a._score || (a.input.player_id < b.input.player_id ? -1 : 1)
      );
      sorted.forEach((it, i) => {
        it.input.roleTier = tierFromRank(i + 1, grp);
        it.input.roleAmbiguous = false;
      });
    }
  }

  // Now that role tiers are assigned, compute each player's raw composite.
  for (const it of items) it.ctx = computeContext(it.input);

  // Era percentile: rank each player against their *own season AND position
  // group* (e.g. 1972 RBs vs other 1972 RBs), so older players are measured by
  // dominance within their era rather than against modern raw-stat inflation.
  // Tiny cohorts are shrunk toward the median so a handful of players can't hand
  // out extreme percentiles on noise.
  const cohorts = new Map();
  for (const it of items) {
    const key = `${it.input.season}|${it.ctx.group}`;
    (cohorts.get(key) || cohorts.set(key, []).get(key)).push(it);
  }
  const percentile = new Map();
  for (const [, group] of cohorts) {
    const sorted = [...group].sort((a, b) => a.ctx.rawComposite - b.ctx.rawComposite);
    const n = sorted.length;
    const shrink = Math.min(1, n / 8); // full spread only once a cohort has >=8 players
    sorted.forEach((it, i) => {
      const raw = n > 1 ? i / (n - 1) : 0.5;
      percentile.set(it, 0.5 + (raw - 0.5) * shrink);
    });
  }

  // Step 3: finalize.
  const out = [];
  const statusCounts = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0]));
  let reviewCount = 0;
  let dispersedCount = 0;
  for (const it of items) {
    const { rating, status, source, confidence, reason, needsReview } = finalize(
      it.input, it.ctx, percentile.get(it), { confidence: it.defConfidence }
    );

    // 1999-only: individualize the no-evidence depth cluster so a roster never
    // stacks on one OVR (see the depth-individualization note at top of file).
    let finalRating = rating;
    let finalNote = reason || "";
    if (
      it.input.season === DEPTH_SEASON &&
      !it.ctx.hasQualityEvidence &&
      (status === STATUS.GENERATED_LOW || status === STATUS.NEEDS_REVIEW)
    ) {
      const seed = `${it.input.player_id || it.input.name || "x"}|${it.input.season || ""}|${it.input.team_code || ""}`;
      const dispersed = disperseDepthOverall(it.input, it.ctx, rating.overall, seed);
      if (dispersed !== rating.overall) {
        finalRating = {
          overall: dispersed,
          ...projectAttributes(it.ctx.group, dispersed, seed, {
            attrNudges: it.ctx.stat.attrNudges || {},
            keyLift: it.ctx.award.lift || 0,
            availability: it.ctx.hasRole ? it.ctx.availability : null,
            awardOverall: it.ctx.award.overall,
          }),
        };
        finalNote = finalNote ? `${finalNote} [1999 depth individualized]` : finalNote;
        dispersedCount++;
      }
    }

    statusCounts[status] = (statusCounts[status] || 0) + 1;
    if (needsReview) reviewCount++;
    const rowOut = {
      player_id: it.p.player_id,
      season: it.input.season,
      team_code: it.p.team_code,
      status,
      rating_source: source,
      rating_confidence: confidence,
      needs_manual_review: needsReview ? "true" : "",
      note: finalNote,
    };
    for (const f of RATING_FIELDS) rowOut[f] = finalRating[f];
    out.push(rowOut);
  }

  out.sort(
    (a, b) => a.season - b.season || a.team_code.localeCompare(b.team_code) || b.overall - a.overall
  );

  writeCsv(fromRoot("data", "processed", "ratings.csv"), out, RATINGS_COLUMNS);

  log.ok(`${out.length} ratings written`);
  log.info(`within-roster ranking: ${groups.size} position groups, ${ambiguousGroups} ambiguous (no signal)`);
  log.info(`1999 depth individualized (no-evidence cluster): ${dispersedCount}`);
  log.info(`flagged needs_manual_review: ${reviewCount}`);
  log.info(
    "by status: " +
      ALL_STATUSES.map((s) => `${s}=${statusCounts[s]}`).join("  ")
  );
}

run();
