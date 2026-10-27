# 2004 Rating Audit — Before State

Generated from `reports/_work/2004_before.csv` (1532 player-rows, 32 teams) against the corrected 2004 registry.

## Summary

- **5 of 32 teams** trip at least one distribution red-flag.
- **6 players** carry a rating that contradicts their own 2004 box score (or are full-time starters stuck in the 67-71 band).
- The dominant failure mode is **rating compression**: position groups with no recorded starts/stats (all of defense, the OL, and specialists — defensive box scores and awards are empty for 2004) collapse onto a neutral ~68 base, so genuine starters and a few stars are indistinguishable from deep backups.
- A secondary failure mode is **flat depth**: the engine's per-player depth dispersal is currently scoped to 1999-2003 only, so 2004's statless depth stacks onto a single team-scaled number. The overhaul extends the dispersal set to 2004.
- Before this pass the 2004 registry carried a flat team_strength of 70 for all 32 teams (now corrected) and **no curated overrides** exist for 2004, so every rating is engine-generated.

## Teams flagged (worst first)

| Team | Players | Avg | Min | Max | %67–71 | %same | Issue |
|------|--------:|----:|----:|----:|-------:|------:|-------|
| ARI Arizona Cardinals | 46 | 72.4 | 50 | 86 | 30.4% | 10.9% | 30% in 67-71 generic band |
| DAL Dallas Cowboys | 50 | 72.2 | 51 | 96 | 34.0% | 14.0% | 34% in 67-71 generic band |
| DET Detroit Lions | 48 | 71.8 | 53 | 85 | 31.3% | 10.4% | 31% in 67-71 generic band |
| IND Indianapolis Colts | 45 | 74.5 | 54 | 99 | 31.1% | 20.0% | 31% in 67-71 generic band |
| PIT Pittsburgh Steelers | 44 | 72.1 | 50 | 87 | 6.8% | 11.4% | SB-class team but max only 87 |

## Teams clean on distribution flags

`ATL` (Atlanta Falcons, max 88), `BAL` (Baltimore Ravens, max 98), `BUF` (Buffalo Bills, max 89), `CAR` (Carolina Panthers, max 98), `CHI` (Chicago Bears, max 87), `CIN` (Cincinnati Bengals, max 94), `CLE` (Cleveland Browns, max 84), `DEN` (Denver Broncos, max 90), `GB` (Green Bay Packers, max 96), `HOU` (Houston Texans, max 92), `JAX` (Jacksonville Jaguars, max 89), `KC` (Kansas City Chiefs, max 96), `LAC` (San Diego Chargers, max 96), `LAR` (St. Louis Rams, max 95), `LV` (Oakland Raiders, max 89), `MIA` (Miami Dolphins, max 93), `MIN` (Minnesota Vikings, max 99), `NE` (New England Patriots, max 91), `NO` (New Orleans Saints, max 96), `NYG` (New York Giants, max 93), `NYJ` (New York Jets, max 93), `PHI` (Philadelphia Eagles, max 96), `SEA` (Seattle Seahawks, max 94), `SF` (San Francisco 49ers, max 90), `TB` (Tampa Bay Buccaneers, max 91), `TEN` (Tennessee Titans, max 93), `WAS` (Washington Redskins, max 87)


## Most undervalued players (top 25 by gap)

| Player | Team | Pos | OVR | Issue |
|--------|------|-----|----:|-------|
| Randy Moss | MIN | WR | 82 | production-implied floor 90, rated 82 (-8) |
| Duce Staley | PIT | RB | 73 | production-implied floor 78, rated 73 (-5) |
| Lee Suggs | CLE | RB | 74 | production-implied floor 78, rated 74 (-4) |
| Chris Brown | TEN | RB | 79 | production-implied floor 83, rated 79 (-4) |
| Vinny Testaverde | DAL | QB | 81 | production-implied floor 84, rated 81 (-3) |
| Fred Taylor | JAX | RB | 83 | production-implied floor 86, rated 83 (-3) |

## Recommended action

Author a curated 2004 override set (stars + clear starters, ~18–26 per team) resolved to the real GSIS player_ids by name match, with heavy coverage of defense / OL / specialists (which the engine cannot grade from empty box scores); let true depth fall to the engine. Append 2004-specific aging-legend caps so season-agnostic legend rows don't leak peak value. Extend the engine's depth dispersal to include 2004 so statless backups don't stack on one number. Then regenerate, apply overrides, and re-export.

