// One-shot registry patch for the 1999 season overhaul. Line-oriented: only
// rewrites rows whose season column is 1999, leaving every other row byte-
// identical. Sets (a) historically-correct 1999 team names for the four
// franchises whose registry name is the modern one, (b) real 1999 regular-
// season records, and (c) a curated team_strength prior per team. Idempotent.
//
// Run: node scripts/patch-1999-registry.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "data", "team_seasons.csv");

// code -> [wins, losses, ties, team_strength]  (1999 final regular season)
const REC = {
  ARI: [6, 10, 0, 69], ATL: [5, 11, 0, 68], BAL: [8, 8, 0, 76], BUF: [11, 5, 0, 84],
  CAR: [8, 8, 0, 74], CHI: [6, 10, 0, 69], CIN: [4, 12, 0, 64], CLE: [2, 14, 0, 58],
  DAL: [8, 8, 0, 76], DEN: [6, 10, 0, 72], DET: [8, 8, 0, 75], GB: [8, 8, 0, 75],
  IND: [13, 3, 0, 88], JAX: [14, 2, 0, 92], KC: [9, 7, 0, 77], LAC: [8, 8, 0, 71],
  LV: [8, 8, 0, 73], MIA: [9, 7, 0, 78], MIN: [10, 6, 0, 81], NE: [8, 8, 0, 74],
  NO: [3, 13, 0, 62], NYG: [7, 9, 0, 71], NYJ: [8, 8, 0, 74], PHI: [5, 11, 0, 68],
  PIT: [6, 10, 0, 70], SEA: [9, 7, 0, 78], SF: [4, 12, 0, 66], LAR: [13, 3, 0, 94],
  TB: [11, 5, 0, 86], TEN: [13, 3, 0, 90], WAS: [10, 6, 0, 82],
};

// Historically-correct 1999 names (only where the registry currently holds the
// modern name). Codes stay modern/stable; only the displayed team_name changes.
const NAME_1999 = {
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
  if (!line.startsWith("1999,")) return line;
  const f = line.split(",");
  const code = f[1];
  const rec = REC[code];
  if (!rec) { console.warn("no record table entry for 1999", code); return line; }
  seen.add(code);
  if (NAME_1999[code]) f[2] = NAME_1999[code];
  f[3] = String(rec[0]); // wins
  f[4] = String(rec[1]); // losses
  f[5] = String(rec[2]); // ties
  f[6] = String(rec[3]); // team_strength
  patched++;
  return f.join(",");
});

fs.writeFileSync(FILE, out.join(eol));
console.log(`patched ${patched} 1999 registry rows`);
const missing = Object.keys(REC).filter((c) => !seen.has(c));
if (missing.length) console.warn("registry rows NOT found for:", missing.join(", "));
