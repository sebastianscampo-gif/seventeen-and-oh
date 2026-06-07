import { Position, RosterSlot, TeamProfile, UnitRating } from "./types";
import { SIM_CONFIG } from "./sim-config";
import { POSITION_NAMES } from "./positions";

// Builds the granular, sim-ready profile of a fully-drafted roster: per-unit
// ratings (used for matchup math), composite power, star/clutch inputs, and the
// best/weakest unit + standout/weak-link players for the result explanation.
//
// Assumes every non-optional slot is filled (the app only scores a complete
// roster). K/P are optional and default to a neutral special-teams value.

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function computeTeamProfile(roster: RosterSlot[]): TeamProfile {
  // Effective rating lookup keyed by slot position group.
  const byPos = (pos: Position): number[] =>
    roster
      .filter((s) => s.position === pos && s.player)
      .map((s) => s.effectiveRating ?? 0);

  const mean = (xs: number[], fallback = 0): number =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fallback;

  // Individual position-group averages.
  const qb = mean(byPos("QB"));
  const rb = mean(byPos("RB"));
  const wr = mean(byPos("WR"));
  const te = mean(byPos("TE"));
  const lt = mean(byPos("LT"));
  const lg = mean(byPos("LG"));
  const c = mean(byPos("C"));
  const rg = mean(byPos("RG"));
  const rt = mean(byPos("RT"));
  const edge = mean(byPos("EDGE"));
  const dt = mean(byPos("DT"));
  const lb = mean(byPos("LB"));
  const cb = mean(byPos("CB"));
  const s = mean(byPos("S"));
  const k = mean(byPos("K"), 72);
  const p = mean(byPos("P"), 72);

  const oLine = mean([lt, lg, c, rg, rt]);
  const receivers = mean([wr, wr, wr, te]); // WR weighted 3:1 over TE via counts
  const wrTe = mean([wr, te]);

  // Composite units (weights chosen so the unit reads like the real strength
  // of that phase of the game).
  const passOff = 0.45 * qb + 0.3 * wrTe + 0.25 * oLine;
  const rushOff = 0.55 * oLine + 0.45 * rb;
  const passRush = 0.6 * edge + 0.4 * dt;
  const runDef = 0.4 * dt + 0.35 * lb + 0.25 * s;
  const secondary = 0.6 * cb + 0.4 * s;
  const specialTeams = mean([k, p], 72);

  // Side averages over actual filled starters.
  const offSlots = roster.filter((x) => x.side === "OFF" && x.player);
  const defSlots = roster.filter((x) => x.side === "DEF" && x.player);
  const offense = mean(offSlots.map((x) => x.effectiveRating ?? 0));
  const defense = mean(defSlots.map((x) => x.effectiveRating ?? 0));

  // Star power: top-3 effective ratings drive a 0..100 star score.
  const filled = roster.filter((x) => x.player);
  const sortedRatings = filled
    .map((x) => x.effectiveRating ?? 0)
    .sort((a, b) => b - a);
  const starScore = mean(sortedRatings.slice(0, 3), offense);
  const starCount = filled.filter(
    (x) => (x.effectiveRating ?? 0) >= SIM_CONFIG.STAR_RATING_THRESHOLD
  ).length;

  // Playoff clutch, QB-weighted (a clutch QB matters most in January).
  const qbSlot = roster.find((x) => x.position === "QB" && x.player);
  const qbClutch = qbSlot?.player?.playoffClutch ?? 75;
  const clutchAvg = mean(filled.map((x) => x.player!.playoffClutch), 75);
  const clutch = 0.4 * qbClutch + 0.6 * clutchAvg;

  // Composite power (config-weighted; QB + OL deliberately double-counted).
  const w = SIM_CONFIG;
  const power = clamp(
    w.OFFENSE_WEIGHT * offense +
      w.DEFENSE_WEIGHT * defense +
      w.QB_WEIGHT * qb +
      w.OFFENSIVE_LINE_WEIGHT * oLine +
      w.STAR_POWER_WEIGHT * starScore,
    0,
    100
  );

  // Units used for best/weakest ranking and matchup math.
  const units: UnitRating[] = [
    { key: "qb", name: "Quarterback", rating: qb },
    { key: "passOff", name: "Passing offense", rating: passOff },
    { key: "rushOff", name: "Rushing offense", rating: rushOff },
    { key: "oLine", name: "Offensive line", rating: oLine },
    { key: "receivers", name: "Receivers", rating: receivers },
    { key: "passRush", name: "Pass rush", rating: passRush },
    { key: "runDef", name: "Run defense", rating: runDef },
    { key: "linebackers", name: "Linebackers", rating: lb },
    { key: "secondary", name: "Secondary", rating: secondary },
  ];
  const ranked = [...units].sort((a, b) => b.rating - a.rating);
  const bestUnit = ranked[0];
  const weakestUnit = ranked[ranked.length - 1];

  // Standout and weak-link starters (ignore optional K/P for weakness).
  const standout = [...filled].sort(
    (a, b) => (b.effectiveRating ?? 0) - (a.effectiveRating ?? 0)
  )[0];
  const weakLink = [...filled]
    .filter((x) => !x.optional)
    .sort((a, b) => (a.effectiveRating ?? 0) - (b.effectiveRating ?? 0))[0];

  const playerRef = (slot: RosterSlot | undefined) => ({
    name: slot?.player?.name ?? "—",
    position: (slot?.position ?? "QB") as Position,
    rating: slot?.effectiveRating ?? 0,
  });

  return {
    power: round1(power),
    offense: round1(offense),
    defense: round1(defense),
    qb: round1(qb),
    passOff: round1(passOff),
    rushOff: round1(rushOff),
    oLine: round1(oLine),
    passRush: round1(passRush),
    runDef: round1(runDef),
    secondary: round1(secondary),
    linebackers: round1(lb),
    receivers: round1(receivers),
    specialTeams: round1(specialTeams),
    starCount,
    clutch: round1(clutch),
    units: units.map((u) => ({ ...u, rating: round1(u.rating) })),
    bestUnit: { ...bestUnit, rating: round1(bestUnit.rating) },
    weakestUnit: { ...weakestUnit, rating: round1(weakestUnit.rating) },
    bestPlayer: playerRef(standout),
    biggestWeakness: playerRef(weakLink),
  };
}

// Used by sim-config consumers that want a readable position name.
export function positionName(pos: Position): string {
  return POSITION_NAMES[pos];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
