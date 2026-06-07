# 17-0 Data Pipeline

How the historical NFL dataset for **17-0** is stored, rated, and turned into the
per-team-season JSON the game reads. Everything lives in plain CSV files inside
the project and is processed by zero-dependency Node scripts — there is no
database, no network call, and no single giant JSON blob.

## Design principles

These are hard constraints. Keep them when extending the dataset:

1. **The game reads from files in the project.** Rosters are never pasted into
   chat or fetched at runtime. The whole dataset is committed CSV + generated
   JSON.
2. **One optimized JSON per team-season.** The export step writes
   `data/game/team-seasons/<SEASON>_<TEAM>.json`, never one monolithic file.
   The client bundles these through a generated barrel of static imports.
3. **Custom ratings only.** The rating engine (`scripts/lib/ratings-engine.mjs`)
   is a transparent, reproducible model built from public signals (role, awards,
   box-score stats, team strength, era percentile). It copies **no** proprietary
   rating database.
4. **Always playable, even with incomplete data.** Any player with thin or
   missing inputs still receives a full fallback rating and is flagged
   (`needs_review` / `missing_data`) instead of breaking the build.
5. **No hallucinated rosters.** Use real, verifiable roster data or the provided
   sample set. The pipeline is built to *ingest* real files, not to invent them.

---

## Folder map

```
data/
  teams.csv                  # franchise registry (all 32 NFL teams)
  team_seasons.csv           # one row per playable team-season (record, strength)
  rating_overrides.csv       # manual rating corrections (hand-edited)
  players.json               # legacy demo dataset (input to the one-off migrator)

  raw/                       # hand-authored / imported source data
    rosters/                 # <SEASON>_<TEAM>.csv — one row per player (REQUIRED)
    stats/                   # <SEASON>_<TEAM>.csv — optional box-score overlay
    awards/                  # <SEASON>_<TEAM>.csv — optional awards overlay

  processed/                 # generated intermediates (do not hand-edit)
    player_seasons.csv       # normalized: one row per player per season
    players.csv              # one row per unique player (aggregated)
    ratings.csv              # engine output + applied overrides

  game/                      # generated, game-ready output (do not hand-edit)
    team-seasons/
      <SEASON>_<TEAM>.json   # one optimized file per team-season
      index.json             # lightweight catalog of all team-seasons

scripts/
  build.mjs                  # runs the four stages in order
  migrate-legacy-json.mjs    # one-off: players.json -> raw roster CSVs
  import-rosters.mjs         # stage 1: raw -> processed/player_seasons + players
  generate-ratings.mjs       # stage 2: player_seasons -> processed/ratings
  apply-overrides.mjs        # stage 3: overlay rating_overrides onto ratings
  export-team-seasons.mjs    # stage 4: -> game JSON + index + TS barrel
  lib/
    csv.mjs                  # dependency-free CSV reader/writer
    util.mjs                 # paths, slugify, num/list parsers, jitter, logging
    schema.mjs               # canonical columns + rating tuning tables (data)
    ratings-engine.mjs       # the rating math (logic)

lib/
  data.ts                    # maps generated JSON -> runtime Player/TeamSeason
  data-schema.ts             # TS types mirroring the exported JSON shape
  generated/
    team-seasons.generated.ts  # barrel of static JSON imports (generated)
```

---

## The pipeline at a glance

```
raw/rosters/*.csv  ┐
raw/stats/*.csv    ├─(1) import ─► processed/player_seasons.csv ─┐
raw/awards/*.csv   ┘                processed/players.csv        │
                                                                 │
team_seasons.csv ──────────────────────────────────────────────►(2) generate
                                                                 │   ratings
                                       processed/ratings.csv ◄───┘
                                                 │
rating_overrides.csv ──►(3) apply overrides ─────┤ (rewrites ratings.csv in place)
                                                 │
                                                 ▼
                                  (4) export ─► data/game/team-seasons/*.json
                                                data/game/team-seasons/index.json
                                                lib/generated/team-seasons.generated.ts
```

Run the whole thing:

```bash
npm run data:build      # import -> ratings -> overrides -> export
```

Or run a single stage (handy while iterating):

```bash
npm run data:import     # node scripts/import-rosters.mjs
npm run data:ratings    # node scripts/generate-ratings.mjs
npm run data:overrides  # node scripts/apply-overrides.mjs
npm run data:export     # node scripts/export-team-seasons.mjs
npm run data:migrate    # node scripts/migrate-legacy-json.mjs  (one-off)
```

All scripts are ESM `.mjs` using only Node built-ins. No `npm install` is needed
for the data pipeline.

---

## 1. How to add a new team-season

A "team-season" is one team in one year (e.g. `2007_NE`). To add one:

1. **Confirm the franchise exists** in `data/teams.csv`. All 32 current NFL teams
   are already listed by `team_code` (e.g. `NE`, `SF`, `KC`). Only edit this file
   to fix franchise-level facts (conference/division, relocation notes).

2. **Add a row to `data/team_seasons.csv`** — this is the registry of playable
   team-seasons. Columns:

   | column             | meaning                                                        |
   | ------------------ | -------------------------------------------------------------- |
   | `season`           | year, e.g. `2007`                                              |
   | `team_code`        | must match `teams.csv`, e.g. `NE`                              |
   | `team_name`        | display name, e.g. `New England Patriots`                     |
   | `wins`/`losses`/`ties` | season record (used in JSON + label)                      |
   | `team_strength`    | 0–100 prior for how stacked the roster was (default `70`)      |
   | `rating_source`    | usually `generated`                                            |
   | `rating_confidence`| default confidence for this team's generated ratings (0–1)     |
   | `roster_file`      | optional override path; blank ⇒ `raw/rosters/<SEASON>_<TEAM>.csv` |
   | `notes`            | free text                                                      |

   Example:

   ```csv
   2007,NE,New England Patriots,16,0,0,98,generated,0.6,,16-0 regular season.
   ```

3. **Add the roster file** (next section), then run `npm run data:build`.

> **Shortcut:** you can skip step 2. If you drop a correctly named roster file in
> `raw/rosters/` that isn't in the registry, `import-rosters.mjs` auto-appends a
> registry row with safe defaults (`team_strength=70`, `rating_confidence=0.6`,
> note `auto-added; please complete`) and writes it back to `team_seasons.csv`.
> Editing the row afterward to set the real record and strength is recommended.

---

## 2. How to add new roster files

Create `data/raw/rosters/<SEASON>_<TEAM>.csv`, one row per player. The filename
**must** match `^\d{4}_[A-Z0-9]{2,3}\.csv$` (e.g. `2007_NE.csv`) or the importer
won't discover it. Copy `data/raw/rosters/_TEMPLATE.csv` as a starting point (the
template itself is ignored — it doesn't match the season/team pattern).

Roster columns (`ROSTER_COLUMNS` in `schema.mjs`):

| column                | required | notes                                                            |
| --------------------- | :------: | ---------------------------------------------------------------- |
| `player_id`           |  no\*    | stable kebab id; blank ⇒ derived from `name` via `slugify`       |
| `name`                | **yes**  | display name                                                     |
| `position`            | **yes**  | one of the 16 positions below (fullbacks use `RB`)               |
| `secondary_positions` |  no      | semicolon-separated, same set, e.g. `LG;RG`                      |
| `jersey_number`       |  no      |                                                                  |
| `height`              |  no      | e.g. `6-4`                                                       |
| `weight`              |  no      | lbs                                                              |
| `birth_date`          |  no      | `YYYY-MM-DD`                                                     |
| `college`             |  no      |                                                                  |
| `years_exp`           |  no      |                                                                  |
| `games`               |  no†     | feeds the role prior                                             |
| `games_started`       |  no†     | feeds the role prior                                             |
| `scout_grade`         |  no      | optional 0–99 scouting prior; blends in when stats/awards thin   |
| `awards`              |  no      | semicolon-separated, e.g. `MVP;First-Team All-Pro;Pro Bowl`      |
| `notes`               |  no      | free text                                                        |

\* Provide an explicit `player_id` when two players share a name, or to keep an id
stable across spelling changes.
† Strictly optional, but a player with a known position and **no** role, stats,
awards, or scout grade is flagged `needs_review` (see §7).

**Positions** (must match `lib/types.ts`):

```
QB RB WR TE  LT LG C RG RT  EDGE DT LB CB S  K P
```

There is no `FB` — list fullbacks as `RB`. An unrecognized position does not crash
the build; that player is rated with a generic fallback and flagged `missing_data`.

### Optional overlays (stats & awards)

Two optional files enrich a roster without bloating it. Both are keyed by
`player_id` (or a `name` column the importer slugifies), so they only need the
columns you actually have.

- **`data/raw/stats/<SEASON>_<TEAM>.csv`** — box-score stats. Any of:
  `pass_yds, pass_td, pass_int, passer_rating, rush_yds, rush_td, receptions,
  rec_yds, rec_td, sacks, tackles, def_int, forced_fumbles, fg_made, fg_att,
  fg_pct, punt_avg`. Overlay values win over inline roster columns of the same
  name; `fg_pct` is derived from `fg_made`/`fg_att` when left blank.

- **`data/raw/awards/<SEASON>_<TEAM>.csv`** — a `player_id` (or `name`) column plus
  `awards` (or `award`). Merged with any inline `awards` on the roster row (union,
  de-duplicated). Useful when a roster was imported without award data.

Example stats row:

```csv
player_id,pass_yds,pass_td,pass_int,passer_rating,rush_yds,rush_td,receptions,rec_yds,rec_td,sacks,def_int,fg_made,fg_att,punt_avg
tom-brady,4806,50,8,117.2,98,2,,,,,,,,
```

### Bulk import: real rosters from nflverse (recommended for many seasons)

Authoring rosters by hand is fine for a few marquee team-seasons, but to ingest
**many real seasons at once** use the bundled nflverse importer instead of typing
players. [nflverse](https://github.com/nflverse/nflverse-data) is a free, public,
community dataset of real NFL rosters and weekly stats going back to **1965**.
Pulling from it is what lets us honor the "do not hallucinate rosters" rule at
scale — every player is real and sourced, not invented.

Two scripts, then the normal pipeline:

```bash
# 1. download the raw source CSVs into data/raw/source/nflverse/ (cached; safe to
#    re-run). Use any year range.
npm run data:fetch  -- --from 1965 --to 2024

# 2. transform them into our schema: data/raw/rosters/<S>_<T>.csv +
#    data/raw/stats/<S>_<T>.csv, and upsert data/team_seasons.csv rows.
npm run data:adapt  -- --from 1965 --to 2024

# 3. rate + export as usual
npm run data:build
```

What `adapt-nflverse.mjs` handles automatically:

- **Weekly → season** dedupe (one row per player per season).
- **Status filter** — keeps players who were actually on the team (`ACT`, `RES`,
  …); drops cuts and practice-squad noise.
- **Season-aware franchise normalization** — maps historical codes to our
  `teams.csv` codes, including the season-dependent ones: `OAK`→`LV`, `SD`→`LAC`,
  `BAL`→`IND` before 1996 but `BAL` (Ravens) after, `STL`→`ARI` before 1988 but
  `STL` (Rams) for 1995–2015, `HOU`→`TEN` before 2002 but `HOU` (Texans) after.
- **Position mapping** to our 16 slots (`FB`→`RB`, `T`→`LT` + `RT` secondary,
  `DE`→`EDGE`, `NT`→`DT`, `ILB/OLB/MLB`→`LB`, `FS/SS`→`S`; long snappers skipped).
- **Season stat aggregation** from weekly `player_stats` (passing/rushing/receiving
  totals + a computed passer rating), joined by player id.

Safety + known limits:

- **Curated rosters are never clobbered.** If a roster file already exists it is
  skipped; `--force` only refreshes files this importer itself wrote (marked with
  a `nflverse` note), so your hand-authored samples survive.
- **Role baseline.** Skill players get real game counts from their stat line. A
  player with no box score (most OL / defenders) gets a modest *availability
  estimate* so they're still `generated` and draftable rather than mass
  `needs_review`. This is an explicit estimate (confidence is kept modest); the
  documented refinement is to join nflverse `snap_counts` (2012+) for real
  games/starts, and an awards/All-Pro source to differentiate non-skill stars.

> **Scale note.** The default delivery path (a static-import barrel that bundles
> every team-season — see §6) is fine for dozens to a few hundred team-seasons.
> Importing *all* ~60 years is ~1,500 team-seasons / tens of thousands of players,
> which is too large to ship in one client bundle. At that scale switch the export
> to on-demand loading (write the JSON under `public/` and `fetch` each
> team-season when it's drawn, keeping only a lightweight `index.json` in memory).

---

## 3. How to run the import script

```bash
npm run data:import     # or: node scripts/import-rosters.mjs
```

What it does:

1. Reads `data/team_seasons.csv`. Auto-discovers any roster files in
   `raw/rosters/` not yet registered and appends them with defaults.
2. For each registered team-season, reads its roster file and merges the optional
   `stats` and `awards` overlays.
3. Normalizes everything into two processed files:
   - **`data/processed/player_seasons.csv`** — one row per player per season
     (bio + role + awards + flattened stats). This is the rating engine's input.
   - **`data/processed/players.csv`** — one row per *unique* player, aggregating
     primary position, seasons played, and teams across all their seasons.

Console output reports `<N> team-seasons → <M> player-seasons, <K> unique
players`. Re-running is idempotent — it always rebuilds both files from scratch.

> Bringing a legacy `data/players.json` into the pipeline? Run
> `npm run data:migrate` once. It converts that single file into per-team-season
> roster CSVs, carrying each legacy `overall` into `scout_grade` (it will **not**
> overwrite existing roster files unless you pass `--force`). Then run the normal
> import.

---

## 4. How to generate ratings

```bash
npm run data:ratings    # or: node scripts/generate-ratings.mjs
```

Reads `processed/player_seasons.csv` + `team_seasons.csv` and writes
**`data/processed/ratings.csv`** — one row per player-season with `overall` plus
the 21 attributes, a `status`, a `rating_source`, and a `rating_confidence`.

It runs in two passes:

1. **Raw composite** (`computeContext`): combine a *role prior* (from
   games/games-started), an *awards bonus*, *stat production*, a *team-strength*
   nudge, and an optional *scout-grade* blend into one raw number per player.
2. **Finalize** (`finalize`): rank each player within their **season × position-group
   cohort** to get an "era percentile," blend that gentle curve with the absolute
   composite, then project the 21 attributes from `overall` using each position's
   attribute profile. Assigns the status and confidence.

### Missing `games_started` (important)

`games_started` is recorded for only a minority of historical player-seasons. The
role prior does **not** treat "no starts on file" as "started zero games" — that
would crush the majority of the database to replacement level. When starts are
unknown it infers a *dampened, capped* start ratio from availability
(`availability * 0.55`), landing an everyday player in the backup/rotation band, and
marks the rating lower-confidence (see below).

### Confidence tiers

Generated ratings carry an explicit confidence tier based on how much real evidence
backed them (box-score stats and awards are strong signals; a scouting prior or
*recorded* starts are moderate):

| Status | Meaning |
| --- | --- |
| `generated_high_confidence` | strong evidence (stats/awards, or two moderate signals) |
| `generated_medium_confidence` | one solid signal |
| `generated_low_confidence` | role inferred from availability alone (data-sparse majority) |
| `needs_review` | no usable data — sensible fallback for the position group |
| `missing_data` | unknown position — generic fallback |

The numeric `rating_confidence` complements the tier and is penalized when the role
rests on inferred (not recorded) starts.

See [Rating engine overview](#rating-engine-overview) for the math and tuning
tables. The console prints a status breakdown, e.g.:

```
by status: generated_high_confidence=8135  generated_medium_confidence=5269  generated_low_confidence=82762  needs_review=1
```

(`manually_reviewed` / `manual_override` stay at 0 here — those are applied in the
next stage.)

---

## 5. How to manually override player ratings

Hand-tune `data/rating_overrides.csv`, then re-apply:

```bash
npm run data:overrides  # or: node scripts/apply-overrides.mjs
```

This overlays your corrections onto `processed/ratings.csv` (rewriting it in
place). Columns (`OVERRIDE_COLUMNS`):

```
player_id, name, season, team_code, position,
status, review_status, reviewed_by, last_updated, rating_confidence, reason,
overall, speed, strength, awareness, pass_rating, run_rating, receiving,
blocking, pass_block, run_block, pass_rush, run_defense, tackling,
coverage, man_coverage, zone_coverage, hands, kicking, punting,
clutch, playoff_clutch, durability
```

`name` and `position` are for human readability only (not used for matching).
`reviewed_by` and `last_updated` record provenance and are appended to the note.

Rules:

- **Match key:** `player_id` is required. `season` and `team_code` are optional:
  - leave **both blank** to apply to *every* season/team of that player (great for
    a franchise legend), or
  - set them to target **one** specific player-season.
- **Selective fields:** only the rating columns you fill in are replaced; blank
  cells leave the generated value untouched. You can override just `speed`, or the
  whole block.
- **Review workflow:** set `review_status` to `rejected`, `draft`, or `wip` to park
  an entry in the file **without** it taking effect. Anything else (e.g. `approved`,
  blank) applies — overrides always take priority over generated ratings.
- **Status resolution:**
  - an explicit `status` column wins (must be a valid status), else
  - an override that sets **≥1** rating value becomes `manual_override`
    (confidence defaults to `0.95`), and
  - an override that sets **no** rating values becomes `manually_reviewed`
    (confidence `0.85`) — i.e. a reviewer signing off on the generated numbers.
- `rating_source` becomes `manual`; `reason` (+ provenance) is stored as the note.
- Unmatched / skipped overrides are counted and logged, but never fail the build.

Example — bump a legend across all his seasons, and sign off on another player's
generated line:

```csv
player_id,season,team_code,status,rating_confidence,reason,overall,...,playoff_clutch,durability
jerry-rice,,,,,Greatest WR ever,99,...,99,95
bob-griese,1972,MIA,manually_reviewed,,Generated line looks right,,...,,
```

Because overrides live in their own file, they survive re-imports and
re-generation — you only lose them if you delete the file.

---

## 6. How to export the final game-ready JSON files

```bash
npm run data:export     # or: node scripts/export-team-seasons.mjs
```

Joins `team_seasons.csv` + `processed/player_seasons.csv` + `processed/ratings.csv`
and writes, **one file per team-season**:

- **`data/game/team-seasons/<SEASON>_<TEAM>.json`** — the optimized game doc:
  `schemaVersion`, ids, `record`, `metadata` (engine version, status counts,
  needs-review count, team strength), `positions` (position → player ids),
  `players[]` (each with camelCased `attributes`, the full snake_cased `rating`
  block, `stats`, `status`, `ratingSource`, `ratingConfidence`, `archetype`,
  `era`), a `ratings` map, the `roster` id list, and a `draftPool`
  (`available` + `byPosition`).
- **`data/game/team-seasons/index.json`** — a lightweight catalog of every
  team-season (id, label, record, counts) for menus.
- **`lib/generated/team-seasons.generated.ts`** — a barrel that statically
  imports every JSON file and re-exports them as `TEAM_SEASONS`. This is what lets
  the client bundle the data with no `fs`/`fetch`.

The app consumes the barrel through `lib/data.ts`, which maps each `GamePlayer`
onto the runtime `Player`/`TeamSeason` shapes (see `lib/data-schema.ts`). The
public `getAllPlayers()` / `getTeamSeasons()` signatures are unchanged, so the
rest of the game is untouched. After exporting, restart `next dev` (or rebuild) to
pick up the regenerated barrel.

---

## 7. How the game handles missing data

The pipeline is designed so incomplete data degrades gracefully — it never blocks
the build, and the game stays fully playable.

| Situation                                                        | Status              | Source     | What happens                                                                 |
| ---------------------------------------------------------------- | ------------------- | ---------- | --------------------------------------------------------------------------- |
| Healthy generated rating (has role/stats/awards/scout)           | `generated`         | `generated`| Normal engine output.                                                       |
| Known position, but **no** role, stats, awards, or scout grade   | `needs_review`      | `fallback` | Gets a position fallback overall (e.g. QB 66) so it's still draftable.       |
| **Unrecognized** position (typo / not in the 16)                 | `missing_data`      | `fallback` | Gets the generic fallback overall (62); flagged for a position fix.          |
| A reviewer signed off on the generated numbers                   | `manually_reviewed` | `manual`   | Numbers kept; confidence raised; provenance recorded.                       |
| A reviewer hand-set one or more numbers                          | `manual_override`   | `manual`   | Your values win over the generated ones.                                    |

Other safety nets:

- **Fallback overalls** per position group (`FALLBACK_OVERALL` in `schema.mjs`)
  plus a `GENERIC_FALLBACK_OVERALL` (62) guarantee every player has a usable
  number.
- **Global clamps:** every produced value is clamped to `[20, 99]`, and any
  *generated* player is floored at `40` (`OVERALL_FLOOR`) — a rostered NFL player
  is never below that.
- **Lowered confidence:** `needs_review` is capped at `0.4` and `missing_data` at
  `0.3`, so the UI can visually flag uncertain ratings.
- **Runtime guard:** `lib/data.ts` maps a null `overall` to `60` and drops any
  null-valued attribute, so even a half-rated player renders and is draftable.
- **Counts surfaced:** each team-season's `metadata.statusCounts` and
  `metadata.needsReview` make it easy to spot which rosters still need attention.

To find everything that needs attention after a build:

```bash
grep -E ',(needs_review|missing_data),' data/processed/ratings.csv
```

Fix it by adding the missing role/stats/awards to the raw files (preferred) or by
adding a row to `rating_overrides.csv`, then re-run `npm run data:build`.

---

## Reference

### The five rating statuses

| status              | meaning                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `generated`         | Produced by the engine from real signals.                               |
| `manually_reviewed` | A human confirmed the generated numbers (no values changed).            |
| `manual_override`   | A human set one or more numbers by hand (those values win).             |
| `missing_data`      | Could not be rated normally (e.g. unknown position); fallback applied.  |
| `needs_review`      | Known position but too little data; fallback applied, flagged to fill.  |

### The 22 rating fields

`overall` + 21 attributes (`ATTRIBUTE_FIELDS`):

```
speed strength awareness
pass_rating run_rating receiving
blocking pass_block run_block
pass_rush run_defense tackling
coverage man_coverage zone_coverage
hands kicking punting
clutch playoff_clutch durability
```

In the exported JSON these are camelCased on `player.attributes`
(`passRating`, `manCoverage`, …); `playoff_clutch` is also hoisted to
`player.playoffClutch`. The full snake_cased block is preserved on `player.rating`.

### CSV column reference

All column layouts are centralized in `scripts/lib/schema.mjs` so every script
agrees on file shapes. Authoritative sets: `TEAMS_COLUMNS`, `TEAM_SEASON_COLUMNS`,
`ROSTER_COLUMNS`, `STAT_COLUMNS`, `PLAYER_SEASON_COLUMNS`, `PLAYERS_COLUMNS`,
`RATINGS_COLUMNS`, `OVERRIDE_COLUMNS`, `RATING_FIELDS`. The CSV reader keys rows by
**header name**, so column order in a file doesn't matter and overlay files may
contain any subset of columns. Lines starting with `#` and blank lines are
ignored.

### Rating engine overview

`scripts/lib/ratings-engine.mjs` turns the signals we have into an `overall` and
21 attributes. It is deterministic: identical inputs always produce identical
numbers (attribute "jitter" is a hash of a stable per-player seed, not RNG).

**Inputs → raw composite (`computeContext`):**

- **Role prior** — from `games` / `games_started`. A full starter lands ~76, a
  deep reserve ~54. No role data ⇒ the position's `FALLBACK_OVERALL`. When
  `games_started` is **unknown** (the common case historically), the start ratio is
  inferred from availability and capped (`* 0.55`) rather than assumed zero, and the
  result is flagged lower-confidence.
- **Awards bonus** — keyword-matched against `AWARD_TIERS` (e.g. MVP `+18`,
  First-Team All-Pro `+12`, Pro Bowl `+5`), capped at `+26` combined. Winners also
  get a small "lift" to their key attributes.
- **Stat production** — each position has a `STAT_MODEL` mapping stats to an
  "elite" reference; production scores as a fraction of elite and both raises
  `overall` and nudges the relevant attributes. Stats are optional — absent stats
  contribute nothing.
- **Team-strength nudge** — `±~1.8` over a 30-point swing around the league-ish
  baseline of 70.
- **Scout-grade blend** — an optional 0–99 prior, weighted more heavily when
  stats/awards are thin (up to 60%), less when there's other evidence (25%).

**Finalize (`finalize`):**

- **Era percentile** — players are ranked within their **season × position-group**
  cohort (1972 RBs vs other 1972 RBs), so era adjustment is by-position and older
  players are judged on dominance within their own era. A gentle percentile curve
  (p=0→60, p=1→98) is blended `0.18` against `0.82` of the absolute composite, so a
  great player in a weak year still reads as great without flattening everyone.
  Small cohorts are shrunk toward the median to avoid noise.
- **Attribute projection** — each attribute is tiered per position
  (`key` / `support` / `minor` / `irrelevant` in `POSITION_PROFILE`) and projected
  from `overall` via `TIER` slopes, plus stat nudges, the award lift on key
  attributes, a durability tweak from availability, and a playoff-clutch tweak
  from award pedigree.
- **Status & confidence** — a generated rating is tiered
  `generated_high/medium/low_confidence` from its evidence (stats, awards, scout
  prior, recorded starts); thin fallbacks are `needs_review` / `missing_data`.
  Numeric confidence rises with stats, awards, role, and scout grade, is penalized
  when starts are inferred rather than recorded, and is capped for the fallback
  statuses.

To re-tune the model, edit the tables in `schema.mjs` (`POSITION_PROFILE`, `TIER`,
`AWARD_TIERS`, `STAT_MODEL`, `FALLBACK_OVERALL`) — the logic in
`ratings-engine.mjs` reads them as data. Bump `ENGINE_VERSION` when you do; it's
recorded in each team-season's `metadata`.

---

## Quick start checklist

```bash
# 1. (optional) seed raw rosters from the legacy demo file, once
npm run data:migrate

# 2. add/edit data:
#    - data/team_seasons.csv         (register the team-season)
#    - data/raw/rosters/<SY>_<TM>.csv (the roster — required)
#    - data/raw/stats/<SY>_<TM>.csv   (optional)
#    - data/raw/awards/<SY>_<TM>.csv  (optional)
#    - data/rating_overrides.csv      (optional hand corrections)

# 3. build everything
npm run data:build

# 4. check what still needs data
grep -E ',(needs_review|missing_data),' data/processed/ratings.csv

# 5. run the game
npm run dev
```
