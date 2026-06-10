// One-shot registry patch for the 2002 season overhaul. Line-oriented: only
// rewrites rows whose season column is 2002, leaving every other row byte-
// identical. Sets (a) historically-correct 2002 team names for the four
// franchises whose registry name is the modern one, (b) real 2002 regular-
// season records, and (c) a curated team_strength prior per team. Idempotent.
//
// Run: node scripts/patch-2002-registry.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "data", "team_seasons.csv");

// code -> [wins, losses, ties, team_strength]  (2002 final regular season)
// Records verified against 2002 NFL standings (first 32-team season w/ HOU).
// Sum: 255 W / 255 L / 2 T = 256 games (one tie: PIT 34-34 ATL).
// team_strength is a record-anchored prior nudged by real roster quality
// (e.g. STL 7-9 but elite skill talent -> 78; HOU expansion -> kept low at 58).
const REC = {
  ARI: [5, 11, 0, 64], ATL: [9, 6, 1, 81], BAL: [7, 9, 0, 73], BUF: [8, 8, 0, 76],
  CAR: [7, 9, 0, 73], CHI: [4, 12, 0, 65], CIN: [2, 14, 0, 56], CLE: [9, 7, 0, 79],
  DAL: [5, 11, 0, 66], DEN: [9, 7, 0, 80], DET: [3, 13, 0, 60], GB: [12, 4, 0, 88],
  HOU: [4, 12, 0, 58], IND: [10, 6, 0, 82], JAX: [6, 10, 0, 70], KC: [8, 8, 0, 78],
  LAC: [8, 8, 0, 77], LV: [11, 5, 0, 90], MIA: [9, 7, 0, 81], MIN: [6, 10, 0, 72],
  NE: [9, 7, 0, 80], NO: [9, 7, 0, 78], NYG: [10, 6, 0, 82], NYJ: [9, 7, 0, 80],
  PHI: [12, 4, 0, 89], PIT: [10, 5, 1, 85], SEA: [7, 9, 0, 72], SF: [10, 6, 0, 83],
  LAR: [7, 9, 0, 78], TB: [12, 4, 0, 92], TEN: [11, 5, 0, 87], WAS: [7, 9, 0, 71],
};

// Historically-correct 2002 names (only where the registry currently holds the
// modern name). Codes stay modern/stable; only the displayed team_name changes.
const NAME_2002 = {
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
  if (!line.startsWith("2002,")) return line;
  const f = line.split(",");
  const code = f[1];
  const rec = REC[code];
  if (!rec) { console.warn("no record table entry for 2002", code); return line; }
  seen.add(code);
  if (NAME_2002[code]) f[2] = NAME_2002[code];
  f[3] = String(rec[0]); // wins
  f[4] = String(rec[1]); // losses
  f[5] = String(rec[2]); // ties
  f[6] = String(rec[3]); // team_strength
  patched++;
  return f.join(",");
});

fs.writeFileSync(FILE, out.join(eol));
console.log(`patched ${patched} 2002 registry rows`);
const missing = Object.keys(REC).filter((c) => !seen.has(c));
if (missing.length) console.warn("registry rows NOT found for:", missing.join(", "));
