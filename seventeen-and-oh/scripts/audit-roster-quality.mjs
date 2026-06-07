// Roster-quality audit (Phase 2, Step 1).
//
// Looks at EVERY team-season and measures how "flat" its OVERALL ratings are:
// how many players share the same number, how many sit at exactly 70, how wide
// the spread is, and how much real evidence (recorded starts, box-score stats,
// awards) was available to separate them. The point is to find rosters where the
// generator gave up and clustered everyone together, not to re-rate anything.
//
// Outputs:
//   reports/suspicious_rosters.csv      (user-specified columns)
//   reports/roster_rating_quality_audit.md  (human-readable summary)
//
// Read-only: never modifies ratings.csv or any processed data.

import fs from "node:fs";
import { readCsv, writeCsv } from "./lib/csv.mjs";
import { fromRoot, num } from "./lib/util.mjs";
import { STAT_COLUMNS } from "./lib/schema.mjs";

const ratings = readCsv(fromRoot("data", "processed", "ratings.csv"));
const playerSeasons = readCsv(fromRoot("data", "processed", "player_seasons.csv"));

// Join player_seasons by composite key so we can read evidence columns.
const psByKey = new Map();
for (const p of playerSeasons) {
  psByKey.set(`${p.player_id}|${num(p.season)}|${p.team_code}`, p);
}

// ---- group ratings by team-season --------------------------------------------
const teamSeasons = new Map(); // `${season}|${team_code}` -> { season, team_code, team_name, rows: [] }
for (const r of ratings) {
  const season = num(r.season);
  const key = `${season}|${r.team_code}`;
  if (!teamSeasons.has(key)) {
    const ps = psByKey.get(`${r.player_id}|${season}|${r.team_code}`);
    teamSeasons.set(key, {
      season,
      team_code: r.team_code,
      team_name: ps?.team || r.team_code,
      rows: [],
    });
  }
  teamSeasons.get(key).rows.push(r);
}

// ---- helpers ------------------------------------------------------------------
function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return 0;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
function mode(arr) {
  const m = new Map();
  let best = null;
  let bestCount = 0;
  for (const v of arr) {
    const c = (m.get(v) || 0) + 1;
    m.set(v, c);
    if (c > bestCount) {
      bestCount = c;
      best = v;
    }
  }
  return { value: best, count: bestCount };
}
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

function hasAnyStat(ps) {
  if (!ps) return false;
  return STAT_COLUMNS.some((c) => ps[c] !== "" && ps[c] != null);
}

// ---- evaluate every team-season ----------------------------------------------
const records = [];
for (const ts of teamSeasons.values()) {
  const { season, team_code, team_name, rows } = ts;
  const n = rows.length;
  const overalls = rows.map((r) => num(r.overall)).filter((v) => v != null);
  if (!overalls.length) continue;

  const md = mode(overalls);
  const minO = Math.min(...overalls);
  const maxO = Math.max(...overalls);
  const avg = Math.round((overalls.reduce((a, b) => a + b, 0) / overalls.length) * 10) / 10;
  const med = median(overalls);
  const spread = maxO - minO;
  const pctSame = pct(md.count, n);
  const at70 = overalls.filter((v) => v >= 69 && v <= 71).length; // 70 +/- rounding
  const pct70 = pct(at70, n);

  // Evidence availability across the roster.
  let gsKnown = 0;
  let withStats = 0;
  let withAwards = 0;
  let lowConf = 0;
  for (const r of rows) {
    const ps = psByKey.get(`${r.player_id}|${season}|${team_code}`);
    if (ps && ps.games_started !== "" && ps.games_started != null) gsKnown++;
    if (hasAnyStat(ps)) withStats++;
    if (ps && (ps.awards || "").trim()) withAwards++;
    if ((r.status || "").includes("low_confidence")) lowConf++;
  }
  const pctGs = pct(gsKnown, n);
  const pctStats = pct(withStats, n);
  const pctAwards = pct(withAwards, n);
  const pctLow = pct(lowConf, n);

  // ---- classify the dominant problem ----
  const problems = [];
  if (pct70 >= 25) problems.push("generic_70_cluster");
  if (pctSame >= 40) problems.push("same_overall_cluster");
  else if (pctSame >= 30) problems.push("weak_separation");
  if (maxO < 80) problems.push("no_clear_starters");
  if (maxO < 85 && n >= 30) problems.push("no_stars");
  if (spread < 12) problems.push("compressed_spread");
  if (pctGs === 0) problems.push("no_recorded_starts");
  if (season >= 1999 && pctStats < 20) problems.push("missing_boxscore_post1999");

  // Suspicion score: weight the things the user cares about most.
  let score = 0;
  score += pct70 * 1.5;
  score += Math.max(0, pctSame - 20) * 1.2;
  score += Math.max(0, 18 - spread) * 2.5;
  score += maxO < 80 ? 25 : maxO < 85 ? 10 : 0;
  score += pctGs === 0 ? 20 : 0;
  score += season >= 1999 && pctStats < 20 ? 10 : 0;
  score = Math.round(score * 10) / 10;

  // Recommended action keys to the dominant cause.
  let action;
  if (pctGs === 0 && pct70 >= 25) {
    action = "Full bio-only import (no starts/stats). Infer role from status+depth+exp; mark low_confidence/needs_review.";
  } else if (season >= 1999 && pctStats < 20 && pctGs === 0) {
    action = "Join nflverse box-score stats for skill players; infer role for the rest.";
  } else if (pctSame >= 40 || spread < 12) {
    action = "Re-generate with role+production separation; verify starters vs depth.";
  } else if (maxO < 85) {
    action = "Verify top players; ensure stars are not capped down to starter range.";
  } else {
    action = "Minor: spot-check separation; likely acceptable.";
  }

  records.push({
    team_code,
    team_name,
    season,
    number_of_players: n,
    average_overall: avg,
    median_overall: med,
    min_overall: minO,
    max_overall: maxO,
    percent_same_rating: pctSame,
    percent_70_overall: pct70,
    likely_problem: problems.join("|") || "none",
    recommended_action: action,
    // extra (not in the user's column list, appended after for analysis)
    _score: score,
    _spread: spread,
    _pct_gs: pctGs,
    _pct_stats: pctStats,
    _pct_awards: pctAwards,
    _pct_low_conf: pctLow,
  });
}

// ---- decide which rosters are "suspicious" ------------------------------------
const isSuspicious = (r) =>
  r.percent_70_overall >= 20 ||
  r.percent_same_rating >= 35 ||
  r._spread < 14 ||
  r.max_overall < 82 ||
  r._pct_gs === 0;

const flagged = records.filter(isSuspicious).sort((a, b) => b._score - a._score);

// ---- write suspicious_rosters.csv (exact user columns) ------------------------
const CSV_COLUMNS = [
  "team_code",
  "team_name",
  "season",
  "number_of_players",
  "average_overall",
  "median_overall",
  "min_overall",
  "max_overall",
  "percent_same_rating",
  "percent_70_overall",
  "likely_problem",
  "recommended_action",
];
const outDir = fromRoot("reports");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
writeCsv(fromRoot("reports", "suspicious_rosters.csv"), flagged, CSV_COLUMNS);

// ---- aggregate stats for the markdown report ---------------------------------
const total = records.length;
const flat70 = records.filter((r) => r.percent_70_overall >= 25).length;
const noStarts = records.filter((r) => r._pct_gs === 0).length;
const someStarts = records.filter((r) => r._pct_gs > 0).length;
const compressed = records.filter((r) => r._spread < 14).length;
const noStarters = records.filter((r) => r.max_overall < 80).length;
const post99NoStats = records.filter((r) => r.season >= 1999 && r._pct_stats < 20).length;
const post99 = records.filter((r) => r.season >= 1999).length;

const bigRosters = records.filter((r) => r.number_of_players >= 40);
const smallRosters = records.filter((r) => r.number_of_players < 40);
const avgSpreadBig = bigRosters.length
  ? Math.round((bigRosters.reduce((a, r) => a + r._spread, 0) / bigRosters.length) * 10) / 10
  : 0;
const avgSpreadSmall = smallRosters.length
  ? Math.round((smallRosters.reduce((a, r) => a + r._spread, 0) / smallRosters.length) * 10) / 10
  : 0;

const summary = {
  total,
  flagged: flagged.length,
  flat70,
  noStarts,
  someStarts,
  compressed,
  noStarters,
  post99,
  post99NoStats,
  bigRosters: bigRosters.length,
  smallRosters: smallRosters.length,
  avgSpreadBig,
  avgSpreadSmall,
};

console.log("Roster-quality audit complete.");
console.log(JSON.stringify(summary, null, 2));
console.log("\nWorst 15 by suspicion score:");
for (const r of flagged.slice(0, 15)) {
  console.log(
    `  ${r.season} ${r.team_code.padEnd(3)} n=${String(r.number_of_players).padStart(2)} ` +
      `spread=${String(r._spread).padStart(2)} %70=${String(r.percent_70_overall).padStart(4)} ` +
      `%same=${String(r.percent_same_rating).padStart(4)} max=${String(r.max_overall).padStart(2)} ` +
      `gs%=${String(r._pct_gs).padStart(3)} :: ${r.likely_problem}`
  );
}

// Expose the computed records for the report writer (written to a temp JSON the
// markdown generator can read, so this script stays single-purpose & cacheable).
fs.writeFileSync(
  fromRoot("reports", ".roster_quality_data.json"),
  JSON.stringify({ summary, flagged: flagged.slice(0, 60), records }, null, 0)
);
