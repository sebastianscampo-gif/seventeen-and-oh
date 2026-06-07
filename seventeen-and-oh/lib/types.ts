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

// A named rating bucket (offense, secondary, pass rush, ...). Used both for the
// user's roster profile and for ranking best/weakest units.
export interface UnitRating {
  key: string; // machine key, e.g. "secondary"
  name: string; // display name, e.g. "Secondary"
  rating: number; // 0..100
}

// Granular, sim-ready breakdown of the user's drafted roster. Derived from the
// roster once it is fully filled (see lib/team-profile.ts).
export interface TeamProfile {
  power: number; // composite 0..100 used as the team's base strength
  offense: number;
  defense: number;
  qb: number;
  passOff: number; // passing game (QB + receivers + protection)
  rushOff: number; // running game (line + back)
  oLine: number; // offensive line
  passRush: number; // EDGE + DT getting after the QB
  runDef: number; // front seven vs the run
  secondary: number; // CB + S coverage
  linebackers: number;
  receivers: number; // WR + TE
  specialTeams: number;
  starCount: number; // starters rated at/above the star threshold
  clutch: number; // playoff-clutch average (QB-weighted)
  units: UnitRating[]; // every unit, for best/weakest ranking
  bestUnit: UnitRating;
  weakestUnit: UnitRating;
  bestPlayer: { name: string; position: Position; rating: number };
  biggestWeakness: { name: string; position: Position; rating: number };
}

// One matchup edge in a single game (used for upset explanations + debug).
export interface MatchupEdge {
  key: string;
  label: string; // human description, e.g. "Offensive line vs pass rush"
  value: number; // signed power points (favoring user when positive)
}

export interface GameResult {
  round: string; // "Regular Season", "Divisional Round", ...
  opponent: string;
  opponentPower: number;
  win: boolean;
  ourScore: number;
  oppScore: number;
  winProb: number; // pre-game win probability (for debug mode)
  homeField: boolean;
  upset: boolean; // true when the lower-power team won
  note: string | null; // short explanation for notable / upset games
  edges: MatchupEdge[]; // matchup breakdown that fed this game
}

export type Ending =
  | "perfect" // 17-0 + Super Bowl
  | "ringless-perfect" // 17-0 but lost in playoffs
  | "upset-champ" // won it all as an underdog / on upsets
  | "champ-imperfect" // Super Bowl win, not 17-0
  | "great-team-bad-ending" // elite roster, early exit or missed playoffs
  | "deep-run" // reached conference title / Super Bowl, lost
  | "one-and-done" // lost first playoff game
  | "missed-playoffs" // did not reach the playoffs
  | "disappointing"; // poor record, well short of January

// Monte-Carlo estimate of the roster's true odds (shown in debug mode).
export interface SeasonOdds {
  expectedWins: number;
  playoffOdds: number; // 0..1
  superBowlOdds: number; // 0..1
  perfectOdds: number; // 0..1 (17-0 + ring)
  winDistribution: number[]; // length 18: probability of finishing with N wins
}

// Post-season "why did this happen" breakdown shown on the result screen.
export interface ResultExplanation {
  summary: string;
  offense: number;
  defense: number;
  bestUnit: UnitRating;
  weakestUnit: UnitRating;
  bestPlayer: { name: string; position: Position; rating: number };
  biggestWeakness: { name: string; position: Position; rating: number };
  playoffResult: string;
  superBowlResult: string;
}

export interface SimulationResult {
  wins: number;
  losses: number;
  perfectRegularSeason: boolean;
  madePlayoffs: boolean;
  superBowlChampion: boolean;
  seed: number | null; // playoff seed (1..7), null if missed
  teamPower: number;
  regularSeason: GameResult[];
  playoffs: GameResult[];
  eliminatedRound: string | null;
  ending: Ending;
  endingTitle: string;
  endingSubtitle: string;
  profile: TeamProfile;
  explanation: ResultExplanation;
  odds: SeasonOdds;
}
