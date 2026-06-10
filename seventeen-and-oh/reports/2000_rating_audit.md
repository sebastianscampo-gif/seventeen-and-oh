# 2000 Rating Audit — Before State

Generated from `reports/_work/2000_before.csv` (1860 player-rows, 31 teams) against the corrected 2000 registry.

## Summary

- **25 of 31 teams** trip at least one distribution red-flag.
- **1 players** carry a rating that contradicts their own 2000 box score (or are full-time starters stuck in the 67-71 band).
- The dominant failure mode is **rating compression**: position groups with no recorded starts/stats (all of defense, the OL, and specialists — defensive box scores and awards are empty for 2000) collapse onto a neutral ~68 base, so genuine starters and a few stars are indistinguishable from deep backups.
- A secondary failure mode is **flat depth**: the engine's per-player depth dispersal is currently scoped to 1999 only, so 2000's statless depth stacks onto a single team-scaled number. The overhaul extends the dispersal set to 2000.
- Only **4 curated overrides** exist for 2000 today (all Baltimore: Ray Lewis, Jonathan Ogden, Rod Woodson, Shannon Sharpe), so every other rating is engine-generated.

## Position normalization status

Already normalized in the source: `DE→EDGE`, interior `DL→DT`, `DB→CB`/`S`. Box scores don't distinguish L/R OL, and OL is rated as a unit, so collapsed tackle/guard labels are cosmetic — noted, not blocking.

## Teams flagged (worst first)

| Team | Players | Avg | Min | Max | %67–71 | %same | Issue |
|------|--------:|----:|----:|----:|-------:|------:|-------|
| ARI Arizona Cardinals | 64 | 70.6 | 51 | 89 | 51.6% | 48.4% | 52% in 67-71 generic band; 48% share OVR 71 |
| ATL Atlanta Falcons | 63 | 71.4 | 50 | 85 | 38.1% | 30.2% | 38% in 67-71 generic band; 30% share OVR 71 |
| BUF Buffalo Bills | 55 | 72.2 | 52 | 91 | 7.3% | 47.3% | 47% share OVR 72 |
| CAR Carolina Panthers | 67 | 71.6 | 51 | 98 | 14.9% | 47.8% | 48% share OVR 72 |
| CHI Chicago Bears | 68 | 70.1 | 49 | 84 | 10.3% | 32.4% | 32% share OVR 72 |
| CIN Cincinnati Bengals | 61 | 71.0 | 51 | 87 | 14.8% | 45.9% | 46% share OVR 72 |
| CLE Cleveland Browns | 68 | 70.5 | 51 | 84 | 4.4% | 35.3% | 35% share OVR 72 |
| DAL Dallas Cowboys | 66 | 71.3 | 50 | 96 | 10.6% | 36.4% | 36% share OVR 72 |
| DET Detroit Lions | 59 | 72.2 | 53 | 88 | 10.2% | 42.4% | 42% share OVR 73 |
| GB Green Bay Packers | 61 | 72.9 | 51 | 91 | 6.6% | 39.3% | 39% share OVR 73 |
| IND Indianapolis Colts | 59 | 73.6 | 57 | 97 | 8.5% | 37.3% | 37% share OVR 73 |
| JAX Jacksonville Jaguars | 65 | 72.3 | 50 | 92 | 13.8% | 33.8% | 34% share OVR 73 |
| LAC San Diego Chargers | 59 | 72.5 | 50 | 95 | 5.1% | 33.9% | 34% share OVR 74 |
| LAR St. Louis Rams | 58 | 73.5 | 50 | 96 | 10.3% | 25.9% | 26% share OVR 75 |
| LV Oakland Raiders | 55 | 73.6 | 50 | 92 | 7.3% | 36.4% | 36% share OVR 74 |
| MIA Miami Dolphins | 65 | 72.4 | 51 | 93 | 13.8% | 36.9% | 37% share OVR 74 |
| MIN Minnesota Vikings | 58 | 73.5 | 51 | 97 | 5.2% | 46.6% | 47% share OVR 74 |
| NE New England Patriots | 65 | 72.0 | 49 | 88 | 4.6% | 40.0% | 40% share OVR 74 |
| NO New Orleans Saints | 61 | 71.9 | 50 | 93 | 9.8% | 26.2% | 26% share OVR 75 |
| PHI Philadelphia Eagles | 57 | 73.2 | 56 | 90 | 14.0% | 29.8% | 30% share OVR 75 |
| PIT Pittsburgh Steelers | 62 | 72.0 | 51 | 86 | 12.9% | 40.3% | 40% share OVR 75 |
| SEA Seattle Seahawks | 58 | 73.4 | 52 | 89 | 5.2% | 55.2% | 55% share OVR 75 |
| SF San Francisco 49ers | 60 | 73.7 | 50 | 96 | 3.3% | 45.0% | 45% share OVR 75 |
| TEN Tennessee Titans | 63 | 73.6 | 55 | 93 | 12.7% | 31.7% | 32% share OVR 75 |
| WAS Washington Redskins | 63 | 74.1 | 54 | 98 | 12.7% | 25.4% | 25% share OVR 76 |

## Teams clean on distribution flags

`BAL` (Baltimore Ravens, max 99), `DEN` (Denver Broncos, max 95), `KC` (Kansas City Chiefs, max 96), `NYG` (New York Giants, max 90), `NYJ` (New York Jets, max 91), `TB` (Tampa Bay Buccaneers, max 88)


## Most undervalued players (top 25 by gap)

| Player | Team | Pos | OVR | Issue |
|--------|------|-----|----:|-------|
| Vinny Testaverde | NYJ | QB | 81 | production-implied floor 84, rated 81 (-3) |

## Recommended action

Author a curated 2000 override set (stars + clear starters, ~18–24 per team) resolved to the real GSIS player_ids by name match, with heavy coverage of defense / OL / specialists (which the engine cannot grade from empty box scores); let true depth fall to the engine. Extend the engine's depth dispersal to include 2000 so statless backups don't stack on one number. Then regenerate, apply overrides, and re-export. The 24-man Baltimore roster is a curated showcase — keep as a thin curated roster.

