# 2003 Rating Audit — Before State

Generated from `reports/_work/2003_before.csv` (1519 player-rows, 32 teams) against the corrected 2003 registry.

## Summary

- **7 of 32 teams** trip at least one distribution red-flag.
- **0 players** carry a rating that contradicts their own 2003 box score (or are full-time starters stuck in the 67-71 band).
- The dominant failure mode is **rating compression**: position groups with no recorded starts/stats (all of defense, the OL, and specialists — defensive box scores and awards are empty for 2003) collapse onto a neutral ~68 base, so genuine starters and a few stars are indistinguishable from deep backups.
- A secondary failure mode is **flat depth**: the engine's per-player depth dispersal is currently scoped to 1999-2002 only, so 2003's statless depth stacks onto a single team-scaled number. The overhaul extends the dispersal set to 2003.
- Before this pass the 2003 registry carried a flat team_strength of 70 for all 32 teams (now corrected) and **no curated overrides** exist for 2003, so every rating is engine-generated.

## Teams flagged (worst first)

| Team | Players | Avg | Min | Max | %67–71 | %same | Issue |
|------|--------:|----:|----:|----:|-------:|------:|-------|
| ARI Arizona Cardinals | 48 | 71.6 | 51 | 95 | 37.5% | 14.6% | 38% in 67-71 generic band |
| BAL Baltimore Ravens | 43 | 73.1 | 53 | 96 | 32.6% | 11.6% | 33% in 67-71 generic band |
| BUF Buffalo Bills | 45 | 71.6 | 50 | 89 | 31.1% | 11.1% | 31% in 67-71 generic band |
| CAR Carolina Panthers | 44 | 72.5 | 53 | 91 | 34.1% | 11.4% | 34% in 67-71 generic band |
| CHI Chicago Bears | 49 | 71.0 | 51 | 84 | 34.7% | 16.3% | 35% in 67-71 generic band |
| NE New England Patriots | 46 | 71.7 | 51 | 88 | 13.0% | 10.9% | SB-class team but max only 88 |
| PHI Philadelphia Eagles | 48 | 73.3 | 51 | 84 | 20.8% | 10.4% | playoff team but max only 84 |

## Teams clean on distribution flags

`ATL` (Atlanta Falcons, max 87), `CIN` (Cincinnati Bengals, max 95), `CLE` (Cleveland Browns, max 83), `DAL` (Dallas Cowboys, max 96), `DEN` (Denver Broncos, max 92), `DET` (Detroit Lions, max 82), `GB` (Green Bay Packers, max 96), `HOU` (Houston Texans, max 87), `IND` (Indianapolis Colts, max 95), `JAX` (Jacksonville Jaguars, max 90), `KC` (Kansas City Chiefs, max 97), `LAC` (San Diego Chargers, max 96), `LAR` (St. Louis Rams, max 99), `LV` (Oakland Raiders, max 85), `MIA` (Miami Dolphins, max 93), `MIN` (Minnesota Vikings, max 99), `NO` (New Orleans Saints, max 92), `NYG` (New York Giants, max 88), `NYJ` (New York Jets, max 92), `PIT` (Pittsburgh Steelers, max 94), `SEA` (Seattle Seahawks, max 93), `SF` (San Francisco 49ers, max 92), `TB` (Tampa Bay Buccaneers, max 92), `TEN` (Tennessee Titans, max 94), `WAS` (Washington Redskins, max 97)


## Most undervalued players (top 25 by gap)

| Player | Team | Pos | OVR | Issue |
|--------|------|-----|----:|-------|

## Recommended action

Author a curated 2003 override set (stars + clear starters, ~18–26 per team) resolved to the real GSIS player_ids by name match, with heavy coverage of defense / OL / specialists (which the engine cannot grade from empty box scores); let true depth fall to the engine. Append 2003-specific aging-legend caps so season-agnostic legend rows don't leak peak value (Rice, Bruce Smith, Larry Allen, Ogden, Seau, Woodson, Randle, J.Taylor, Z.Thomas). Extend the engine's depth dispersal to include 2003 so statless backups don't stack on one number. Then regenerate, apply overrides, and re-export.

