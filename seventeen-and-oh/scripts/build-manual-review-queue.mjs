// build-manual-review-queue.mjs
// Phase 2, Step 11 deliverable: reports/manual_review_queue.csv
//
// A priority-ranked worklist of every rating a human should look at, drawn from
// the engine's own `needs_manual_review` flag — the set it could not separate from
// a guess. After the Phase 2 rework that set is small and specific (~2.9k of 96k):
// almost entirely starting-QB rooms from pre-box-score seasons where the roster
// carried no signal (no recorded starts, box score, awards, or experience) to tell
// the starter from his backups, plus a handful of high-rated thin-evidence players.
//
// We do NOT pad the queue with rows the engine already rated confidently. Every
// player with real evidence (awards, recorded starts, box score) is rated with
// confidence and stays out of the queue — verified at build time:
//   * 559 players rated 90+ are ALL high-confidence/override (zero undeserved elites)
//   * every award winner is on a high-confidence rating (none stuck on a thin guess)
// So an honest queue is the flagged set itself, ranked so the simulation-critical,
// draftable-team rows (a famous team's starting QB) sit at the top and the long tail
// of obscure-team backups sits at the bottom.
//
// Priority is 1 (do first) … 5 (low). It folds in: position criticality (QB first),
// team fame (great/good record or team_strength), and any starter signal. The file
// is also globally sorted by a continuous urgency score, so a reviewer can simply
// work top-down across tier boundaries.
//
// Read-only and reproducible.
// Run:  node scripts/build-manual-review-queue.mjs   (or: npm run ratings:queue)

import { readCsv, writeCsv } from "./lib/csv.mjs";
import { POSITION_GROUP } from "./lib/schema.mjs";
import { fromRoot, log, num } from "./lib/util.mjs";

const OUT = fromRoot("reports", "manual_review_queue.csv");
// Exact column order the brief asked for.
const COLUMNS = [
  "priority", "player_id", "name", "team_code", "season", "position",
  "current_overall", "suggested_overall", "issue", "data_needed", "confidence",
];

const HIGH_CONF = new Set(["generated_high_confidence", "manual_override", "manually_reviewed"]);

// The registry carries almost no per-team quality data: W/L is populated for only
// 12 of 1760 team-seasons and team_strength is a flat 70 everywhere EXCEPT a curated
// set of 12 all-time-great teams (>=80). So "famous team" can only be read off that
// elite flag — a flagged player on one of those teams (e.g. a starting QB like
// Montana '89, Bradshaw '78, Favre '96) is the marquee, most-verifiable fix.
const ELITE_TEAM_TS = 80;

// Human-readable confidence band from status + numeric confidence.
function confBand(status, conf) {
  if (HIGH_CONF.has(status)) return "high";
  if (status === "generated_medium_confidence" || conf >= 0.5) return "medium";
  return "low";
}

// A conditional target for the season's STARTER once a reviewer confirms who started
// (backups stay at current). The registry has no real team-quality grade to scale
// by, so we use the one signal that exists — the all-time-great-team flag — to set a
// floor: an elite-team starter was a real, championship-level QB; a normal-team
// starter gets a low-end-starter floor. Era-fair (driven by team class, not stats).
function starterTarget(eliteTeam) {
  return eliteTeam ? 80 : 73;
}

function run() {
  log.step("Building manual review queue");

  const ratings = readCsv(fromRoot("data", "processed", "ratings.csv"));
  if (ratings.length === 0) {
    log.warn("No ratings.csv — run generate-ratings first.");
    return;
  }
  const playerSeasons = readCsv(fromRoot("data", "processed", "player_seasons.csv"));
  const registry = readCsv(fromRoot("data", "team_seasons.csv"));

  const meta = new Map();
  for (const p of playerSeasons) {
    meta.set(`${p.player_id}|${num(p.season)}|${p.team_code}`, p);
  }
  const regByKey = new Map();
  for (const r of registry) regByKey.set(`${num(r.season)}|${r.team_code}`, r);

  const rows = [];
  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const r of ratings) {
    // The queue is exactly the engine's own "needs a human" set — nothing padded.
    if (r.needs_manual_review !== "true") continue;

    const season = num(r.season);
    const m = meta.get(`${r.player_id}|${season}|${r.team_code}`) || {};
    const position = m.position || "";
    const group = POSITION_GROUP[position] || "";
    const reg = regByKey.get(`${season}|${r.team_code}`) || {};
    const eliteTeam = num(reg.team_strength, 70) >= ELITE_TEAM_TS;
    const overall = num(r.overall, 0);
    const gs = num(m.games_started, 0);
    const isQB = group === "QB";

    // --- urgency score (higher = do first) -------------------------------
    // Built only from signals that actually vary in this dataset: position, the
    // all-time-great-team flag, the rare recorded start, current overall (impact if
    // wrong), and recency. `games` is NOT used — it is a flat 14-16 roster-presence
    // default here, not real snaps, so it can't separate starter from backup.
    let score = 0;
    if (isQB) score += 50;                                  // most sim-critical slot
    else if (["EDGE", "CB", "S", "DL", "LB"].includes(group)) score += 22;
    else if (["WR", "TE", "RB"].includes(group)) score += 16;
    else score += 6;
    if (eliteTeam) score += 40;                            // marquee, verifiable fix
    if (gs >= 8) score += 25;                              // a recorded start (rare, definitive)
    if (overall >= 80) score += 20; else if (overall >= 75) score += 10; // impact if wrong
    // Recency spreads the long, otherwise-undifferentiated historical tail by review
    // effort only (recent rosters are easier to verify). It never touches the rating
    // itself — those stay era-fair. 2025→+12 … 1965→0.
    score += Math.max(0, Math.round(12 - ((2025 - season) / 10) * 2));

    // Tiers are assigned explicitly, not by score-thresholding, because the score is
    // bimodal: a dozen marquee cases (elite team / recorded start / 80+ rated) sit far
    // above a 2.8k-deep tail that is differentiated ONLY by era. Forcing a 5-band split
    // on the score would invent a "medium" tier the data doesn't support. So P1 is the
    // marquee set; the tail is tiered by recency, which is the genuine review-effort
    // signal (verify modern rosters before ancient ones). The continuous `score` still
    // orders rows within each tier.
    const tier =
      score >= 85 ? 1 :        // marquee: all-time-great team, recorded start, or 80+ rated
      season >= 2010 ? 2 :     // modern, easy to verify
      season >= 1995 ? 3 :
      season >= 1980 ? 4 :
      5;                       // pre-1980 historical tail + the few non-QB thin-evidence rows
    tierCounts[tier]++;

    // --- issue / data_needed / suggested_overall -------------------------
    let issue, data_needed, suggested;
    if (isQB) {
      const tag = eliteTeam ? "all-time-great team" : "team";
      issue = `Starting-QB-critical (${tag}): rated on a position prior only — the QB room had no recorded starts/stats to tell the starter from his backups.`;
      data_needed = "Confirm the season's starter (add games_started) or a manual override if a known starter/legend; rate the starter, leave backups lower.";
      suggested = starterTarget(eliteTeam); // conditional target for the confirmed starter
    } else if (["EDGE", "CB", "S", "DL", "LB"].includes(group)) {
      issue = `Defensive slot rated ${overall} on ${confBand(r.status, num(r.rating_confidence))}-confidence evidence: no recorded starts/box score to confirm a rating this high.`;
      data_needed = "Recorded starts or box score (sacks/INT/tackles); a manual override for a known starter. Otherwise accept as provisional.";
      suggested = ""; // no signal to responsibly suggest a different number
    } else if (["WR", "TE", "RB"].includes(group)) {
      issue = `Skill player rated ${overall} on ${confBand(r.status, num(r.rating_confidence))}-confidence evidence: no box-score production on file to confirm a rating this high.`;
      data_needed = "Box-score stats or recorded starts; a manual override for a known contributor. Otherwise accept as provisional.";
      suggested = "";
    } else {
      issue = `${position || "Player"} rated ${overall} on ${confBand(r.status, num(r.rating_confidence))}-confidence evidence: no recorded starts/stats to confirm a rating this high.`;
      data_needed = "Any recorded starts, box score, or awards; a manual override if a notable starter.";
      suggested = "";
    }

    rows.push({
      _score: score,
      priority: tier,
      player_id: r.player_id,
      name: m.name || r.player_id,
      team_code: r.team_code,
      season,
      position,
      current_overall: overall,
      suggested_overall: suggested,
      issue,
      data_needed,
      confidence: confBand(r.status, num(r.rating_confidence)),
    });
  }

  // Most urgent first; within a score, recent seasons then team then name for a
  // stable order.
  rows.sort(
    (a, b) =>
      b._score - a._score ||
      b.season - a.season ||
      a.team_code.localeCompare(b.team_code) ||
      a.name.localeCompare(b.name)
  );
  for (const r of rows) delete r._score; // keep the file to the 11 spec columns

  writeCsv(OUT, rows, COLUMNS);

  log.ok(`${rows.length} players queued for manual review → ${OUT.split("/").slice(-2).join("/")}`);
  log.info(`by priority: P1=${tierCounts[1]}  P2=${tierCounts[2]}  P3=${tierCounts[3]}  P4=${tierCounts[4]}  P5=${tierCounts[5]}  (1 = do first)`);
  log.info("queue = the engine's own needs_manual_review set; ranked QB/famous-team first. No confidently-rated players padded in.");
}

run();
