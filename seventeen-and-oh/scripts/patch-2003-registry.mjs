// One-shot registry patch for the 2003 season overhaul. Line-oriented: only
// rewrites rows whose season column is 2003, leaving every other row byte-
// identical. Sets (a) historically-correct 2003 team names for the four
// franchises whose registry name is the modern one, (b) real 2003 regular-
// season records, and (c) a curated team_strength prior per team. Idempotent.
//
// Run: node scripts/patch-2003-registry.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "data", "team_seasons.csv");

// code -> [wins, losses, ties, team_strength]  (2003 final regular season)
// Records verified against 2003 NFL standings. 256 W / 256 L / 0 T = 256 games.
// team_strength is a record-anchored prior nudged by real roster quality:
//   NE 14-2 SB champ + elite D -> 90; KC 13-3 explosive O but weak D -> 86;
//   TB 7-9 but still elite defensive talent (decline from 2002) -> 78;
//   LV(OAK) 4-12 collapse from the 2002 SB team -> 66; HOU yr-2 expansion -> 62.
const REC = {
  ARI: [4, 12, 0, 62], ATL: [5, 11, 0, 66], BAL: [10, 6, 0, 83], BUF: [6, 10, 0, 70],
  CAR: [11, 5, 0, 84], CHI: [7, 9, 0, 67], CIN: [8, 8, 0, 73], CLE: [5, 11, 0, 66],
  DAL: [10, 6, 0, 79], DEN: [10, 6, 0, 80], DET: [5, 11, 0, 63], GB: [10, 6, 0, 81],
  HOU: [5, 11, 0, 62], IND: [12, 4, 0, 86], JAX: [5, 11, 0, 66], KC: [13, 3, 0, 86],
  LAC: [4, 12, 0, 68], LV: [4, 12, 0, 66], MIA: [10, 6, 0, 81], MIN: [9, 7, 0, 77],
  NE: [14, 2, 0, 90], NO: [8, 8, 0, 73], NYG: [4, 12, 0, 64], NYJ: [6, 10, 0, 70],
  PHI: [12, 4, 0, 87], PIT: [6, 10, 0, 72], SEA: [10, 6, 0, 80], SF: [7, 9, 0, 72],
  LAR: [12, 4, 0, 84], TB: [7, 9, 0, 78], TEN: [12, 4, 0, 85], WAS: [5, 11, 0, 66],
};

// Historically-correct 2003 names (only where the registry currently holds the
// modern name). Codes stay modern/stable; only the displayed team_name changes.
const NAME_2003 = {
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
  if (!line.startsWith("2003,")) return line;
  const f = line.split(",");
  const code = f[1];
  const rec = REC[code];
  if (!rec) { console.warn("no record table entry for 2003", code); return line; }
  seen.add(code);
  if (NAME_2003[code]) f[2] = NAME_2003[code];
  f[3] = String(rec[0]); // wins
  f[4] = String(rec[1]); // losses
  f[5] = String(rec[2]); // ties
  f[6] = String(rec[3]); // team_strength
  patched++;
  return f.join(",");
});

fs.writeFileSync(FILE, out.join(eol));
console.log(`patched ${patched} 2003 registry rows`);
const missing = Object.keys(REC).filter((c) => !seen.has(c));
if (missing.length) console.warn("registry rows NOT found for:", missing.join(", "));
