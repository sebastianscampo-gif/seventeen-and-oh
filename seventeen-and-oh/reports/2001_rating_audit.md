# 2001 Rating Audit — Before State

Generated from `reports/_work/2001_before.csv` (1877 player-rows, 31 teams) against the corrected 2001 registry.

## Summary

- **25 of 31 teams** trip at least one distribution red-flag.
- **4 players** carry a rating that contradicts their own 2001 box score (or are full-time starters stuck in the 67-71 band).
- The dominant failure mode is **rating compression**: position groups with no recorded starts/stats (all of defense, the OL, and specialists — defensive box scores and awards are empty for 2001) collapse onto a neutral ~68 base, so genuine starters and a few stars are indistinguishable from deep backups.
- A secondary failure mode is **flat depth**: the engine's per-player depth dispersal is currently scoped to 1999/2000 only, so 2001's statless depth stacks onto a single team-scaled number. The overhaul extends the dispersal set to 2001.
- **No curated overrides** exist for 2001 today, so every rating is engine-generated.

## Position normalization status

Already normalized in the source: `DE→EDGE`, interior `DL→DT`, `DB→CB`/`S`. Box scores don't distinguish L/R OL, and OL is rated as a unit, so collapsed tackle/guard labels are cosmetic — noted, not blocking.

## Teams flagged (worst first)

| Team | Players | Avg | Min | Max | %67–71 | %same | Issue |
|------|--------:|----:|----:|----:|-------:|------:|-------|
| ARI Arizona Cardinals | 63 | 71.9 | 51 | 95 | 47.6% | 36.5% | 48% in 67-71 generic band; 37% share OVR 71 |
| BAL Baltimore Ravens | 60 | 72.7 | 55 | 96 | 36.7% | 28.3% | 37% in 67-71 generic band; 28% share OVR 71 |
| ATL Atlanta Falcons | 58 | 71.4 | 50 | 83 | 31.0% | 24.1% | 31% in 67-71 generic band |
| BUF Buffalo Bills | 58 | 72.1 | 52 | 87 | 34.5% | 24.1% | 34% in 67-71 generic band |
| CAR Carolina Panthers | 62 | 71.1 | 51 | 86 | 22.6% | 30.6% | 31% share OVR 72 |
| CIN Cincinnati Bengals | 61 | 71.1 | 52 | 90 | 11.5% | 34.4% | 34% share OVR 72 |
| CLE Cleveland Browns | 70 | 71.0 | 54 | 92 | 11.4% | 27.1% | 27% share OVR 72 |
| DAL Dallas Cowboys | 65 | 71.3 | 50 | 96 | 6.2% | 32.3% | 32% share OVR 73 |
| DEN Denver Broncos | 61 | 71.7 | 52 | 96 | 13.1% | 26.2% | 26% share OVR 73 |
| DET Detroit Lions | 62 | 70.8 | 50 | 88 | 8.1% | 32.3% | 32% share OVR 73 |
| GB Green Bay Packers | 62 | 72.5 | 50 | 94 | 8.1% | 27.4% | 27% share OVR 73 |
| KC Kansas City Chiefs | 61 | 72.8 | 50 | 93 | 6.6% | 29.5% | 30% share OVR 74 |
| LAC San Diego Chargers | 58 | 73.3 | 51 | 95 | 5.2% | 39.7% | 40% share OVR 74 |
| LAR St. Louis Rams | 56 | 74.9 | 53 | 97 | 7.1% | 32.1% | 32% share OVR 75 |
| LV Oakland Raiders | 60 | 73.7 | 52 | 93 | 10.0% | 26.7% | 27% share OVR 74 |
| MIN Minnesota Vikings | 63 | 73.0 | 55 | 93 | 11.1% | 34.9% | 35% share OVR 74 |
| NO New Orleans Saints | 60 | 73.0 | 50 | 93 | 10.0% | 33.3% | 33% share OVR 74 |
| NYG New York Giants | 59 | 73.4 | 52 | 88 | 5.1% | 42.4% | 42% share OVR 75 |
| NYJ New York Jets | 55 | 73.2 | 52 | 92 | 14.5% | 30.9% | 31% share OVR 75 |
| PHI Philadelphia Eagles | 58 | 72.6 | 50 | 89 | 5.2% | 44.8% | 45% share OVR 75 |
| PIT Pittsburgh Steelers | 56 | 73.3 | 51 | 89 | 7.1% | 46.4% | 46% share OVR 75 |
| SF San Francisco 49ers | 61 | 74.7 | 51 | 98 | 4.9% | 37.7% | 38% share OVR 75 |
| TB Tampa Bay Buccaneers | 57 | 73.0 | 51 | 90 | 10.5% | 28.1% | 28% share OVR 76 |
| TEN Tennessee Titans | 59 | 73.0 | 53 | 91 | 6.8% | 27.1% | 27% share OVR 76 |
| WAS Washington Redskins | 59 | 74.2 | 53 | 97 | 11.9% | 42.4% | 42% share OVR 76 |

## Teams clean on distribution flags

`CHI` (Chicago Bears, max 93), `IND` (Indianapolis Colts, max 99), `JAX` (Jacksonville Jaguars, max 95), `MIA` (Miami Dolphins, max 93), `NE` (New England Patriots, max 92), `SEA` (Seattle Seahawks, max 93)


## Most undervalued players (top 25 by gap)

| Player | Team | Pos | OVR | Issue |
|--------|------|-----|----:|-------|
| Jerome Bettis | PIT | RB | 76 | production-implied floor 83, rated 76 (-7) |
| Terrell Davis | DEN | RB | 74 | production-implied floor 78, rated 74 (-4) |
| Charlie Batch | DET | QB | 72 | production-implied floor 76, rated 72 (-4) |
| Trent Green | KC | QB | 80 | production-implied floor 84, rated 80 (-4) |

## Recommended action

Author a curated 2001 override set (stars + clear starters, ~18–24 per team) resolved to the real GSIS player_ids by name match, with heavy coverage of defense / OL / specialists (which the engine cannot grade from empty box scores); let true depth fall to the engine. Extend the engine's depth dispersal to include 2001 so statless backups don't stack on one number. Then regenerate, apply overrides, and re-export.

