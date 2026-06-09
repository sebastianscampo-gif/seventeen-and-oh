// Extract every 1999 player from the exported team-season JSONs into one flat
// table: identity + role + key box-score stats + current rating. Serves as both
// the BEFORE snapshot (for the before/after report) and the authoring reference
// for the curated override pass. Read-only; writes reports/_work/1999_before.csv.

import fs from "node:fs";
import path from "node:path";
import { writeCsv } from "./lib/csv.mjs";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "public", "team-seasons");
const OUTDIR = path.join(ROOT, "reports", "_work");
fs.mkdirSync(OUTDIR, { recursive: true });

const files = fs.readdirSync(DIR).filter((f) => /^1999_/.test(f) && f.endsWith(".json")).sort();
const rows = [];
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  for (const p of d.players) {
    const s = p.stats || {};
    rows.push({
      team_code: d.teamCode,
      team_name: d.team,
      player_id: p.playerId || p.id,
      name: p.name,
      position: p.position,
      games: p.games ?? "",
      games_started: p.gamesStarted ?? "",
      overall: p.overall ?? "",
      status: p.status || "",
      confidence: p.ratingConfidence ?? "",
      needs_review: p.needsManualReview ? "true" : "",
      pass_yds: s.passYds ?? "", pass_td: s.passTd ?? "", pass_int: s.passInt ?? "",
      rush_yds: s.rushYds ?? "", rush_td: s.rushTd ?? "",
      receptions: s.receptions ?? "", rec_yds: s.recYds ?? "", rec_td: s.recTd ?? "",
    });
  }
}

const cols = [
  "team_code", "team_name", "player_id", "name", "position", "games", "games_started",
  "overall", "status", "confidence", "needs_review",
  "pass_yds", "pass_td", "pass_int", "rush_yds", "rush_td", "receptions", "rec_yds", "rec_td",
];
writeCsv(path.join(OUTDIR, "1999_before.csv"), rows, cols);
console.log(`extracted ${rows.length} player-rows from ${files.length} teams -> reports/_work/1999_before.csv`);

// quick per-team player counts
const byTeam = {};
for (const r of rows) byTeam[r.team_code] = (byTeam[r.team_code] || 0) + 1;
console.log(Object.entries(byTeam).map(([k, v]) => `${k}:${v}`).join("  "));
