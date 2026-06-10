// One-shot registry patch for the 2000 season overhaul. Line-oriented: only
// rewrites rows whose season column is 2000, leaving every other row byte-
// identical. Sets (a) historically-correct 2000 team names for the four
// franchises whose registry name is the modern one, (b) real 2000 regular-
// season records, and (c) a curated team_strength prior per team. Idempotent.
//
// Run: node scripts/patch-2000-registry.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "data", "team_seasons.csv");

// code -> [wins, losses, ties, team_strength]  (2000 final regular season)
// Records verified against 2000 NFL standings; sum of wins = 248 = total games.
const REC = {
  ARI: [3, 13, 0, 63], ATL: [4, 12, 0, 66], BAL: [12, 4, 0, 93], BUF: [8, 8, 0, 76],
  CAR: [7, 9, 0, 73], CHI: [5, 11, 0, 67], CIN: [4, 12, 0, 65], CLE: [3, 13, 0, 62],
  DAL: [5, 11, 0, 70], DEN: [11, 5, 0, 83], DET: [9, 7, 0, 76], GB: [9, 7, 0, 78],
  IND: [10, 6, 0, 83], JAX: [7, 9, 0, 76], KC: [7, 9, 0, 75], LAC: [1, 15, 0, 58],
  LV: [12, 4, 0, 88], MIA: [11, 5, 0, 83], MIN: [11, 5, 0, 85], NE: [5, 11, 0, 69],
  NO: [10, 6, 0, 82], NYG: [12, 4, 0, 87], NYJ: [9, 7, 0, 79], PHI: [11, 5, 0, 83],
  PIT: [9, 7, 0, 78], SEA: [6, 10, 0, 72], SF: [6, 10, 0, 71], LAR: [10, 6, 0, 85],
  TB: [10, 6, 0, 84], TEN: [13, 3, 0, 90], WAS: [8, 8, 0, 78],
};

// Historically-correct 2000 names (only where the registry currently holds the
// modern name). Codes stay modern/stable; only the displayed team_name changes.
const NAME_2000 = {
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
  if (!line.startsWith("2000,")) return line;
  const f = line.split(",");
  const code = f[1];
  const rec = REC[code];
  if (!rec) { console.warn("no record table entry for 2000", code); return line; }
  seen.add(code);
  if (NAME_2000[code]) f[2] = NAME_2000[code];
  f[3] = String(rec[0]); // wins
  f[4] = String(rec[1]); // losses
  f[5] = String(rec[2]); // ties
  f[6] = String(rec[3]); // team_strength
  patched++;
  return f.join(",");
});

fs.writeFileSync(FILE, out.join(eol));
console.log(`patched ${patched} 2000 registry rows`);
const missing = Object.keys(REC).filter((c) => !seen.has(c));
if (missing.length) console.warn("registry rows NOT found for:", missing.join(", "));
