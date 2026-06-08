// validate-team-seasons.mjs
// Franchise-existence + team-code integrity check for the team-season registry.
//
// The brief calls out impossible mappings such as a "1967 Carolina Panthers"
// (the Panthers' first NFL season is 1995). This guards against any team-season
// that is chronologically impossible for its franchise, references a team_code
// that does not exist in teams.csv, sits outside the supported league era, or is
// duplicated. It writes reports/invalid_team_seasons.csv and exits non-zero when
// a violation is found, so it can gate an export.
//
// teams.csv carries each franchise's first_season and (optional) last_season —
// the canonical existence window. We use the MODERN, user-friendly team_name for
// display while validating against the franchise's real history.
//
// Run:  node scripts/validate-team-seasons.mjs   (or: npm run ratings:validate-teams)

import { readCsv, writeCsv } from "./lib/csv.mjs";
import { fromRoot, log, num } from "./lib/util.mjs";

const OUT = fromRoot("reports", "invalid_team_seasons.csv");
const COLUMNS = ["team_code", "team_name", "season", "problem", "suggested_fix"];

// Supported league era. Pro football predates this, but the game's dataset and
// rating model target the modern NFL/AFL era; anything outside is almost
// certainly a typo rather than a real season we intend to ship.
const ERA_MIN = 1920; // NFL founding (APFA)
const ERA_MAX = new Date().getFullYear();

function run() {
  log.step("Validating team-season franchise existence");

  const registry = readCsv(fromRoot("data", "team_seasons.csv"));
  const teams = readCsv(fromRoot("data", "teams.csv"));
  if (registry.length === 0) {
    log.warn("No team_seasons.csv — nothing to validate.");
    return;
  }

  const teamByCode = new Map(teams.map((t) => [t.team_code, t]));
  const rows = [];
  const seen = new Set();

  for (const reg of registry) {
    const code = (reg.team_code || "").trim();
    const season = num(reg.season);
    const team = teamByCode.get(code);
    // Prefer the registry's per-season display name, else the franchise's modern
    // name, else the raw code — always the user-friendly label.
    const displayName = reg.team_name || team?.team_name || team?.franchise || code;
    const add = (problem, fix) => rows.push({ team_code: code, team_name: displayName, season: season ?? reg.season, problem, suggested_fix: fix });

    if (!code) { add("blank team_code", "set a valid franchise code from teams.csv"); continue; }
    if (season == null) { add("missing/invalid season", "set a 4-digit season year"); continue; }

    // Duplicate team-season row.
    const dupKey = `${season}|${code}`;
    if (seen.has(dupKey)) add("duplicate team-season row", "remove the duplicate row");
    seen.add(dupKey);

    // Unknown franchise code.
    if (!team) {
      add("team_code not found in teams.csv", "correct the code or add the franchise to teams.csv");
      continue;
    }

    // Era sanity.
    if (season < ERA_MIN || season > ERA_MAX) {
      add(`season ${season} outside supported era ${ERA_MIN}-${ERA_MAX}`, "correct the season year");
    }

    // Franchise existence window.
    const first = num(team.first_season);
    const last = num(team.last_season); // blank = still active
    if (first != null && season < first) {
      add(
        `franchise did not exist yet (${team.franchise} began ${first})`,
        `remove this team-season, or re-map to the franchise that played in ${season}`
      );
    } else if (last != null && season > last) {
      add(
        `franchise no longer existed (${team.franchise} ended ${last})`,
        `re-map to the successor franchise for ${season}`
      );
    }
  }

  rows.sort((a, b) => String(a.team_code).localeCompare(String(b.team_code)) || num(a.season) - num(b.season));
  writeCsv(OUT, rows, COLUMNS);

  const rel = OUT.split("/").slice(-2).join("/");
  if (rows.length === 0) {
    log.ok(`validated ${registry.length} team-seasons across ${teamByCode.size} franchises — 0 invalid mappings.`);
    log.info(`(no impossible team-seasons, e.g. no pre-1995 Carolina Panthers) → ${rel}`);
  } else {
    log.warn(`${rows.length} invalid team-season(s) found → ${rel}`);
    for (const r of rows.slice(0, 10)) log.warn(`  ${r.season} ${r.team_code} — ${r.problem}`);
    process.exitCode = 1;
  }
}

run();
