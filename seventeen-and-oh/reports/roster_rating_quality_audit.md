# Roster Rating Quality Audit — 17-0

_Phase 2, Step 1 (diagnosis). Written 2026-06-07. Every number is reproducible from
`scripts/audit-roster-quality.mjs` (`npm run ratings:audit`) run against
`data/processed/ratings.csv` joined to `data/processed/player_seasons.csv`.
Read-only — no ratings were changed to produce this report._

## Why this audit exists

The previous pass (Phase 1) fixed **deflation** — it raised the average and moved the
data-sparse majority out of a false "depth" band. But it did **not** review each
roster player-by-player. The result is rosters that are *flat*: too many players
share one number, starters and backups look identical, and stars are not separated
from role players. The clearest example is the **1996 New York Giants** — 60 players,
**78% rated exactly 70**, top rating 70. That is not a roster of individuals; it is a
default applied 60 times.

This audit measures that flatness across **all 1,760 team-seasons** so the fix can be
targeted, honest about missing data, and validated.

## Headline numbers

| Metric | Value |
| --- | ---: |
| Team-seasons audited | 1,760 |
| **Flagged as suspicious** | **1,740 (98.9%)** |
| Perfectly flat (every player within 0 pts) | 340 |
| ≥90% of roster on one identical rating | 584 |
| ≥25% of roster at exactly 70 | 803 |
| No recorded starts anywhere on roster | 926 |
| Compressed spread (max − min < 14) | 928 |
| No clear starter (max overall < 80) | 926 |

Nearly every roster is flagged. That is expected and correct: the flatness is
systemic, not a handful of bad rosters. It comes from **missing source data**, which
the audit quantifies next.

## Root cause: the evidence simply isn't in the data

A rating can only separate players if there is something to separate them *by*:
recorded starts (starter vs. backup), box-score production (stars vs. role players),
or awards (excellence). Here is how much of each actually exists, by era, across
96,167 player-seasons:

| Era | Player-seasons | Has starts | Has box score | Has awards | Has scout grade |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1960s | 5,670 | 0% | 0% | 0% | 0% |
| 1970s | 13,001 | 0% | 0% | 0% | 0% |
| 1980s | 16,413 | 0% | 0% | 0% | 0% |
| 1990s | 16,958 | 2% | 3% | 0% | 0% |
| 2000s | 15,704 | 19% | 32% | 0% | 0% |
| 2010s | 17,756 | 18% | 30% | 0% | 0% |
| 2020s | 10,665 | 16% | 26% | 0% | 0% |
| **All** | **96,167** | **8.7%** | **14.3%** | **0.0%** | **0.2%** |

The takeaways:

- **Box-score stats exist only for 1999–2024**, and only for ~30% of players even
  then (skill positions — QB/RB/WR/TE and a few defensive counters). Offensive line,
  most of the defense, and all depth/special-teams players have **no stats in any
  era**.
- **Recorded starts cover under 9% of the dataset** and are essentially absent before
  2000.
- **Awards and scouting grades are effectively empty** (one awards file exists,
  `2007_NE.csv`). They cannot be a separation lever at scale today.

So for **~85% of player-seasons the only signals are position, games played,
years of experience, and roster status (active/reserve/cut).** The old engine had
nothing to spread those players by, so it parked them all at the role prior (~70).

## The two distinct failure modes

The flatness is **not uniform**. It splits cleanly at the 1999 box-score boundary:

### 1. Pre-2000 imports — catastrophically flat (~950 team-seasons)

| Era | Team-seasons | Avg spread (max−min) | Mostly-70 rosters |
| --- | ---: | ---: | ---: |
| 1960s | 123 | 0.8 | 57 |
| 1970s | 268 | 1.1 | 123 |
| 1980s | 280 | 0.9 | 128 |
| 1990s | 291 | 3.7 | 133 |

These are full 40–60 man bio-only imports (name, position, height/weight, college,
experience — **no starts, no stats, no awards**). Average internal spread is **~1
point**: the entire roster is one number. This is the 1996 NYG pattern, repeated
~950 times. **The 1985 Bears as a full import would look like this too** — only the
hand-curated 23-man version (below) escapes it.

### 2. Post-1999 imports — bimodal (~795 team-seasons)

| Era | Team-seasons | Avg spread | Mostly-70 rosters |
| --- | ---: | ---: | ---: |
| 2000s | 318 | 29.6 | 147 |
| 2010s | 320 | 29.8 | 144 |
| 2020s | 160 | 29.7 | 71 |

Spread looks healthy (~30 points) but it is **bimodal**, not graduated: ~20 skill
players get real production-based ratings up into the 80s–90s, while the **other ~30
players on the roster (offensive line, most defenders, depth, special teams) collapse
to a flat blob at exactly 70.** That is why ~45% of modern rosters still trip the
"≥25% at 70" flag despite a wide min-to-max range. The stars are fine; everyone
without a box score is generic.

### 3. The 16 hand-curated rosters — the opposite problem

Eight of the nine pilot teams (and ~8 others) are small, hand-built 23–25 man
rosters. They have recorded starts, so they *do* separate — but they are **compressed
at the top**, not flat at the bottom:

| Team | Players | Avg | Spread | Max | %@70 | Has stats |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1996 NYG | 60 | 69.8 | 1 | 70 | 100% | no |
| 1985 CHI | 23 | 85.0 | 14 | 92 | 0% | no |
| 1999 STL | 23 | 84.0 | 14 | 92 | 0% | no |
| 2000 BAL | 24 | 83.5 | 24 | 99 | 0% | no |
| 2007 NE | 23 | 87.1 | 17 | 99 | 0% | 44% |
| 2013 SEA | 24 | 84.2 | 12 | 91 | 0% | no |
| 2018 KC | 24 | 84.0 | 14 | 91 | 0% | no |
| 2020 TB | 25 | 84.6 | 9 | 88 | 0% | no |
| 2023 SF | 24 | 84.4 | 13 | 91 | 0% | no |

A 24-man roster averaging **84** means "everyone here is a good starter" — true once
you trim to 24, but it loses the gradient between a genuine star (Megatron, Bruce
Smith) and a solid starter. And these rosters only contain the stars/starters; the
40-ish other real players are missing entirely. So even the "good" rosters are not
individualized the way the brief asks.

## What this means for the fix (preview of the roadmap)

Because the evidence is missing for the majority, we **cannot** measure most players —
but the brief is explicit: *still create the best possible provisional rating from
role, games played, position, and team context, and mark it low-confidence.* The
levers, in priority order:

1. **Box-score production** (1999+, skill players) — real, high/medium confidence.
2. **Recorded starts** (where present) — starter vs. rotation vs. backup.
3. **Within-roster depth rank by position** — the key new lever. Even with no starts
   data, ranking players within each position group on a roster (by games played,
   experience, roster status) infers who the starters are, producing an honest
   starter→depth gradient instead of a flat 70. Marked low-confidence.
4. **Positional value + era baseline** — a starting QB/edge/CB/LT is not a backup
   guard; bake position scarcity into the baseline.
5. **Manual overrides** for legends and famous teams where it matters for gameplay.

The detailed plan is in `reports/player_rating_roadmap.md`.

## Deliverables from Step 1

- `reports/roster_rating_quality_audit.md` — this report.
- `reports/suspicious_rosters.csv` — all 1,740 flagged rosters with the exact columns
  requested (team_code, team_name, season, number_of_players, average_overall,
  median_overall, min_overall, max_overall, percent_same_rating, percent_70_overall,
  likely_problem, recommended_action), sorted worst-first by a suspicion score.
- `scripts/audit-roster-quality.mjs` — the reproducible audit (`npm run ratings:audit`).
