// ---------------------------------------------------------------------------
// 17-0 season simulator — tunable balance config.
//
// Everything that controls how "lucky" or "skill-driven" the simulation feels
// lives here so balance can be adjusted in one place without touching logic.
// All ratings/powers are on a 0..100 scale (same scale as player overalls).
// ---------------------------------------------------------------------------

export const SIM_CONFIG = {
  // --- Win-probability core (Elo-style) ----------------------------------
  // winProb = 1 / (1 + 10 ^ (-(diff) / scale))
  // Larger scale => probabilities pulled toward 50% (more upsets / volatility).
  ELO_SCALE: 15,

  // Added to ELO_SCALE per phase. Playoffs are intentionally more volatile,
  // so a single game is closer to a coin flip than a regular-season game.
  REGULAR_SEASON_RANDOMNESS: 5, // effective regular-season scale = 20
  PLAYOFF_RANDOMNESS: 9, //        effective playoff scale       = 24

  // Power points granted to the home team. Applied in playoff seeding; the
  // Super Bowl is neutral.
  HOME_FIELD_ADVANTAGE: 2.0,

  // --- Power composition weights (must conceptually sum to ~1) ------------
  // A team's overall "power" is a blend of unit ratings. QB and the offensive
  // line are intentionally double-counted (they also feed `offense`) so the
  // sim rewards/punishes them more heavily than a flat positional average.
  OFFENSE_WEIGHT: 0.3,
  DEFENSE_WEIGHT: 0.32,
  QB_WEIGHT: 0.16,
  OFFENSIVE_LINE_WEIGHT: 0.08,
  STAR_POWER_WEIGHT: 0.14,

  // --- Matchup modifiers --------------------------------------------------
  // Per unit-vs-unit comparison: edge = (myUnit - theirUnit) * SENSITIVITY,
  // clamped to ±MATCHUP_UNIT_CAP. The sum of all six matchups is clamped to
  // ±MATCHUP_TOTAL_CAP power points before it enters the win-prob formula.
  MATCHUP_SENSITIVITY: 0.16,
  MATCHUP_UNIT_CAP: 3.0,
  MATCHUP_TOTAL_CAP: 6.0,

  // Multiplier on the whole matchup edge. Raise to make specific roster
  // strengths/weaknesses swing games more (more "explainable" upsets).
  UPSET_FACTOR: 1.0,

  // --- Playoff star/clutch bonus -----------------------------------------
  // Extra power the user's team carries ONLY in the playoffs. This is what
  // lets an elite-QB / elite-defense team punch above its average rating in
  // January, and what makes a weak QB "lower playoff reliability".
  STAR_POWER_PLAYOFF_BONUS: 0.5, // power per 92+ rated starter
  CLUTCH_WEIGHT: 0.1, //            (avgClutch - 75) * this
  PLAYOFF_QB_FACTOR: 0.09, //       (qbRating - 85) * this
  PLAYOFF_BONUS_CLAMP: [-5, 5] as [number, number],

  // A starter counts as a "star" at/above this effective rating.
  STAR_RATING_THRESHOLD: 92,

  // Power at/above which a roster is considered "elite" (drives the
  // "Great Team, Bad Ending" verdict when such a team flames out).
  ELITE_POWER_THRESHOLD: 89,

  // --- Playoff qualification odds by regular-season win total -------------
  // Rolled independently of the bracket: even a 9-8 team is a coin flip to
  // get in, an 8-9 team rarely sneaks in, a 7-win team almost never does.
  PLAYOFF_QUALIFICATION_ODDS: {
    17: 1.0, 16: 1.0, 15: 1.0, 14: 1.0, 13: 0.99,
    12: 0.97, 11: 0.92, 10: 0.78, 9: 0.5, 8: 0.18,
    7: 0.05, 6: 0.01, 5: 0.0, 4: 0.0, 3: 0.0, 2: 0.0, 1: 0.0, 0: 0.0,
  } as Record<number, number>,

  // --- Opponent generation ------------------------------------------------
  // Power range for each opponent tier and how often each tier appears on a
  // 17-game schedule (weights are relative and normalized at runtime).
  OPPONENT_TIERS: {
    weak: { range: [70, 78] as [number, number], weight: 0.18 },
    average: { range: [79, 84] as [number, number], weight: 0.34 },
    good: { range: [85, 89] as [number, number], weight: 0.28 },
    great: { range: [90, 94] as [number, number], weight: 0.14 },
    elite: { range: [95, 99] as [number, number], weight: 0.06 },
  },

  // Spread of an opponent's individual units around its base power. Higher =
  // more lopsided opponents (a strong team with one exploitable weakness),
  // which creates more matchup-driven games.
  OPPONENT_UNIT_SPREAD: 5,

  // --- Monte Carlo odds projection (debug) -------------------------------
  // How many full seasons to simulate to estimate the team's true odds.
  PROJECTION_RUNS: 4000,
};

export type SimConfig = typeof SIM_CONFIG;
