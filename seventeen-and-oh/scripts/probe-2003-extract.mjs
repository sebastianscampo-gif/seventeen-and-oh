// Extract every 2003 player from the exported team-season JSONs into one flat
// table: identity + role + key box-score stats + current rating. Serves as both
// the BEFORE snapshot (for the before/after report) and the authoring reference
// for the curated override pass. Also writes a human-readable digest grouped by
// team x position group, sorted by current overall, for hand-authoring.
// Read-only; writes reports/_work/2003_before.csv and reports/_work/2003_digest.txt.

import fs from "node:fs";
import path from "node:path";
import { writeCsv } from "./lib/csv.mjs";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "public", "team-seasons");
const OUTDIR = path.join(ROOT, "reports", "_work");
fs.mkdirSync(OUTDIR, { recursive: true });

const files = fs.readdirSync(DIR).filter((f) => /^2003_/.test(f) && f.endsWith(".json")).sort();
const rows = [];
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  for (const p of d.players) {
    const s = p.stats || {};
    rows.push({
      team_code: d.teamCode,
      team_name: d.team,
      player_id: p.playerId || p.id,
      name: p.name,
      position: p.position,
      games: p.games ?? "",
      games_started: p.gamesStarted ?? "",
      overall: p.overall ?? "",
      status: p.status || "",
      confidence: p.ratingConfidence ?? "",
      needs_review: p.needsManualReview ? "true" : "",
      pass_yds: s.passYds ?? "", pass_td: s.passTd ?? "", pass_int: s.passInt ?? "",
      rush_yds: s.rushYds ?? "", rush_td: s.rushTd ?? "",
      receptions: s.receptions ?? "", rec_yds: s.recYds ?? "", rec_td: s.recTd ?? "",
      sacks: s.sacks ?? "", tackles: s.tackles ?? "", def_int: s.defInt ?? "",
      forced_fumbles: s.forcedFumbles ?? "", fg_pct: s.fgPct ?? "", punt_avg: s.puntAvg ?? "",
    });
  }
}

const cols = [
  "team_code", "team_name", "player_id", "name", "position", "games", "games_started",
  "overall", "status", "confidence", "needs_review",
  "pass_yds", "pass_td", "pass_int", "rush_yds", "rush_td", "receptions", "rec_yds", "rec_td",
  "sacks", "tackles", "def_int", "forced_fumbles", "fg_pct", "punt_avg",
];
writeCsv(path.join(OUTDIR, "2003_before.csv"), rows, cols);
console.log(`extracted ${rows.length} player-rows from ${files.length} teams -> reports/_work/2003_before.csv`);

// quick per-team player counts
const byTeamCount = {};
for (const r of rows) byTeamCount[r.team_code] = (byTeamCount[r.team_code] || 0) + 1;
console.log(Object.entries(byTeamCount).map(([k, v]) => `${k}:${v}`).join("  "));

// --- human-readable digest -------------------------------------------------
const GROUP = {
  QB: "QB", RB: "RB", FB: "RB", HB: "RB", WR: "WR", TE: "TE",
  LT: "OL", LG: "OL", C: "OL", RG: "OL", RT: "OL", T: "OL", G: "OL", OL: "OL", OT: "OL", OG: "OL",
  EDGE: "EDGE", DE: "EDGE", DT: "DT", NT: "DT", DL: "DT",
  LB: "LB", ILB: "LB", OLB: "LB", MLB: "LB",
  CB: "CB", DB: "CB", S: "S", SS: "S", FS: "S",
  K: "K", PK: "K", P: "P", LS: "P",
};
const GORDER = ["QB", "RB", "WR", "TE", "OL", "EDGE", "DT", "LB", "CB", "S", "K", "P"];
const ne = (v) => v != null && String(v).trim() !== "";
function statStr(r) {
  const bits = [];
  if (ne(r.pass_yds)) bits.push(`pass ${r.pass_yds}/${r.pass_td || 0}td/${r.pass_int || 0}int`);
  if (ne(r.rush_yds)) bits.push(`rush ${r.rush_yds}/${r.rush_td || 0}`);
  if (ne(r.receptions) || ne(r.rec_yds)) bits.push(`rec ${r.receptions || 0}-${r.rec_yds || 0}/${r.rec_td || 0}`);
  if (ne(r.sacks)) bits.push(`${r.sacks}sk`);
  if (ne(r.tackles)) bits.push(`${r.tackles}tkl`);
  if (ne(r.def_int)) bits.push(`${r.def_int}int`);
  if (ne(r.forced_fumbles)) bits.push(`${r.forced_fumbles}ff`);
  if (ne(r.fg_pct)) bits.push(`fg ${r.fg_pct}%`);
  if (ne(r.punt_avg)) bits.push(`punt ${r.punt_avg}`);
  return bits.join("  ");
}

const byTeam = {};
for (const r of rows) (byTeam[r.team_code] ||= []).push(r);

const out = [];
for (const code of Object.keys(byTeam).sort()) {
  const list = byTeam[code];
  const tn = list[0].team_name;
  out.push(`\n========== ${code} (${tn}) — ${list.length} players ==========`);
  const groups = {};
  for (const r of list) (groups[GROUP[r.position] || "?"] ||= []).push(r);
  for (const g of GORDER) {
    const ps = groups[g];
    if (!ps) continue;
    ps.sort((a, b) => Number(b.overall) - Number(a.overall));
    out.push(`-- ${g} --`);
    for (const r of ps) {
      const gs = ne(r.games_started) ? `gs${String(r.games_started).padStart(2)}` : "gs ?";
      out.push(
        `  ${String(r.overall).padStart(2)} ${r.position.padEnd(4)} ${gs} ${r.name.padEnd(24)} ${statStr(r)}`
      );
    }
  }
}
fs.writeFileSync(path.join(OUTDIR, "2003_digest.txt"), out.join("\n") + "\n");
console.log(`wrote reports/_work/2003_digest.txt (${out.length} lines)`);
