// Position-group feasibility probe. For each position group, finds the earliest
// season whose evidence coverage clears the "strong" and "usable" bars, and
// records what real data exists vs is missing. Read-only; writes
// reports/position_rating_feasibility.csv.

import fs from "node:fs";
import path from "node:path";
import { readCsv, writeCsv } from "./lib/csv.mjs";

const ROOT = process.cwd();
const P = (...x) => path.join(ROOT, ...x);
const ps = readCsv(P("data", "processed", "player_seasons.csv"));

const ne = (v) => v !== undefined && v !== null && String(v).trim() !== "";

// Position-group → raw position codes (mirrors the engine's grouping).
const GROUPS = {
  QB: ["QB"],
  RB: ["RB", "FB", "HB"],
  WR: ["WR"],
  TE: ["TE"],
  OT: ["LT", "RT", "T", "OT"],
  OG: ["LG", "RG", "G", "OG"],
  C: ["C"],
  EDGE: ["EDGE", "DE"],
  DT: ["DT", "NT"],
  LB: ["LB", "ILB", "OLB", "MLB"],
  CB: ["CB", "DB"],
  S: ["S", "SS", "FS"],
  K: ["K", "PK"],
  P: ["P"],
};
const posToGroup = {};
for (const [g, codes] of Object.entries(GROUPS)) for (const c of codes) posToGroup[c] = g;

// Which raw stat columns are the *relevant* evidence for each group.
const hasOff = (r) =>
  ne(r.pass_yds) || ne(r.rush_yds) || ne(r.rec_yds) || ne(r.receptions) || ne(r.passer_rating);
const hasDef = (r) => ne(r.sacks) || ne(r.tackles) || ne(r.def_int) || ne(r.forced_fumbles);
const hasKick = (r) => ne(r.fg_att) || ne(r.fg_made) || ne(r.fg_pct);
const hasPunt = (r) => ne(r.punt_avg);
const EVIDENCE = {
  QB: hasOff, RB: hasOff, WR: hasOff, TE: hasOff,
  OT: () => false, OG: () => false, C: () => false, // OL never has box-score stats
  EDGE: hasDef, DT: hasDef, LB: hasDef, CB: hasDef, S: hasDef,
  K: hasKick, P: hasPunt,
};

// group -> year -> {n, ev}
const tally = {};
for (const g of Object.keys(GROUPS)) tally[g] = new Map();
for (const r of ps) {
  const g = posToGroup[(r.position || "").trim()];
  if (!g) continue;
  const y = Number(r.season);
  if (!Number.isFinite(y)) continue;
  const m = tally[g];
  if (!m.has(y)) m.set(y, { n: 0, ev: 0 });
  const b = m.get(y);
  b.n++;
  if (EVIDENCE[g](r)) b.ev++;
}

const STRONG = 60; // % of the group with real evidence to call ratings "strong"
const USABLE = 25;

function earliestClearing(map, threshold) {
  const years = [...map.keys()].sort((a, b) => a - b);
  for (const y of years) {
    const b = map.get(y);
    if (b.n >= 5 && (100 * b.ev) / b.n >= threshold) return y;
  }
  return "none";
}

// Static descriptors grounded in the verified findings.
const META = {
  QB: ["passing yds/TD/INT, passer rating, rush yds (1999+)", "pre-1999 box scores; advanced/EPA", "high (1999+)", "no"],
  RB: ["rush yds/TD, receptions, rec yds (1999+)", "pre-1999 box scores; snap/touch share", "high (1999+)", "no"],
  WR: ["receptions, rec yds/TD (1999+)", "pre-1999 box scores; routes/targets", "high (1999+)", "no"],
  TE: ["receptions, rec yds/TD (1999+)", "pre-1999 box scores; blocking grades", "medium (1999+)", "no"],
  OT: ["bio (ht/wt), games/started, depth", "ALL box-score & grading stats (every era)", "low (role/bio only)", "yes"],
  OG: ["bio (ht/wt), games/started, depth", "ALL box-score & grading stats (every era)", "low (role/bio only)", "yes"],
  C: ["bio (ht/wt), games/started, depth", "ALL box-score & grading stats (every era)", "low (role/bio only)", "yes"],
  EDGE: ["bio, games/started, depth", "sacks/tackles/FF empty in EVERY era", "low (role/bio only)", "yes"],
  DT: ["bio, games/started, depth", "sacks/tackles empty in EVERY era", "low (role/bio only)", "yes"],
  LB: ["bio, games/started, depth", "tackles/sacks/INT empty in EVERY era", "low (role/bio only)", "yes"],
  CB: ["bio, games/started, depth", "INT/PD/tackles empty in EVERY era", "low (role/bio only)", "yes"],
  S: ["bio, games/started, depth", "INT/tackles/FF empty in EVERY era", "low (role/bio only)", "yes"],
  K: ["bio, games/started, depth", "FG made/att/pct empty in EVERY era", "low (role/bio only)", "yes"],
  P: ["bio, games/started, partial games (1999+)", "punt avg/yds empty in EVERY era", "low (role/bio only)", "yes"],
};

const cols = [
  "position_group", "earliest_strong_year", "earliest_usable_year",
  "main_data_available", "main_data_missing", "confidence_level", "manual_review_needed",
];
const rows = Object.keys(GROUPS).map((g) => {
  const m = tally[g];
  const [avail, missing, conf, review] = META[g];
  return {
    position_group: g,
    earliest_strong_year: earliestClearing(m, STRONG),
    earliest_usable_year: earliestClearing(m, USABLE),
    main_data_available: avail,
    main_data_missing: missing,
    confidence_level: conf,
    manual_review_needed: review,
  };
});

fs.mkdirSync(P("reports"), { recursive: true });
writeCsv(P("reports", "position_rating_feasibility.csv"), rows, cols);

console.log("group strong usable  conf");
for (const r of rows) {
  console.log(
    r.position_group.padEnd(5),
    String(r.earliest_strong_year).padStart(6),
    String(r.earliest_usable_year).padStart(6),
    "  " + r.confidence_level
  );
}
// Also dump peak coverage per group so we can describe the ceiling honestly.
console.log("\ngroup  peak_evidence%  (year)");
for (const g of Object.keys(GROUPS)) {
  let best = 0, bestY = "-";
  for (const [y, b] of tally[g]) {
    if (b.n >= 5) { const p = (100 * b.ev) / b.n; if (p > best) { best = p; bestY = y; } }
  }
  console.log(g.padEnd(6), String(Math.round(best * 10) / 10).padStart(6), " ", bestY);
}
