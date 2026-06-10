// One-shot registry patch for the 2001 season overhaul. Line-oriented: only
// rewrites rows whose season column is 2001, leaving every other row byte-
// identical. Sets (a) historically-correct 2001 team names for the four
// franchises whose registry name is the modern one, (b) real 2001 regular-
// season records, and (c) a curated team_strength prior per team. Idempotent.
//
// Run: node scripts/patch-2001-registry.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "data", "team_seasons.csv");

// code -> [wins, losses, ties, team_strength]  (2001 final regular season)
// Records verified against 2001 NFL standings; sum of wins = 248 = total games.
const REC = {
  ARI: [7, 9, 0, 65], ATL: [7, 9, 0, 67], BAL: [10, 6, 0, 86], BUF: [3, 13, 0, 61],
  CAR: [1, 15, 0, 56], CHI: [13, 3, 0, 86], CIN: [6, 10, 0, 64], CLE: [7, 9, 0, 68],
  DAL: [5, 11, 0, 65], DEN: [8, 8, 0, 78], DET: [2, 14, 0, 58], GB: [12, 4, 0, 85],
  IND: [6, 10, 0, 75], JAX: [6, 10, 0, 69], KC: [6, 10, 0, 69], LAC: [5, 11, 0, 64],
  LV: [10, 6, 0, 85], MIA: [11, 5, 0, 83], MIN: [5, 11, 0, 68], NE: [11, 5, 0, 86],
  NO: [7, 9, 0, 73], NYG: [7, 9, 0, 73], NYJ: [10, 6, 0, 80], PHI: [11, 5, 0, 85],
  PIT: [13, 3, 0, 90], SEA: [9, 7, 0, 75], SF: [12, 4, 0, 84], LAR: [14, 2, 0, 93],
  TB: [9, 7, 0, 83], TEN: [7, 9, 0, 73], WAS: [8, 8, 0, 73],
};

// Historically-correct 2001 names (only where the registry currently holds the
// modern name). Codes stay modern/stable; only the displayed team_name changes.
const NAME_2001 = {
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
  if (!line.startsWith("2001,")) return line;
  const f = line.split(",");
  const code = f[1];
  const rec = REC[code];
  if (!rec) { console.warn("no record table entry for 2001", code); return line; }
  seen.add(code);
  if (NAME_2001[code]) f[2] = NAME_2001[code];
  f[3] = String(rec[0]); // wins
  f[4] = String(rec[1]); // losses
  f[5] = String(rec[2]); // ties
  f[6] = String(rec[3]); // team_strength
  patched++;
  return f.join(",");
});

fs.writeFileSync(FILE, out.join(eol));
console.log(`patched ${patched} 2001 registry rows`);
const missing = Object.keys(REC).filter((c) => !seen.has(c));
if (missing.length) console.warn("registry rows NOT found for:", missing.join(", "));
