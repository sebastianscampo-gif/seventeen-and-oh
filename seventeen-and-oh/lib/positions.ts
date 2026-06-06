import { Position, RosterSlot, Side } from "./types";

export const POSITION_NAMES: Record<Position, string> = {
  QB: "Quarterback",
  RB: "Running Back",
  WR: "Wide Receiver",
  TE: "Tight End",
  LT: "Left Tackle",
  LG: "Left Guard",
  C: "Center",
  RG: "Right Guard",
  RT: "Right Tackle",
  EDGE: "Edge Rusher",
  DT: "Defensive Tackle",
  LB: "Linebacker",
  CB: "Cornerback",
  S: "Safety",
  K: "Kicker",
  P: "Punter",
};

export const POSITION_SIDE: Record<Position, Side> = {
  QB: "OFF", RB: "OFF", WR: "OFF", TE: "OFF",
  LT: "OFF", LG: "OFF", C: "OFF", RG: "OFF", RT: "OFF",
  EDGE: "DEF", DT: "DEF", LB: "DEF", CB: "DEF", S: "DEF",
  K: "ST", P: "ST",
};

export const SIDE_NAMES: Record<Side, string> = {
  OFF: "Offense",
  DEF: "Defense",
  ST: "Special Teams",
};

// Roster requirements. Order defines draft slot order.
export const ROSTER_TEMPLATE: {
  position: Position;
  count: number;
  optional?: boolean;
}[] = [
  { position: "QB", count: 1 },
  { position: "RB", count: 1 },
  { position: "WR", count: 3 },
  { position: "TE", count: 1 },
  { position: "LT", count: 1 },
  { position: "LG", count: 1 },
  { position: "C", count: 1 },
  { position: "RG", count: 1 },
  { position: "RT", count: 1 },
  { position: "EDGE", count: 2 },
  { position: "DT", count: 2 },
  { position: "LB", count: 2 },
  { position: "CB", count: 3 },
  { position: "S", count: 2 },
  { position: "K", count: 1, optional: true },
  { position: "P", count: 1, optional: true },
];

export function createEmptyRoster(): RosterSlot[] {
  const slots: RosterSlot[] = [];
  for (const { position, count, optional } of ROSTER_TEMPLATE) {
    for (let i = 1; i <= count; i++) {
      slots.push({
        id: count > 1 ? `${position}-${i}` : position,
        position,
        label: count > 1 ? `${position}${i}` : position,
        side: POSITION_SIDE[position],
        optional: !!optional,
        player: null,
        fit: null,
        effectiveRating: null,
      });
    }
  }
  return slots;
}

// Position-fit matrix: natural position -> { slot position: multiplier }.
// Anything not listed falls back to WRONG_FIT (out of position).
const FIT: Record<Position, Partial<Record<Position, number>>> = {
  QB: {}, // a QB is heavily penalized anywhere but QB
  RB: { WR: 0.74, TE: 0.68 },
  WR: { TE: 0.86, RB: 0.76, CB: 0.6, S: 0.55 },
  TE: { WR: 0.88, RB: 0.78, LT: 0.66, RT: 0.66, LG: 0.6, RG: 0.6, C: 0.58 },
  LT: { RT: 0.93, LG: 0.86, RG: 0.84, C: 0.8, TE: 0.64 },
  LG: { RG: 0.95, C: 0.9, LT: 0.86, RT: 0.85 },
  C: { LG: 0.92, RG: 0.92, LT: 0.8, RT: 0.8 },
  RG: { LG: 0.95, C: 0.9, RT: 0.86, LT: 0.85 },
  RT: { LT: 0.93, RG: 0.86, LG: 0.84, C: 0.8, TE: 0.64 },
  EDGE: { LB: 0.9, DT: 0.82, S: 0.58 },
  DT: { EDGE: 0.85, LB: 0.7 },
  LB: { EDGE: 0.88, S: 0.8, DT: 0.72, CB: 0.64 },
  CB: { S: 0.88, LB: 0.66, WR: 0.6 },
  S: { CB: 0.85, LB: 0.8, WR: 0.55 },
  K: { P: 0.82 },
  P: { K: 0.82 },
};

const WRONG_FIT = 0.52; // generic out-of-position
const QB_ELSEWHERE = 0.5; // QB at any non-QB slot
const SECONDARY_FLOOR = 0.93; // listed secondary positions play near-natural

// Returns a 0..1 multiplier applied to a player's overall in a given slot.
export function positionFit(
  natural: Position,
  secondary: Position[],
  slot: Position
): number {
  if (natural === slot) return 1;
  if (secondary?.includes(slot)) {
    return Math.max(SECONDARY_FLOOR, FIT[natural]?.[slot] ?? 0);
  }
  if (natural === "QB") return QB_ELSEWHERE;
  const m = FIT[natural]?.[slot];
  return m != null ? m : WRONG_FIT;
}

export type FitTone = "natural" | "similar" | "emergency" | "wrong";

export function fitTier(fit: number): { label: string; tone: FitTone } {
  if (fit >= 0.999) return { label: "Natural", tone: "natural" };
  if (fit >= 0.85) return { label: "Similar", tone: "similar" };
  if (fit >= 0.66) return { label: "Emergency", tone: "emergency" };
  return { label: "Out of position", tone: "wrong" };
}
