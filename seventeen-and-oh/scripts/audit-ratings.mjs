// audit-ratings.mjs
// Consistency checker + inflation/deflation auditor for the 17-0 rating system.
//
// Reads the processed rating data and cross-checks every player-season against
// the rating scale, the position profiles, award signals, and box-score
// production. It NEVER mutates the data — it only reports. Run it before and
// after a regeneration to see what changed.
//
// Outputs (all under /reports):
//   rating_audit_summary.md   human-readable overview + distributions
//   rating_errors.csv         hard problems (must fix)
//   rating_warnings.csv       soft problems (should review)
//   overrated_players.csv     ratings the evidence does not support (too high)
//   underrated_players.csv    ratings the evidence does not support (too low)
//
// Run:  node scripts/audit-ratings.mjs   (or: npm run data:audit)

import fs from "node:fs";
import { readCsv, writeCsv } from "./lib/csv.mjs";
import {
  POSITIONS, POSITION_GROUP, POSITION_PROFILE, SIDE_OF,
  ATTRIBUTE_FIELDS, RATING_FIELDS, OVERALL_FLOOR, RATING_MIN, RATING_MAX,
  isGeneratedStatus,
} from "./lib/schema.mjs";
import { fromRoot, num, list, log } from "./lib/util.mjs";

const REPORTS = fromRoot("reports");

// ---------------------------------------------------------------------------
// Rating scale (matches the documented 17-0 scale).
// ---------------------------------------------------------------------------
const SCALE_BANDS = [
  [98, 99, "All-time legendary season"],
  [95, 97, "MVP / DPOY / elite First-Team All-Pro"],
  [90, 94, "Star / strong All-Pro"],
  [85, 89, "Very good starter"],
  [80, 84, "Solid starter"],
  [75, 79, "Average starter"],
  [70, 74, "Rotation / below-average starter"],
  [65, 69, "Backup-level"],
  [40, 64, "Depth / weak backup"],
];

// Healthy share of the *whole* dataset that should sit at 90+. Most rows are
// depth players, so this is intentionally tiny.
const HEALTHY_90_SHARE = 0.01; // 1% of all rated rows
const ELITE_CLUSTER_90 = 7; // >=7 90+ players on one team-season is suspicious
const ELITE_CLUSTER_95 = 3; // >=3 95+ players on one team-season is suspicious

// Award -> the floor a player should sit at the season they earned it. These
// are FLOORS used to catch deflation, not hard targets.
const AWARD_FLOOR = [
  { match: ["mvp", "most valuable"], floor: 93, label: "MVP" },
  { match: ["offensive player of the year", "opoy"], floor: 92, label: "OPOY" },
  { match: ["defensive player of the year", "dpoy"], floor: 92, label: "DPOY" },
  { match: ["first-team all-pro", "first team all-pro", "1st team all-pro", "all-pro first"], floor: 89, label: "First-Team All-Pro" },
  { match: ["second-team all-pro", "second team all-pro", "2nd team all-pro"], floor: 84, label: "Second-Team All-Pro" },
  { match: ["all-pro", "all pro"], floor: 86, label: "All-Pro" },
  { match: ["pro bowl", "pro-bowl"], floor: 82, label: "Pro Bowl" },
];

function awardFloor(awards) {
  let best = null;
  for (const raw of awards) {
    const a = String(raw).toLowerCase();
    for (const t of AWARD_FLOOR) {
      if (t.match.some((m) => a.includes(m))) {
        if (!best || t.floor > best.floor) best = t;
        break;
      }
    }
  }
  return best; // {floor,label} | null
}

// "Star-season" production thresholds by group. Hitting one implies a player
// was clearly above an average starter that year (=> a deflated overall is a
// red flag). Only *counting* stats are used: a rate stat (passer rating, FG%)
// can spike on a tiny garbage-time sample, so volume-based counting stats are
// self-gating and avoid flagging mop-up backups as underrated stars.
const STAR_STATS = {
  QB: [["pass_yds", 4000], ["pass_td", 30]],
  RB: [["rush_yds", 1300], ["rush_td", 13]],
  WR: [["rec_yds", 1200], ["rec_td", 11]],
  TE: [["rec_yds", 850], ["rec_td", 8]],
  EDGE: [["sacks", 12]],
  DL: [["sacks", 9]],
  LB: [["tackles", 140], ["def_int", 5]],
  CB: [["def_int", 7]],
  S: [["def_int", 6]],
  K: [["fg_made", 32]],
  P: [],
};

// A high scouting prior is a legitimate justification for a high overall (the
// curated team-seasons elevate clear all-time greats via scout_grade rather
// than box-score awards). Treat it as evidence so the auditor does not flag
// e.g. Walter Payton or Patrick Mahomes as "overrated".
const HIGH_SCOUT = 85;

function starStat(group, stats) {
  const defs = STAR_STATS[group] || [];
  for (const [col, thr] of defs) {
    const v = num(stats[col]);
    if (v != null && v >= thr) return { col, value: v, threshold: thr };
  }
  return null;
}

function band(overall) {
  for (const [lo, hi, label] of SCALE_BANDS) if (overall >= lo && overall <= hi) return label;
  return "Below scale";
}

function run() {
  log.step("Auditing ratings");
  fs.mkdirSync(REPORTS, { recursive: true });

  const ratings = readCsv(fromRoot("data", "processed", "ratings.csv"));
  const playerSeasons = readCsv(fromRoot("data", "processed", "player_seasons.csv"));
  if (ratings.length === 0) {
    log.warn("No ratings.csv — run generate-ratings first.");
    return;
  }

  const psByKey = new Map();
  for (const p of playerSeasons) psByKey.set(`${p.player_id}|${num(p.season)}|${p.team_code}`, p);

  const errors = [];
  const warnings = [];
  const overrated = [];
  const underrated = [];

  const pushErr = (r, check, detail) =>
    errors.push({ player_id: r.player_id, season: r.season, team_code: r.team_code, check, detail, overall: r.overall });
  const pushWarn = (r, check, detail) =>
    warnings.push({ player_id: r.player_id, season: r.season, team_code: r.team_code, check, detail, overall: r.overall });

  // --- distributions / tallies -------------------------------------------
  const N = ratings.length;
  const bandCount = {};
  const statusCount = {};
  const sourceCount = {};
  let sum = 0;
  let ge90 = 0, ge95 = 0, ge98 = 0;
  const ninetyPlusByTs = {};
  const seenKeys = new Set();
  let dupes = 0;

  for (const r of ratings) {
    const key = `${r.player_id}|${num(r.season)}|${r.team_code}`;
    const p = psByKey.get(key);
    const pos = p?.position || "";
    const group = POSITION_GROUP[pos];
    const overall = num(r.overall);
    const awards = list(p?.awards);
    const stats = p || {};

    // ---- structural integrity (errors) ----
    if (seenKeys.has(key)) { dupes++; pushErr(r, "duplicate_player_season", `repeated ${key}`); }
    seenKeys.add(key);

    if (overall == null) pushErr(r, "missing_overall", "overall is blank");
    if (pos && !POSITIONS.includes(pos)) pushErr(r, "invalid_position", `position "${pos}" not in canonical set`);
    if (!r.status) pushErr(r, "missing_status", "no rating status");
    if (!r.rating_source) pushErr(r, "missing_source", "no rating source");
    if (r.rating_confidence === "" || r.rating_confidence == null) pushErr(r, "missing_confidence", "no rating confidence");

    if (overall != null && overall > RATING_MAX) pushErr(r, "overall_above_max", `${overall} > ${RATING_MAX}`);
    if (overall != null && overall < OVERALL_FLOOR && isGeneratedStatus(r.status)) pushErr(r, "overall_below_floor", `${overall} < ${OVERALL_FLOOR}`);

    // attribute bounds
    for (const f of RATING_FIELDS) {
      const v = num(r[f]);
      if (v != null && (v > RATING_MAX || v < RATING_MIN)) pushErr(r, "attribute_out_of_range", `${f}=${v}`);
    }

    if (overall == null || !group) {
      // can't run scale checks without an overall + known group
      if (overall != null) { sum += overall; bandCount[band(overall)] = (bandCount[band(overall)] || 0) + 1; }
      statusCount[r.status] = (statusCount[r.status] || 0) + 1;
      sourceCount[r.rating_source] = (sourceCount[r.rating_source] || 0) + 1;
      continue;
    }

    sum += overall;
    bandCount[band(overall)] = (bandCount[band(overall)] || 0) + 1;
    statusCount[r.status] = (statusCount[r.status] || 0) + 1;
    sourceCount[r.rating_source] = (sourceCount[r.rating_source] || 0) + 1;
    if (overall >= 90) { ge90++; ninetyPlusByTs[`${num(r.season)}_${r.team_code}`] = (ninetyPlusByTs[`${num(r.season)}_${r.team_code}`] || 0) + 1; }
    if (overall >= 95) ge95++;
    if (overall >= 98) ge98++;

    // ---- key-attribute support (warnings) ----
    const profile = POSITION_PROFILE[group];
    if (profile) {
      const keyVals = profile.key.map((a) => num(r[a])).filter((v) => v != null);
      const missingKey = profile.key.filter((a) => num(r[a]) == null);
      if (missingKey.length) pushWarn(r, "missing_key_attribute", `${pos} missing key attr(s): ${missingKey.join(", ")}`);
      if (keyVals.length) {
        const maxKey = Math.max(...keyVals);
        if (overall - maxKey > 12) pushWarn(r, "overall_exceeds_key_attrs", `overall ${overall} but best key attr ${maxKey} (gap ${overall - maxKey})`);
      }
    }

    // ---- cross-side attribute bleed (warnings) ----
    const side = SIDE_OF[pos];
    if (side === "DEF") {
      if (num(r.pass_rating) >= 55 || num(r.receiving) >= 55)
        pushWarn(r, "offensive_attrs_on_defender", `pass_rating=${r.pass_rating} receiving=${r.receiving}`);
    }
    if (side === "OFF" && group !== "QB") {
      if (num(r.pass_rush) >= 55 || num(r.coverage) >= 55)
        pushWarn(r, "defensive_attrs_on_offense", `pass_rush=${r.pass_rush} coverage=${r.coverage}`);
    }
    if (group === "OL" && num(r.receiving) >= 55)
      pushWarn(r, "skill_attrs_on_lineman", `receiving=${r.receiving}`);

    // ---- evidence signals ----
    const gs = num(stats.games_started);
    const scout = num(stats.scout_grade);
    const af = awardFloor(awards);
    const ss = starStat(group, stats);
    const highScout = scout != null && scout >= HIGH_SCOUT;
    // A high overall is "justified" if any strong signal supports it.
    const justified = !!af || !!ss || highScout;

    // ---- OVERRATED detection ----
    // High overall that NO signal (award, star production, or scouting prior)
    // supports. With the curated scout_grade elevations excluded, this should
    // be near-empty in healthy data.
    if (overall >= 90 && !justified && isGeneratedStatus(r.status)) {
      overrated.push(row(r, p, pos, overall, 84,
        `Elite ${overall} with no award, star production, or scouting prior to justify it`, "medium"));
    } else if (overall >= 85 && gs != null && gs <= 2 && !justified) {
      overrated.push(row(r, p, pos, overall, 72,
        `Backup-level role (${gs} starts) rated ${overall} like a starter`, "high"));
    } else if (overall >= 88 && !justified && gs != null && gs < 8 && isGeneratedStatus(r.status)) {
      overrated.push(row(r, p, pos, overall, 82,
        `${overall} with only ${gs} starts and no award/production/scouting support`, "medium"));
    }

    // ---- UNDERRATED detection ----
    // Strong signal but the overall sits below where the scale says it should.
    if (af && overall < af.floor - 1) {
      const rec = Math.min(99, Math.max(af.floor, overall + 4));
      underrated.push(row(r, p, pos, overall, rec,
        `${af.label} season rated ${overall}; award implies >= ${af.floor}`,
        overall < af.floor - 8 ? "high" : "medium"));
    } else if (ss && overall < 84) {
      // Counting-stat star season (self-gating volume) rated like a mere starter.
      const rec = Math.min(94, Math.max(85, overall + 8));
      underrated.push(row(r, p, pos, overall, rec,
        `Star production (${ss.col} ${ss.value} >= ${ss.threshold}) rated only ${overall}`,
        overall < 78 ? "high" : "medium"));
    } else if (gs != null && gs >= 14 && overall < 68 && isGeneratedStatus(r.status)) {
      // Full-time starter crushed into depth territory — the classic missing-data deflation.
      underrated.push(row(r, p, pos, overall, 74,
        `Full-season starter (${gs} starts) rated ${overall} — likely missing-data deflation`,
        "medium"));
    }
  }

  // ---- dataset-wide checks ----
  const datasetNotes = [];
  if (ge90 / N > HEALTHY_90_SHARE)
    datasetNotes.push(`INFLATION: ${ge90} (${((ge90 / N) * 100).toFixed(2)}%) rows are 90+, above the ${(HEALTHY_90_SHARE * 100).toFixed(1)}% healthy ceiling.`);
  else
    datasetNotes.push(`90+ rows: ${ge90} (${((ge90 / N) * 100).toFixed(2)}%) — within the healthy <=${(HEALTHY_90_SHARE * 100).toFixed(1)}% band.`);

  for (const [ts, c] of Object.entries(ninetyPlusByTs)) {
    if (c >= ELITE_CLUSTER_90) {
      warnings.push({ player_id: "(team-season)", season: ts.split("_")[0], team_code: ts.split("_")[1], check: "elite_cluster", detail: `${c} players rated 90+ on one team-season`, overall: "" });
    }
  }

  // ---- write CSV reports ----
  fs.mkdirSync(REPORTS, { recursive: true });
  writeCsv(`${REPORTS}/rating_errors.csv`, errors, ["player_id", "season", "team_code", "check", "detail", "overall"]);
  writeCsv(`${REPORTS}/rating_warnings.csv`, warnings, ["player_id", "season", "team_code", "check", "detail", "overall"]);
  const overrCols = ["player_id", "name", "team_code", "season", "position", "current_overall", "recommended_overall", "reason", "confidence"];
  // de-dup + sort by gap
  overrated.sort((a, b) => (b.current_overall - b.recommended_overall) - (a.current_overall - a.recommended_overall));
  underrated.sort((a, b) => (b.recommended_overall - b.current_overall) - (a.recommended_overall - a.current_overall));
  writeCsv(`${REPORTS}/overrated_players.csv`, overrated, overrCols);
  writeCsv(`${REPORTS}/underrated_players.csv`, underrated, overrCols);

  // ---- summary markdown ----
  const meanOverall = (sum / N).toFixed(1);
  const lines = [];
  lines.push(`# Rating Audit Summary`);
  lines.push("");
  lines.push(`_Generated ${new Date().toISOString()} by \`scripts/audit-ratings.mjs\`. Read-only; the data was not modified._`);
  lines.push("");
  lines.push(`- **Rated player-seasons:** ${N.toLocaleString()}`);
  lines.push(`- **Mean overall:** ${meanOverall}`);
  lines.push(`- **Errors:** ${errors.length}  |  **Warnings:** ${warnings.length}`);
  lines.push(`- **Overrated flags:** ${overrated.length}  |  **Underrated flags:** ${underrated.length}`);
  lines.push(`- **Duplicate player-seasons:** ${dupes}`);
  lines.push("");
  lines.push(`## Rating-scale distribution`);
  lines.push("");
  lines.push(`| Band | Meaning | Count | Share |`);
  lines.push(`| ---: | --- | ---: | ---: |`);
  for (const [lo, hi, label] of SCALE_BANDS) {
    const c = bandCount[label] || 0;
    lines.push(`| ${lo}–${hi} | ${label} | ${c.toLocaleString()} | ${((c / N) * 100).toFixed(1)}% |`);
  }
  lines.push("");
  lines.push(`90+: **${ge90}** (${((ge90 / N) * 100).toFixed(2)}%) · 95+: **${ge95}** (${((ge95 / N) * 100).toFixed(2)}%) · 98+: **${ge98}** (${((ge98 / N) * 100).toFixed(2)}%)`);
  lines.push("");
  for (const n of datasetNotes) lines.push(`> ${n}`);
  lines.push("");
  lines.push(`## By status`);
  lines.push("");
  lines.push(`| Status | Count | Share |`);
  lines.push(`| --- | ---: | ---: |`);
  for (const [k, v] of Object.entries(statusCount).sort((a, b) => b[1] - a[1]))
    lines.push(`| ${k} | ${v.toLocaleString()} | ${((v / N) * 100).toFixed(1)}% |`);
  lines.push("");
  lines.push(`## By source`);
  lines.push("");
  lines.push(`| Source | Count | Share |`);
  lines.push(`| --- | ---: | ---: |`);
  for (const [k, v] of Object.entries(sourceCount).sort((a, b) => b[1] - a[1]))
    lines.push(`| ${k} | ${v.toLocaleString()} | ${((v / N) * 100).toFixed(1)}% |`);
  lines.push("");
  lines.push(`## Error checks`);
  lines.push("");
  const errByCheck = tally(errors, "check");
  if (Object.keys(errByCheck).length === 0) lines.push(`No errors. ✓`);
  else { lines.push(`| Check | Count |`); lines.push(`| --- | ---: |`); for (const [k, v] of Object.entries(errByCheck).sort((a, b) => b[1] - a[1])) lines.push(`| ${k} | ${v} |`); }
  lines.push("");
  lines.push(`## Warning checks`);
  lines.push("");
  const warnByCheck = tally(warnings, "check");
  if (Object.keys(warnByCheck).length === 0) lines.push(`No warnings. ✓`);
  else { lines.push(`| Check | Count |`); lines.push(`| --- | ---: |`); for (const [k, v] of Object.entries(warnByCheck).sort((a, b) => b[1] - a[1])) lines.push(`| ${k} | ${v} |`); }
  lines.push("");
  lines.push(`## Top underrated (by gap)`);
  lines.push("");
  lines.push(sampleTable(underrated.slice(0, 15)));
  lines.push("");
  lines.push(`## Top overrated (by gap)`);
  lines.push("");
  lines.push(overrated.length ? sampleTable(overrated.slice(0, 15)) : "_None flagged._");
  lines.push("");
  lines.push(`Full lists: \`reports/underrated_players.csv\`, \`reports/overrated_players.csv\`, \`reports/rating_errors.csv\`, \`reports/rating_warnings.csv\`.`);
  lines.push("");
  fs.writeFileSync(`${REPORTS}/rating_audit_summary.md`, lines.join("\n"));

  log.ok(`audit complete: ${errors.length} errors, ${warnings.length} warnings, ${overrated.length} overrated, ${underrated.length} underrated`);
  log.info(`mean overall ${meanOverall} · 90+ ${ge90} (${((ge90 / N) * 100).toFixed(2)}%) · reports in /reports`);
}

function row(r, p, pos, current, recommended, reason, confidence) {
  return {
    player_id: r.player_id,
    name: p?.name || r.player_id,
    team_code: r.team_code,
    season: r.season,
    position: pos,
    current_overall: current,
    recommended_overall: recommended,
    reason,
    confidence,
  };
}

function tally(arr, field) {
  const out = {};
  for (const x of arr) out[x[field]] = (out[x[field]] || 0) + 1;
  return out;
}

function sampleTable(rows) {
  if (!rows.length) return "_None flagged._";
  const out = [`| Player | Pos | Season | Team | Current | Rec. | Conf. | Reason |`, `| --- | --- | ---: | --- | ---: | ---: | --- | --- |`];
  for (const r of rows) out.push(`| ${r.name} | ${r.position} | ${r.season} | ${r.team_code} | ${r.current_overall} | ${r.recommended_overall} | ${r.confidence} | ${r.reason} |`);
  return out.join("\n");
}

run();
