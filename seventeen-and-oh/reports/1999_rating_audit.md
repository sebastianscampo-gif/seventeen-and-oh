# 1999 Rating Audit — Before State

Generated from `reports/_work/1999_before.csv` (1846 player-rows, 31 teams) against the corrected 1999 registry.

## Summary

- **18 of 31 teams** trip at least one distribution red-flag.
- **4 players** carry a rating that contradicts their own 1999 box score (or are full-time starters stuck in the 67-71 band).
- The dominant failure mode is **rating compression**: position groups with no recorded starts/stats collapse onto a neutral ~68 base, so genuine starters and a few stars are indistinguishable from deep backups.
- **Zero curated overrides** exist for 1999 today, so every rating except the 23-man St. Louis demo roster is engine-generated.

## Position normalization status

Already normalized in the source: `DE→EDGE`, interior `DL→DT`, `DB→CB`/`S`. **Not** split: offensive tackles/guards are collapsed to `LT`/`LG` (only 1 `RT` and 1 `RG` league-wide). Box scores don't distinguish L/R OL, and OL is rated as a unit, so this is cosmetic — noted, not blocking.

## Teams flagged (worst first)

| Team | Players | Avg | Min | Max | %67–71 | %same | Issue |
|------|--------:|----:|----:|----:|-------:|------:|-------|
| ARI Arizona Cardinals | 60 | 71.4 | 51 | 85 | 50.0% | 40.0% | 50% in 67-71 generic band; 40% share OVR 71 |
| TB Tampa Bay Buccaneers | 58 | 73.1 | 52 | 86 | 6.9% | 27.6% | 28% share OVR 75; SB-class team but max only 86 |
| ATL Atlanta Falcons | 58 | 70.4 | 51 | 89 | 29.3% | 31.0% | 31% share OVR 72 |
| BAL Baltimore Ravens | 60 | 71.5 | 51 | 96 | 16.7% | 30.0% | 30% share OVR 72 |
| CIN Cincinnati Bengals | 63 | 70.8 | 52 | 87 | 9.5% | 31.7% | 32% share OVR 72 |
| CLE Cleveland Browns | 61 | 72.2 | 59 | 89 | 14.8% | 27.9% | 28% share OVR 72 |
| DAL Dallas Cowboys | 66 | 72.0 | 50 | 98 | 6.1% | 28.8% | 29% share OVR 73 |
| GB Green Bay Packers | 61 | 71.8 | 50 | 90 | 4.9% | 26.2% | 26% share OVR 73 |
| IND Indianapolis Colts | 59 | 72.7 | 51 | 98 | 11.9% | 27.1% | 27% share OVR 73 |
| LV Oakland Raiders | 58 | 73.1 | 51 | 92 | 8.6% | 31.0% | 31% share OVR 74 |
| MIA Miami Dolphins | 62 | 72.2 | 52 | 93 | 6.5% | 32.3% | 32% share OVR 74 |
| NE New England Patriots | 62 | 72.7 | 51 | 86 | 12.9% | 25.8% | 26% share OVR 74 |
| NYJ New York Jets | 61 | 72.8 | 50 | 92 | 4.9% | 45.9% | 46% share OVR 75 |
| PHI Philadelphia Eagles | 61 | 72.0 | 51 | 87 | 9.8% | 36.1% | 36% share OVR 75 |
| SEA Seattle Seahawks | 59 | 73.3 | 50 | 89 | 10.2% | 32.2% | 32% share OVR 75 |
| SF San Francisco 49ers | 63 | 72.8 | 52 | 88 | 6.3% | 36.5% | 37% share OVR 75 |
| TEN Tennessee Titans | 58 | 74.4 | 55 | 90 | 6.9% | 37.9% | 38% share OVR 76 |
| WAS Washington Redskins | 59 | 75.4 | 56 | 93 | 3.4% | 52.5% | 53% share OVR 76 |

## Teams clean on distribution flags

`BUF` (Buffalo Bills, max 97), `CAR` (Carolina Panthers, max 96), `CHI` (Chicago Bears, max 94), `DEN` (Denver Broncos, max 88), `DET` (Detroit Lions, max 92), `JAX` (Jacksonville Jaguars, max 96), `KC` (Kansas City Chiefs, max 95), `LAC` (San Diego Chargers, max 95), `LAR` (St. Louis Rams, max 97), `MIN` (Minnesota Vikings, max 95), `NO` (New Orleans Saints, max 84), `NYG` (New York Giants, max 90), `PIT` (Pittsburgh Steelers, max 86)


## Most undervalued players (top 25 by gap)

| Player | Team | Pos | OVR | Issue |
|--------|------|-----|----:|-------|
| Dan Marino | MIA | QB | 71 | production-implied floor 76, rated 71 (-5) |
| Brett Favre | GB | QB | 84 | production-implied floor 88, rated 84 (-4) |
| Kerry Collins | NYG | QB | 72 | production-implied floor 76, rated 72 (-4) |
| Fred Taylor | JAX | RB | 75 | production-implied floor 78, rated 75 (-3) |

## Recommended action

Author a curated 1999 override set (stars + clear starters, ~15–25 per team) resolved to the real GSIS player_ids by name match; let true depth fall to the engine (correctly 58–70). Then regenerate, apply overrides, and re-export. The St. Louis demo roster is already a high-quality showcase but is only 23 players — extend or leave as a thin curated roster.

