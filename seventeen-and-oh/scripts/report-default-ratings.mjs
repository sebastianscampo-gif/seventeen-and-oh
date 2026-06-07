// report-default-ratings.mjs
// Step 6 deliverable: reports/default_rating_players.csv
//
// After the Phase 2 engine rework, no roster is parked on a single flat number
// anymore — but ~51% of player-seasons still rest on a *position prior alone*
// (bio-only imports with no recorded starts, box score, awards, or experience to
// separate one player from another within their position group). Those are what
// the brief calls "default ratings": individualized only by position value, not
// by anything the player actually did.
//
// This report lists every such player with a reason and a recommended next step,
// sorted so the simulation-critical, action-worthy rows (starting-QB-caliber and
// premium defensive slots) float to the top and the long tail of acceptable
// depth-player provisionals sits below. It is read-only and reproducible.
//
// Run:  node scripts/report-default-ratings.mjs   (or: npm run ratings:defaults)

import { readCsv, writeCsv } from "./lib/csv.mjs";
import { POSITION_GROUP, STATUS } from "./lib/schema.mjs";
import { fromRoot, log, num } from "./lib/util.mjs";

// Exact column order the brief asked for (no extra columns leak into the file).
const COLUMNS = [
  "player_id", "name", "team_code", "season", "position",
  "current_overall", "reason_flagged", "recommended_next_step",
];

// Triage weight by position group: higher = more simulation-critical / more
// likely a wrong "default" actually hurts gameplay. Used only for sorting.
const PRIORITY = {
  QB: 6,
  EDGE: 5, CB: 5, S: 5, DL: 5, LB: 5, // pre-box-score defensive starters
  WR: 4, TE: 4, RB: 4,                // skill players with no production on file
  OL: 3,                             // linemen (never had a box score)
  K: 1, P: 1,                        // specialists; a default here barely matters
};

// Reason + recommended next step, tailored to the position group so a reviewer
// can tell an action-needed row (starting QB, premium defender) from an
// acceptable provisional depth rating.
function classify(group) {
  switch (group) {
    case "QB":
      return {
        reason:
          "Starting-QB-critical, rated on a position prior only: no recorded starts, box score, or experience, and the QB room had no signal to tell starter from backup.",
        step:
          "Designate the season's starter (add games_started) or add a manual override if this is a known starter/legend.",
      };
    case "EDGE": case "CB": case "S": case "DL": case "LB":
      return {
        reason:
          "Defensive starter-caliber slot rated on a position prior only: pre-box-score era, no starts or stats to measure the player's performance.",
        step:
          "Add recorded starts/box score if available, or a manual override for a known starter; otherwise accept as a provisional rating.",
      };
    case "OL":
      return {
        reason:
          "Offensive lineman rated on a position prior only: OL carries no box score and this roster had no recorded starts to infer a depth order.",
        step:
          "Add recorded starts or team rushing/sack context; override known long-time starters. Acceptable as provisional otherwise.",
      };
    case "WR": case "TE": case "RB":
      return {
        reason:
          "Skill player rated on a position prior only: no production on file for this season and the roster gave no signal to rank within the position group.",
        step:
          "Add box-score stats or recorded starts if available; override known contributors. Acceptable as provisional otherwise.",
      };
    default: // K / P and anything else
      return {
        reason:
          "Specialist/depth player rated on a position prior only: no stats or starts on file.",
        step:
          "Acceptable provisional rating; add an override only if this player was a notable starter.",
      };
  }
}

function run() {
  log.step("Reporting players on default (position-prior-only) ratings");

  const ratings = readCsv(fromRoot("data", "processed", "ratings.csv"));
  if (ratings.length === 0) {
    log.warn("No ratings.csv — run generate-ratings first.");
    return;
  }
  const playerSeasons = readCsv(fromRoot("data", "processed", "player_seasons.csv"));
  const meta = new Map();
  for (const p of playerSeasons) {
    meta.set(`${p.player_id}|${num(p.season)}|${p.team_code}`, { name: p.name, position: p.position });
  }

  const rows = [];
  const byGroup = {};
  for (const r of ratings) {
    // A "default" rating = a low-confidence generated rating whose basis is the
    // position prior alone (the engine writes that phrase into the note when a
    // position group on a roster carried no signal to separate its players).
    if (r.status !== STATUS.GENERATED_LOW) continue;
    if (!(r.note || "").includes("position-based prior")) continue;

    const m = meta.get(`${r.player_id}|${num(r.season)}|${r.team_code}`) || {};
    const position = m.position || "";
    const group = POSITION_GROUP[position] || "";
    const { reason, step } = classify(group);
    byGroup[group] = (byGroup[group] || 0) + 1;

    rows.push({
      _priority: (PRIORITY[group] ?? 2) * 1000 + num(r.overall, 0),
      player_id: r.player_id,
      name: m.name || r.player_id,
      team_code: r.team_code,
      season: num(r.season),
      position,
      current_overall: num(r.overall),
      reason_flagged: reason,
      recommended_next_step: step,
    });
  }

  // Action-worthy rows first (QBs, premium defenders), depth tail last.
  rows.sort(
    (a, b) =>
      b._priority - a._priority ||
      a.season - b.season ||
      a.team_code.localeCompare(b.team_code) ||
      a.name.localeCompare(b.name)
  );
  for (const r of rows) delete r._priority; // keep the file to the 8 spec columns

  writeCsv(fromRoot("reports", "default_rating_players.csv"), rows, COLUMNS);

  log.ok(`${rows.length} players on default (position-prior-only) ratings written`);
  log.info(
    "by position group: " +
      Object.entries(byGroup)
        .sort((a, b) => b[1] - a[1])
        .map(([g, n]) => `${g}=${n}`)
        .join("  ")
  );
  log.info("sorted action-worthy first (QB > premium defense > skill > OL > specialist).");
}

run();
