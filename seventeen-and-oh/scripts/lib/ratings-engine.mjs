// 17-0 custom rating engine.
//
// Produces a 0-99 overall plus 21 detailed attributes for a player-season from
// signals we actually have: position, role (games / games started), awards,
// box-score stats, team strength, an optional scouting prior, and the player's
// percentile within their season cohort ("era percentile").
//
// This is NOT Madden and copies no proprietary rating database. It is a
// transparent, reproducible model: same inputs always yield the same numbers.
//
// Two-pass usage (see generate-ratings.mjs):
//   1. computeContext(input)  -> a raw composite per player
//   2. finalize(input, ctx, cohortPercentile, defaults) -> full rating + status
//
// Single-pass convenience: evaluate(input, defaults) assumes median percentile.

import {
  ATTRIBUTE_FIELDS, POSITION_GROUP, POSITION_PROFILE, POSITIONS,
  TIER, AWARD_TIERS, AWARD_BONUS_CAP, STAT_MODEL,
  FALLBACK_OVERALL, GENERIC_FALLBACK_OVERALL,
  POSITION_VALUE, ROLE_TIER,
  RATING_MIN, RATING_MAX, OVERALL_FLOOR, STATUS, SOURCE,
  isGeneratedStatus,
} from "./schema.mjs";
import { clamp, jitter, num } from "./util.mjs";

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------
function normalizeAward(a) {
  return String(a).toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

export function awardBonus(awards) {
  let overall = 0;
  let lift = 0;
  for (const raw of awards) {
    const a = normalizeAward(raw);
    if (!a) continue;
    for (const tier of AWARD_TIERS) {
      if (tier.match.some((m) => a.includes(m))) {
        overall += tier.overall;
        lift = Math.max(lift, tier.lift);
        break; // first (most specific) matching tier wins for this award
      }
    }
  }
  return { overall: Math.min(overall, AWARD_BONUS_CAP), lift };
}

// ---------------------------------------------------------------------------
// Stat production -> overall bonus + per-attribute nudges
// ---------------------------------------------------------------------------
export function statProduction(group, stats) {
  const model = STAT_MODEL[group];
  const attrNudges = {};
  if (!model) return { overallBonus: 0, attrNudges, hasStats: false };

  let prodNum = 0;
  let prodDen = 0;
  let hasStats = false;

  for (const s of model.stats) {
    const v = num(stats[s.col]);
    if (v == null) continue;
    hasStats = true;
    const w = s.weight ?? 1;
    const frac = clamp(v / s.elite, 0, 1.25);
    prodNum += frac * w;
    prodDen += w;
    const nudge = frac * 12; // ~+15 at elite production
    for (const a of s.attr) attrNudges[a] = (attrNudges[a] || 0) + nudge;
  }

  let overallBonus = prodDen ? (prodNum / prodDen) * model.overallScale : 0;

  for (const p of model.penalties || []) {
    const v = num(stats[p.col]);
    if (v == null) continue;
    const over = clamp((v - p.bad) / p.bad, 0, 1);
    overallBonus -= over * model.overallScale * 0.4;
    for (const a of p.attr) attrNudges[a] = (attrNudges[a] || 0) - over * 8;
  }

  // Keep individual attribute nudges bounded.
  for (const k of Object.keys(attrNudges)) {
    attrNudges[k] = clamp(attrNudges[k], -18, 18);
  }
  return { overallBonus, attrNudges, hasStats };
}

// ---------------------------------------------------------------------------
// Roster-aware role model (Phase 2)
//
// A rating can only separate players if there is something to separate them by.
// Roughly 85% of historical player-seasons carry no starts, stats, or awards —
// only position and (often a flat-default) games count. The old model parked all
// of those at one number (~70), producing the "every Giant is a 70" rosters.
//
// The fix has two parts:
//   1. RECORDED STARTS, when present, set the role tier directly.
//   2. Otherwise the generator ranks each player WITHIN their roster + position
//      group (by recorded starts, then production, then experience/availability)
//      and hands us a role tier. When even that ranking has no signal to go on,
//      the role is `unknown` (ambiguous): an honestly uncertain middle prior,
//      flagged low-confidence. Positional value spreads the baseline so a roster
//      is never a single flat number, but we never invent a precise starter.
// ---------------------------------------------------------------------------

// Resolve a role tier + start ratio for a player. Prefers recorded starts; then
// a generator-supplied within-roster depth tier; then a neutral unknown prior.
function resolveRole(input, group) {
  const games = num(input.games);
  const gamesStarted = num(input.games_started ?? input.gamesStarted);
  const availability =
    games != null ? clamp(games / 16, 0, 1)
    : gamesStarted != null ? clamp(gamesStarted / 16, 0, 1)
    : 0.6;

  // 1. Recorded starts -> tier straight from the start ratio (highest trust).
  if (gamesStarted != null) {
    const startRatio = clamp(gamesStarted / Math.max(games ?? gamesStarted, 16), 0, 1);
    let tier;
    if (startRatio >= 0.75) tier = "starter1";
    else if (startRatio >= 0.45) tier = "starter2";
    else if (startRatio >= 0.2) tier = "rotation";
    else if (startRatio > 0) tier = "backup";
    else tier = "depth";
    return { tier, startsKnown: true, ambiguous: false, startRatio, availability };
  }

  // 2. Within-roster depth tier supplied by the generator's pre-pass.
  if (input.roleTier && ROLE_TIER[input.roleTier]) {
    return {
      tier: input.roleTier,
      startsKnown: false,
      ambiguous: !!input.roleAmbiguous,
      startRatio: ROLE_TIER[input.roleTier].startRatio,
      availability,
    };
  }

  // 3. No roster context (standalone evaluation) -> honest unknown prior.
  return {
    tier: "unknown", startsKnown: false, ambiguous: true,
    startRatio: ROLE_TIER.unknown.startRatio, availability,
  };
}

// How much of a role tier's separation survives when we have NO evidence of the
// player's *quality* (no recorded starts, no box score, no awards, no scout
// grade) — i.e. the tier came from a positional depth guess alone. We compress
// such ratings toward the neutral prior so a guessed "starter" (and especially a
// lone specialist like a kicker) is not priced like a proven one. Real evidence
// keeps the full separation.
const SOFT_ROLE_K = 0.4;

function rolePrior(position, group, input, hasQualityEvidence) {
  const hasAnyRole =
    num(input.games) != null ||
    num(input.games_started ?? input.gamesStarted) != null ||
    (input.roleTier && ROLE_TIER[input.roleTier]);

  const role = resolveRole(input, group);
  const T = ROLE_TIER[role.tier] || ROLE_TIER.unknown;
  const neutral = ROLE_TIER.unknown.base;

  // Without quality evidence, pull the tier base toward the neutral prior and
  // damp positional value — we know roughly where on the depth chart, not how
  // good. With evidence, use the full tier base and full positional value.
  const base = hasQualityEvidence ? T.base : neutral + SOFT_ROLE_K * (T.base - neutral);
  const posWeight = hasQualityEvidence ? 1 : 0.6;
  const posVal = (POSITION_VALUE[position] ?? 0) * T.weight * posWeight;
  // Small availability nudge (durability / games played), centered at ~0.8.
  const availBonus = (role.availability - 0.8) * 5;
  const prior = base + posVal + availBonus;

  return {
    prior,
    hasRole: !!hasAnyRole,
    startsKnown: role.startsKnown,
    ambiguous: role.ambiguous,
    availability: role.availability,
    startRatio: role.startRatio,
    tier: role.tier,
  };
}

function tierOf(group, attr) {
  const p = POSITION_PROFILE[group];
  if (!p) return "irrelevant";
  if (p.key?.includes(attr)) return "key";
  if (p.support?.includes(attr)) return "support";
  if (p.minor?.includes(attr)) return "minor";
  return "irrelevant";
}

// ---------------------------------------------------------------------------
// Pass 1: compute the raw composite (pre-percentile) overall and carry signals.
// ---------------------------------------------------------------------------
export function computeContext(input) {
  const position = input.position;
  const positionKnown = POSITIONS.includes(position);
  const group = POSITION_GROUP[position] || "RB"; // RB = neutral skill default

  const games = num(input.games);
  const gamesStarted = num(input.games_started ?? input.gamesStarted);

  // Evidence of the player's *quality* (not just role): real production, awards,
  // a scouting grade, or recorded starts. Computed first because it decides how
  // much of the role-tier separation we trust (see rolePrior softening).
  const awards = Array.isArray(input.awards) ? input.awards : [];
  const award = awardBonus(awards);
  const stat = statProduction(group, input.stats || {});
  const scoutGrade = num(input.scoutGrade ?? input.scout_grade);
  const hasQualityEvidence =
    gamesStarted != null || stat.hasStats || award.overall > 0 || scoutGrade != null;

  const role = rolePrior(position, group, input, hasQualityEvidence);

  const teamStrength = num(input.teamStrength, 70);
  const teamAdj = (teamStrength - 70) * 0.06; // ~ +/-1.8 over a 30-pt swing

  let raw = role.prior + award.overall + stat.overallBonus + teamAdj;

  // Optional scouting prior: weighted more heavily when other evidence is thin.
  if (scoutGrade != null) {
    const evidence = (stat.hasStats ? 1 : 0) + (awards.length ? 1 : 0);
    const wScout = evidence >= 2 ? 0.25 : evidence === 1 ? 0.4 : 0.6;
    raw = raw * (1 - wScout) + scoutGrade * wScout;
  }

  return {
    group, position, positionKnown,
    games, gamesStarted,
    hasRole: role.hasRole, availability: role.availability,
    startsKnown: role.startsKnown, startRatio: role.startRatio,
    roleTier: role.tier, roleAmbiguous: role.ambiguous,
    award, stat, scoutGrade, hasQualityEvidence,
    hasData: role.hasRole || stat.hasStats || awards.length > 0 || scoutGrade != null,
    rawComposite: raw,
  };
}

// ---------------------------------------------------------------------------
// Human-readable explanation + manual-review flag
// ---------------------------------------------------------------------------
const TIER_LABEL = {
  starter1: "lead starter", starter2: "starter", rotation: "rotation player",
  backup: "backup", depth: "depth", unknown: "role unclear",
};

// One-sentence rationale stored alongside the rating (the brief's rating_reason).
function buildReason(ctx, overall, status) {
  const pos = ctx.position || "?";
  const parts = [];
  if (status === STATUS.MISSING_DATA) return `Rated ${overall} (${pos}): no usable inputs — fallback, missing data.`;
  // Basis of the role.
  if (ctx.startsKnown) parts.push(`${TIER_LABEL[ctx.roleTier]} by recorded starts`);
  else if (ctx.stat.hasStats) parts.push(`${TIER_LABEL[ctx.roleTier]} by box-score production`);
  else if (ctx.roleAmbiguous) parts.push("position-based prior (no starts or stats on file)");
  else parts.push(`${TIER_LABEL[ctx.roleTier]} by within-roster depth rank`);
  // Extra evidence.
  if (ctx.stat.hasStats) parts.push("production scored vs. era cohort");
  if (ctx.award.overall > 0) parts.push("award bonus");
  if (ctx.scoutGrade != null) parts.push("scouting prior");
  // Confidence tag.
  const conf =
    status === STATUS.GENERATED_HIGH ? "high confidence"
    : status === STATUS.GENERATED_MEDIUM ? "medium confidence"
    : status === STATUS.NEEDS_REVIEW ? "needs review"
    : "low confidence";
  return `Rated ${overall} (${pos}): ${parts.join(", ")} — ${conf}.`;
}

// Flag the high-leverage, thin-evidence rows a human should eyeball. Kept
// targeted so the review queue stays a few players per roster, not the whole
// database.
function flagReview(ctx, overall, status) {
  if (status === STATUS.NEEDS_REVIEW || status === STATUS.MISSING_DATA) return true;
  const low = status === STATUS.GENERATED_LOW;
  const med = status === STATUS.GENERATED_MEDIUM;
  // Presumed starting/rotation QB with no real evidence: always worth a look.
  // `unknown` is included because an ambiguous QB room (e.g. a bio-only import)
  // still has a real starter we just can't identify — review them all rather than
  // let the starting QB slip through unflagged. Clear backups/depth are excluded.
  if (low && ctx.group === "QB" && ["starter1", "starter2", "rotation", "unknown"].includes(ctx.roleTier)) return true;
  if (low && overall >= 84) return true;                       // high rating on thin evidence
  if (low && ctx.roleAmbiguous && ctx.roleTier === "starter1") return true;
  if ((low || med) && overall >= 88) return true;              // near-elite without strong proof
  return false;
}

// ---------------------------------------------------------------------------
// Pass 2: finalize overall + attributes + status + confidence.
// cohortPercentile in [0,1]: player's rank within their season (era percentile).
// ---------------------------------------------------------------------------
export function finalize(input, ctx, cohortPercentile = 0.5, defaults = {}) {
  const seed = `${input.player_id || input.name || "x"}|${input.season || ""}|${input.team_code || ""}`;
  const baseConfidence = num(defaults.confidence, 0.6);

  // --- status / source -----------------------------------------------------
  let status;
  let source;
  let overall;

  if (!ctx.positionKnown) {
    status = STATUS.MISSING_DATA;
    source = SOURCE.FALLBACK;
    overall = GENERIC_FALLBACK_OVERALL;
  } else if (!ctx.hasData) {
    status = STATUS.NEEDS_REVIEW;
    source = SOURCE.FALLBACK;
    overall = FALLBACK_OVERALL[ctx.group] ?? GENERIC_FALLBACK_OVERALL;
  } else {
    // Generated rating: pick a confidence tier from how much *real* evidence
    // backs it. Box-score stats and awards are strong signals; a scouting prior
    // or measured (not inferred) starts are moderate signals. A rating built
    // from availability alone — the data-sparse majority — lands LOW so the
    // game and the audit can treat it cautiously.
    let evidence = 0;
    if (ctx.stat.hasStats) evidence += 2;
    if (ctx.award.overall > 0) evidence += 2;
    if (ctx.scoutGrade != null) evidence += 1;
    if (ctx.startsKnown) evidence += 1;
    if (evidence >= 3) status = STATUS.GENERATED_HIGH;
    else if (evidence >= 1) status = STATUS.GENERATED_MEDIUM;
    else status = STATUS.GENERATED_LOW;
    source = SOURCE.GENERATED;
    // Blend absolute composite with a gentle era-percentile curve for spread.
    // Era percentile is only trustworthy when it reflects real production; for
    // no-evidence players it is mostly sort-order noise, so we lean on the
    // (position-aware) composite and let the curve nudge only lightly. This also
    // stops a lone, evidence-free specialist from being lifted above real
    // starters on a data-empty roster.
    const pCurve = 60 + cohortPercentile * 38; // p=0 -> 60, p=1 -> 98
    const pWeight = ctx.hasQualityEvidence ? 0.18 : 0.1;
    overall = (1 - pWeight) * ctx.rawComposite + pWeight * pCurve;
  }

  overall = clamp(Math.round(overall), isGeneratedStatus(status) ? OVERALL_FLOOR : RATING_MIN, RATING_MAX);

  // --- attributes ----------------------------------------------------------
  const attrNudges = ctx.stat.attrNudges || {};
  const keyLift = ctx.award.lift || 0;
  const rating = { overall };

  for (const attr of ATTRIBUTE_FIELDS) {
    const tier = tierOf(ctx.group, attr);
    const T = TIER[tier];
    let v = T.base + T.slope * (overall - 50) + T.jitter * jitter(seed + "|" + attr);
    if (attrNudges[attr]) v += attrNudges[attr];
    if (tier === "key") v += keyLift;
    if (attr === "durability" && ctx.hasRole) v += (ctx.availability - 0.75) * 16;
    if (attr === "playoff_clutch") v += ctx.award.overall * 0.15; // big-game pedigree
    rating[attr] = clamp(Math.round(v), RATING_MIN, RATING_MAX);
  }
  // Overall should not trail its own best attributes too far for elite players.
  rating.overall = clamp(rating.overall, isGeneratedStatus(status) ? OVERALL_FLOOR : RATING_MIN, RATING_MAX);

  // --- confidence ----------------------------------------------------------
  let confidence = baseConfidence;
  if (ctx.stat.hasStats) confidence += 0.15;
  if (ctx.award.overall > 0) confidence += 0.12;
  if (ctx.hasRole) confidence += 0.08;
  if (ctx.scoutGrade != null) confidence += 0.05;
  // Penalize ratings whose role rests on *inferred* (not recorded) starts, and
  // penalize harder when even the within-roster ranking had no signal to use.
  if (ctx.hasRole && !ctx.startsKnown) confidence -= 0.18;
  if (ctx.roleAmbiguous) confidence -= 0.12;
  if (status === STATUS.GENERATED_LOW) confidence = Math.min(confidence, 0.55);
  if (status === STATUS.NEEDS_REVIEW) confidence = Math.min(confidence, 0.4);
  if (status === STATUS.MISSING_DATA) confidence = Math.min(confidence, 0.3);
  confidence = clamp(Math.round(confidence * 100) / 100, 0.05, 0.99);

  // --- explanation + manual-review flag ------------------------------------
  const reason = buildReason(ctx, rating.overall, status);
  const needsReview = flagReview(ctx, rating.overall, status);

  return { rating, status, source, confidence, reason, needsReview };
}

/** Single-call convenience for one-off evaluation (median percentile). */
export function evaluate(input, defaults = {}) {
  const ctx = computeContext(input);
  return finalize(input, ctx, 0.5, defaults);
}
