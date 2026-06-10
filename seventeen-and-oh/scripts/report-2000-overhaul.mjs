// report-2000-overhaul.mjs
// Read-only reporting pass for the 2000 rating overhaul. Emits, in one run:
//   Step 5: reports/2000_manual_review_queue.csv
//   Step 7: reports/2000_team_rating_summaries.md
//   Step 8: reports/2000_rating_before_after.csv
//   Step 8: reports/2000_team_distribution_before_after.csv
//
// Sources of truth:
//   BEFORE  -> reports/_work/2000_before.csv  (pre-overhaul engine state)
//   AFTER   -> public/team-seasons/2000_<TC>.json  (post-overhaul exported state)
//
// Players are joined BEFORE<->AFTER by player_id (handles the few 2000 roster
// corrections where a player moved teams). Nothing here mutates game data.
//
// Run:  node scripts/report-2000-overhaul.mjs

import fs from "node:fs";
import { readCsv, writeCsv } from "./lib/csv.mjs";
import { fromRoot, log, num, roundTo } from "./lib/util.mjs";

const SEASON = 2000;
const BEFORE_CSV = fromRoot("reports", "_work", "2000_before.csv");
const REGISTRY_CSV = fromRoot("data", "team_seasons.csv");
const TS_DIR = fromRoot("public", "team-seasons");

const OUT_QUEUE = fromRoot("reports", "2000_manual_review_queue.csv");
const OUT_SUMMARIES = fromRoot("reports", "2000_team_rating_summaries.md");
const OUT_BEFORE_AFTER = fromRoot("reports", "2000_rating_before_after.csv");
const OUT_DIST = fromRoot("reports", "2000_team_distribution_before_after.csv");
const OUT_STEP6 = fromRoot("reports", "2000_distribution_warnings.csv");

// ----------------------------------------------------------------------------
// Position grouping for queue prioritisation.
const QB = new Set(["QB"]);
const KEY_DEF = new Set(["DE", "DT", "EDGE", "NT", "CB", "S", "FS", "SS", "LB", "ILB", "OLB", "MLB", "DL", "DB"]);
const SKILL = new Set(["WR", "TE", "RB", "FB", "HB"]);

// ----------------------------------------------------------------------------
// Load BEFORE state, keyed by player_id (first occurrence wins).
function loadBefore() {
  const rows = readCsv(BEFORE_CSV);
  const byId = new Map();
  const byTeam = new Map(); // team_code -> [rows]
  const teamName = new Map(); // team_code -> team_name
  for (const r of rows) {
    if (!byId.has(r.player_id)) byId.set(r.player_id, r);
    if (!byTeam.has(r.team_code)) byTeam.set(r.team_code, []);
    byTeam.get(r.team_code).push(r);
    if (!teamName.has(r.team_code)) teamName.set(r.team_code, r.team_name);
  }
  return { rows, byId, byTeam, teamName };
}

// Authoritative 2000 team names from the team-season registry. The BEFORE csv
// carries MODERN franchise names for relocated/renamed teams (Rams, Raiders,
// Redskins, Chargers), so we must not use it for display. The registry stores
// the historically-correct 2000 name per team_code.
function loadTeamNames() {
  const rows = readCsv(REGISTRY_CSV);
  const byCode = new Map();
  for (const r of rows) {
    if (num(r.season) !== SEASON) continue;
    if (r.team_name) byCode.set(r.team_code, r.team_name);
  }
  return byCode;
}

// Load AFTER state from the 31 exported team JSONs.
function loadAfter() {
  const files = fs
    .readdirSync(TS_DIR)
    .filter((f) => /^2000_[A-Z]{2,3}\.json$/.test(f))
    .sort();
  const teams = [];
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(`${TS_DIR}/${f}`, "utf8"));
    teams.push(j);
  }
  return teams;
}

// ----------------------------------------------------------------------------
// Distribution helpers.
function distStats(overalls) {
  const n = overalls.length;
  if (n === 0) {
    return { n: 0, avg: 0, min: 0, max: 0, p90: 0, p80: 0, band67_71: 0, pct67_71: 0 };
  }
  let sum = 0,
    min = Infinity,
    max = -Infinity,
    p90 = 0,
    p80 = 0,
    band = 0;
  for (const o of overalls) {
    sum += o;
    if (o < min) min = o;
    if (o > max) max = o;
    if (o >= 90) p90++;
    if (o >= 80) p80++;
    if (o >= 67 && o <= 71) band++;
  }
  return {
    n,
    avg: roundTo(sum / n, 1),
    min,
    max,
    p90,
    p80,
    band67_71: band,
    pct67_71: roundTo((band / n) * 100, 1),
  };
}

// ----------------------------------------------------------------------------
// Manual-review queue priority. 1 = do first … 5 = low.
function queuePriority({ position, overall, conf, teamStrength, gamesStarted }) {
  let score = 0;
  if (QB.has(position)) score += 50;
  else if (KEY_DEF.has(position)) score += 22;
  else if (SKILL.has(position)) score += 16;
  else score += 6;
  if (teamStrength >= 80) score += 40; // marquee / very verifiable team
  else if (teamStrength >= 74) score += 18; // playoff-class team
  if (gamesStarted != null && gamesStarted >= 8) score += 25; // recorded start (rare here)
  if (overall >= 85) score += 24;
  else if (overall >= 80) score += 16;
  else if (overall >= 75) score += 8;
  if (conf < 0.4) score += 10; // very thin evidence

  const priority = score >= 80 ? 1 : score >= 55 ? 2 : score >= 38 ? 3 : score >= 22 ? 4 : 5;
  return { score, priority };
}

function confBand(conf) {
  if (conf >= 0.7) return "high";
  if (conf >= 0.5) return "medium";
  return "low";
}

// ----------------------------------------------------------------------------
function run() {
  log.step("Generating 2000 overhaul reports");

  const before = loadBefore();
  const after = loadAfter();
  const teamNames = loadTeamNames(); // 2000-correct names from the registry
  log.info(`BEFORE rows: ${before.rows.length}  |  AFTER teams: ${after.length}`);

  const baRows = []; // player-level before/after
  const distRows = []; // team distribution before/after
  const queueRows = []; // manual review queue
  const summaries = []; // per-team summary objects for markdown

  for (const team of after) {
    const tc = team.teamCode;
    // 2000-correct name from the registry first; fall back to the export's own
    // label, then the BEFORE csv (modern names), then the code.
    const teamName = teamNames.get(tc) || team.team || before.teamName.get(tc) || tc;
    const teamStrength = num(team?.metadata?.teamStrength, 70);
    const rec = team.record || { wins: 0, losses: 0, ties: 0 };
    const players = (team.players || []).slice();

    // AFTER per-player + before/after rows.
    const afterOveralls = [];
    const enriched = [];
    for (const p of players) {
      const id = p.playerId || p.id;
      const b = before.byId.get(id);
      const oldOverall = b ? num(b.overall, null) : null;
      const newOverall = num(p.overall, 0);
      const oldConf = b ? num(b.confidence, null) : null;
      const newConf = num(p.ratingConfidence, null);
      const change = oldOverall == null ? "" : newOverall - oldOverall;
      const isOverride = p.status === "manual_override";

      let reasonForChange = "";
      if (isOverride) {
        reasonForChange = p.ratingReason || "Manual curated override (2000 overhaul)";
      } else if (change !== "" && change !== 0) {
        reasonForChange = "Engine re-derivation after 2000 roster/override changes";
      }

      baRows.push({
        team_code: tc,
        team_name: teamName,
        season: SEASON,
        player_id: id,
        name: p.name,
        position: p.position,
        old_overall: oldOverall == null ? "" : oldOverall,
        new_overall: newOverall,
        change,
        old_confidence: oldConf == null ? "" : oldConf,
        new_confidence: newConf == null ? "" : newConf,
        reason_for_change: reasonForChange,
      });

      afterOveralls.push(newOverall);
      enriched.push({
        id,
        name: p.name,
        position: p.position,
        overall: newOverall,
        conf: newConf == null ? 0 : newConf,
        status: p.status,
        isOverride,
        needsReview: p.needsManualReview === true,
        ratingReason: p.ratingReason || "",
        gamesStarted: p.gamesStarted == null ? null : num(p.gamesStarted, null),
        change,
        oldOverall,
      });

      // Manual-review queue: rows a human should still confirm after the overhaul.
      // Curated overrides are human-set already, so they are excluded. We surface
      // (a) the engine's own needs-review flags, (b) any near-starter-or-better
      // rating resting on thin (low/med-confidence) evidence rather than real
      // production, and (c) a presumed starting QB rated on a position prior. Clear
      // low backups are left off — nobody needs to re-check a 64-rated third-stringer.
      const conf = newConf == null ? 0 : newConf;
      const isQBpos = QB.has(p.position);
      const flagged = p.needsManualReview === true;
      const nearStarterThin = newOverall >= 75 && conf < 0.6;
      const thinStarterQB = isQBpos && newOverall >= 70 && conf < 0.65;
      if (!isOverride && (flagged || nearStarterThin || thinStarterQB)) {
        const { score, priority } = queuePriority({
          position: p.position,
          overall: newOverall,
          conf: newConf == null ? 0 : newConf,
          teamStrength,
          gamesStarted: p.gamesStarted == null ? null : num(p.gamesStarted, null),
        });
        let issue, reason, dataNeeded, suggested;
        if (QB.has(p.position)) {
          issue = `Starting-QB slot rated ${newOverall} on ${confBand(newConf ?? 0)}-confidence evidence`;
          reason = "QB is the most simulation-critical position; the room carried no recorded starts/box score to separate the starter from backups.";
          dataNeeded = "Confirm the 2000 starter (games_started) or apply a curated override; rate the starter, leave backups lower.";
          suggested = teamStrength >= 80 ? 80 : teamStrength >= 74 ? 76 : "";
        } else if (KEY_DEF.has(p.position)) {
          issue = `Defensive starter rated ${newOverall} on ${confBand(newConf ?? 0)}-confidence evidence`;
          reason = "Statless defensive group (no recorded starts/box score) — engine cannot confirm a rating this high without a human check.";
          dataNeeded = "Recorded starts or box score (sacks/INT/tackles), or a curated override for a known starter.";
          suggested = "";
        } else if (SKILL.has(p.position)) {
          issue = `Skill player rated ${newOverall} on ${confBand(newConf ?? 0)}-confidence evidence`;
          reason = "No box-score production on file to confirm a rating this high.";
          dataNeeded = "Box-score stats or recorded starts, or a curated override for a known contributor.";
          suggested = "";
        } else {
          issue = `${p.position || "Player"} rated ${newOverall} on ${confBand(newConf ?? 0)}-confidence evidence`;
          reason = "Engine flagged this rating as unconfirmed (no recorded starts/stats/awards).";
          dataNeeded = "Any recorded starts, box score, or awards, or a curated override if a notable starter.";
          suggested = "";
        }
        queueRows.push({
          _score: score,
          priority,
          player_id: id,
          name: p.name,
          team_code: tc,
          team_name: teamName,
          position: p.position,
          current_overall: newOverall,
          suggested_overall: suggested,
          issue,
          reason,
          data_needed: dataNeeded,
          confidence: confBand(newConf ?? 0),
        });
      }
    }

    // BEFORE distribution for this team (pre-overhaul roster as it stood).
    const beforeOveralls = (before.byTeam.get(tc) || []).map((r) => num(r.overall, 0));
    const dB = distStats(beforeOveralls);
    const dA = distStats(afterOveralls);

    // Most-shared single OVR (for the "no >25% on one number" check).
    const freqA = {};
    for (const o of afterOveralls) freqA[o] = (freqA[o] || 0) + 1;
    const modeEntry = Object.entries(freqA).sort((a, b) => b[1] - a[1])[0] || ["0", "0"];
    const modeVal = Number(modeEntry[0]);
    const modeShare = afterOveralls.length
      ? roundTo((Number(modeEntry[1]) / afterOveralls.length) * 100, 1)
      : 0;

    distRows.push({
      team_code: tc,
      team_name: teamName,
      season: SEASON,
      players_total: dA.n,
      avg_ovr_before: dB.avg,
      avg_ovr_after: dA.avg,
      min_ovr_before: dB.min,
      min_ovr_after: dA.min,
      max_ovr_before: dB.max,
      max_ovr_after: dA.max,
      players_90_plus_before: dB.p90,
      players_90_plus_after: dA.p90,
      players_80_plus_before: dB.p80,
      players_80_plus_after: dA.p80,
      percent_67_to_71_before: dB.pct67_71,
      percent_67_to_71_after: dA.pct67_71,
    });

    summaries.push({ tc, teamName, teamStrength, rec, dA, dB, modeVal, modeShare, enriched });
  }

  // --- sort + write player before/after ------------------------------------
  baRows.sort(
    (a, b) =>
      a.team_code.localeCompare(b.team_code) ||
      b.new_overall - a.new_overall ||
      a.name.localeCompare(b.name)
  );
  writeCsv(OUT_BEFORE_AFTER, baRows, [
    "team_code", "team_name", "season", "player_id", "name", "position",
    "old_overall", "new_overall", "change", "old_confidence", "new_confidence",
    "reason_for_change",
  ]);
  log.ok(`${baRows.length} player rows -> ${OUT_BEFORE_AFTER.split("/").slice(-2).join("/")}`);

  // --- sort + write distribution -------------------------------------------
  distRows.sort((a, b) => b.avg_ovr_after - a.avg_ovr_after || a.team_code.localeCompare(b.team_code));
  writeCsv(OUT_DIST, distRows, [
    "team_code", "team_name", "season", "players_total",
    "avg_ovr_before", "avg_ovr_after", "min_ovr_before", "min_ovr_after",
    "max_ovr_before", "max_ovr_after", "players_90_plus_before", "players_90_plus_after",
    "players_80_plus_before", "players_80_plus_after",
    "percent_67_to_71_before", "percent_67_to_71_after",
  ]);
  log.ok(`${distRows.length} team rows -> ${OUT_DIST.split("/").slice(-2).join("/")}`);

  // --- sort + write manual review queue ------------------------------------
  queueRows.sort(
    (a, b) =>
      a.priority - b.priority ||
      b._score - a._score ||
      a.team_code.localeCompare(b.team_code) ||
      a.name.localeCompare(b.name)
  );
  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of queueRows) {
    tierCounts[r.priority]++;
    delete r._score;
  }
  writeCsv(OUT_QUEUE, queueRows, [
    "priority", "player_id", "name", "team_code", "team_name", "position",
    "current_overall", "suggested_overall", "issue", "reason", "data_needed", "confidence",
  ]);
  log.ok(`${queueRows.length} players queued -> ${OUT_QUEUE.split("/").slice(-2).join("/")}`);
  log.info(
    `queue by priority: P1=${tierCounts[1]} P2=${tierCounts[2]} P3=${tierCounts[3]} P4=${tierCounts[4]} P5=${tierCounts[5]}`
  );

  // --- write team summaries markdown ---------------------------------------
  writeSummaries(summaries);
  log.ok(`team summaries -> ${OUT_SUMMARIES.split("/").slice(-2).join("/")}`);

  // --- Step 6 distribution warnings ----------------------------------------
  writeStep6(summaries);
}

// ----------------------------------------------------------------------------
// Step 6 realism checks (the brief's explicit warn list), scoped to 2000.
function winPct(rec) {
  const g = (rec.wins || 0) + (rec.losses || 0) + (rec.ties || 0);
  return g > 0 ? ((rec.wins || 0) + 0.5 * (rec.ties || 0)) / g : null;
}

function writeStep6(summaries) {
  const rows = [];
  const add = (s, rule, severity, detail) =>
    rows.push({ team_code: s.tc, team_name: s.teamName, season: SEASON, rule, severity, detail });

  let cleanTeams = 0;
  for (const s of summaries) {
    const before = rows.length;
    const wp = winPct(s.rec);
    const recStr = `${s.rec.wins}-${s.rec.losses}${s.rec.ties ? "-" + s.rec.ties : ""}`;

    // 1. >30% of the roster stacked in the 67-71 band.
    if (s.dA.pct67_71 > 30)
      add(s, "band_67_71_over_30", "WARN", `${s.dA.pct67_71}% of roster rated 67-71 (band still broad — confirm it is spread, not stacked)`);
    // 2. >25% sharing one identical OVR.
    if (s.modeShare > 25)
      add(s, "same_overall_over_25", "WARN", `${s.modeShare}% share OVR ${s.modeVal} (${Math.round((s.modeShare / 100) * s.dA.n)}/${s.dA.n})`);
    // 3. No player above 80 at all.
    if (s.dA.max < 80)
      add(s, "no_player_over_80", "WARN", `roster max OVR is ${s.dA.max} — no player above 80`);
    // 4. Playoff-class team (>=.5625 win%) with no 85+ star.
    if (wp != null && wp >= 0.5625 && s.dA.max < 85)
      add(s, "playoff_team_no_85", "WARN", `playoff-class team (${recStr}) tops out at ${s.dA.max} (<85)`);
    // 5. SB-class team (>=.8125 win%) with no 90+ star.
    if (wp != null && wp >= 0.8125 && s.dA.max < 90)
      add(s, "sb_team_no_90", "WARN", `SB-class team (${recStr}) tops out at ${s.dA.max} (<90)`);
    // 6. A recorded starter (>=8 starts) rated like a backup (<=68).
    const startersLow = s.enriched.filter((e) => e.gamesStarted != null && e.gamesStarted >= 8 && e.overall <= 68);
    if (startersLow.length)
      add(s, "starter_rated_like_backup", "WARN", `${startersLow.length} recorded starter(s) rated <=68: ${startersLow.slice(0, 4).map((e) => `${e.name} ${e.overall}`).join(", ")}`);
    // 7. A non-curated, low-confidence player rated like a star (>=85).
    const backupStar = s.enriched.filter((e) => !e.isOverride && e.conf < 0.6 && e.overall >= 85);
    if (backupStar.length)
      add(s, "backup_rated_like_star", "WARN", `${backupStar.length} thin-evidence player(s) rated >=85: ${backupStar.slice(0, 4).map((e) => `${e.name} ${e.overall}`).join(", ")}`);

    if (rows.length === before) cleanTeams++;
  }

  rows.sort((a, b) => a.team_code.localeCompare(b.team_code) || a.rule.localeCompare(b.rule));
  writeCsv(OUT_STEP6, rows, ["team_code", "team_name", "season", "rule", "severity", "detail"]);
  const ruleCounts = {};
  for (const r of rows) ruleCounts[r.rule] = (ruleCounts[r.rule] || 0) + 1;
  log.ok(`${rows.length} Step-6 warning(s) across ${summaries.length - cleanTeams} team(s); ${cleanTeams} clean -> ${OUT_STEP6.split("/").slice(-2).join("/")}`);
  if (rows.length) log.info("by rule: " + Object.entries(ruleCounts).map(([k, v]) => `${k}=${v}`).join("  "));
}

// ----------------------------------------------------------------------------
function writeSummaries(summaries) {
  const L = [];
  L.push("# 2000 NFL Season — Team Rating Summaries");
  L.push("");
  L.push("_Generated by `scripts/report-2000-overhaul.mjs` after the 2000 rating overhaul._");
  L.push("");
  L.push(
    "Ratings were authored individually: stars and clear starters received curated overrides; honest depth was left to the engine. The scale is deliberately tight — 90+ is special, 95+ is rare."
  );
  L.push("");

  // League overview table, sorted by post-overhaul average overall.
  const byAvg = [...summaries].sort(
    (a, b) => b.dA.avg - a.dA.avg || b.teamStrength - a.teamStrength
  );
  L.push("## League overview (after overhaul)");
  L.push("");
  L.push("| Team | Record | Str | Players | Avg | Min | Max | 90+ | 85+ | 80+ | % 67–71 |");
  L.push("|------|--------|-----|---------|-----|-----|-----|-----|-----|-----|---------|");
  for (const s of byAvg) {
    const p85 = s.enriched.filter((e) => e.overall >= 85).length;
    const recStr = `${s.rec.wins}-${s.rec.losses}${s.rec.ties ? "-" + s.rec.ties : ""}`;
    L.push(
      `| ${s.teamName} (${s.tc}) | ${recStr} | ${s.teamStrength} | ${s.dA.n} | ${s.dA.avg} | ${s.dA.min} | ${s.dA.max} | ${s.dA.p90} | ${p85} | ${s.dA.p80} | ${s.dA.pct67_71}% |`
    );
  }
  L.push("");

  // Per-team sections, alphabetical by team code.
  const byTc = [...summaries].sort((a, b) => a.tc.localeCompare(b.tc));
  for (const s of byTc) {
    const recStr = `${s.rec.wins}-${s.rec.losses}${s.rec.ties ? "-" + s.rec.ties : ""}`;
    L.push(`## ${s.teamName} (${s.tc}) — ${SEASON}`);
    L.push("");
    L.push(
      `**Record:** ${recStr} · **Team strength:** ${s.teamStrength} · **Players:** ${s.dA.n} · ` +
        `**Avg OVR:** ${s.dA.avg} (was ${s.dB.avg}) · **Range:** ${s.dA.min}–${s.dA.max} · ` +
        `**90+:** ${s.dA.p90} · **80+:** ${s.dA.p80} · **% in 67–71:** ${s.dA.pct67_71}% (was ${s.dB.pct67_71}%)`
    );
    L.push("");

    // Top of roster by overall.
    const top = [...s.enriched].sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name)).slice(0, 10);
    L.push("**Top of roster:**");
    L.push("");
    L.push("| Player | Pos | OVR | Was | Source |");
    L.push("|--------|-----|-----|-----|--------|");
    for (const e of top) {
      const was = e.oldOverall == null ? "—" : e.oldOverall;
      const src = e.isOverride ? "curated" : "engine";
      L.push(`| ${e.name} | ${e.position} | ${e.overall} | ${was} | ${src} |`);
    }
    L.push("");

    // Notable curated overrides (biggest moves and marquee names).
    const overrides = s.enriched
      .filter((e) => e.isOverride)
      .sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name));
    if (overrides.length) {
      L.push(`**Curated overrides (${overrides.length}):**`);
      L.push("");
      for (const e of overrides) {
        const reason = e.ratingReason.replace(/\s*\[by [^\]]+\]\s*$/, "");
        const delta = e.oldOverall == null ? "" : ` (was ${e.oldOverall})`;
        L.push(`- **${e.name}** ${e.position} — **${e.overall}**${delta}: ${reason}`);
      }
      L.push("");
    }

    // Players still flagged for manual review on this team.
    const flagged = s.enriched.filter((e) => e.needsReview).length;
    if (flagged) {
      L.push(`_${flagged} player(s) still flagged for manual review (see \`2000_manual_review_queue.csv\`)._`);
      L.push("");
    }
  }

  fs.writeFileSync(OUT_SUMMARIES, L.join("\n") + "\n");
}

run();
