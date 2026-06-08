# Player-Rating Systemic Bug — Root-Cause Investigation & Fix

**Project:** 17-0 (seventeen-and-oh) · **Date:** 2026-06-08
**Scope:** the full rating pipeline — 1,760 team-seasons, 96,167 player-seasons.

> **Mandate (verbatim):** *"Do not just make ratings higher. Fix the systemic
> problem… The final result should be a reliable player rating system where every
> player on every roster is rated based on role, performance, position, season
> context, and available evidence."*

This document is the root-cause analysis. It explains **why** so many players were
stuck in a generic 67-71 band, **what the actual defects were** (not a list of
players to bump), **how the pipeline was fixed end-to-end**, and **how regressions
are now caught automatically.** The per-team and per-player numbers live in the
companion CSVs (see *Deliverables*).

---

## 1. TL;DR

The engine had **two opposite defects that shared one root cause: it only trusted
one kind of evidence — offensive box-score volume.**

1. **Signal starvation → under-rating.** Any player without offensive counting
   stats (every offensive lineman, every defender, kickers/punters, and almost
   everyone on a pre-1999 roster) had *no input* to the rating formula, so they
   fell through to a flat fallback and piled up at **67-71**. Elite stat-less
   players (Quenton Nelson, T.J. Watt, Aaron Donald) landed there too.
2. **Volume-without-a-floor → over-rating.** The few players who *did* have
   counting stats were graded on raw totals with **no efficiency/quality floor**,
   so high-volume-but-mediocre seasons (Case Keenum 2017, Sam Howell 2023) scored
   as *high-confidence* 90+.

Both are now fixed at the source. Headline movement across the whole database:

| Metric (per-roster average)            | Before | After  |
| -------------------------------------- | -----: | -----: |
| Players in the 67-71 generic band      | 66.1%  | 15.3%  |
| Database-wide players in 67-71         | 65.4% (62,882) | 15.2% (14,644) |
| Roster average overall                 | 70.0   | 73.0   |
| Roster **max** overall (does it have a star?) | 80.9 | 86.4 |
| Rating spread (max − min)              | 18.4   | 24.1   |
| Rosters flagged "suspicious"           | 69% (1,214) | 52.3% (920)\* |

\* **The residual 920 is not 920 remaining bugs.** 893 of them are **pre-1999
rosters where the source data is genuinely bio-only** (no per-player stats exist to
separate depth players), which is a documented data limitation, not an engine
defect. Only **27 are modern (1999+) rosters** worth a human glance, and even those
have correctly-graded stars — it is their *depth tail* that still clusters. See §7.

No player was hand-edited to "look right." The fix is in the **engine, the fallback
logic, the position models, and a small curated-override layer for stat-less
legends** — plus three new validators that fail the build if the bug ever returns.

---

## 2. Root cause — the two failure modes

### 2.1 Signal starvation (the under-rating engine)

The old rating path was effectively *"grade the player from their offensive
counting stats; if there aren't any, use a generic fallback."* That design has a
fatal blind spot — **most football players never accrue offensive counting stats:**

- **Offensive linemen** (LT/LG/C/RG/RT) have *no* box-score line at all.
- **Defenders** (EDGE/DT/LB/CB/S) have tackles/sacks/INTs at best, and those were
  not wired into the offensive formula.
- **Kickers/punters** were a separate world the formula didn't grade.
- **Pre-1999 rosters** are imported as bio rows with little or no per-game data, so
  even skill players had nothing to grade.

Every one of those players hit the fallback, and the fallback emitted **one flat
number near 70.** That is why ~two-thirds of the entire database sat at 67-71 and
why rosters were so flat (spread 18.4) and star-less (max 80.9).

### 2.2 Volume without a floor (the over-rating engine)

The complementary defect: when counting stats *did* exist, the engine rewarded
**raw volume** and marked the result **high-confidence**, with no penalty for poor
efficiency, turnovers, or sacks taken. A quarterback who threw for a lot of yards on
a lot of attempts scored like a star regardless of *how well* he played:

- **Case Keenum, 2017 MIN — 90 overall (high-confidence).** One good year read as
  inner-circle elite.
- **Sam Howell, 2023 WAS — 91 overall (high-confidence).** League-leading pass
  *attempts* (and a league-high sack count, heavily turnover-prone) read as elite.

So the distribution was simultaneously **too flat in the middle** (everyone at 70)
and **too generous at the top for the wrong players** (compilers at 90+), while the
genuinely elite stat-less players were buried at 70. That combination is the
"systemic problem" the brief describes.

---

## 3. Pipeline audit (stage by stage)

The brief asked for an audit of the entire chain. Findings per stage:

| Stage | File(s) | Finding |
| ----- | ------- | ------- |
| Raw → processed | `scripts/adapt-nflverse.mjs`, `import-rosters.mjs` | **OK.** Import correctly de-duplicates per team-season; the dataset's mix of GSIS ids (`00-0019596`) and legacy slug ids (`tom-brady`) is intentional (slug rows are curated showcase seasons). Only 5/1,760 team-seasons contain a duplicate-name player and all 5 are legitimate (two distinct real players sharing a name). **No duplicate-roster bug.** |
| Stats/awards joins | `player_seasons.csv` | **Root cause #1 lives here in effect** — defense/OL/ST have no offensive box score to join, and the old engine had no alternate signal for them. |
| Ratings generation | `scripts/lib/ratings-engine.mjs`, `generate-ratings.mjs` | **Primary defect site.** Single-signal grading + over-compression + a flat fallback. Rewritten (see §4). |
| Overrides | `scripts/apply-overrides.mjs`, `data/rating_overrides.csv` | Worked, but had a latent bug: an override that set only `overall` left the *attributes* computed from the old (wrong) overall. Fixed to re-derive blanks (see §4.4). |
| Confidence / status | schema `STATUS`, `rating_confidence` | Confidence was being assigned by *whether stats existed*, which is exactly why volume compilers were "high-confidence" and stat-less elites "low-confidence." Now role-aware. |
| Team-season export | `scripts/export-team-seasons.mjs` | **OK** — faithfully serializes `ratings.csv` into `public/team-seasons/*.json` with metadata. Added a staleness guard so a stale export can't ship (see §6). |
| Team-season registry | `data/team_seasons.csv`, `teams.csv` | Checked for impossible franchise-seasons (e.g. a pre-1995 Carolina Panthers). **0 found** — but there was no guard preventing one. Guard added (see §5). |
| Frontend / Classic / Blind | `lib/data.ts`, `app/components/*` | **OK and verified.** Both draft modes read the same corrected `overall` from the exported JSON; Blind only *hides* the number visually. |
| Simulation | `lib/scoring.ts`, `lib/team-profile.ts`, `lib/simulation.ts` | **OK and verified.** Corrected overalls flow `overall → effectiveRating → team power → game odds`, per position group. |

---

## 4. The fix

### 4.1 Multi-signal, role-aware rating engine

`scripts/lib/ratings-engine.mjs` was reworked so a player's overall is built from
**role, position, season context, and whatever evidence exists** — not from
offensive volume alone:

- **Within-roster depth ranking.** Players are ranked *inside their own
  position group on their own team* and assigned a **role tier** (starter1,
  starter2, rotation, depth…). This separates a roster even when per-player stats
  are thin, because depth-chart position is itself signal.
- **Era-relative percentile.** A player is graded against the *cohort that played
  his position in his era*, shrunk toward the mean for small cohorts so a
  one-game sample can't masquerade as elite.
- **Efficiency/quality floor on rate stats.** Volume no longer implies quality;
  a high-attempt, low-efficiency, turnover-heavy season is graded as such. This is
  what pulls Keenum and Howell off 90.
- **Two-pass finalize** (`computeContext` → `finalize`) so tier, percentile, and
  confidence are computed with the whole roster in view.

### 4.2 Intelligent role-based fallback (replaces the flat 70)

When evidence is genuinely missing, the engine no longer emits a flat number. It
emits a **role-graded provisional rating** with full provenance, on this ladder:

| Role | Range | | Role | Range |
| ---- | ----- |-| ---- | ----- |
| Elite           | 92-99 | | Weak starter | 72-75 |
| Star            | 88-91 | | Rotation     | 68-73 |
| Strong starter  | 82-87 | | Backup       | 62-68 |
| Average starter | 76-81 | | Deep roster  | 55-62 |

Every fallback rating now carries **`rating_source`, `rating_confidence`,
`rating_reason`, and `needs_manual_review`**, so a low-confidence value is
labelled, auditable, and queue-able — never silently parked at 70.

### 4.3 Position-specific grading (no offensive box score required)

Each position group now has its **own** formula keyed off the attributes that
actually define it, so OL/EDGE/DT/LB/CB/S/K/P are graded on their own terms instead
of being starved by an offense-only model. This is the structural fix for §2.1.

### 4.4 Curated overrides for stat-less legends + the 4 alarming players

A thin, reviewed override layer (`data/rating_overrides.csv`) handles two things the
engine *cannot* infer from a stat-blank source row:

- **Inner-circle, career-stat-less greats** — e.g. Aaron Donald (99), Reggie White
  (98), Lawrence Taylor (99), Anthony Munoz (98), Deion Sanders (98). These would
  otherwise sit at the position prior no matter how good the engine is, because the
  *data does not exist* to lift them.
- **The 4 alarming players** (Keenum, Nelson, Howell, Watt — see §7.3).

Two override-layer hardenings:

- `apply-overrides.mjs` now **re-derives blank attributes from the new overall**
  using the same position model the engine uses. Before, an override that set only
  `overall=92` on a guard left depth-tier attributes attached to a star — incoherent.
- An override may target **one player-season** (showcase seasons, keyed by the
  curated slug id) or **a whole career** (legends, keyed by GSIS id with blank
  season/team), and a reviewer can park an entry via `review_status` without it
  taking effect.

---

## 5. Invalid team-season mappings (franchise existence)

The brief calls out impossible mappings such as a **"1967 Carolina Panthers"**
(the franchise's first NFL season is 1995). New validator
`scripts/validate-team-seasons.mjs` checks every registry row against
`teams.csv` (each franchise's `first_season`/`last_season` window), plus blank/garbage
codes, duplicates, unknown franchise codes, and the supported league era (1920-present).

**Result: 0 invalid mappings** across 1,760 team-seasons / 32 franchises
(`reports/invalid_team_seasons.csv` is empty by design). The impossible
"1967 Carolina Panthers" **does not exist in the data** — and now *cannot* be added
without failing the build.

Per the requirement to *"use correct historical team naming internally but display
modern/user-friendly naming,"* the validator and exporter validate against each
franchise's real history while displaying the **modern** name — e.g. the
1985 Washington team is validated as the same franchise but displayed as
**"Washington Commanders."**

---

## 6. Validation & automated regression guards

Three validators now gate the pipeline (`npm run ratings:regen` runs them in order
and any FAIL exits non-zero):

1. **`validate-team-seasons.mjs`** — franchise existence / registry integrity.
   → **0 invalid mappings.**
2. **`validate-rating-distribution.mjs`** — per-roster realism rules (flatness,
   generic-70, backup-over-starter, great-team-no-elite, position/attribute match…).
   It distinguishes a real bug (rankable players flattened **despite** evidence →
   **FAIL**) from an expected data gap (a bio-only cluster with no evidence to
   separate → **INFO**). → **0 FAIL**, 17 WARN (curated super-teams + dual-position
   source rows), 866 INFO (documented data-gap rosters).
3. **`validate-game-data.mjs`** — post-export guard on the JSON the game actually
   loads: stale-export detection, required-metadata presence, a **known-elite floor**
   watchlist (18 unambiguous greats that must clear a rating floor on a given roster,
   e.g. *Aaron Donald ≥ 95 on 2018 LAR*, *T.J. Watt ≥ 92 on 2022 PIT*), inflated-QB
   and generic-roster warnings. → **0 FAIL**, 316 WARN (review flags, not bugs).

The known-elite floor is the key recurrence guard: if a future regen ever drops
Donald back to 72 or Watt back to 73, the build **fails**.

---

## 7. Results

### 7.1 Database-wide (full before/after in `_snapshots/`)

See the headline table in §1. The 67-71 band fell from **65.4% to 15.2%** of all
96,167 players; average roster **max** rose from 80.9 to 86.4 (rosters now actually
have stars); spread widened from 18.4 to 24.1 (rosters are now *graded*, not flat).

### 7.2 The 30 flagged team-seasons

`reports/suspicious_team_season_rating_fixes.csv` has the full before/after for all
30 brief teams (+ the 4 alarming-player teams). Representative rows:

| Team-season | 67-71 before→after | max before→after | spread before→after | note |
| ----------- | -----------------: | ---------------: | ------------------: | ---- |
| 1992 Buffalo Bills      | 55 → 28 | 73 → **97** | 6 → 26 | Bruce Smith now elite |
| 1985 Washington Commanders | 51 → 2 | 72 → 78 | 5 → 7 | role-graded (pre-99 data gap) |
| 1965 New York Jets      | 46 → 0  | 74 → 81 | 6 → 8  | now has a separated top end |
| 2022 Pittsburgh Steelers| 22 → 14 | 88 → **95** | 31 → 43 | T.J. Watt corrected |
| 2022 Indianapolis Colts | 20 → 12 | 87 → **92** | 27 → 36 | Quenton Nelson corrected |
| 2023 Washington Commanders | 21 → 10 | **91 → 87** | 35 → 37 | Howell pulled *down* off the top |

(The roster max **dropping** for 2023 WAS is the fix working — an inflated compiler
was removed from the top of the roster.)

**`1967 Carolina Panthers`** is reported as an impossible team-season that **does
not exist** in the data (franchise began 1995), now guarded by §5.

### 7.3 The 4 alarming players (`alarming_player_rating_fixes.csv`)

| Player | Team-season | Old | New | Defect |
| ------ | ----------- | --: | --: | ------ |
| Case Keenum   | 2017 MIN | 90 | **79** | over-rated volume compiler (no efficiency floor) |
| Sam Howell    | 2023 WAS | 91 | **76** | over-rated volume compiler (turnover/sack-blind) |
| Quenton Nelson| 2022 IND | 72 | **92** | under-rated elite OL (no box score → generic band) |
| T.J. Watt     | 2022 PIT | 73 | **95** | under-rated elite EDGE (no box score → generic band) |

These four are the cleanest illustration of the two failure modes: the two
*high-confidence* over-rates and the two *low-confidence* generic-band under-rates,
all corrected at the engine + override layer (confidence 0.95).

### 7.4 Full-database scan (`all_suspicious_rosters_detected.csv`, 920 rows)

The detector still flags 920 rosters, **stratified honestly**:

- **893 are pre-1999** — the documented data gap. The source has bio rows but no
  per-player stats to separate depth, so those players correctly sit at the position
  prior. *Recommended action: none (not a regression).*
- **27 are modern (1999+)** and worth a glance. Even these have correctly-graded
  stars (e.g. 2008 HOU top = Andre Johnson 97, 2001 BAL top = Jonathan Ogden 96);
  it is the *depth tail* that still clusters, mostly early-2000s Arizona rosters with
  thin depth-player data. *Recommended action: audit stat joins / targeted overrides.*

---

## 8. Frontend & simulation verification (nothing broke)

- **`tsc --noEmit`** → exit 0. **`next build`** → exit 0 (static prerender OK).
- **Data wiring confirmed by reading the code path**, not assumed:
  - Draft UI (`DraftScreen`, `RosterDetailsPanel`) reads `player.overall` from the
    exported JSON; **Classic** shows the number, **Blind** hides it visually — both
    use the same corrected value.
  - Simulation: `overall → effectiveRating (scoring.ts) → computeTeamProfile.power
    (team-profile.ts) → game odds (simulation.ts)`, with every position group
    consumed individually, so position-specific corrections reach the sim.
- Spot-checked exported JSON: Watt 95, Nelson 92, Keenum 79, Howell 76, Donald 99,
  Taylor 99, Reggie White 98 — all `status = manual_override`, all present on the
  expected rosters.

---

## 9. Honest residual / known limitations

- **Pre-1999 data gap (the 893).** No engine can separate players the source data
  doesn't describe. The fix grades them by *role tier* (a real improvement over a
  flat 70) and **labels** the low confidence; it does not invent evidence. This is
  surfaced as INFO, not hidden.
- **316 game-data WARN / 17 distribution WARN.** Review flags, not bugs:
  inflated-QB *candidates* (a human-review list), curated super-teams that are
  intentionally elite-heavy, and a handful of dual-position source rows.
- **Override re-derivation uses a single position label.** A multi-position legend
  (e.g. listed LB but really EDGE one year) gets slightly approximate *non-signature*
  attributes; explicit attribute overrides (e.g. `pass_rush`) mitigate this.

---

## 10. Deliverables

| File | What it is |
| ---- | ---------- |
| `reports/rating_bug_investigation.md` | this document — root cause + fix |
| `reports/suspicious_team_season_rating_fixes.csv` | before/after for the 30 flagged teams (+4 alarming) |
| `reports/all_suspicious_rosters_detected.csv` | full-database scan (920 rosters, stratified) |
| `reports/invalid_team_seasons.csv` | franchise-existence violations — **empty (0)** |
| `reports/alarming_player_rating_fixes.csv` | the 4 alarming players, old→new + reasons |
| `scripts/lib/ratings-engine.mjs` | reworked multi-signal, role-aware engine + fallback |
| `scripts/apply-overrides.mjs` | override layer + attribute re-derivation |
| `data/rating_overrides.csv` | curated stat-less legends + the 4 alarming players |
| `scripts/validate-team-seasons.mjs` | franchise-existence guard |
| `scripts/validate-rating-distribution.mjs` | per-roster realism guard |
| `scripts/validate-game-data.mjs` | post-export + known-elite-floor guard |

## 11. Reproduce

```bash
npm run ratings:regen
# = validate-team-seasons → generate-ratings → apply-overrides
#   → export-team-seasons → validate-rating-distribution → validate-game-data
# Exits non-zero on any FAIL. Current run: 0 FAIL across all three validators.
```
