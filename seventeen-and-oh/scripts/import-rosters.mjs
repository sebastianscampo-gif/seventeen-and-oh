// import-rosters.mjs
// Reads the team-season registry + raw roster files (plus optional per
// team-season stats and awards overlays) and normalizes everything into:
//   data/processed/player_seasons.csv  (one row per player per season)
//   data/processed/players.csv         (one row per unique player)
//
// Run:  node scripts/import-rosters.mjs   (or: npm run data:import)

import fs from "node:fs";
import { readCsv, writeCsv } from "./lib/csv.mjs";
import {
  PLAYER_SEASON_COLUMNS, PLAYERS_COLUMNS, STAT_COLUMNS, TEAM_SEASON_COLUMNS,
} from "./lib/schema.mjs";
import { fromRoot, list, log, num, playerIdFromName, slugify } from "./lib/util.mjs";

const REGISTRY = fromRoot("data", "team_seasons.csv");
const ROSTERS_DIR = fromRoot("data", "raw", "rosters");

/** Load an overlay file (stats/awards) keyed by player_id (or name slug). */
function loadOverlay(kind, season, teamCode) {
  const file = fromRoot("data", "raw", kind, `${season}_${teamCode}.csv`);
  const rows = readCsv(file);
  const byId = new Map();
  for (const r of rows) {
    const id = r.player_id || (r.name ? playerIdFromName(r.name) : null);
    if (!id) continue;
    const prev = byId.get(id) || [];
    prev.push(r);
    byId.set(id, prev);
  }
  return byId;
}

function rosterFileFor(reg) {
  if (reg.roster_file) return fromRoot(reg.roster_file);
  return fromRoot("data", "raw", "rosters", `${reg.season}_${reg.team_code}.csv`);
}

function run() {
  log.step("Importing rosters");

  let registry = readCsv(REGISTRY);
  if (registry.length === 0) {
    log.warn(`No registry at ${REGISTRY}. Nothing to import.`);
    return;
  }

  // Discover roster files not yet listed in the registry and append them with
  // safe defaults so a new team-season is picked up just by dropping a file in.
  const known = new Set(registry.map((r) => `${r.season}_${r.team_code}`));
  if (fs.existsSync(ROSTERS_DIR)) {
    for (const f of fs.readdirSync(ROSTERS_DIR)) {
      const m = f.match(/^(\d{4})_([A-Z0-9]{2,3})\.csv$/);
      if (!m) continue;
      const id = `${m[1]}_${m[2]}`;
      if (!known.has(id)) {
        log.warn(`Roster ${f} not in registry — appending with defaults (edit team_seasons.csv to refine).`);
        registry.push({
          season: m[1], team_code: m[2], team_name: m[2],
          wins: "", losses: "", ties: "", team_strength: "70",
          rating_source: "generated", rating_confidence: "0.6",
          roster_file: "", notes: "auto-added; please complete",
        });
        known.add(id);
      }
    }
    // Persist any auto-added rows back to the registry.
    writeCsv(REGISTRY, registry, TEAM_SEASON_COLUMNS);
  }

  const playerSeasons = [];
  const masters = new Map(); // player_id -> aggregate
  let teamSeasonCount = 0;

  for (const reg of registry) {
    const season = num(reg.season);
    const teamCode = reg.team_code;
    if (!season || !teamCode) {
      log.warn(`Skipping registry row with missing season/team_code: ${JSON.stringify(reg)}`);
      continue;
    }
    const file = rosterFileFor(reg);
    const roster = readCsv(file);
    if (roster.length === 0) {
      log.warn(`No roster rows found for ${season}_${teamCode} (${file}). Skipping.`);
      continue;
    }
    teamSeasonCount++;

    const statsOverlay = loadOverlay("stats", season, teamCode);
    const awardsOverlay = loadOverlay("awards", season, teamCode);

    for (const row of roster) {
      const name = (row.name || "").trim();
      if (!name) continue;
      const playerId = (row.player_id || "").trim() || playerIdFromName(name);

      // Merge awards: inline column + overlay rows (overlay may have `award` or `awards`).
      const awards = new Set(list(row.awards));
      for (const o of awardsOverlay.get(playerId) || []) {
        for (const a of list(o.award || o.awards)) awards.add(a);
      }

      // Merge stats: inline columns are the base; overlay columns win if present.
      const stats = {};
      for (const col of STAT_COLUMNS) {
        if (row[col] != null && row[col] !== "") stats[col] = row[col];
      }
      for (const o of statsOverlay.get(playerId) || []) {
        for (const col of STAT_COLUMNS) {
          if (o[col] != null && o[col] !== "") stats[col] = o[col];
        }
      }
      // Derive FG% when made/att are present and pct is blank.
      if (stats.fg_pct == null && num(stats.fg_att)) {
        stats.fg_pct = Math.round((num(stats.fg_made, 0) / num(stats.fg_att)) * 1000) / 10;
      }

      const ps = {
        player_id: playerId,
        name,
        team: reg.team_name || teamCode,
        team_code: teamCode,
        season,
        position: (row.position || "").trim(),
        secondary_positions: list(row.secondary_positions).join(";"),
        jersey_number: row.jersey_number || "",
        height: row.height || "",
        weight: row.weight || "",
        birth_date: row.birth_date || "",
        college: row.college || "",
        years_exp: row.years_exp || "",
        games: row.games || "",
        games_started: row.games_started || "",
        awards: [...awards].join(";"),
        scout_grade: row.scout_grade || "",
        rating_source: reg.rating_source || "generated",
        rating_confidence: reg.rating_confidence || "0.6",
        notes: row.notes || "",
      };
      for (const col of STAT_COLUMNS) ps[col] = stats[col] ?? "";
      playerSeasons.push(ps);

      // Aggregate into the master players table.
      const m = masters.get(playerId) || {
        player_id: playerId, name, positions: {}, birth_date: "", college: "",
        seasons: new Set(), teams: new Set(),
      };
      m.name = name;
      m.positions[ps.position] = (m.positions[ps.position] || 0) + 1;
      if (!m.birth_date && ps.birth_date) m.birth_date = ps.birth_date;
      if (!m.college && ps.college) m.college = ps.college;
      m.seasons.add(season);
      m.teams.add(teamCode);
      masters.set(playerId, m);
    }
  }

  playerSeasons.sort(
    (a, b) => a.season - b.season || a.team_code.localeCompare(b.team_code) || a.name.localeCompare(b.name)
  );

  const players = [...masters.values()]
    .map((m) => {
      const seasons = [...m.seasons].sort((a, b) => a - b);
      const primary = Object.entries(m.positions).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      return {
        player_id: m.player_id,
        name: m.name,
        primary_position: primary,
        birth_date: m.birth_date,
        college: m.college,
        first_season: seasons[0] ?? "",
        last_season: seasons[seasons.length - 1] ?? "",
        seasons_played: seasons.length,
        teams: [...m.teams].sort().join(";"),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  writeCsv(fromRoot("data", "processed", "player_seasons.csv"), playerSeasons, PLAYER_SEASON_COLUMNS);
  writeCsv(fromRoot("data", "processed", "players.csv"), players, PLAYERS_COLUMNS);

  log.ok(`${teamSeasonCount} team-seasons → ${playerSeasons.length} player-seasons, ${players.length} unique players`);
}

run();
