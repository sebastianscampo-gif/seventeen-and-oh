// One-shot registry patch for the 2004 season overhaul. Line-oriented: only
// rewrites rows whose season column is 2004, leaving every other row byte-
// identical. Sets (a) historically-correct 2004 team names for the four
// franchises whose registry name is the modern one, (b) real 2004 regular-
// season records, and (c) a curated team_strength prior per team. Idempotent.
//
// Run: node scripts/patch-2004-registry.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "data", "team_seasons.csv");

// code -> [wins, losses, ties, team_strength]  (2004 final regular season)
// Records verified against 2004 NFL standings. 256 W / 256 L / 0 T = 256 games.
// team_strength is a record-anchored prior nudged by real roster quality:
//   PIT 15-1 elite D + run game -> 90; NE 14-2 repeat SB champ -> 90; PHI 13-3
//   SB runner-up -> 88; IND 12-4 Manning 49-TD MVP -> 88; SD 12-4 breakout -> 84;
//   BAL 9-7 but Ed Reed DPOY + elite D -> 80; KC 7-9 elite O / no D -> 75;
//   CAR 7-9 injury-wrecked SB hangover but real talent -> 76; SF 2-14 collapse -> 58.
const REC = {
  ARI: [6, 10, 0, 68], ATL: [11, 5, 0, 82], BAL: [9, 7, 0, 80], BUF: [9, 7, 0, 77],
  CAR: [7, 9, 0, 76], CHI: [5, 11, 0, 67], CIN: [8, 8, 0, 74], CLE: [4, 12, 0, 64],
  DAL: [6, 10, 0, 72], DEN: [10, 6, 0, 80], DET: [6, 10, 0, 70], GB: [10, 6, 0, 80],
  HOU: [7, 9, 0, 66], IND: [12, 4, 0, 88], JAX: [9, 7, 0, 76], KC: [7, 9, 0, 75],
  LAC: [12, 4, 0, 84], LV: [5, 11, 0, 68], MIA: [4, 12, 0, 64], MIN: [8, 8, 0, 78],
  NE: [14, 2, 0, 90], NO: [8, 8, 0, 73], NYG: [6, 10, 0, 70], NYJ: [10, 6, 0, 80],
  PHI: [13, 3, 0, 88], PIT: [15, 1, 0, 90], SEA: [9, 7, 0, 78], SF: [2, 14, 0, 58],
  LAR: [8, 8, 0, 76], TB: [5, 11, 0, 70], TEN: [5, 11, 0, 71], WAS: [6, 10, 0, 70],
};

// Historically-correct 2004 names (only where the registry currently holds the
// modern name). Codes stay modern/stable; only the displayed team_name changes.
const NAME_2004 = {
  LAC: "San Diego Chargers",
  LV: "Oakland Raiders",
  WAS: "Washington Redskins",
  LAR: "St. Louis Rams",
};

const raw = fs.readFileSync(FILE, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(/\r?\n/);

let patched = 0;
const seen = new Set();
const out = lines.map((line) => {
  if (!line.startsWith("2004,")) return line;
  const f = line.split(",");
  const code = f[1];
  const rec = REC[code];
  if (!rec) { console.warn("no record table entry for 2004", code); return line; }
  seen.add(code);
  if (NAME_2004[code]) f[2] = NAME_2004[code];
  f[3] = String(rec[0]); // wins
  f[4] = String(rec[1]); // losses
  f[5] = String(rec[2]); // ties
  f[6] = String(rec[3]); // team_strength
  patched++;
  return f.join(",");
});

fs.writeFileSync(FILE, out.join(eol));
console.log(`patched ${patched} 2004 registry rows`);
const missing = Object.keys(REC).filter((c) => !seen.has(c));
if (missing.length) console.warn("registry rows NOT found for:", missing.join(", "));
