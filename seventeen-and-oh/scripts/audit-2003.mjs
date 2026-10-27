// Step 1 + Step 2 of the 2003 overhaul: audit the CURRENT (before) ratings and
// roster completeness for every 2003 team, grounded in the box-score snapshot
// reports/_work/2003_before.csv and the corrected registry (records/strength/
// names from data/team_seasons.csv). Read-only; writes four reports:
//
//   reports/2003_suspicious_teams.csv     distribution red-flags per team
//   reports/2003_suspicious_players.csv   players whose rating contradicts their box score
//   reports/2003_roster_completeness.csv  position-group head-count per team
//   reports/2003_rating_audit.md          narrative summary
//
// Run: node scripts/audit-2003.mjs

import fs from "node:fs";
import path from "node:path";
import { readCsv, writeCsv } from "./lib/csv.mjs";

const ROOT = process.cwd();
const WORK = path.join(ROOT, "reports", "_work");
const OUT = path.join(ROOT, "reports");
const rows = readCsv(path.join(WORK, "2003_before.csv"));
const registry = readCsv(path.join(ROOT, "data", "team_seasons.csv")).filter((r) => r.season === "2003");

const regByCode = new Map(registry.map((r) => [r.team_code, r]));
const N = (v) => (v === "" || v == null ? null : Number(v));

// 2003 playoff teams: AFC = NE, KC, IND, BAL, TEN, DEN; NFC = PHI, LAR, CAR, GB, SEA, DAL.
const PLAYOFF = new Set(["NE", "KC", "IND", "BAL", "TEN", "DEN", "PHI", "LAR", "CAR", "GB", "SEA", "DAL"]);
// Teams that indisputably fielded a 90+ superstar in 2003 (MVP/award/All-Pro core):
// IND (Manning co-MVP, Harrison, James), TEN (McNair co-MVP), BAL (Ray Lewis DPOY, Jamal Lewis
// OPOY 2066yds, Ogden), KC (Priest Holmes 27 rush TD record, Gonzalez), MIN (Moss), MIA (Taylor),
// LAR (Holt rec title), SEA (Walter Jones), CAR (Peppers), NE (champion core Brady/Law).
const SB_CLASS = new Set(["IND", "TEN", "BAL", "KC", "MIN", "MIA", "LAR", "SEA", "CAR", "NE"]);

// Position -> roster-completeness bucket.
const BUCKET = {
  QB: "qbs", RB: "rbs", FB: "rbs", HB: "rbs", WR: "wrs", TE: "tes",
  LT: "ol", LG: "ol", C: "ol", RG: "ol", RT: "ol", T: "ol", G: "ol", OL: "ol", OT: "ol", OG: "ol",
  EDGE: "dl", DE: "dl", DT: "dl", NT: "dl", DL: "dl",
  LB: "lb", ILB: "lb", OLB: "lb", MLB: "lb",
  CB: "cb", DB: "cb", S: "s", SS: "s", FS: "s",
  K: "k", PK: "k", P: "p", LS: "p",
};
const CORE = ["qbs", "rbs", "wrs", "tes", "ol", "dl", "lb", "cb", "s"];

// Production-implied OVR floor: the rating a player's box score alone should
// justify. Used to flag undervalued starters/stars (the compression bug).
function productionFloor(r) {
  const pos = r.position;
  const py = N(r.pass_yds), ptd = N(r.pass_td), ry = N(r.rush_yds), rtd = N(r.rush_td);
  const recy = N(r.rec_yds), rectd = N(r.rec_td);
  let floor = 0; const why = [];
  if (pos === "QB") {
    if (py >= 4000 || ptd >= 28) { floor = 88; why.push(`${py}pY/${ptd}pTD`); }
    else if (py >= 3500 || ptd >= 24) { floor = 84; why.push(`${py}pY/${ptd}pTD`); }
    else if (py >= 3000 || ptd >= 20) { floor = 80; why.push(`${py}pY/${ptd}pTD`); }
    else if (py >= 2200) { floor = 76; why.push(`${py}pY (clear starter)`); }
  } else if (pos === "RB") {
    if (ry >= 1500 || (ry >= 1300 && rtd >= 11)) { floor = 90; why.push(`${ry}rY/${rtd}rTD`); }
    else if (ry >= 1200) { floor = 86; why.push(`${ry}rY/${rtd}rTD`); }
    else if (ry >= 1000) { floor = 83; why.push(`${ry}rY/${rtd}rTD`); }
    else if (ry >= 700) { floor = 78; why.push(`${ry}rY (lead back)`); }
    if (N(r.rec_yds) >= 700) { floor = Math.max(floor, 84); why.push(`${recy}recY (dual-threat)`); }
  } else if (pos === "WR") {
    if (recy >= 1400 || rectd >= 12) { floor = 90; why.push(`${recy}recY/${rectd}TD`); }
    else if (recy >= 1100 || rectd >= 10) { floor = 86; why.push(`${recy}recY/${rectd}TD`); }
    else if (recy >= 900) { floor = 82; why.push(`${recy}recY/${rectd}TD`); }
    else if (recy >= 650) { floor = 77; why.push(`${recy}recY (WR2)`); }
  } else if (pos === "TE") {
    if (recy >= 800 || rectd >= 8) { floor = 85; why.push(`${recy}recY/${rectd}TD`); }
    else if (recy >= 550) { floor = 80; why.push(`${recy}recY/${rectd}TD`); }
    else if (recy >= 350) { floor = 76; why.push(`${recy}recY`); }
  }
  return { floor, why: why.join(", ") };
}

const byTeam = {};
for (const r of rows) (byTeam[r.team_code] ||= []).push(r);

const teamReport = [];
const playerReport = [];
const completeness = [];

const codes = Object.keys(byTeam).sort();
for (const code of codes) {
  const list = byTeam[code];
  const reg = regByCode.get(code) || {};
  const teamName = reg.team_name || list[0].team_name;
  const ovrs = list.map((r) => N(r.overall)).filter((v) => v != null);
  const total = ovrs.length;
  const avg = ovrs.reduce((a, b) => a + b, 0) / total;
  const min = Math.min(...ovrs), max = Math.max(...ovrs);
  const band = ovrs.filter((v) => v >= 67 && v <= 71).length;
  const pctBand = (100 * band) / total;
  const counts = {};
  for (const v of ovrs) counts[v] = (counts[v] || 0) + 1;
  const topSame = Math.max(...Object.values(counts));
  const pctSame = (100 * topSame) / total;
  const modeVal = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const flags = [];
  if (pctBand > 30) flags.push(`${pctBand.toFixed(0)}% in 67-71 generic band`);
  if (pctSame > 25) flags.push(`${pctSame.toFixed(0)}% share OVR ${modeVal}`);
  if (max < 80) flags.push(`no player above 80 (max ${max})`);
  if (PLAYOFF.has(code) && max < 85) flags.push(`playoff team but max only ${max}`);
  if (SB_CLASS.has(code) && max < 90) flags.push(`SB-class team but max only ${max}`);
  const action = flags.length
    ? "Author curated overrides for stars + clear starters; let true depth fall to engine."
    : "OK — spot-check only.";
  teamReport.push({
    team_code: code, team_name: teamName, season: 2003,
    players_total: total,
    average_ovr: avg.toFixed(1),
    min_ovr: min, max_ovr: max,
    percent_67_to_71: pctBand.toFixed(1),
    percent_same_rating: pctSame.toFixed(1),
    issue: flags.join("; ") || "none",
    recommended_action: action,
  });

  const b = Object.fromEntries(["qbs", "rbs", "wrs", "tes", "ol", "dl", "lb", "cb", "s", "k", "p"].map((k) => [k, 0]));
  for (const r of list) { const bk = BUCKET[r.position]; if (bk) b[bk]++; }
  const missing = CORE.filter((k) => b[k] === 0);
  let status = "ok";
  if (missing.length) status = `incomplete (missing ${missing.join("/")})`;
  else if (total < 30) status = "thin (curated/demo roster)";
  else if (b.k === 0 || b.p === 0) status = "ok (no K/P listed)";
  completeness.push({
    team_code: code, team_name: teamName, season: 2003, total_players: total,
    qbs: b.qbs, rbs: b.rbs, wrs: b.wrs, tes: b.tes,
    offensive_linemen: b.ol, defensive_linemen: b.dl, linebackers: b.lb,
    cornerbacks: b.cb, safeties: b.s, kickers: b.k, punters: b.p,
    missing_position_groups: missing.join("/") || "none",
    roster_status: status,
  });

  for (const r of list) {
    const ovr = N(r.overall);
    const { floor, why } = productionFloor(r);
    if (floor && ovr != null && ovr < floor - 2) {
      playerReport.push({
        player_id: r.player_id, name: r.name, team_code: code, team_name: teamName,
        season: 2003, position: r.position, current_overall: ovr,
        issue: `production-implied floor ${floor}, rated ${ovr} (${ovr - floor})`,
        recommended_action: `override to ~${floor} (${why})`,
      });
    } else if (ovr != null && ovr >= 67 && ovr <= 71 && N(r.games_started) != null && N(r.games_started) >= 14) {
      playerReport.push({
        player_id: r.player_id, name: r.name, team_code: code, team_name: teamName,
        season: 2003, position: r.position, current_overall: ovr,
        issue: `full-time starter (${r.games_started} starts) stuck in 67-71 generic band`,
        recommended_action: "review role; override to a starter-appropriate OVR (75-84)",
      });
    }
  }
}

teamReport.sort((a, b) =>
  (b.issue === "none" ? 0 : b.issue.split(";").length) - (a.issue === "none" ? 0 : a.issue.split(";").length) ||
  a.team_code.localeCompare(b.team_code));
playerReport.sort((a, b) => a.team_code.localeCompare(b.team_code) || a.position.localeCompare(b.position) || a.current_overall - b.current_overall);
completeness.sort((a, b) => a.team_code.localeCompare(b.team_code));

writeCsv(path.join(OUT, "2003_suspicious_teams.csv"), teamReport,
  ["team_code", "team_name", "season", "players_total", "average_ovr", "min_ovr", "max_ovr", "percent_67_to_71", "percent_same_rating", "issue", "recommended_action"]);
writeCsv(path.join(OUT, "2003_suspicious_players.csv"), playerReport,
  ["player_id", "name", "team_code", "team_name", "season", "position", "current_overall", "issue", "recommended_action"]);
writeCsv(path.join(OUT, "2003_roster_completeness.csv"), completeness,
  ["team_code", "team_name", "season", "total_players", "qbs", "rbs", "wrs", "tes", "offensive_linemen", "defensive_linemen", "linebackers", "cornerbacks", "safeties", "kickers", "punters", "missing_position_groups", "roster_status"]);

const flagged = teamReport.filter((t) => t.issue !== "none");
const md = [];
md.push("# 2003 Rating Audit — Before State\n");
md.push(`Generated from \`reports/_work/2003_before.csv\` (${rows.length} player-rows, ${codes.length} teams) against the corrected 2003 registry.\n`);
md.push("## Summary\n");
md.push(`- **${flagged.length} of ${codes.length} teams** trip at least one distribution red-flag.`);
md.push(`- **${playerReport.length} players** carry a rating that contradicts their own 2003 box score (or are full-time starters stuck in the 67-71 band).`);
md.push(`- The dominant failure mode is **rating compression**: position groups with no recorded starts/stats (all of defense, the OL, and specialists — defensive box scores and awards are empty for 2003) collapse onto a neutral ~68 base, so genuine starters and a few stars are indistinguishable from deep backups.`);
md.push(`- A secondary failure mode is **flat depth**: the engine's per-player depth dispersal is currently scoped to 1999-2002 only, so 2003's statless depth stacks onto a single team-scaled number. The overhaul extends the dispersal set to 2003.`);
md.push(`- Before this pass the 2003 registry carried a flat team_strength of 70 for all 32 teams (now corrected) and **no curated overrides** exist for 2003, so every rating is engine-generated.\n`);
md.push("## Teams flagged (worst first)\n");
md.push("| Team | Players | Avg | Min | Max | %67–71 | %same | Issue |");
md.push("|------|--------:|----:|----:|----:|-------:|------:|-------|");
for (const t of flagged) md.push(`| ${t.team_code} ${t.team_name} | ${t.players_total} | ${t.average_ovr} | ${t.min_ovr} | ${t.max_ovr} | ${t.percent_67_to_71}% | ${t.percent_same_rating}% | ${t.issue} |`);
md.push("\n## Teams clean on distribution flags\n");
const clean = teamReport.filter((t) => t.issue === "none");
md.push(clean.length ? clean.map((t) => `\`${t.team_code}\` (${t.team_name}, max ${t.max_ovr})`).join(", ") : "_none_");
md.push("\n\n## Most undervalued players (top 25 by gap)\n");
md.push("| Player | Team | Pos | OVR | Issue |");
md.push("|--------|------|-----|----:|-------|");
const topUnder = [...playerReport]
  .map((p) => ({ ...p, gap: (p.issue.match(/\((-?\d+)\)/) ? Number(RegExp.$1) : 0) }))
  .sort((a, b) => a.gap - b.gap)
  .slice(0, 25);
for (const p of topUnder) md.push(`| ${p.name} | ${p.team_code} | ${p.position} | ${p.current_overall} | ${p.issue} |`);
md.push("\n## Recommended action\n");
md.push("Author a curated 2003 override set (stars + clear starters, ~18–26 per team) resolved to the real GSIS player_ids by name match, with heavy coverage of defense / OL / specialists (which the engine cannot grade from empty box scores); let true depth fall to the engine. Append 2003-specific aging-legend caps so season-agnostic legend rows don't leak peak value (Rice, Bruce Smith, Larry Allen, Ogden, Seau, Woodson, Randle, J.Taylor, Z.Thomas). Extend the engine's depth dispersal to include 2003 so statless backups don't stack on one number. Then regenerate, apply overrides, and re-export.\n");
fs.writeFileSync(path.join(OUT, "2003_rating_audit.md"), md.join("\n") + "\n");

console.log(`teams flagged: ${flagged.length}/${codes.length}`);
console.log(`suspicious players: ${playerReport.length}`);
console.log("wrote reports/2003_suspicious_teams.csv, _suspicious_players.csv, _roster_completeness.csv, _rating_audit.md");
