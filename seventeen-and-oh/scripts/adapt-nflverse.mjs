// adapt-nflverse.mjs
// Transforms the downloaded nflverse source CSVs (data/raw/source/nflverse/)
// into the 17-0 raw schema the normal pipeline consumes:
//   data/raw/rosters/<SEASON>_<TEAM>.csv   (ROSTER_COLUMNS)
//   data/raw/stats/<SEASON>_<TEAM>.csv     (STAT_COLUMNS, offense/kicking)
// and upserts a registry row per team-season into data/team_seasons.csv.
//
// After running this, run the normal pipeline:
//   npm run data:import && npm run data:ratings && npm run data:overrides && npm run data:export
//   (or just: npm run data:build)
//
// What it handles:
//   • weekly roster rows -> one season row per player (modal team/position)
//   • status filter (keep players who were actually on the team)
//   • season-aware franchise code normalization (OAK->LV, SD->LAC, season-
//     dependent BAL->IND/BAL and STL->ARI/LAR, HOU->TEN/HOU, etc.)
//   • position mapping to our 16 slots (FB->RB, T->LT(+RT), DE->EDGE, NT->DT…)
//   • season stat aggregation from weekly player_stats (+ computed passer rating)
//
// Curated sample rosters are NEVER clobbered: if a roster file already exists it
// is skipped unless you pass --force.
//
// Usage:
//   node scripts/adapt-nflverse.mjs --from 1965 --to 2024
//   npm run data:adapt -- --from 2023 --to 2024 [--force]

import fs from "node:fs";
import { readCsv, writeCsv } from "./lib/csv.mjs";
import { ROSTER_COLUMNS, STAT_COLUMNS, TEAM_SEASON_COLUMNS, TEAMS_COLUMNS } from "./lib/schema.mjs";
import { fromRoot, log, num } from "./lib/util.mjs";

const SRC = fromRoot("data", "raw", "source", "nflverse");
const ROSTERS_OUT = fromRoot("data", "raw", "rosters");
const STATS_OUT = fromRoot("data", "raw", "stats");
const REGISTRY = fromRoot("data", "team_seasons.csv");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const FROM = parseInt(arg("from", "1965"), 10);
const TO = parseInt(arg("to", String(new Date().getFullYear() - 1)), 10);
const FORCE = process.argv.includes("--force");

// Roster statuses worth keeping (players who were genuinely part of the team).
// Drops CUT / DEV (practice squad) / TRC|TRD (trade artifacts) noise.
const KEEP_STATUS = new Set(["ACT", "RES", "INA", "RET", "PUP", "NON", "EXE", "SUS"]);

// nflverse depth_chart_position -> our 16 slots (preferred when present).
const DEPTH_MAP = {
  QB: "QB", RB: "RB", FB: "RB", HB: "RB",
  WR: "WR", TE: "TE",
  T: "LT", OT: "LT", LT: "LT", RT: "RT",
  G: "LG", OG: "LG", LG: "LG", RG: "RG", C: "C",
  DE: "EDGE", EDGE: "EDGE",
  DT: "DT", NT: "DT", DL: "DT",
  ILB: "LB", MLB: "LB", OLB: "LB", LB: "LB",
  CB: "CB", DB: "CB",
  FS: "S", SS: "S", S: "S", SAF: "S",
  K: "K", PK: "K", P: "P",
  LS: null, // long snappers: not a draftable slot in 17-0
};
// Coarse position fallback when depth_chart_position is blank.
const COARSE_MAP = {
  QB: "QB", RB: "RB", FB: "RB", WR: "WR", TE: "TE",
  OL: "LG", T: "LT", G: "LG", C: "C",
  DL: "DT", DE: "EDGE", DT: "DT", NT: "DT",
  LB: "LB", DB: "S", CB: "CB", S: "S",
  K: "K", P: "P", LS: null,
};
// Mirror so a tackle/guard can fill either side in the draft.
const MIRROR = { LT: "RT", RT: "LT", LG: "RG", RG: "LG" };

function mapPosition(depth, coarse) {
  const d = (depth || "").toUpperCase();
  if (d in DEPTH_MAP) return DEPTH_MAP[d];
  const c = (coarse || "").toUpperCase();
  if (c in COARSE_MAP) return COARSE_MAP[c];
  return null;
}

// Season-aware normalization of nflverse team codes -> our teams.csv codes.
function normTeam(raw, season) {
  const c = (raw || "").toUpperCase();
  switch (c) {
    case "OAK": case "RAI": case "LV": case "LVR": return "LV";
    case "SD": case "SDG": case "LAC": return "LAC";
    case "PHO": case "PHX": case "ARZ": case "ARI": case "CRD": return "ARI";
    case "BOS": case "NWE": case "NE": return "NE"; // AFL Boston Patriots -> NE
    case "WSH": case "WAS": return "WAS";
    case "GNB": return "GB";
    case "KAN": return "KC";
    case "NOR": return "NO";
    case "SFO": return "SF";
    case "TAM": return "TB";
    case "CLV": return "CLE";
    case "JAC": return "JAX";
    case "OTI": return "TEN"; // Houston/Tennessee Oilers
    case "HOU": case "HST": return season >= 2002 ? "HOU" : "TEN"; // Oilers(<=1996)->TEN; Texans(2002+, nflverse HST 2002-15)->HOU
    case "BAL": case "CLT": case "BLT": return season >= 1996 ? "BAL" : "IND"; // Colts(<=1983)->IND; Ravens(1996+, nflverse BLT 2002-15)
    case "RAM": return "LAR"; // our Rams franchise code (modern: Los Angeles)
    case "STL": case "SL": return season >= 1995 ? "LAR" : "ARI"; // St.L Cardinals(<=1987)->ARI; St.L Rams(1995-2015, nflverse SL 2002-15)->LAR
    case "LA": case "LAR": return "LAR"; // LA Rams -> our Rams code
    default: return c; // stable: ATL BUF CAR CHI CIN DAL DEN DET GB KC MIA MIN NYG NYJ PHI PIT SEA SF TB CLE IND DEN ...
  }
}

function mode(values) {
  const counts = new Map();
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
  return best;
}
function firstNonEmpty(values) {
  for (const v of values) if (v != null && v !== "") return v;
  return "";
}

// NFL passer rating from aggregated season totals.
function passerRating(cmp, att, yds, td, intc) {
  if (!att) return "";
  const a = Math.max(0, Math.min(2.375, ((cmp / att) - 0.3) * 5));
  const b = Math.max(0, Math.min(2.375, ((yds / att) - 3) * 0.25));
  const cc = Math.max(0, Math.min(2.375, (td / att) * 20));
  const d = Math.max(0, Math.min(2.375, 2.375 - ((intc / att) * 25)));
  return Math.round(((a + b + cc + d) / 6) * 1000) / 10;
}

// Aggregate weekly player_stats -> season totals per player_id (offense/kicking).
function loadSeasonStats(season) {
  const file = `${SRC}/player_stats_${season}.csv`;
  if (!fs.existsSync(file)) return new Map();
  const rows = readCsv(file);
  const agg = new Map();
  for (const r of rows) {
    if (r.season_type && r.season_type !== "REG") continue;
    const id = r.player_id;
    if (!id) continue;
    const a = agg.get(id) || {
      games: 0, cmp: 0, att: 0, pass_yds: 0, pass_td: 0, pass_int: 0,
      rush_yds: 0, rush_td: 0, receptions: 0, rec_yds: 0, rec_td: 0,
    };
    a.games += 1;
    a.cmp += num(r.completions, 0);
    a.att += num(r.attempts, 0);
    a.pass_yds += num(r.passing_yards, 0);
    a.pass_td += num(r.passing_tds, 0);
    a.pass_int += num(r.interceptions, 0);
    a.rush_yds += num(r.rushing_yards, 0);
    a.rush_td += num(r.rushing_tds, 0);
    a.receptions += num(r.receptions, 0);
    a.rec_yds += num(r.receiving_yards, 0);
    a.rec_td += num(r.receiving_tds, 0);
    agg.set(id, a);
  }
  return agg;
}

function run() {
  const teams = readCsv(fromRoot("data", "teams.csv"));
  const teamName = new Map(teams.map((t) => [t.team_code, t.team_name || t.franchise]));
  const knownTeam = new Set(teams.map((t) => t.team_code));

  fs.mkdirSync(ROSTERS_OUT, { recursive: true });
  fs.mkdirSync(STATS_OUT, { recursive: true });

  let registry = readCsv(REGISTRY);
  const regIndex = new Map(registry.map((r) => [`${r.season}_${r.team_code}`, r]));

  log.step(`Adapting nflverse ${FROM}-${TO} -> 17-0 raw rosters`);

  let wroteRosters = 0;
  let skipped = 0;
  let wroteStats = 0;
  let totalPlayers = 0;
  const unknownCodes = new Set();

  for (let season = FROM; season <= TO; season++) {
    const rosterFile = `${SRC}/roster_${season}.csv`;
    if (!fs.existsSync(rosterFile)) continue;
    const rows = readCsv(rosterFile);
    const seasonStats = loadSeasonStats(season);

    // Group weekly rows -> one entry per player (keyed by gsis_id, else name+dob).
    const byPlayer = new Map();
    for (const r of rows) {
      if (r.status && !KEEP_STATUS.has(r.status.toUpperCase())) continue;
      const key = r.gsis_id || `${r.full_name}|${r.birth_date}`;
      if (!key || key === "|") continue;
      const p = byPlayer.get(key) || { rows: [], teams: [], positions: [], coarse: [] };
      p.rows.push(r);
      p.teams.push(normTeam(r.team, season));
      p.positions.push((r.depth_chart_position || "").toUpperCase());
      p.coarse.push((r.position || "").toUpperCase());
      byPlayer.set(key, p);
    }

    // Bucket players into their (normalized) team.
    const teamRosters = new Map();
    for (const [key, p] of byPlayer) {
      const team = mode(p.teams);
      if (!team) continue;
      if (!knownTeam.has(team)) unknownCodes.add(`${season}:${team}`);
      const pos = mapPosition(mode(p.positions), mode(p.coarse));
      if (!pos) continue; // e.g. long snapper -> skip
      const sample = p.rows;
      const name = firstNonEmpty(sample.map((r) => r.full_name));
      if (!name) continue;

      const st = seasonStats.get(key);
      // Role signal. Skill players: real games count from their season stat line
      // (e.g. an injured WR with 3 weeks reads as 3). Everyone else made a real
      // NFL active roster, so apply a modest availability baseline (an explicit
      // estimate) rather than flagging them needs_review — this keeps OL and
      // defenders as proper `generated` players and the draft pool playable.
      // TODO: replace the baseline with real games/starts from nflverse
      // snap_counts (2012+) for sharper non-skill ratings.
      const games = st ? st.games : 14;
      const gamesStarted = st && st.games >= 8 ? st.games : "";

      const stats = {};
      if (st) {
        if (st.pass_yds) stats.pass_yds = st.pass_yds;
        if (st.pass_td) stats.pass_td = st.pass_td;
        if (st.pass_int) stats.pass_int = st.pass_int;
        if (st.att) stats.passer_rating = passerRating(st.cmp, st.att, st.pass_yds, st.pass_td, st.pass_int);
        if (st.rush_yds) stats.rush_yds = st.rush_yds;
        if (st.rush_td) stats.rush_td = st.rush_td;
        if (st.receptions) stats.receptions = st.receptions;
        if (st.rec_yds) stats.rec_yds = st.rec_yds;
        if (st.rec_td) stats.rec_td = st.rec_td;
      }

      const player = {
        player_id: key.startsWith("00-") ? key : "", // keep gsis id when present
        name,
        position: pos,
        secondary_positions: MIRROR[pos] || "",
        jersey_number: firstNonEmpty(sample.map((r) => r.jersey_number)),
        height: firstNonEmpty(sample.map((r) => r.height)),
        weight: firstNonEmpty(sample.map((r) => r.weight)),
        birth_date: firstNonEmpty(sample.map((r) => r.birth_date)),
        college: firstNonEmpty(sample.map((r) => r.college)),
        years_exp: firstNonEmpty(sample.map((r) => r.years_exp)),
        games,
        games_started: gamesStarted,
        scout_grade: "",
        awards: "",
        notes: "nflverse",
        _stats: Object.keys(stats).length ? { player_id: key, ...stats } : null,
      };
      const list = teamRosters.get(team) || [];
      list.push(player);
      teamRosters.set(team, list);
    }

    // Write per-team-season roster + stats files; upsert the registry.
    for (const [team, players] of teamRosters) {
      const id = `${season}_${team}`;
      const rosterPath = `${ROSTERS_OUT}/${id}.csv`;
      if (fs.existsSync(rosterPath)) {
        // Never clobber a hand-curated roster. --force only refreshes files this
        // importer previously wrote (marked with the "nflverse" note).
        const existing = readCsv(rosterPath);
        const isOurs = existing.length === 0 || existing.every((r) => (r.notes || "").includes("nflverse"));
        if (!FORCE || !isOurs) {
          skipped++;
          continue;
        }
      }
      players.sort((a, b) => (num(b.games, 0) - num(a.games, 0)) || a.name.localeCompare(b.name));
      writeCsv(rosterPath, players, ROSTER_COLUMNS);
      wroteRosters++;
      totalPlayers += players.length;

      const statRows = players.filter((p) => p._stats).map((p) => p._stats);
      if (statRows.length) {
        writeCsv(`${STATS_OUT}/${id}.csv`, statRows, ["player_id", ...STAT_COLUMNS]);
        wroteStats++;
      }

      if (!regIndex.has(id)) {
        const row = {
          season: String(season), team_code: team,
          team_name: teamName.get(team) || team,
          wins: "", losses: "", ties: "",
          team_strength: "70", rating_source: "generated", rating_confidence: "0.55",
          roster_file: "", notes: "nflverse import",
        };
        registry.push(row);
        regIndex.set(id, row);
      }
    }
  }

  registry.sort((a, b) => num(a.season) - num(b.season) || String(a.team_code).localeCompare(b.team_code));
  writeCsv(REGISTRY, registry, TEAM_SEASON_COLUMNS);

  log.ok(`${wroteRosters} roster file(s) written (${totalPlayers} players), ${wroteStats} stats file(s)` + (skipped ? `, ${skipped} existing skipped` : ""));
  if (unknownCodes.size) {
    log.warn(`team codes not in teams.csv (first 12): ${[...unknownCodes].slice(0, 12).join(", ")}`);
  }
  log.info("next: npm run data:build");
}

run();
