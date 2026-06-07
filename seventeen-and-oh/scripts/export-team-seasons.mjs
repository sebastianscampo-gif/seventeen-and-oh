// export-team-seasons.mjs
// Builds the game-ready data from the processed CSVs:
//   public/team-seasons/<season>_<code>.json   one optimized file per team-season
//   public/team-seasons/index.json             lightweight manifest of all team-seasons
//
// Files land in public/ so Next serves them as static assets and the client
// fetches each team-season on demand (see lib/data.ts). This scales to the full
// ~1,500-team-season, 60-year database without bundling everything into the
// client — only the small index.json is loaded up front.
//
// Run:  node scripts/export-team-seasons.mjs   (or: npm run data:export)

import fs from "node:fs";
import { readCsv } from "./lib/csv.mjs";
import {
  ATTRIBUTE_FIELDS, RATING_FIELDS, STAT_COLUMNS, POSITIONS, POSITION_GROUP,
  POSITION_PROFILE, ENGINE_VERSION, SCHEMA_VERSION, STATUS,
} from "./lib/schema.mjs";
import { camel, eraOf, fromRoot, list, log, num, teamSeasonId, teamSeasonLabel } from "./lib/util.mjs";

const OUT_DIR = fromRoot("public", "team-seasons");

// The exported provenance line. Generated rows now carry a specific, one-line
// `rating_reason` in `note` (e.g. "Rated 78: inferred WR2 by depth rank…"), so we
// surface it directly when present and only fall back to generic per-status text
// when a row has no reason. Manual rows keep their human-authored note.
function sourceNote(status, note, confidence) {
  switch (status) {
    case STATUS.MANUAL_OVERRIDE: return note ? `Manual override: ${note}` : "Manual override.";
    case STATUS.MANUALLY_REVIEWED: return note ? `Reviewed: ${note}` : "Reviewed — generated values confirmed.";
    case STATUS.NEEDS_REVIEW: return note || "Incomplete data — provisional rating, needs review.";
    case STATUS.MISSING_DATA: return note || "Missing position/data — generic fallback rating.";
    case STATUS.GENERATED_HIGH: return note || `Generated — high confidence (${confidence}); backed by stats/awards or recorded starts.`;
    case STATUS.GENERATED_MEDIUM: return note || `Generated — medium confidence (${confidence}); partial evidence.`;
    case STATUS.GENERATED_LOW: return note || `Generated — low confidence (${confidence}); role inferred from availability only.`;
    default: return note || `Generated rating (confidence ${confidence}).`;
  }
}

function run() {
  log.step("Exporting game-ready team-seasons");

  const registry = readCsv(fromRoot("data", "team_seasons.csv"));
  const teams = readCsv(fromRoot("data", "teams.csv"));
  const playerSeasons = readCsv(fromRoot("data", "processed", "player_seasons.csv"));
  const ratings = readCsv(fromRoot("data", "processed", "ratings.csv"));

  if (registry.length === 0 || playerSeasons.length === 0) {
    log.warn("Missing registry or player_seasons — run import/ratings first.");
    return;
  }

  const teamName = new Map(teams.map((t) => [t.team_code, t.team_name]));
  const ratingByKey = new Map();
  for (const r of ratings) ratingByKey.set(`${r.player_id}|${num(r.season)}|${r.team_code}`, r);

  const psByTs = new Map();
  for (const p of playerSeasons) {
    const id = teamSeasonId(num(p.season), p.team_code);
    (psByTs.get(id) || psByTs.set(id, []).get(id)).push(p);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = [];
  let fileCount = 0;

  for (const reg of registry) {
    const season = num(reg.season);
    const teamCode = reg.team_code;
    if (!season || !teamCode) continue;
    const id = teamSeasonId(season, teamCode);
    const roster = psByTs.get(id) || [];
    if (roster.length === 0) {
      log.warn(`No players for ${id}; skipping export.`);
      continue;
    }
    const team = reg.team_name || teamName.get(teamCode) || teamCode;

    const players = [];
    const ratingsMap = {};
    const statusCounts = {};
    let confSum = 0;
    let flaggedForReview = 0;
    const sourceTally = {};

    for (const p of roster) {
      const key = `${p.player_id}|${season}|${teamCode}`;
      const rr = ratingByKey.get(key);
      const ratingObj = {};
      for (const f of RATING_FIELDS) ratingObj[f] = rr ? num(rr[f]) : null;
      const status = rr?.status || STATUS.MISSING_DATA;
      const source = rr?.rating_source || "fallback";
      const confidence = rr ? num(rr.rating_confidence, 0) : 0;
      const note = rr?.note || "";
      const needsManualReview = rr?.needs_manual_review === "true";

      statusCounts[status] = (statusCounts[status] || 0) + 1;
      sourceTally[source] = (sourceTally[source] || 0) + 1;
      if (needsManualReview) flaggedForReview++;
      confSum += confidence;

      const group = POSITION_GROUP[p.position] || "";
      const attributes = {};
      for (const a of ATTRIBUTE_FIELDS) {
        if (a === "playoff_clutch") continue; // surfaced as playoffClutch
        attributes[camel(a)] = ratingObj[a];
      }

      // Carry through any non-blank box-score stats for transparency / UI.
      const stats = {};
      for (const c of STAT_COLUMNS) if (p[c] !== "" && p[c] != null) stats[camel(c)] = num(p[c]);

      const player = {
        id: p.player_id,
        playerId: p.player_id,
        name: p.name,
        team,
        teamCode,
        season,
        position: p.position,
        secondaryPositions: list(p.secondary_positions),
        jerseyNumber: p.jersey_number || null,
        height: p.height || null,
        weight: num(p.weight),
        birthDate: p.birth_date || null,
        college: p.college || null,
        yearsExp: num(p.years_exp),
        games: num(p.games),
        gamesStarted: num(p.games_started),
        awards: list(p.awards),
        overall: ratingObj.overall,
        playoffClutch: ratingObj.playoff_clutch,
        attributes,
        rating: ratingObj,
        stats,
        status,
        ratingSource: source,
        ratingConfidence: confidence,
        needsManualReview,
        ratingReason: note,
        archetype: POSITION_PROFILE[group]?.archetype || p.position,
        era: eraOf(season),
        sourceNote: sourceNote(status, note, confidence),
      };
      players.push(player);
      ratingsMap[p.player_id] = {
        ...ratingObj, status, source, confidence,
      };
    }

    // Sort by overall (best first) for stable, draft-friendly ordering.
    players.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0) || a.name.localeCompare(b.name));

    const positions = {};
    for (const pos of POSITIONS) positions[pos] = [];
    for (const pl of players) (positions[pl.position] || (positions[pl.position] = [])).push(pl.id);

    const available = players.map((p) => p.id);
    const dominantSource = Object.entries(sourceTally).sort((a, b) => b[1] - a[1])[0]?.[0] || "generated";
    const needsReview = (statusCounts[STATUS.NEEDS_REVIEW] || 0) + (statusCounts[STATUS.MISSING_DATA] || 0);

    const doc = {
      schemaVersion: SCHEMA_VERSION,
      id,
      teamSeasonId: id,
      season,
      team,
      teamCode,
      label: teamSeasonLabel(season, team),
      record: { wins: num(reg.wins), losses: num(reg.losses), ties: num(reg.ties, 0) },
      metadata: {
        ratingSource: dominantSource,
        ratingConfidence: Math.round((confSum / players.length) * 100) / 100,
        engineVersion: ENGINE_VERSION,
        generatedAt: new Date().toISOString(),
        playerCount: players.length,
        statusCounts,
        needsReview,
        needsManualReview: flaggedForReview,
        teamStrength: num(reg.team_strength, 70),
        notes: reg.notes || "",
      },
      positions,
      players,
      ratings: ratingsMap,
      roster: available,
      draftPool: { available, byPosition: positions },
    };

    fs.writeFileSync(`${OUT_DIR}/${id}.json`, JSON.stringify(doc) + "\n");
    fileCount++;

    manifest.push({
      id, season, team, teamCode,
      label: doc.label,
      file: `${id}.json`,
      playerCount: players.length,
      ratingConfidence: doc.metadata.ratingConfidence,
      ratingSource: dominantSource,
      needsReview,
      needsManualReview: flaggedForReview,
      statusCounts,
    });
  }

  manifest.sort((a, b) => a.season - b.season || a.teamCode.localeCompare(b.teamCode));
  fs.writeFileSync(`${OUT_DIR}/index.json`, JSON.stringify(manifest, null, 2) + "\n");

  log.ok(`${fileCount} team-season JSON files + index.json written to public/team-seasons/`);
  log.info("the app fetches these on demand via lib/data.ts (no client bundle barrel).");
}

run();
