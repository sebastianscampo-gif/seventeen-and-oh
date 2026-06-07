// lib/field-layout.ts
// Fixed formation coordinates for the football-field roster map. Keyed by the
// real RosterSlot.id values produced by createEmptyRoster() (lib/positions.ts),
// so the field ALWAYS matches the slots the game actually uses — no invented
// positions. Framework-free so it can be unit-tested and shared.
//
// Coordinate system (percentages of the field box):
//   x: 0 = left sideline ............ 100 = right sideline
//   y: 0 = defense's deep zone (top)  100 = offense backfield (bottom)
// The line of scrimmage sits at y ≈ 52: defense above it, offense below it.

export interface FieldCoord {
  x: number;
  y: number;
}

export const LINE_OF_SCRIMMAGE = 52;

// One coordinate per real slot id. Offense is a 3-WR set (WR-3 in the slot);
// defense is the roster's 4-2-5 look (EDGE-DT-DT-EDGE / 2 LB / CB-CB-slotCB /
// 2 deep S). K and P sit on the back edge as special-teams markers.
export const FIELD_POSITIONS: Record<string, FieldCoord> = {
  // ---- Defense (top half) ------------------------------------------------
  "S-1": { x: 38, y: 12 }, // free safety — deep middle-left
  "S-2": { x: 62, y: 17 }, // strong safety — deep, offset right
  "CB-1": { x: 8, y: 39 }, // wide left
  "CB-2": { x: 92, y: 39 }, // wide right
  "CB-3": { x: 23, y: 33 }, // slot corner
  "LB-1": { x: 41, y: 32 },
  "LB-2": { x: 60, y: 32 },
  "EDGE-1": { x: 29, y: 46 }, // left edge
  "DT-1": { x: 44, y: 46 },
  "DT-2": { x: 57, y: 46 },
  "EDGE-2": { x: 72, y: 46 }, // right edge

  // ---- Offense (bottom half) --------------------------------------------
  "WR-1": { x: 7, y: 59 }, // split end, wide left
  "WR-3": { x: 20, y: 62 }, // slot receiver
  LT: { x: 33, y: 57 },
  LG: { x: 41.5, y: 57 },
  C: { x: 50, y: 57 },
  RG: { x: 58.5, y: 57 },
  RT: { x: 67, y: 57 },
  TE: { x: 76, y: 58 }, // inline, right of RT
  "WR-2": { x: 93, y: 59 }, // flanker, wide right
  QB: { x: 50, y: 68 },
  RB: { x: 50, y: 81 },

  // ---- Special teams (back edge) ----------------------------------------
  K: { x: 35, y: 93 },
  P: { x: 65, y: 93 },
};

/** True when a slot id has a coordinate on the field map. */
export function hasFieldPosition(slotId: string): boolean {
  return slotId in FIELD_POSITIONS;
}
