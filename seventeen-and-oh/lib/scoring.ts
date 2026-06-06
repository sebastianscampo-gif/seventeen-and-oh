import { Player, Position, RosterSlot, ScoreBreakdown } from "./types";
import { positionFit } from "./positions";

export function effectiveRating(player: Player, slot: Position): number {
  const fit = positionFit(player.position, player.secondaryPositions, slot);
  return Math.round(player.overall * fit);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// Weighted team score:
//   Offense 40% / Defense 40% / Position fit 10% / Balance 5% / Star power 5%
export function computeScore(roster: RosterSlot[]): ScoreBreakdown {
  const filled = roster.filter((s) => s.player);
  const off = filled.filter((s) => s.side === "OFF");
  const def = filled.filter((s) => s.side === "DEF");

  const avg = (arr: RosterSlot[], fn: (s: RosterSlot) => number) =>
    arr.length ? arr.reduce((a, s) => a + fn(s), 0) / arr.length : 0;

  const offense = avg(off, (s) => s.effectiveRating ?? 0);
  const defense = avg(def, (s) => s.effectiveRating ?? 0);

  // Position fit across the whole roster, scaled to 0..100.
  const fit = avg(filled, (s) => (s.fit ?? 0) * 100);

  // Balance rewards a roster that is not lopsided between offense and defense.
  const diff = Math.abs(offense - defense);
  const balance = Math.max(0, 100 - diff * 2.2);

  // Star power: playoff-clutch average plus a bonus for elite (90+) talent.
  const clutchAvg = avg(filled, (s) => s.player!.playoffClutch);
  const stars = filled.filter((s) => s.player!.overall >= 90).length;
  const star = Math.min(100, clutchAvg + stars * 2.2);

  const total =
    offense * 0.4 + defense * 0.4 + fit * 0.1 + balance * 0.05 + star * 0.05;

  return {
    offense: round1(offense),
    defense: round1(defense),
    fit: round1(fit),
    balance: round1(balance),
    star: round1(star),
    total: round1(total),
  };
}
