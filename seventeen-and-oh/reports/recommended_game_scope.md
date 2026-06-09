# Recommended Game Scope — 17-0

Grounded in `reports/data_quality_by_year.csv`, `reports/position_rating_feasibility.csv`,
and the analysis in `reports/historical_scope_feasibility.md`. Team-season and player
counts below are measured from `data/processed/player_seasons.csv`.

---

## The three options

### Option 1 — Quality-first (RECOMMENDED as the main DB)
- **Range:** 1999–2024
- **Seasons:** 26 · **Team-seasons:** 829 · **Players:** 45,971
- **Rating quality:** the evidence floor. Every season carries real QB/RB/WR/TE
  production (stats_completeness 22–37%, confidence 0.46–0.54); defense/OL/K/P are
  modelled from role + bio + curated overrides. Confidence labels are honest.
- **Risks:** 10 of 14 position groups are still role/bio (a feed limitation that exists
  in every era, not a property of this range). 1999–2001 is a 31-team league.
- **Recommended use:** **the default, rated, simulated database.**
- **Use as main DB?** ✅ **Yes.**

> Tightest variant: **2002–2024** (23 seasons · 736 team-seasons · 40,388 players) — a
> clean 32-team league with the strongest stat coverage (32–37%) and confidence 0.53. Use
> this if you want maximum rating quality and are willing to drop 1999–2001.

### Option 2 — Balanced (modern rated core + curated legends)
- **Range:** 1999–2024 rated **+** a hand-picked, clearly-labeled set of famous pre-1999
  teams via manual overrides (e.g. ~20–40 legend team-seasons, not the full bio-only mass).
- **Seasons:** 26 rated + curated throwbacks · **Team-seasons:** 829 + curated.
- **Rating quality:** identical evidence floor for the rated core; legends are
  override-graded and flagged lower-confidence.
- **Risks:** curation effort; must keep legends visibly separate from rated play.
- **Recommended use:** ship Option 1 first, then layer this in for throwback appeal.
- **Use as main DB?** ✅ Yes (it *is* Option 1 plus opt-in content).

### Option 3 — Maximum historical (breadth-first)
- **Range:** 1966–2024
- **Seasons:** 59 · **Team-seasons:** 1,738 · **Players:** 95,204
- **Rating quality:** mixed and mostly low. 1966–1998 (≈909 team-seasons, ≈49k players)
  has **0% performance evidence** and ~99% low-confidence ratings — the exact condition
  that produced the 67–71 compression bug.
- **Risks:** half the database is bio-only heuristics. Presenting it as accurate would be
  dishonest and reintroduces the bug class just fixed.
- **Recommended use:** only with mandatory confidence labels and a separate "Legacy" mode.
- **Use as main DB?** ❌ **No** — not as the sole rated pool.

---

## Recommendation

Ship **Option 1 (1999–2024)** as the main rated and simulated database, evolving into
**Option 2** by adding curated, clearly-labeled pre-1999 legend teams over time. Do **not**
adopt Option 3 as the default rated pool. 1999 is not a compromise — it is the first year
the underlying data can honestly support ratings, and the recent bugs were a direct
consequence of reaching past it.

---

## Final answer (requested format)

- **The earliest year I recommend for full reliable coverage is 1999 — for the offensive
  skill positions (QB/RB/WR/TE) only.** No season offers full reliable coverage for *all
  14* position groups, because defensive, offensive-line, kicking and punting box-score
  stats are absent in **every** season of this dataset; those groups are always rated from
  role + bio + curated overrides, not production.

- **The earliest year I recommend for usable coverage is 1999.** This is where real
  performance stats begin (stats_completeness jumps 0% → 28.3%, confidence 0.34 → 0.46),
  giving graded skill positions plus a disciplined role/bio model elsewhere.

- **I do NOT recommend going back to 1966 for full coverage, because** 1966–1998 is
  bio-only: 0% of those players have a single performance stat, ~99% are flagged
  low-confidence, and ratings can only be inferred from depth order and body type — which
  is exactly what produced the 67–71 compression bug. Rosters are complete there, but the
  *ratings* would not be accurate, fair, or evidence-based.

- **The best full-game database scope is 1999–2024** (Option 1: 26 seasons, 829
  team-seasons, 45,971 players) as the rated main pool — optionally tightened to 2002–2024
  for a clean 32-team league with peak stat coverage — with confidence labels shown in the
  UI and pre-1999 kept out of the default rated pool.

- **Older seasons should be handled by** an opt-in, clearly-labeled "Legacy / Throwback"
  pool: curated famous teams added gradually through manual overrides and manual review,
  with visible confidence labels, kept separate from the rated modern database — never
  blended in at full confidence or presented as accurate historical ratings.
