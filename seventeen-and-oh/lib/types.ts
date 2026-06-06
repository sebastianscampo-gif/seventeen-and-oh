// Core data schema for 17-0

export type Position =
  | "QB" | "RB" | "WR" | "TE"
  | "LT" | "LG" | "C" | "RG" | "RT"
  | "EDGE" | "DT" | "LB" | "CB" | "S"
  | "K" | "P";

export type Side = "OFF" | "DEF" | "ST";

export type GameMode = "classic" | "blind";

export interface PlayerAttributes {
  [key: string]: number;
}

export interface Player {
  id: string;
  name: string;
  team: string;
  teamCode: string;
  season: number;
  position: Position;
  secondaryPositions: Position[];
  overall: number;
  attributes: PlayerAttributes;
  archetype: string;
  era: string;
  playoffClutch: number;
  sourceNote: string;
}

export interface TeamSeason {
  id: string; // `${season}-${teamCode}`
  team: string;
  teamCode: string;
  season: number;
  label: string; // "2007 New England Patriots"
  players: Player[];
}

export interface RosterSlot {
  id: string; // unique, e.g. "WR-2"
  position: Position;
  label: string; // "WR2"
  side: Side;
  optional: boolean; // K / P
  player: Player | null;
  fit: number | null; // 0..1 multiplier in this slot
  effectiveRating: number | null; // round(overall * fit)
}

export interface DraftState {
  mode: GameMode;
  roundIndex: number; // 0-based; equals picks made
  totalRounds: number;
  teamSeason: TeamSeason | null;
  draftedPlayerIds: string[];
  roster: RosterSlot[];
  status: "drafting" | "complete";
}

export interface ScoreBreakdown {
  offense: number;
  defense: number;
  fit: number;
  balance: number;
  star: number;
  total: number; // weighted final, 0..100
}

export interface GameResult {
  round: string; // "Regular Season", "Divisional Round", ...
  opponent: string;
  win: boolean;
  ourScore: number;
  oppScore: number;
}

export type Ending =
  | "perfect" // 17-0 + Super Bowl
  | "ringless-perfect" // 17-0 but lost in playoffs
  | "champ-imperfect" // Super Bowl win, not 17-0
  | "playoff-loss" // lost in playoffs, not perfect
  | "missed-playoffs"; // did not reach the playoffs

export interface SimulationResult {
  wins: number;
  losses: number;
  perfectRegularSeason: boolean;
  madePlayoffs: boolean;
  superBowlChampion: boolean;
  regularSeason: GameResult[];
  playoffs: GameResult[];
  eliminatedRound: string | null;
  ending: Ending;
  endingTitle: string;
  endingSubtitle: string;
  perGameWinProb: number;
}
