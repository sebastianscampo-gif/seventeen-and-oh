// One-shot feasibility probe. Joins the processed player_seasons + ratings with
// the franchise registry to produce a year-by-year data-quality table. Pure
// read-only; writes reports/data_quality_by_year.csv. No mutation of the dataset.

import fs from "node:fs";
import path from "node:path";
import { readCsv, writeCsv } from "./lib/csv.mjs";

const ROOT = process.cwd();
const P = (...x) => path.join(ROOT, ...x);

const ps = readCsv(P("data", "processed", "player_seasons.csv"));
const ratings = readCsv(P("data", "processed", "ratings.csv"));
const teams = readCsv(P("data", "teams.csv"));

const CURRENT = 2026; // open-ended franchises run through the present season

const ne = (v) => v !== undefined && v !== null && String(v).trim() !== "";
const num = (v) => (ne(v) ? Number(v) : NaN);

// ---- teams_expected(year): franchises whose window covers the season --------
const windows = teams.map((t) => ({
  code: t.team_code,
  first: Number(t.first_season),
  last: ne(t.last_season) ? Number(t.last_season) : CURRENT,
}));
const teamsExpected = (year) =>
  windows.filter((w) => year >= w.first && year <= w.last).length;

// ---- evidence predicate (real performance signal) ---------------------------
const hasOff = (r) =>
  ne(r.pass_yds) || ne(r.rush_yds) || ne(r.rec_yds) || ne(r.receptions) || ne(r.passer_rating);
const hasEvidence = (r) => hasOff(r) || ne(r.games_started);

// ---- aggregate player_seasons by year ---------------------------------------
const byYearPS = new Map();
for (const r of ps) {
  const y = Number(r.season);
  if (!Number.isFinite(y)) continue;
  if (!byYearPS.has(y)) byYearPS.set(y, { n: 0, ev: 0, teams: new Set(), rosterByTeam: new Map() });
  const b = byYearPS.get(y);
  b.n++;
  if (hasEvidence(r)) b.ev++;
  if (ne(r.team_code)) {
    b.teams.add(r.team_code);
    b.rosterByTeam.set(r.team_code, (b.rosterByTeam.get(r.team_code) || 0) + 1);
  }
}

// ---- aggregate ratings by year ----------------------------------------------
const byYearR = new Map();
for (const r of ratings) {
  const y = Number(r.season);
  if (!Number.isFinite(y)) continue;
  if (!byYearR.has(y)) byYearR.set(y, { n: 0, confSum: 0, confN: 0, low: 0, review: 0, fallback: 0, ovrSum: 0, ovrN: 0 });
  const b = byYearR.get(y);
  b.n++;
  const c = num(r.rating_confidence);
  if (Number.isFinite(c)) { b.confSum += c; b.confN++; }
  if (r.status === "generated_low_confidence") b.low++;
  if (String(r.needs_manual_review).trim() === "true") b.review++;
  const ov = num(r.overall);
  if (Number.isFinite(ov)) { b.ovrSum += ov; b.ovrN++; if (ov >= 67 && ov <= 71) b.fallback++; }
}

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const r2 = (x) => Math.round(x * 100) / 100;

// ---- recommended_status rule (documented thresholds) ------------------------
// Hard data limits found in the project:
//  * performance stats only exist 1999+ (and only for QB/RB/WR/TE);
//  * a season is fieldable only if every expected franchise has a roster.
function recommend({ rosterCompleteness, statsCompleteness }) {
  if (rosterCompleteness < 90) return "exclude_incomplete_league";
  if (statsCompleteness >= 20) return "include_usable";         // skill-position evidence present (1999+)
  if (statsCompleteness >= 5) return "include_low_confidence";  // thin evidence
  return "legacy_bio_only";                                     // pre-1999: no performance signal
}

const years = [...new Set([...byYearPS.keys(), ...byYearR.keys()])].sort((a, b) => a - b);
const rows = [];
for (const y of years) {
  const p = byYearPS.get(y) || { n: 0, ev: 0, teams: new Set(), rosterByTeam: new Map() };
  const r = byYearR.get(y) || { n: 0, confSum: 0, confN: 0, low: 0, review: 0, fallback: 0, ovrSum: 0, ovrN: 0 };
  const expected = teamsExpected(y);
  const available = p.teams.size;
  const rosterCompleteness = pct(available, expected);
  const statsCompleteness = pct(p.ev, p.n);
  rows.push({
    season: y,
    teams_expected: expected,
    teams_available: available,
    roster_completeness: rosterCompleteness,
    stats_completeness: statsCompleteness,
    rating_confidence_average: r.confN ? r2(r.confSum / r.confN) : 0,
    percent_players_needs_review: pct(r.review, r.n),
    percent_players_generated_low_confidence: pct(r.low, r.n),
    percent_players_with_fallback_rating: pct(r.fallback, r.ovrN),
    recommended_status: recommend({ rosterCompleteness, statsCompleteness }),
  });
}

const cols = [
  "season", "teams_expected", "teams_available", "roster_completeness",
  "stats_completeness", "rating_confidence_average", "percent_players_needs_review",
  "percent_players_generated_low_confidence", "percent_players_with_fallback_rating",
  "recommended_status",
];
fs.mkdirSync(P("reports"), { recursive: true });
writeCsv(P("reports", "data_quality_by_year.csv"), rows, cols);

// ---- console summary so we can calibrate the prose ---------------------------
console.log("season expd avail roster% stats% conf  rev%  low%  fb%  status");
for (const r of rows) {
  console.log(
    String(r.season).padEnd(6),
    String(r.teams_expected).padStart(4),
    String(r.teams_available).padStart(5),
    String(r.roster_completeness).padStart(6),
    String(r.stats_completeness).padStart(6),
    String(r.rating_confidence_average).padStart(5),
    String(r.percent_players_needs_review).padStart(5),
    String(r.percent_players_generated_low_confidence).padStart(5),
    String(r.percent_players_with_fallback_rating).padStart(5),
    " " + r.recommended_status
  );
}
console.log("\nrows:", rows.length, "years:", years[0], "-", years[years.length - 1]);
