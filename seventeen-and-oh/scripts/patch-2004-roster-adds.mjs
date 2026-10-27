// One-shot roster patch for the 2004 season overhaul. The nflverse roster import
// for 2004 carries almost no LB/S rows and omits several defensive stars outright
// (the Ravens' 45-man 2004 file has no Ed Reed and no Ray Lewis). The 2004 brief
// asks for Baltimore's elite defensive talent -- Ed Reed's Defensive Player of the
// Year season above all -- to be rated, which is impossible for players that are
// not on the roster at all. This adds exactly those two Ravens, and fixes the one
// clear position-mapping error found in the audit (Chris Cooley is a tight end,
// not a running back).
//
// It edits the raw roster/stats files AND the processed tables directly instead
// of re-running the importer: the importer cannot be re-run as-is (it would
// re-register the Rams as "STL" and rewrite every season). Idempotent.
//
// Run: node scripts/patch-2004-roster-adds.mjs

import fs from "node:fs";
import path from "node:path";
import { readCsv, writeCsv } from "./lib/csv.mjs";
import { PLAYER_SEASON_COLUMNS, PLAYERS_COLUMNS } from "./lib/schema.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW_ROSTER = path.join(ROOT, "data/raw/rosters/2004_BAL.csv");
const RAW_STATS = path.join(ROOT, "data/raw/stats/2004_BAL.csv");
const RAW_WAS = path.join(ROOT, "data/raw/rosters/2004_WAS.csv");
const PS = path.join(ROOT, "data/processed/player_seasons.csv");
const PL = path.join(ROOT, "data/processed/players.csv");

const NOTE = "manual-add: omitted from nflverse import";
const ADDS = [
  {
    player_id: "ed-reed", name: "Ed Reed", position: "S", jersey_number: "20",
    height: "71", weight: "205", birth_date: "1978-09-11", years_exp: "2",
    games: "16", games_started: "16",
    awards: "Defensive Player of the Year;First-Team All-Pro;Pro Bowl",
    def_int: "9", // NFL-leading 9 interceptions
  },
  {
    player_id: "00-0009889", name: "Ray Lewis", position: "LB", jersey_number: "52",
    height: "73", weight: "240", birth_date: "1975-05-15", years_exp: "8",
    games: "", games_started: "", awards: "Pro Bowl", def_int: "",
  },
];

function appendLine(file, line) {
  let raw = fs.readFileSync(file, "utf8");
  if (!raw.endsWith("\n")) raw += "\n";
  fs.writeFileSync(file, raw + line + "\n");
}

// --- raw roster + raw stats overlay (BAL) -----------------------------------
const rosterText = fs.readFileSync(RAW_ROSTER, "utf8");
for (const a of ADDS) {
  if (rosterText.includes(`,${a.name},`)) continue;
  // player_id,name,position,secondary_positions,jersey_number,height,weight,
  // birth_date,college,years_exp,games,games_started,scout_grade,awards,notes
  appendLine(
    RAW_ROSTER,
    [a.player_id, a.name, a.position, "", a.jersey_number, a.height, a.weight,
      a.birth_date, "", a.years_exp, a.games, a.games_started, "", a.awards, NOTE].join(","),
  );
  if (a.def_int) {
    // player_id,pass_yds,pass_td,pass_int,passer_rating,rush_yds,rush_td,receptions,
    // rec_yds,rec_td,sacks,tackles,def_int,forced_fumbles,fg_made,fg_att,fg_pct,punt_avg
    const cols = Array(17).fill("");
    cols[11] = a.def_int;
    appendLine(RAW_STATS, [a.player_id, ...cols].join(","));
  }
  console.log(`raw roster: added ${a.name} (BAL 2004)`);
}

// Chris Cooley: tight end, mis-tagged RB in the import.
const was = fs.readFileSync(RAW_WAS, "utf8");
if (was.includes("00-0022738,Chris Cooley,RB,")) {
  fs.writeFileSync(RAW_WAS, was.replace("00-0022738,Chris Cooley,RB,", "00-0022738,Chris Cooley,TE,"));
  console.log("raw roster: Chris Cooley RB -> TE (WAS 2004)");
}

// --- processed tables -------------------------------------------------------
const ps = readCsv(PS);
const key = (r) => [Number(r.season), r.team_code, r.name];
const cmp = (a, b) => {
  const x = key(a), y = key(b);
  return x[0] - y[0] || x[1].localeCompare(y[1]) || x[2].localeCompare(y[2]);
};
let psChanged = false;
for (const r of ps) {
  if (r.player_id === "00-0022738" && String(r.season) === "2004" && r.team_code === "WAS" && r.position === "RB") {
    r.position = "TE";
    psChanged = true;
    console.log("processed: Chris Cooley RB -> TE (WAS 2004)");
  }
}
for (const a of ADDS) {
  if (ps.some((r) => r.player_id === a.player_id && String(r.season) === "2004" && r.team_code === "BAL")) continue;
  const row = Object.fromEntries(PLAYER_SEASON_COLUMNS.map((c) => [c, ""]));
  Object.assign(row, {
    player_id: a.player_id, name: a.name, team: "Baltimore Ravens", team_code: "BAL", season: "2004",
    position: a.position, jersey_number: a.jersey_number, height: a.height, weight: a.weight,
    birth_date: a.birth_date, years_exp: a.years_exp, games: a.games, games_started: a.games_started,
    awards: a.awards, def_int: a.def_int, rating_source: "generated", rating_confidence: "0.55", notes: NOTE,
  });
  let i = ps.findIndex((r) => cmp(r, row) > 0);
  if (i < 0) i = ps.length;
  ps.splice(i, 0, row);
  psChanged = true;
  console.log(`processed: added ${a.name} (BAL 2004)`);
}
if (psChanged) writeCsv(PS, ps, PLAYER_SEASON_COLUMNS);

const pl = readCsv(PL);
let plChanged = false;
for (const a of ADDS) {
  const existing = pl.find((r) => r.player_id === a.player_id);
  if (existing) {
    const seasons = Number(existing.seasons_played || 0);
    if (Number(existing.last_season) < 2004) {
      existing.last_season = "2004";
      existing.seasons_played = String(seasons + 1);
      plChanged = true;
    }
    if (!String(existing.teams).split(";").includes("BAL")) {
      existing.teams = [...String(existing.teams).split(";").filter(Boolean), "BAL"].sort().join(";");
      plChanged = true;
    }
  } else {
    const row = Object.fromEntries(PLAYERS_COLUMNS.map((c) => [c, ""]));
    Object.assign(row, {
      player_id: a.player_id, name: a.name, primary_position: a.position, birth_date: a.birth_date,
      first_season: "2004", last_season: "2004", seasons_played: "1", teams: "BAL",
    });
    let i = pl.findIndex((r) => r.name.localeCompare(a.name) > 0);
    if (i < 0) i = pl.length;
    pl.splice(i, 0, row);
    plChanged = true;
  }
}
if (plChanged) {
  writeCsv(PL, pl, PLAYERS_COLUMNS);
  console.log("processed: players.csv updated");
}
console.log("done");
