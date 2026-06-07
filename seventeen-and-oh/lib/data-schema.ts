// Types for the game-ready team-season JSON produced by the data pipeline
// (scripts/export-team-seasons.mjs). The app fetches these on demand from
// public/team-seasons/ (see lib/data.ts) and maps them onto the runtime
// Player / TeamSeason shapes there.
//
// This file is hand-written but mirrors the exporter's output exactly. If you
// change the export shape, update these types to match.

import type { Position } from "./types";

export type RatingStatus =
  // Generated ratings carry a confidence tier reflecting how much real evidence
  // (recorded starts, box-score stats, awards, scouting prior) backed them.
  | "generated_high_confidence"
  | "generated_medium_confidence"
  | "generated_low_confidence"
  | "generated" // legacy single-tier label, still accepted
  | "manually_reviewed"
  | "manual_override"
  | "missing_data"
  | "needs_review";

export type RatingSource = "generated" | "manual" | "fallback";

/** Full snake-cased rating block: overall + 21 attributes. Null when unrated. */
export interface GameRating {
  overall: number | null;
  speed: number | null;
  strength: number | null;
  awareness: number | null;
  pass_rating: number | null;
  run_rating: number | null;
  receiving: number | null;
  blocking: number | null;
  pass_block: number | null;
  run_block: number | null;
  pass_rush: number | null;
  run_defense: number | null;
  tackling: number | null;
  coverage: number | null;
  man_coverage: number | null;
  zone_coverage: number | null;
  hands: number | null;
  kicking: number | null;
  punting: number | null;
  clutch: number | null;
  playoff_clutch: number | null;
  durability: number | null;
}

/** camelCased attributes surfaced for the UI (playoffClutch is hoisted out). */
export type GameAttributes = Record<string, number | null>;

export interface GamePlayer {
  id: string;
  playerId: string;
  name: string;
  team: string;
  teamCode: string;
  season: number;
  position: Position;
  secondaryPositions: Position[];
  jerseyNumber: string | null;
  height: string | null;
  weight: number | null;
  birthDate: string | null;
  college: string | null;
  yearsExp: number | null;
  games: number | null;
  gamesStarted: number | null;
  awards: string[];
  overall: number | null;
  playoffClutch: number | null;
  attributes: GameAttributes;
  rating: GameRating;
  stats: Record<string, number>;
  status: RatingStatus;
  ratingSource: RatingSource;
  ratingConfidence: number;
  archetype: string;
  era: string;
  sourceNote: string;
}

export interface GameTeamSeasonMetadata {
  ratingSource: string;
  ratingConfidence: number;
  engineVersion: string;
  generatedAt: string;
  playerCount: number;
  statusCounts: Record<string, number>;
  needsReview: number;
  teamStrength: number;
  notes: string;
}

export interface GameTeamSeasonRatingEntry extends GameRating {
  status: RatingStatus;
  source: RatingSource;
  confidence: number;
}

export interface GameTeamSeason {
  schemaVersion: number;
  id: string;
  teamSeasonId: string;
  season: number;
  team: string;
  teamCode: string;
  label: string;
  record: { wins: number; losses: number; ties: number };
  metadata: GameTeamSeasonMetadata;
  positions: Record<string, string[]>;
  players: GamePlayer[];
  ratings: Record<string, GameTeamSeasonRatingEntry>;
  roster: string[];
  draftPool: { available: string[]; byPosition: Record<string, string[]> };
}
