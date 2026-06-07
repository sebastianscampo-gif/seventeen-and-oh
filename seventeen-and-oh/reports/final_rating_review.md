# Final Rating Review — 17-0

_Written 2026-06-07. Covers the full ratings revision pass. All numbers are
reproducible from `scripts/audit-ratings.mjs`; no proprietary or Madden data was
used; no historical claims here are invented._

## What this pass set out to do

Make the player ratings realistic, position-specific, historically fair,
era-adjusted, and useful for the season simulator — without inflating the average
player or flattening legendary seasons. The audit found the system was **deflated,
not inflated** (see `rating_inflation_audit.md`), so the work centered on honest
missing-data handling and provenance rather than pulling ratings down.

## Scale calibration (target vs. actual)

The documented 17-0 scale and where the regenerated data actually lands:

| Band | Meaning | Share after |
| ---: | --- | ---: |
| 98–99 | All-time legendary | 0.01% (12) |
| 95–97 | MVP / DPOY / elite All-Pro | 0.0% (7) |
| 90–94 | Star / strong All-Pro | 0.0% (45) |
| 85–89 | Very good starter | 1.4% |
| 80–84 | Solid starter | 2.6% |
| 75–79 | Average starter | 2.1% |
| 70–74 | Rotation / below-average starter | 30.9% |
| 65–69 | Backup-level | 56.7% |
| 40–64 | Depth / weak backup | 6.3% |

90+ is 0.07% of the dataset — a 90 is genuinely special. The bulk of the league sits
in the backup/rotation bands, which is correct for a pool dominated by role players
and thin historical data.

## The 14-point brief — status

1. **Audit rating scale** — Done. `audit-ratings.mjs` classifies every row against
   the scale; distribution above.
2. **Position-specific attributes** — Done. Each position group has key/support/minor
   attribute tiers (`POSITION_PROFILE` in `scripts/lib/schema.mjs`); attributes track
   the overall by relevance, with stat nudges and award lifts.
3. **Inflation check** — Done. `reports/rating_inflation_audit.md` +
   `reports/overrated_players.csv` (0 rows — none flagged).
4. **Underrated check** — Done. `reports/underrated_players.csv` (43 rows: e.g.
   Priest Holmes 2004, Randy Moss 2004, Adrian Peterson 2007 — real star seasons
   sitting a few points low, mostly mid-confidence).
5. **Era adjustment** — Done. Era percentile is computed within `season ×
   position-group` cohorts with small-cohort shrinkage, so older players are judged
   by dominance within their own era, not modern raw-stat volume.
6. **Confidence tiers** — Done. Statuses: `manual_override`, `manually_reviewed`,
   `generated_high_confidence`, `generated_medium_confidence`,
   `generated_low_confidence`, `needs_review`, `missing_data`. Numeric confidence
   complements the tier and is penalized when role rests on inferred starts.
7. **Manual override system** — Done. `data/rating_overrides.csv` upgraded with
   `name, position, review_status, reviewed_by, last_updated` plus the granular
   per-attribute columns. Overrides always take priority; a `review_status` of
   `rejected`/`draft`/`wip` parks an entry without applying it.
8. **Consistency checker** — Done. `scripts/audit-ratings.mjs` (→ `npm run
   data:audit`) emits the summary, errors, warnings, overrated and underrated CSVs.
9. **Generation logic** — Done. Explainable engine over position, role
   (games/recorded-or-inferred starts), awards, box-score stats, team strength,
   scouting prior, and era percentile. Same inputs always yield the same numbers.
10. **Simulation usefulness** — Verified. `scripts/sim-check.ts` runs end-to-end:
    win curves, playoff/Super Bowl/perfect-season odds, and matchup sensitivity all
    behave (a great offense with a leaky secondary is upset-prone; a weak QB sags in
    January). Team strength is unit-based, so a roster does not become overpowered
    just by stacking one position.
11. **Position fit** — Done. `lib/positions.ts`: LT↔RT small penalty, CB↔S moderate,
    EDGE→LB moderate, **WR→TE significant (0.72)**, QB-elsewhere major (0.5), and a
    hard **special-teams lockout** — kickers/punters cannot fill any offensive or
    defensive slot and vice versa (multiplier 0.05, surfaced as "Can't play"). K↔P
    remains allowed.
12. **Final review** — This document + `rating_inflation_audit.md`.
13. **Don't break the game** — Verified: `tsc --noEmit` clean, `next build`
    succeeds, `sim-check` runs, audit re-runs, 1,760 team-season JSONs re-exported,
    new statuses + override provenance confirmed in the exported data.
14. **Deliverables** — See list below.

## Verification log (task 13)

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 |
| `npx next build` | compiled + typechecked + static pages generated, no errors |
| `sim-check.ts` | runs; calibration healthy (power 78→5.0 W, 100→15.4 W / 57.6% SB) |
| `npm run data:audit` | 8 errors, 7 warnings — all from ~5 name-slug collisions |
| JSON spot-check (2007 NE) | Brady 99 `manual_override` w/ provenance note; Moss 99 `generated_high_confidence`; tiers present |

## Honest caveats

- These are estimates, not ground truth. 86% of rows are `low_confidence` because
  the source data for those seasons is thin; their overalls are reasonable priors,
  not measurements.
- The 8 audit errors / 7 warnings are pre-existing **player-identity** collisions in
  slug generation, not rating bugs. They affect ~5 obscure players and are scoped to
  a future import fix.
- The game stays fully playable with incomplete data: unrated/`needs_review` players
  still receive a sensible fallback overall and remain draftable.

## Deliverables

- **Engine / pipeline:** `scripts/lib/ratings-engine.mjs`, `scripts/lib/schema.mjs`,
  `scripts/generate-ratings.mjs`, `scripts/apply-overrides.mjs`,
  `scripts/export-team-seasons.mjs`, `scripts/audit-ratings.mjs`.
- **App:** `lib/data-schema.ts` (status union), `lib/positions.ts` (fit + K/P
  lockout).
- **Data:** regenerated `data/processed/ratings.csv`, re-exported
  `public/team-seasons/*.json`, upgraded `data/rating_overrides.csv` (14 curated
  entries). Pre-regen backup in `data/backups/`.
- **Reports:** `rating_audit_summary.md`, `rating_inflation_audit.md`,
  `final_rating_review.md`, `overrated_players.csv`, `underrated_players.csv`,
  `rating_errors.csv`, `rating_warnings.csv`.
- **Docs:** `docs/DATA_PIPELINE.md` updated for the new tiers, era cohorting,
  override format, and special-teams lockout.
