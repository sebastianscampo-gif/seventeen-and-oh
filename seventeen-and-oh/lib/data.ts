import type { GamePlayer, GameTeamSeason } from "./data-schema";
import { Player, Position, TeamSeason } from "./types";

// The game streams per-team-season JSON from /public on demand. Only a small
// index.json (one entry per team-season) is loaded up front; each team-season's
// full roster is fetched the first time it is drawn and then cached. This keeps
// the client lean even with the full ~1,500-team-season, 60-year database —
// nothing is bundled, everything is a static asset served from public/.
//
// To grow the dataset, drop roster CSVs in data/raw/rosters (or bulk-import via
// `npm run data:fetch && npm run data:adapt`) and re-run `npm run data:build`;
// the JSON files + index regenerate under public/team-seasons/.

const BASE = "/team-seasons";

/** One lightweight catalog entry (mirrors the exporter's index.json rows). */
export interface TeamSeasonSummary {
  id: string;
  season: number;
  team: string;
  teamCode: string;
  label: string;
  file: string;
  playerCount: number;
  ratingConfidence: number;
  ratingSource: string;
  needsReview: number;
}

/** Map a pipeline GamePlayer onto the lean runtime Player the UI expects. */
function toPlayer(gp: GamePlayer): Player {
  // Drop any null-valued attributes and keep the camelCased numbers the UI
  // sorts/labels directly.
  const attributes: Record<string, number> = {};
  for (const [k, v] of Object.entries(gp.attributes)) {
    if (typeof v === "number") attributes[k] = v;
  }

  const overall = gp.overall ?? 60; // fallback keeps needs_review players draftable

  return {
    // Globally unique across team-seasons so the same player in two seasons
    // never collide in the draft's draftedIds tracking.
    id: `${gp.playerId}-${gp.season}-${gp.teamCode}`.toLowerCase(),
    name: gp.name,
    team: gp.team,
    teamCode: gp.teamCode,
    season: gp.season,
    position: gp.position as Position,
    secondaryPositions: (gp.secondaryPositions ?? []) as Position[],
    overall,
    attributes,
    archetype: gp.archetype,
    era: gp.era,
    playoffClutch: gp.playoffClutch ?? overall,
    sourceNote: gp.sourceNote,
  };
}

/** Map a fetched team-season document onto the runtime TeamSeason. */
function toTeamSeason(ts: GameTeamSeason): TeamSeason {
  return {
    id: ts.id,
    team: ts.team,
    teamCode: ts.teamCode,
    season: ts.season,
    label: ts.label,
    players: ts.players.map(toPlayer),
  };
}

let indexPromise: Promise<TeamSeasonSummary[]> | null = null;
const teamSeasonCache = new Map<string, Promise<TeamSeason>>();

/** Load (and memoize) the catalog of every available team-season. */
export function loadIndex(): Promise<TeamSeasonSummary[]> {
  if (!indexPromise) {
    indexPromise = fetch(`${BASE}/index.json`).then((res) => {
      if (!res.ok) throw new Error(`Failed to load team-season index (${res.status})`);
      return res.json() as Promise<TeamSeasonSummary[]>;
    });
  }
  return indexPromise;
}

/** Fetch one team-season's full roster on demand, caching the result. */
export function loadTeamSeason(id: string): Promise<TeamSeason> {
  let cached = teamSeasonCache.get(id);
  if (!cached) {
    cached = fetch(`${BASE}/${id}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load team-season ${id} (${res.status})`);
        return res.json() as Promise<GameTeamSeason>;
      })
      .then(toTeamSeason);
    teamSeasonCache.set(id, cached);
  }
  return cached;
}
