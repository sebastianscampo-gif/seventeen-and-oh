// Shared roster-quality metrics. Reads the exported public/team-seasons/*.json
// and reduces each roster to the numbers the rating-bug reports need:
// distribution shape, generic-band saturation, sameness, spread, and a
// heuristic "suspicious" classification. Pure functions so both the BEFORE/AFTER
// snapshotter and the full-database scan share one definition of "suspicious".

import fs from "node:fs";
import path from "node:path";

export const TEAM_SEASONS_DIR = path.join(
  process.cwd(),
  "public",
  "team-seasons"
);

// The generic-fallback band the brief calls out: players parked at 67-71 because
// the engine had no signal to separate them.
export const GENERIC_LO = 67;
export const GENERIC_HI = 71;

export function listTeamSeasonFiles(dir = TEAM_SEASONS_DIR) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .sort();
}

export function readRoster(file, dir = TEAM_SEASONS_DIR) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  return d;
}

const round1 = (x) => Math.round(x * 10) / 10;

// Reduce one exported team-season to a metrics row.
export function rosterMetrics(d) {
  const players = Array.isArray(d.players) ? d.players : [];
  const teamCode = d.teamCode ?? "";
  const teamName = d.team ?? d.label ?? "";
  const season = d.season ?? "";
  const n = players.length;

  if (n === 0) {
    return {
      team_code: teamCode, team_name: teamName, season,
      players_total: 0, avg_ovr: 0, max_ovr: 0, min_ovr: 0,
      rating_spread: 0, pct_67_71: 0, pct_same_rating: 0,
      highest_rated_player: "", highest_ovr: 0,
      modal_rating: 0, suspicious_reason: "empty_roster",
    };
  }

  const ovr = players.map((p) => Number(p.overall) || 0);
  const sum = ovr.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  const max = Math.max(...ovr);
  const min = Math.min(...ovr);

  // Generic-band saturation.
  const inBand = ovr.filter((v) => v >= GENERIC_LO && v <= GENERIC_HI).length;
  const pct_67_71 = round1((100 * inBand) / n);

  // Sameness: share sitting on the single most common rating value.
  const counts = new Map();
  for (const v of ovr) counts.set(v, (counts.get(v) || 0) + 1);
  let modalRating = ovr[0];
  let modalCount = 0;
  for (const [v, c] of counts) {
    if (c > modalCount || (c === modalCount && v < modalRating)) {
      modalCount = c;
      modalRating = v;
    }
  }
  const pct_same = round1((100 * modalCount) / n);

  // Highest-rated player (name + ovr).
  let top = players[0];
  for (const p of players) if ((Number(p.overall) || 0) > (Number(top.overall) || 0)) top = p;

  const spread = max - min;

  // Heuristic "suspicious" classification — ordered by severity. A roster is
  // flagged when its shape looks engine-starved rather than talent-graded.
  const reasons = [];
  if (pct_67_71 >= 50) reasons.push(`>=50% in ${GENERIC_LO}-${GENERIC_HI} band`);
  else if (pct_67_71 >= 35) reasons.push(`>=35% in ${GENERIC_LO}-${GENERIC_HI} band`);
  if (pct_same >= 40) reasons.push(`>=40% share one rating (${modalRating})`);
  if (spread <= 12) reasons.push(`compressed spread (${spread})`);
  if (max < 80) reasons.push(`no player >=80 (top ${max})`);
  const suspicious_reason = reasons.join("; ");

  return {
    team_code: teamCode, team_name: teamName, season,
    players_total: n,
    avg_ovr: round1(avg),
    max_ovr: max,
    min_ovr: min,
    rating_spread: spread,
    pct_67_71,
    pct_same_rating: pct_same,
    highest_rated_player: top?.name ?? "",
    highest_ovr: Number(top?.overall) || 0,
    modal_rating: modalRating,
    suspicious_reason,
  };
}

export function isSuspicious(m) {
  return m.suspicious_reason.length > 0 && m.players_total > 0;
}

// Build metrics for every exported team-season.
export function allRosterMetrics(dir = TEAM_SEASONS_DIR) {
  return listTeamSeasonFiles(dir).map((f) => rosterMetrics(readRoster(f, dir)));
}
