// Human-readable 1999 roster worksheet for override authoring. Per team, lists
// each player grouped by position group, sorted by current overall, with role
// (games/starts), key box-score stats, and current rating. Writes a text file
// per conference so it can be read in chunks. Read-only.

import fs from "node:fs";
import path from "node:path";
import { readCsv } from "./lib/csv.mjs";

const ROOT = process.cwd();
const work = path.join(ROOT, "reports", "_work");
const rows = readCsv(path.join(work, "1999_before.csv"));

const GROUP = {
  QB: "QB", RB: "RB", FB: "RB", HB: "RB", WR: "WR", TE: "TE",
  LT: "OL", LG: "OL", C: "OL", RG: "OL", RT: "OL", T: "OL", G: "OL", OL: "OL", OT: "OL",
  EDGE: "EDGE", DE: "EDGE", DT: "DT", NT: "DT",
  LB: "LB", ILB: "LB", OLB: "LB", MLB: "LB",
  CB: "CB", DB: "CB", S: "S", SS: "S", FS: "S",
  K: "K", PK: "K", P: "P", LS: "P",
};
const GORDER = ["QB", "RB", "WR", "TE", "OL", "EDGE", "DT", "LB", "CB", "S", "K", "P"];

const byTeam = {};
for (const r of rows) (byTeam[r.team_code] ||= []).push(r);

const ne = (v) => v != null && String(v).trim() !== "";
function statStr(r) {
  const bits = [];
  if (ne(r.pass_yds)) bits.push(`${r.pass_yds}pY/${r.pass_td || 0}pTD/${r.pass_int || 0}int`);
  if (ne(r.rush_yds)) bits.push(`${r.rush_yds}rY/${r.rush_td || 0}rTD`);
  if (ne(r.receptions) || ne(r.rec_yds)) bits.push(`${r.receptions || 0}rec/${r.rec_yds || 0}yd/${r.rec_td || 0}TD`);
  return bits.join(" ");
}

const order = {
  AFC: ["BUF", "MIA", "NE", "NYJ", "IND", "BAL", "CIN", "CLE", "PIT", "TEN", "JAX", "KC", "DEN", "SEA", "LAC", "LV"],
  NFC: ["DAL", "NYG", "PHI", "WAS", "ARI", "MIN", "DET", "GB", "CHI", "TB", "LAR", "CAR", "ATL", "NO", "SF"],
};

for (const [conf, codes] of Object.entries(order)) {
  const out = [];
  for (const code of codes) {
    const list = byTeam[code];
    if (!list) continue;
    const tn = list[0].team_name;
    out.push(`\n========== 1999 ${code}  (${tn})  ${list.length} players ==========`);
    const groups = {};
    for (const r of list) (groups[GROUP[r.position] || "?"] ||= []).push(r);
    for (const g of GORDER) {
      const ps = groups[g];
      if (!ps) continue;
      ps.sort((a, b) => Number(b.overall) - Number(a.overall));
      out.push(`-- ${g} --`);
      for (const r of ps) {
        const gs = ne(r.games_started) ? `gs${r.games_started}` : "gs?";
        const st = statStr(r);
        out.push(
          `  ${String(r.overall).padStart(2)} ${r.position.padEnd(4)} ${r.name.padEnd(24)} g${String(r.games).padStart(2)}/${gs.padEnd(5)} ${st}  [${r.player_id}]`
        );
      }
    }
  }
  const f = path.join(work, `1999_digest_${conf}.txt`);
  fs.writeFileSync(f, out.join("\n") + "\n");
  console.log("wrote", f, out.length, "lines");
}
