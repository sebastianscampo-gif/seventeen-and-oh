# 2002 Rating Audit — Before State

Generated from `reports/_work/2002_before.csv` (1508 player-rows, 32 teams) against the corrected 2002 registry.

## Summary

- **3 of 32 teams** trip at least one distribution red-flag.
- **0 players** carry a rating that contradicts their own 2002 box score (or are full-time starters stuck in the 67-71 band).
- The dominant failure mode is **rating compression**: position groups with no recorded starts/stats (all of defense, the OL, and specialists — defensive box scores and awards are empty for 2002) collapse onto a neutral ~68 base, so genuine starters and a few stars are indistinguishable from deep backups.
- A secondary failure mode is **flat depth**: the engine's per-player depth dispersal is currently scoped to 1999/2000 only, so 2002's statless depth stacks onto a single team-scaled number. The overhaul extends the dispersal set to 2002.
- **No curated overrides** exist for 2002 today, so every rating is engine-generated.

## Position normalization status

Already normalized in the source: `DE→EDGE`, interior `DL→DT`, `DB→CB`/`S`. Box scores don't distinguish L/R OL, and OL is rated as a unit, so collapsed tackle/guard labels are cosmetic — noted, not blocking.

## Teams flagged (worst first)

| Team | Players | Avg | Min | Max | %67–71 | %same | Issue |
|------|--------:|----:|----:|----:|-------:|------:|-------|
| DEN Denver Broncos | 47 | 72.8 | 54 | 93 | 31.9% | 12.8% | 32% in 67-71 generic band |
| DET Detroit Lions | 51 | 71.3 | 51 | 84 | 31.4% | 13.7% | 31% in 67-71 generic band |
| TB Tampa Bay Buccaneers | 51 | 72.4 | 50 | 89 | 17.6% | 9.8% | SB-class team but max only 89 |

## Teams clean on distribution flags

`ARI` (Arizona Cardinals, max 83), `ATL` (Atlanta Falcons, max 86), `BAL` (Baltimore Ravens, max 96), `BUF` (Buffalo Bills, max 95), `CAR` (Carolina Panthers, max 83), `CHI` (Chicago Bears, max 92), `CIN` (Cincinnati Bengals, max 88), `CLE` (Cleveland Browns, max 87), `DAL` (Dallas Cowboys, max 96), `GB` (Green Bay Packers, max 91), `HOU` (Houston Texans, max 87), `IND` (Indianapolis Colts, max 99), `JAX` (Jacksonville Jaguars, max 90), `KC` (Kansas City Chiefs, max 97), `LAC` (San Diego Chargers, max 96), `LAR` (St. Louis Rams, max 91), `LV` (Oakland Raiders, max 96), `MIA` (Miami Dolphins, max 96), `MIN` (Minnesota Vikings, max 94), `NE` (New England Patriots, max 90), `NO` (New Orleans Saints, max 93), `NYG` (New York Giants, max 93), `NYJ` (New York Jets, max 92), `PHI` (Philadelphia Eagles, max 86), `PIT` (Pittsburgh Steelers, max 97), `SEA` (Seattle Seahawks, max 93), `SF` (San Francisco 49ers, max 96), `TEN` (Tennessee Titans, max 90), `WAS` (Washington Redskins, max 97)


## Most undervalued players (top 25 by gap)

| Player | Team | Pos | OVR | Issue |
|--------|------|-----|----:|-------|

## Recommended action

Author a curated 2002 override set (stars + clear starters, ~18–24 per team) resolved to the real GSIS player_ids by name match, with heavy coverage of defense / OL / specialists (which the engine cannot grade from empty box scores); let true depth fall to the engine. Extend the engine's depth dispersal to include 2002 so statless backups don't stack on one number. Then regenerate, apply overrides, and re-export.

