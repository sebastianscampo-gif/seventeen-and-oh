// Canonical schema + tuning tables for the 17-0 rating system.
// This file is data, not logic: positions, rating fields, per-position
// attribute profiles, award weights, stat references, and fallbacks.
// The math that consumes these tables lives in ratings-engine.mjs.

export const ENGINE_VERSION = "1.0.0";
export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Positions (must match lib/types.ts Position union used by the game UI).
// ---------------------------------------------------------------------------
export const POSITIONS = [
  "QB", "RB", "WR", "TE",
  "LT", "LG", "C", "RG", "RT",
  "EDGE", "DT", "LB", "CB", "S",
  "K", "P",
];

// Position -> coarse group used by the rating engine.
export const POSITION_GROUP = {
  QB: "QB", RB: "RB", WR: "WR", TE: "TE",
  LT: "OL", LG: "OL", C: "OL", RG: "OL", RT: "OL",
  EDGE: "EDGE", DT: "DL", LB: "LB", CB: "CB", S: "S",
  K: "K", P: "P",
};

export const SIDE_OF = {
  QB: "OFF", RB: "OFF", WR: "OFF", TE: "OFF",
  LT: "OFF", LG: "OFF", C: "OFF", RG: "OFF", RT: "OFF",
  EDGE: "DEF", DT: "DEF", LB: "DEF", CB: "DEF", S: "DEF",
  K: "ST", P: "ST",
};

// ---------------------------------------------------------------------------
// Rating fields. `overall` is computed first; ATTRIBUTE_FIELDS are the 21
// detailed attributes. RATING_FIELDS is the full set written to ratings.csv.
// ---------------------------------------------------------------------------
export const ATTRIBUTE_FIELDS = [
  "speed", "strength", "awareness",
  "pass_rating", "run_rating", "receiving",
  "blocking", "pass_block", "run_block",
  "pass_rush", "run_defense", "tackling",
  "coverage", "man_coverage", "zone_coverage",
  "hands", "kicking", "punting",
  "clutch", "playoff_clutch", "durability",
];

export const RATING_FIELDS = ["overall", ...ATTRIBUTE_FIELDS];

// ---------------------------------------------------------------------------
// Rating + review statuses and provenance sources.
// ---------------------------------------------------------------------------
export const STATUS = {
  // Generated ratings now carry an explicit confidence tier derived from how
  // much real evidence (starts, stats, awards, scouting prior) backed them.
  GENERATED_HIGH: "generated_high_confidence",
  GENERATED_MEDIUM: "generated_medium_confidence",
  GENERATED_LOW: "generated_low_confidence",
  MANUALLY_REVIEWED: "manually_reviewed",
  MANUAL_OVERRIDE: "manual_override",
  MISSING_DATA: "missing_data",
  NEEDS_REVIEW: "needs_review",
  // Legacy single-tier label, kept so older data / overrides still validate.
  GENERATED: "generated",
};
export const ALL_STATUSES = Object.values(STATUS);

// The three generated confidence tiers, ordered weakest -> strongest.
export const GENERATED_STATUSES = [
  STATUS.GENERATED_LOW, STATUS.GENERATED_MEDIUM, STATUS.GENERATED_HIGH, STATUS.GENERATED,
];
export const isGeneratedStatus = (s) => typeof s === "string" && s.startsWith("generated");

export const SOURCE = {
  GENERATED: "generated",
  MANUAL: "manual",
  FALLBACK: "fallback",
};

// ---------------------------------------------------------------------------
// Per-group attribute profile. Each attribute is tiered by relevance:
//   key      -> tracks overall closely (defines the position)
//   support  -> moderately correlated with overall
//   minor    -> weakly correlated
//   (unlisted) -> irrelevant baseline (low, barely moves with overall)
// `archetype` is a default label used in the exported game JSON.
// ---------------------------------------------------------------------------
export const POSITION_PROFILE = {
  QB: {
    archetype: "Quarterback",
    key: ["pass_rating", "awareness", "clutch"],
    support: ["playoff_clutch", "durability", "hands", "speed"],
    minor: ["strength", "run_rating"],
  },
  RB: {
    archetype: "Running Back",
    key: ["speed", "run_rating", "strength"],
    support: ["awareness", "durability", "hands", "receiving", "clutch", "playoff_clutch"],
    minor: ["pass_block", "blocking"],
  },
  WR: {
    archetype: "Wide Receiver",
    key: ["receiving", "hands", "speed"],
    support: ["awareness", "durability", "clutch", "playoff_clutch", "run_rating"],
    minor: ["strength", "blocking"],
  },
  TE: {
    archetype: "Tight End",
    key: ["receiving", "hands", "blocking"],
    support: ["strength", "awareness", "run_block", "pass_block", "durability", "speed", "clutch", "playoff_clutch"],
    minor: ["run_rating"],
  },
  OL: {
    archetype: "Offensive Lineman",
    key: ["pass_block", "run_block", "blocking", "strength"],
    support: ["awareness", "durability"],
    minor: ["speed", "clutch", "playoff_clutch"],
  },
  EDGE: {
    archetype: "Edge Rusher",
    key: ["pass_rush", "speed", "tackling"],
    support: ["strength", "run_defense", "awareness", "durability", "playoff_clutch", "clutch"],
    minor: ["coverage"],
  },
  DL: {
    archetype: "Defensive Tackle",
    key: ["run_defense", "strength", "pass_rush"],
    support: ["tackling", "awareness", "durability", "playoff_clutch", "clutch"],
    minor: ["speed"],
  },
  LB: {
    archetype: "Linebacker",
    key: ["tackling", "run_defense", "awareness"],
    support: ["speed", "strength", "coverage", "zone_coverage", "pass_rush", "durability", "clutch", "playoff_clutch"],
    minor: ["man_coverage"],
  },
  CB: {
    archetype: "Cornerback",
    key: ["coverage", "man_coverage", "speed"],
    support: ["zone_coverage", "awareness", "tackling", "hands", "durability", "playoff_clutch", "clutch"],
    minor: ["strength"],
  },
  S: {
    archetype: "Safety",
    key: ["coverage", "zone_coverage", "tackling"],
    support: ["speed", "awareness", "man_coverage", "strength", "run_defense", "durability", "hands", "playoff_clutch", "clutch"],
    minor: ["pass_rush"],
  },
  K: {
    archetype: "Kicker",
    key: ["kicking"],
    support: ["clutch", "playoff_clutch", "awareness", "durability"],
    minor: ["punting"],
  },
  P: {
    archetype: "Punter",
    key: ["punting"],
    support: ["awareness", "durability", "clutch", "playoff_clutch"],
    minor: ["kicking"],
  },
};

// How strongly each tier tracks `overall` when projecting an attribute.
// attr = TIER.base + TIER.slope * (overall - 50) + jitter
export const TIER = {
  key:        { base: 50, slope: 1.0, jitter: 3 },
  support:    { base: 46, slope: 0.7, jitter: 4 },
  minor:      { base: 40, slope: 0.45, jitter: 4 },
  irrelevant: { base: 30, slope: 0.18, jitter: 3 },
};

// ---------------------------------------------------------------------------
// Awards. Matched by keyword against the lower-cased award text.
// `overall` is the bonus added to the overall prior; `lift` boosts the
// player's KEY attributes a little extra so award winners feel elite.
// Order matters: longer / more specific keywords first.
// ---------------------------------------------------------------------------
export const AWARD_TIERS = [
  { match: ["super bowl mvp", "sb mvp", "finals mvp"], overall: 9, lift: 3 },
  { match: ["mvp", "most valuable"], overall: 18, lift: 5 },
  { match: ["offensive player of the year", "opoy"], overall: 13, lift: 4 },
  { match: ["defensive player of the year", "dpoy"], overall: 13, lift: 4 },
  { match: ["first-team all-pro", "first team all-pro", "1st team all-pro", "all-pro 1st", "all-pro first"], overall: 12, lift: 4 },
  { match: ["second-team all-pro", "second team all-pro", "2nd team all-pro"], overall: 7, lift: 2 },
  { match: ["all-pro", "all pro"], overall: 11, lift: 4 }, // generic / unspecified team (keep AFTER 2nd-team)
  { match: ["rookie of the year", "oroy", "droy", "roy"], overall: 6, lift: 2 },
  { match: ["comeback player", "cpoy"], overall: 4, lift: 1 },
  { match: ["pro bowl", "pro-bowl"], overall: 5, lift: 1 },
  { match: ["hall of fame", "hof"], overall: 5, lift: 2 }, // career prestige signal
  { match: ["super bowl champion", "sb champ", "champion"], overall: 2, lift: 0 },
];

export const AWARD_BONUS_CAP = 26; // max combined award contribution to overall

// ---------------------------------------------------------------------------
// Stat references. For each group, `stats` lists box-score columns with two
// anchors: `avg` (a league-average STARTER's production) and `elite`. Production
// is scored CENTERED on average:  frac = (v - avg) / (elite - avg), so an
// average season reads ~0, an elite season reads ~+1, and a clearly
// below-replacement season reads negative. This is the core fix for "volume
// compilers" (a QB with empty yards but a 78 passer rating, a kicker hitting 70%
// on many attempts) who used to look elite under a zero-based fraction. `attr`
// lists which attributes the stat nudges. Stats are optional — absent stats
// contribute nothing (the rating then leans on role + position + awards).
//   FRAC_FLOOR: how far below average a season is allowed to count against you.
// ---------------------------------------------------------------------------
export const FRAC_FLOOR = -0.6; // below-average production can subtract, but is bounded
export const FRAC_CEIL = 1.25; // historic outliers can read a bit above "elite"

export const STAT_MODEL = {
  QB: {
    overallScale: 16,
    stats: [
      { col: "pass_yds", avg: 3200, elite: 4600, attr: ["pass_rating", "awareness"], weight: 0.8 },
      { col: "pass_td", avg: 22, elite: 40, attr: ["pass_rating", "clutch"] },
      { col: "passer_rating", avg: 88, elite: 112, attr: ["pass_rating", "awareness"], weight: 1.4 },
      { col: "rush_yds", avg: 150, elite: 700, attr: ["speed", "run_rating"], weight: 0.3 },
    ],
    penalties: [{ col: "pass_int", bad: 16, attr: ["awareness"] }],
  },
  RB: {
    overallScale: 13,
    stats: [
      { col: "rush_yds", avg: 700, elite: 1700, attr: ["run_rating", "speed", "strength"] },
      { col: "rush_td", avg: 6, elite: 16, attr: ["run_rating", "clutch"] },
      { col: "receptions", avg: 28, elite: 75, attr: ["receiving", "hands"], weight: 0.5 },
    ],
  },
  WR: {
    overallScale: 13,
    stats: [
      { col: "rec_yds", avg: 650, elite: 1500, attr: ["receiving", "speed"] },
      { col: "receptions", avg: 50, elite: 110, attr: ["hands", "receiving"] },
      { col: "rec_td", avg: 5, elite: 14, attr: ["receiving", "clutch"] },
    ],
  },
  TE: {
    overallScale: 11,
    stats: [
      { col: "rec_yds", avg: 400, elite: 1050, attr: ["receiving", "hands"] },
      { col: "receptions", avg: 35, elite: 85, attr: ["hands", "receiving"] },
      { col: "rec_td", avg: 4, elite: 11, attr: ["receiving", "clutch"] },
    ],
  },
  OL: {
    overallScale: 6,
    stats: [], // OL has no box-score stats; rating leans on role + awards.
  },
  EDGE: {
    overallScale: 14,
    stats: [
      { col: "sacks", avg: 5, elite: 16, attr: ["pass_rush", "speed"], weight: 1.2 },
      { col: "tackles", avg: 35, elite: 75, attr: ["run_defense", "tackling"], weight: 0.5 },
      { col: "forced_fumbles", avg: 1, elite: 5, attr: ["pass_rush", "clutch"], weight: 0.4 },
    ],
  },
  DL: {
    overallScale: 12,
    stats: [
      { col: "sacks", avg: 3, elite: 12, attr: ["pass_rush"] },
      { col: "tackles", avg: 40, elite: 80, attr: ["run_defense", "tackling"] },
    ],
  },
  LB: {
    overallScale: 12,
    stats: [
      { col: "tackles", avg: 75, elite: 150, attr: ["tackling", "run_defense"] },
      { col: "sacks", avg: 2, elite: 11, attr: ["pass_rush"], weight: 0.6 },
      { col: "def_int", avg: 1, elite: 4, attr: ["coverage", "zone_coverage"], weight: 0.6 },
    ],
  },
  CB: {
    overallScale: 11,
    stats: [
      { col: "def_int", avg: 2, elite: 7, attr: ["coverage", "man_coverage", "hands"] },
      { col: "tackles", avg: 45, elite: 85, attr: ["tackling"], weight: 0.4 },
    ],
  },
  S: {
    overallScale: 11,
    stats: [
      { col: "def_int", avg: 2, elite: 6, attr: ["coverage", "zone_coverage", "hands"] },
      { col: "tackles", avg: 60, elite: 115, attr: ["tackling", "run_defense"] },
    ],
  },
  K: {
    overallScale: 9,
    stats: [
      { col: "fg_pct", avg: 80, elite: 92, attr: ["kicking"], weight: 1.2 },
      { col: "fg_made", avg: 20, elite: 34, attr: ["kicking", "clutch"], weight: 0.6 },
    ],
  },
  P: {
    overallScale: 8,
    stats: [{ col: "punt_avg", avg: 43, elite: 48, attr: ["punting"] }],
  },
};

// Provisional baseline used only when a player has NO usable role/stat/award
// signal at all (the rare !hasData branch). Position-sensible, clearly in
// "rotation/backup provisional" territory, and always exported with
// needs_manual_review = true + a low-confidence reason so it is never mistaken
// for a graded rating. Not a lazy "70 for everyone": premium spots sit a touch
// higher, specialists lower, and the value is re-derived per position below.
export const FALLBACK_OVERALL = {
  QB: 70, RB: 68, WR: 68, TE: 67, OL: 68,
  EDGE: 70, DL: 68, LB: 68, CB: 70, S: 67, K: 66, P: 64,
};
export const GENERIC_FALLBACK_OVERALL = 62;

// ---------------------------------------------------------------------------
// Roster-aware role model (Phase 2). The single biggest fix for "flat" rosters
// where every player landed on ~70. We separate players WITHIN a roster by
// inferring a role tier — from recorded starts when we have them, otherwise from
// a within-roster depth ranking (see generate-ratings.mjs) — and we let real
// football positional value spread the baseline so a starting QB/edge/corner is
// not priced like a depth lineman. Production, awards, and era percentile then
// layer on top. None of this fabricates per-player facts: where a roster carries
// no signal to tell starters from depth, the role is marked `unknown`/ambiguous,
// kept honestly uncertain, and flagged low-confidence / needs_review.
// ---------------------------------------------------------------------------

// Positional value: how much a STARTING-caliber player at this position is worth
// relative to a neutral baseline (scarcity + impact). Scaled by role weight so a
// backup at a premium position isn't treated as more valuable than a starter
// elsewhere. Roughly centered on zero across a full roster.
// These are PREMIUMS above a neutral-position starter (not absolute ratings).
// The bulk of "a QB is valuable" is carried by the high ceiling production +
// awards can reach; this knob only spreads positions a few points so a starting
// corner/edge out-bases a starting guard. Kept small so an *average* starter at
// a premium position doesn't balloon (an avg starting QB should read ~80, not 90).
export const POSITION_VALUE = {
  QB: 4,
  EDGE: 3, CB: 3,
  WR: 2, LT: 2,
  DT: 1, S: 1, RT: 1,
  TE: 1, RB: 0, LB: 1, C: 0,
  LG: 0, RG: 0,
  K: -3, P: -4,
};

// Role tiers. `base` is the overall a player at this tier sits at before
// position value, production, awards, and era percentile are applied.
// `startRatio` is the implied share of starts (feeds durability/role attrs).
// `weight` scales how much positional value applies (full for starters, little
// for depth). `unknown` is the honest middle used when a roster gives us no way
// to rank its players (e.g. a bio-only import with no starts/stats/experience).
// Bases map to the brief's role-based provisional ranges (the rating a player at
// this tier sits at BEFORE position value, production, awards, and percentile):
//   starter1 78  -> average lead starter  (Average starter 76-81)
//   starter2 74  -> weak/second starter   (Weak starter 72-75)
//   rotation 69  -> rotation player        (Rotation 68-73)
//   backup   64  -> backup                 (Backup 62-68)
//   depth    59  -> deep roster            (Deep roster 55-62)
//   unknown  72  -> honest middle (ambiguous room; flagged low-confidence)
// Evidence (production/awards/percentile) lifts the genuinely good toward Star
// (88-91) and Elite (92-99); curated overrides finalize marquee names.
export const ROLE_TIER = {
  starter1: { base: 78, startRatio: 0.95, weight: 1.00 },
  starter2: { base: 74, startRatio: 0.80, weight: 0.90 },
  rotation: { base: 69, startRatio: 0.50, weight: 0.55 },
  backup:   { base: 64, startRatio: 0.28, weight: 0.30 },
  depth:    { base: 59, startRatio: 0.12, weight: 0.15 },
  unknown:  { base: 72, startRatio: 0.45, weight: 0.50 },
};

// How many players "start" at each position group (maps a within-roster depth
// rank to a role tier). Reflects a base lineup with nickel/rotation reality.
export const STARTER_COUNTS = {
  QB: 1, RB: 1, WR: 3, TE: 1, OL: 5,
  EDGE: 2, DL: 2, LB: 3, CB: 3, S: 2, K: 1, P: 1,
};

// Map a 1-based within-group depth rank to a role tier.
export function tierFromRank(rank, group) {
  const starters = STARTER_COUNTS[group] ?? 2;
  if (rank <= Math.ceil(starters / 2)) return "starter1";
  if (rank <= starters) return "starter2";
  if (rank <= starters + Math.max(1, Math.round(starters * 0.8))) return "rotation";
  if (rank <= starters * 2 + 1) return "backup";
  return "depth";
}

// Global clamps for any produced number.
export const RATING_MIN = 20;
export const RATING_MAX = 99;
export const OVERALL_FLOOR = 40; // a rostered NFL player is never below this

// ---------------------------------------------------------------------------
// Column layouts. Centralized so every script agrees on file shapes.
// ---------------------------------------------------------------------------

// Optional box-score stat columns carried from raw inputs through to
// player_seasons.csv and consumed by the rating engine (all optional).
export const STAT_COLUMNS = [
  "pass_yds", "pass_td", "pass_int", "passer_rating",
  "rush_yds", "rush_td",
  "receptions", "rec_yds", "rec_td",
  "sacks", "tackles", "def_int", "forced_fumbles",
  "fg_made", "fg_att", "fg_pct", "punt_avg",
];

// Bio/role columns a roster file may provide (besides stats/awards).
export const ROSTER_COLUMNS = [
  "player_id", "name", "position", "secondary_positions",
  "jersey_number", "height", "weight", "birth_date", "college", "years_exp",
  "games", "games_started", "scout_grade", "awards", "notes",
];

export const TEAMS_COLUMNS = [
  "team_code", "franchise", "team_name", "conference", "division",
  "first_season", "last_season", "notes",
];

export const TEAM_SEASON_COLUMNS = [
  "season", "team_code", "team_name", "wins", "losses", "ties",
  "team_strength", "rating_source", "rating_confidence", "roster_file", "notes",
];

export const PLAYERS_COLUMNS = [
  "player_id", "name", "primary_position", "birth_date", "college",
  "first_season", "last_season", "seasons_played", "teams",
];

export const PLAYER_SEASON_COLUMNS = [
  "player_id", "name", "team", "team_code", "season",
  "position", "secondary_positions", "jersey_number", "height", "weight",
  "birth_date", "college", "years_exp", "games", "games_started",
  "awards", "scout_grade", ...STAT_COLUMNS, "rating_source", "rating_confidence", "notes",
];

export const RATINGS_COLUMNS = [
  "player_id", "season", "team_code", "status",
  "rating_source", "rating_confidence", "needs_manual_review", "note", ...RATING_FIELDS,
];

// Manual override sheet. Keeps the granular per-attribute columns (RATING_FIELDS
// = override_overall + every override_attribute) and adds human-audit metadata:
//   name / position    readability only (not used for matching)
//   status             optional explicit status (else inferred on apply)
//   review_status      reviewer workflow tag (e.g. approved / pending)
//   reviewed_by        who signed off
//   last_updated       ISO date of the last edit
// Overrides always take priority over generated ratings (see apply-overrides).
export const OVERRIDE_COLUMNS = [
  "player_id", "name", "season", "team_code", "position",
  "status", "review_status", "reviewed_by", "last_updated",
  "rating_confidence", "reason",
  ...RATING_FIELDS,
];
