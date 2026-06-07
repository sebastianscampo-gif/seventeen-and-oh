# Rating Inflation Audit

_17-0 custom rating system. Written 2026-06-07. Reproducible: every number below
comes from `scripts/audit-ratings.mjs` run against `data/processed/ratings.csv`._

## Headline finding: the problem was **deflation, not inflation**

The brief asked us to check for rating *inflation* ("average players should not be
overrated"). The data showed the opposite. Before this pass, the generated
ratings were systematically **too low** for the majority of the player pool, while
the small set of genuinely elite seasons was correctly rare.

This report documents the cause, the fix, and the before/after distribution. We do
**not** claim the new numbers are objectively perfect — they are a transparent,
reproducible estimate, and thin-data players are now explicitly flagged as such.

## Evidence of deflation (before)

| Metric | Before |
| --- | ---: |
| Rated player-seasons | 96,167 |
| Mean overall | **62.6** |
| Share in 40–64 ("depth / weak backup") | **88.9%** |
| Share 65–74 (backup / rotation) | 4.2% |
| 90+ ("star / All-Pro and up") | 64 (0.07%) |
| Overrated flags | 0 |
| Underrated flags | 33 |

88.9% of every player-season in history sat in the bottom "depth" band. That is not
plausible: most of those rows are real, multi-year NFL starters and rotation players.

### Root cause

`games_started` is recorded for only **~8.7%** of historical player-seasons. The old
role model treated "no starts on file" as "started zero games," which collapsed the
**91.3%** of players with unknown starts down to a replacement-level prior (~54–58).
The model was well-calibrated *where starts data existed* (players with `gs >= 8`:
median 80, p10 72, p90 86) — it was the missing-data handling that crushed everyone
else.

## The fix

Three engine changes (`scripts/lib/ratings-engine.mjs`,
`scripts/generate-ratings.mjs`):

1. **Dampened role inference for unknown starts.** When `games_started` is missing,
   we no longer assume zero. We infer a conservative, capped start ratio from games
   played (`availability * 0.55`), landing an everyday player in the
   backup/rotation band instead of at the floor.
2. **Confidence tiers.** Every generated rating now carries
   `generated_high_confidence`, `generated_medium_confidence`, or
   `generated_low_confidence`, based on how much real evidence (box-score stats,
   awards, scouting prior, *recorded* starts) backs it. A rating built from
   availability alone is explicitly `low_confidence`, and its numeric confidence is
   penalized. The game and the audit can treat those cautiously.
3. **Era percentile by position group.** The era-adjustment percentile is now
   computed within each `season × position-group` cohort (1972 RBs vs other 1972
   RBs) rather than across the whole season, so older players are measured by
   dominance within their own era. Tiny cohorts are shrunk toward the median to
   avoid noise.

No proprietary or Madden data was used. The model is the same transparent
inputs-in / numbers-out engine; only the missing-data handling and provenance
changed.

## Result (after)

| Metric | Before | After |
| --- | ---: | ---: |
| Mean overall | 62.6 | **68.7** |
| Share in 40–64 | 88.9% | **6.3%** |
| Share 65–69 (backup) | — | 56.7% |
| Share 70–74 (rotation) | — | 30.9% |
| Share 75–89 (starters) | ~6.0% | 6.1% |
| 90+ (star / All-Pro+) | 64 (0.07%) | **64 (0.07%)** |
| 95+ | 17 | 19 |
| 98–99 (legendary) | 10 | 12 |
| Overrated flags | 0 | 0 |

Confidence tiers after regeneration:

| Status | Count | Share |
| --- | ---: | ---: |
| generated_low_confidence | 82,761 | 86.1% |
| generated_high_confidence | 8,123 | 8.4% |
| generated_medium_confidence | 5,268 | 5.5% |
| manual_override | 12 | 0.0% |
| manually_reviewed | 2 | 0.0% |
| needs_review | 1 | 0.0% |

### What changed and what didn't

- The data-sparse majority moved out of the false "depth" band and into a realistic
  backup/rotation range (65–74), **flagged low-confidence** so nothing pretends to
  be precise.
- Players with real evidence (stats / awards / scouting / recorded starts) spread
  across 75–99 as before.
- **The top did not inflate.** 90+ stayed at exactly 64 rows (0.07%), well inside the
  "≤1% of the dataset" health target. A 90 still feels special.
- **Zero overrated flags** both before and after — the audit found no generated
  rating the evidence couldn't support.

## Known limitations (not hidden)

- **Low-confidence cluster.** 86% of rows are `low_confidence` because the underlying
  data (starts, box score) simply isn't there for most historical seasons. Their
  overalls are honest estimates, not measurements. The manual-override workflow
  (`data/rating_overrides.csv`) exists to correct any that matter for gameplay.
- **Name-slug collisions.** 8 "errors" and all 7 "warnings" in the audit come from
  ~5 different real players who share a generated `player_id` slug (e.g. two
  `robert-jackson`s, one offensive and one defensive, merged into one row). This is a
  player-identity issue in slug generation, **not** a rating-logic problem, and is
  scoped to a future import fix.

_See `reports/underrated_players.csv` (43 rows) for specific deflated star seasons
the audit still flags, and `reports/rating_audit_summary.md` for the full
distribution._
