// validate-game-data.mjs
// Post-export integrity + regression guard for the game-ready JSON. The
// distribution validator checks ratings.csv; this one checks the exported
// public/team-seasons/*.json the game actually loads, catching classes of bug
// the brief calls out that only show up after export:
//
//   1. STALE EXPORT      — ratings.csv newer than the JSON (someone regenerated
//                          ratings but forgot to re-export). FAIL.
//   2. METADATA MISSING  — a team-season JSON lacking required metadata blocks
//                          (engineVersion, statusCounts, ratingConfidence, …). FAIL.
//   3. KNOWN-ELITE FLOOR — a watchlist of unambiguous greats that must clear a
//                          floor on a given roster (catches "Aaron Donald 72",
//                          "T.J. Watt 73", a Super Bowl team with no star). FAIL.
//   4. INFLATED QB       — a QB at 90+ with no manual override backing it
//                          (catches "average QB rated 90+ without an override"). WARN.
//   5. GENERIC ROSTER    — >50% of a roster stuck in the 67-71 generic band. WARN.
//
// Writes reports/game_data_warnings.csv. Exits non-zero on any FAIL so it can
// gate a release.
//
// Run:  node scripts/validate-game-data.mjs   (or: npm run ratings:validate-game)

import fs from "node:fs";
import { readCsv, writeCsv } from "./lib/csv.mjs";
import { fromRoot, log } from "./lib/util.mjs";

const DIR = fromRoot("public", "team-seasons");
const RATINGS = fromRoot("data", "processed", "ratings.csv");
const OUT = fromRoot("reports", "game_data_warnings.csv");
const COLUMNS = ["team_season", "severity", "rule", "detail"];

// Mirror the export scope (Option 1 — rated pool is 1999+). Elite fixtures for
// team-seasons outside the exported scope are skipped rather than failed, so the
// pre-1999 legends below stay as ready fixtures if a Legacy pool is added later.
const MIN_SEASON = Number(process.env.SCOPE_MIN_SEASON ?? 1999);
const MAX_SEASON = Number(process.env.SCOPE_MAX_SEASON ?? 9999);
const seasonOf = (ts) => Number(String(ts).split("_")[0]);
const tsInScope = (ts) => seasonOf(ts) >= MIN_SEASON && seasonOf(ts) <= MAX_SEASON;

// Unambiguous greats that must clear a floor on the given roster. Mixed engine-
// rated (Mahomes, Jefferson) and override-backed (Donald, Watt, Nelson) so the
// list guards BOTH the engine and the override layer against regressions.
const KNOWN_ELITE = [
  ["2007_NE", "Tom Brady", 96], ["2007_NE", "Randy Moss", 95],
  ["2022_KC", "Patrick Mahomes", 95], ["2022_MIN", "Justin Jefferson", 93],
  ["1985_CHI", "Walter Payton", 93], ["1985_CHI", "Mike Singletary", 90],
  ["1999_LAR", "Kurt Warner", 93], ["1999_LAR", "Marshall Faulk", 93],
  ["2000_BAL", "Ray Lewis", 95], ["1978_PIT", "Joe Greene", 93],
  ["1978_PIT", "Jack Lambert", 93], ["2013_SEA", "Richard Sherman", 89],
  ["2013_SEA", "Earl Thomas", 89], ["2022_PIT", "T.J. Watt", 92],
  ["2022_IND", "Quenton Nelson", 88], ["2018_LAR", "Aaron Donald", 95],
  ["1996_GB", "Reggie White", 95], ["1986_NYG", "Lawrence Taylor", 95],
];

const REQUIRED_META = ["ratingSource", "ratingConfidence", "engineVersion", "statusCounts", "playerCount", "teamStrength"];

function run() {
  log.step("Validating game-ready JSON");
  if (!fs.existsSync(DIR)) { log.warn("No public/team-seasons — run export first."); process.exitCode = 1; return; }

  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
  if (files.length === 0) { log.warn("No team-season JSON files — run export first."); process.exitCode = 1; return; }

  const warnings = [];
  const add = (ts, severity, rule, detail) => warnings.push({ team_season: ts, severity, rule, detail });

  // --- 1. staleness: ratings.csv must not be newer than the newest JSON ---
  if (fs.existsSync(RATINGS)) {
    const ratingsM = fs.statSync(RATINGS).mtimeMs;
    let newestJson = 0;
    for (const f of files) newestJson = Math.max(newestJson, fs.statSync(`${DIR}/${f}`).mtimeMs);
    if (ratingsM > newestJson + 1000) {
      add("(global)", "FAIL", "stale_export",
        `ratings.csv is newer than the exported JSON by ${((ratingsM - newestJson) / 1000).toFixed(0)}s — re-run export-team-seasons`);
    }
  }

  // --- 2 + 4 + 5: per-roster metadata / inflated QB / generic band ---
  const docs = new Map();
  for (const f of files) {
    let doc;
    try { doc = JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8")); }
    catch { add(f, "FAIL", "bad_json", "file is not valid JSON"); continue; }
    docs.set(doc.id || f.replace(/\.json$/, ""), doc);

    const meta = doc.metadata || {};
    const missing = REQUIRED_META.filter((k) => meta[k] == null);
    if (!doc.schemaVersion) missing.push("schemaVersion");
    if (!Array.isArray(doc.players) || doc.players.length === 0) missing.push("players");
    if (missing.length) add(doc.id || f, "FAIL", "metadata_missing", `missing: ${missing.join(", ")}`);

    const players = Array.isArray(doc.players) ? doc.players : [];
    // Inflated QB without override.
    for (const p of players) {
      if (p.position === "QB" && (p.overall ?? 0) >= 90 && p.status !== "manual_override") {
        add(doc.id || f, "WARN", "inflated_qb",
          `${p.name} QB ${p.overall} is 90+ with status=${p.status} (no manual override)`);
      }
    }
    // Generic-band roster.
    if (players.length >= 12) {
      const band = players.filter((p) => (p.overall ?? 0) >= 67 && (p.overall ?? 0) <= 71).length;
      const pct = (100 * band) / players.length;
      if (pct > 50) add(doc.id || f, "WARN", "generic_roster", `${pct.toFixed(0)}% of roster in the 67-71 generic band`);
    }
  }

  // --- 3: known-elite floor ---
  let skippedElite = 0;
  for (const [ts, name, floor] of KNOWN_ELITE) {
    if (!tsInScope(ts)) { skippedElite++; continue; } // legacy fixture, out of rated scope
    const doc = docs.get(ts);
    if (!doc) { add(ts, "FAIL", "missing_team_season", `expected team-season file ${ts}.json not found`); continue; }
    const pl = (doc.players || []).find((p) => (p.name || "").toLowerCase() === name.toLowerCase());
    if (!pl) { add(ts, "FAIL", "known_elite_missing", `${name} not on roster`); continue; }
    if ((pl.overall ?? 0) < floor) add(ts, "FAIL", "known_elite_floor", `${name} ${pl.overall} < expected floor ${floor}`);
  }

  warnings.sort((a, b) =>
    ({ FAIL: 0, WARN: 1 }[a.severity] - { FAIL: 0, WARN: 1 }[b.severity]) ||
    String(a.team_season).localeCompare(String(b.team_season)));
  writeCsv(OUT, warnings, COLUMNS);

  const fails = warnings.filter((w) => w.severity === "FAIL").length;
  const warns = warnings.filter((w) => w.severity === "WARN").length;
  const rel = OUT.split("/").slice(-2).join("/");
  log.ok(`validated ${files.length} game-ready JSON files → ${rel}`);
  log.info(`FAIL=${fails}   WARN=${warns}   (skipped ${skippedElite} out-of-scope elite fixtures < ${MIN_SEASON})`);
  if (fails > 0) {
    log.warn("FAIL-level game-data problems:");
    for (const w of warnings.filter((w) => w.severity === "FAIL").slice(0, 12)) log.warn(`  ${w.team_season} [${w.rule}] ${w.detail}`);
    process.exitCode = 1;
  } else {
    log.ok("no FAIL-level game-data problems.");
  }
}

run();
