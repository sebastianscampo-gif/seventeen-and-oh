// migrate-legacy-json.mjs  (one-off)
// Converts the legacy single-file dataset (data/players.json) into per
// team-season raw roster CSVs in the new pipeline format. The legacy hand
// "overall" is carried into the `scout_grade` column so the engine can
// reproduce a similar talent spread without fabricating awards or stats.
//
// Existing roster files are left untouched unless --force is passed, so this
// will not clobber hand-authored rosters.
//
// Run:  node scripts/migrate-legacy-json.mjs [--force]

import fs from "node:fs";
import { writeCsv } from "./lib/csv.mjs";
import { ROSTER_COLUMNS } from "./lib/schema.mjs";
import { fromRoot, log, playerIdFromName, teamSeasonId } from "./lib/util.mjs";

const FORCE = process.argv.includes("--force");
const LEGACY = fromRoot("data", "players.json");

function roleFromOverall(ovr) {
  if (ovr >= 80) return { games: 16, games_started: 16 };
  if (ovr >= 70) return { games: 16, games_started: 12 };
  return { games: 14, games_started: 6 };
}

function run() {
  if (!fs.existsSync(LEGACY)) {
    log.warn(`No legacy file at ${LEGACY}; nothing to migrate.`);
    return;
  }
  log.step("Migrating legacy players.json -> raw roster CSVs");
  const legacy = JSON.parse(fs.readFileSync(LEGACY, "utf8"));

  const byTs = new Map();
  for (const p of legacy) {
    const id = teamSeasonId(p.season, p.teamCode);
    (byTs.get(id) || byTs.set(id, []).get(id)).push(p);
  }

  let written = 0;
  let skipped = 0;
  for (const [id, players] of byTs) {
    const file = fromRoot("data", "raw", "rosters", `${id}.csv`);
    if (fs.existsSync(file) && !FORCE) {
      log.info(`exists, skipping ${id}.csv (use --force to overwrite)`);
      skipped++;
      continue;
    }
    const rows = players
      .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
      .map((p) => {
        const role = roleFromOverall(p.overall ?? 70);
        return {
          player_id: playerIdFromName(p.name),
          name: p.name,
          position: p.position,
          secondary_positions: (p.secondaryPositions || []).join(";"),
          jersey_number: "",
          height: "",
          weight: "",
          birth_date: "",
          college: "",
          years_exp: "",
          games: role.games,
          games_started: role.games_started,
          scout_grade: p.overall ?? "",
          awards: "",
          notes: p.sourceNote || "migrated from legacy players.json",
        };
      });
    writeCsv(file, rows, ROSTER_COLUMNS);
    written++;
  }
  log.ok(`${written} roster file(s) written, ${skipped} skipped`);
}

run();
