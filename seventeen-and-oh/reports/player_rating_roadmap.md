# Player Rating Roadmap — 17-0

_Phase 2 plan. Written 2026-06-07. This is the roadmap the brief asked for **before**
changing the database. It defines how every player is rated given the data we
actually have (see `roster_rating_quality_audit.md`), how confidence is assigned, and
how we keep the game playable. No proprietary/Madden data is used; the engine stays a
transparent inputs-in / numbers-out system._

## Design principles

1. **Individualize, don't average.** The goal is *separation within a roster*, not a
   higher mean. A great team still has weak players; a bad team still has stars.
2. **Rate by evidence, label by confidence.** Where production/starts exist, measure.
   Where they don't, infer the best provisional rating and mark it low-confidence or
   `needs_review` — never pretend missing data is precise.
3. **No generic 70s.** Every player gets a rating derived from *something*
   (position value, within-roster depth rank, experience, team context), so two
   players are only identical if their evidence is genuinely identical.
4. **Deterministic & explainable.** Same inputs → same numbers, and every rating
   carries a `rating_reason` sentence.
5. **Don't break the game.** Unrated/thin players still get a sensible, draftable
   fallback; Classic/Blind modes and the simulator keep working.

## The core new mechanism: within-roster depth ranking

The audit showed **85% of players have no starts, stats, or awards** — only position,
games, experience, and status. The breakthrough that avoids generic 70s without
inventing facts:

> For each team-season, within each position group, **rank** players by an
> availability/experience composite (games played → years experience → roster status
> → jersey-number heuristic as a final tiebreak). The rank maps to a **role tier**
> (primary starter / secondary starter / rotation / backup / depth) using realistic
> position counts (1 QB starts, ~2 WR start + slot, 5 OL start, etc.).

This produces an honest starter→depth **gradient** on every roster from data we
already have. It is an *inference*, so every rating built primarily on it is flagged
low-confidence — but it is individualized and defensible, which is exactly the brief.

---

## The 12 rating scenarios (the brief's roadmap points)

### 1. Players with full stats (1999+, skill positions, rich box score)
Inputs: season-aggregated production (yards, TDs, completions/att, target share where
available), efficiency, turnovers, plus starts and awards. Rate primarily on
production vs. the position's era cohort. **Confidence: high.** These anchor each
roster's top end.

### 2. Players with basic/partial stats
Inputs: whatever counting stats exist (e.g., a defender with tackles/sacks/INTs but no
advanced metrics; a kicker with FG%/made). Rate on the available counters, shrink
toward the role baseline when sparse. **Confidence: medium.**

### 3. Offensive line (limited or no box score)
OL almost never has a box score. Rate from: starts (or inferred depth rank), team
rushing/sack-rate context (a top rushing offense lifts its line modestly), experience,
awards/overrides where they exist, durability (games). A long-time starting LT on a
good rushing team rates well above a backup guard. **Confidence: medium if starts
known, else low.**

### 4. Defensive players from older eras (no stats at all)
Pre-2000 defenders have only position/games/experience/status. Rate from within-roster
depth rank + positional value + team-defense context (from team record/era) + any
override. A 12-year starting MLB on a great defense is not a 70. **Confidence: low**,
many flagged `needs_review`; legends handled by overrides (point 8).

### 5. Separating starters from backups
Driven by recorded starts when present; otherwise by the within-roster depth rank.
Role tier sets the base band: primary starter ≫ rotation ≫ backup ≫ depth. This is the
single biggest fix for flatness.

### 6. Detecting stars vs. good vs. average vs. role vs. depth
Layered on top of role tier:
- **Star (88–96):** elite production for the era cohort, or award/override.
- **Good starter (82–88):** strong production or clear lead starter on a good unit.
- **Average starter (76–82):** starts, ordinary production.
- **Rotation (70–76):** part-time/depth-rank rotation.
- **Backup/depth (60–70):** low depth rank, little evidence.

### 7. Era adjustment
Production percentiles computed within `season × position-group` cohorts (with
small-cohort shrinkage), so a 1,000-yard rusher in 1975 is judged against 1975
rushers, not modern volume. Inherited from Phase 1, retained.

### 8. Manual overrides for legends and key teams
`data/rating_overrides.csv` always wins. Curate the obvious legends and the marquee
players on famous/pilot teams (e.g., Payton, Singletary, Reed, Lott, Faulk, Warner,
Sapp, Brady, Moss, Wagner, Sherman, Mahomes, Bosa, Kittle) so the era-adjusted engine
never under-rates a known great. `review_status` of `draft`/`wip`/`rejected` parks an
entry without applying it.

### 9. Flagging players who need manual review
Status `needs_review` + `needs_manual_review=true` + `manual_review_queue.csv` for:
QBs with no stats, suspected starters on famous teams, any 90+, simulation-critical
roles with thin data. The game still rates them provisionally; the queue just marks
them for human attention.

### 10. Preventing generic 70 ratings
Hard rule in the engine and the validator: a roster may not park a large share of
players on one identical number. Every player's base differs by position value + depth
rank + experience even with zero stats, so ties require genuinely identical evidence.
The validator fails a roster with >40% identical or >30% at exactly 70.

### 11. Validating the distribution within each roster
`validate-rating-distribution` checks every team-season against the Step-10 rules
(too-flat, no starter above 80 on a normal/good team, backup rated above starter
without reason, too many 90+, bad team unrealistically high, great team with no elite,
position attributes mismatched). Emits warnings, not silent passes.

### 12. Making ratings useful for the simulator
Ratings feed unit strength (QB, skill, OL, front seven, secondary, special teams).
Separation must be *meaningful*: a real WR1 must outrate a depth WR enough to matter in
sim, and team unit strength must stay balanced so stacking one position doesn't break
the game. Verified by `scripts/sim-check.ts`.

---

## Expected per-roster distribution (target shape)

Not every team hits this exactly, but a normal full roster (~53) should land roughly:

| Tier | Overall | Rough count on a normal roster |
| --- | --- | --- |
| Elite/star | 88–96+ | 0–3 |
| Good starter | 82–88 | 4–8 |
| Average starter | 76–82 | 6–10 |
| Rotation | 70–76 | 10–16 |
| Backup / depth | 60–70 | 15–25 |

Great teams shift up (more stars, fewer weak starters); weak teams shift down but may
still have 1–2 stars. The validator enforces "bad teams can have stars, great teams can
have weak players."

## Confidence model

| Status | When |
| --- | --- |
| `manual_override` | Curated in overrides file. |
| `manually_reviewed` | Human-confirmed generated value. |
| `generated_high_confidence` | Rich production (+starts/awards). |
| `generated_medium_confidence` | Partial stats or known starts. |
| `generated_low_confidence` | Inferred from depth rank / position / experience only. |
| `needs_review` | Provisional but flagged for human attention. |
| `missing_data` | No usable inputs; pure fallback. |

Every generated row also carries `rating_reason` (e.g., _"Rated 78: inferred WR2 by
depth rank (2nd of 6, 15 games), no box score for this season, solid team context —
low confidence."_).

---

## Implementation phases

- **Phase 2.0 — Diagnose (done):** `roster_rating_quality_audit.md`,
  `suspicious_rosters.csv`, this roadmap.
- **Phase 2.1 — Engine rework:** add within-roster depth ranking + role tiers,
  position-specific formulas, `rating_reason`/`needs_manual_review`,
  generic-70 prevention. (`ratings-engine.mjs`, `generate-ratings.mjs`,
  `schema.mjs`.)
- **Phase 2.2 — Reports & overrides:** `default_rating_players.csv`, expand
  `rating_overrides.csv` for pilot-team legends.
- **Phase 2.3 — Pilot:** regenerate the 9 pilot teams, write
  `pilot_roster_rating_revision.md`, eyeball every roster.
- **Phase 2.4 — Scale & validate:** `ratings:*` npm scripts,
  `validate-rating-distribution`, `manual_review_queue.csv`.
- **Phase 2.5 — Full regen & ship:** regenerate all, re-export 1,760 JSONs, run
  tsc/build/sim/audit/validate, confirm Classic/Blind/simulator. Back up first.

## Guardrails (unchanged, binding)

Read data from project files; one optimized JSON per team-season; custom (non-Madden)
ratings; game keeps working with incomplete data via fallbacks; never hallucinate
rosters or historical claims; back up before regenerating; document every major
change.
