# Rating Audit Summary

_Generated 2026-06-07T15:27:15.336Z by `scripts/audit-ratings.mjs`. Read-only; the data was not modified._

- **Rated player-seasons:** 96,167
- **Mean overall:** 69.9
- **Errors:** 8  |  **Warnings:** 8
- **Overrated flags:** 222  |  **Underrated flags:** 9
- **Duplicate player-seasons:** 8

## Rating-scale distribution

| Band | Meaning | Count | Share |
| ---: | --- | ---: | ---: |
| 98–99 | All-time legendary season | 14 | 0.0% |
| 95–97 | MVP / DPOY / elite First-Team All-Pro | 21 | 0.0% |
| 90–94 | Star / strong All-Pro | 524 | 0.5% |
| 85–89 | Very good starter | 1,632 | 1.7% |
| 80–84 | Solid starter | 3,194 | 3.3% |
| 75–79 | Average starter | 3,764 | 3.9% |
| 70–74 | Rotation / below-average starter | 34,911 | 36.3% |
| 65–69 | Backup-level | 44,929 | 46.7% |
| 40–64 | Depth / weak backup | 7,178 | 7.5% |

90+: **559** (0.58%) · 95+: **35** (0.04%) · 98+: **14** (0.01%)

> 90+ rows: 559 (0.58%) — within the healthy <=1.0% band.

## By status

| Status | Count | Share |
| --- | ---: | ---: |
| generated_low_confidence | 82,761 | 86.1% |
| generated_high_confidence | 8,121 | 8.4% |
| generated_medium_confidence | 5,242 | 5.5% |
| manual_override | 41 | 0.0% |
| manually_reviewed | 2 | 0.0% |

## By source

| Source | Count | Share |
| --- | ---: | ---: |
| generated | 96,124 | 100.0% |
| manual | 43 | 0.0% |

## Error checks

| Check | Count |
| --- | ---: |
| duplicate_player_season | 8 |

## Warning checks

| Check | Count |
| --- | ---: |
| defensive_attrs_on_offense | 5 |
| overall_exceeds_key_attrs | 2 |
| elite_cluster | 1 |

## Top underrated (by gap)

| Player | Pos | Season | Team | Current | Rec. | Conf. | Reason |
| --- | --- | ---: | --- | ---: | ---: | --- | --- |
| Priest Holmes | RB | 2004 | KC | 79 | 87 | medium | Star production (rush_td 14 >= 13) rated only 79 |
| Randy Moss | WR | 2004 | MIN | 81 | 89 | medium | Star production (rec_td 13 >= 11) rated only 81 |
| Willie Parker | RB | 2007 | PIT | 83 | 91 | medium | Star production (rush_yds 1316 >= 1300) rated only 83 |
| Antonio Gates | TE | 2010 | LAC | 81 | 89 | medium | Star production (rec_td 10 >= 8) rated only 81 |
| Rob Gronkowski | TE | 2012 | NE | 82 | 90 | medium | Star production (rec_td 11 >= 8) rated only 82 |
| Dwayne Allen | TE | 2014 | IND | 82 | 90 | medium | Star production (rec_td 8 >= 8) rated only 82 |
| Hunter Henry | TE | 2016 | LAC | 83 | 91 | medium | Star production (rec_td 8 >= 8) rated only 83 |
| Garo Yepremian | K | 1972 | MIA | 77 | 82 | medium | Pro Bowl season rated 77; award implies >= 82 |
| Mike Cofer | K | 1989 | SF | 78 | 82 | medium | Pro Bowl season rated 78; award implies >= 82 |

## Top overrated (by gap)

| Player | Pos | Season | Team | Current | Rec. | Conf. | Reason |
| --- | --- | ---: | --- | ---: | ---: | --- | --- |
| Kyler Murray | QB | 2020 | ARI | 93 | 84 | medium | Elite 93 with no award, star production, or scouting prior to justify it |
| Jalen Hurts | QB | 2022 | PHI | 93 | 84 | medium | Elite 93 with no award, star production, or scouting prior to justify it |
| Lamar Jackson | QB | 2023 | BAL | 93 | 84 | medium | Elite 93 with no award, star production, or scouting prior to justify it |
| Josh Allen | QB | 2024 | BUF | 93 | 84 | medium | Elite 93 with no award, star production, or scouting prior to justify it |
| Jayden Daniels | QB | 2024 | WAS | 93 | 84 | medium | Elite 93 with no award, star production, or scouting prior to justify it |
| Rich Gannon | QB | 1999 | LV | 92 | 84 | medium | Elite 92 with no award, star production, or scouting prior to justify it |
| Rich Gannon | QB | 2000 | LV | 92 | 84 | medium | Elite 92 with no award, star production, or scouting prior to justify it |
| Donovan McNabb | QB | 2000 | PHI | 92 | 84 | medium | Elite 92 with no award, star production, or scouting prior to justify it |
| Rich Gannon | QB | 2001 | LV | 92 | 84 | medium | Elite 92 with no award, star production, or scouting prior to justify it |
| Aaron Brooks | QB | 2001 | NO | 92 | 84 | medium | Elite 92 with no award, star production, or scouting prior to justify it |
| Trent Green | QB | 2002 | KC | 92 | 84 | medium | Elite 92 with no award, star production, or scouting prior to justify it |
| Tom Brady | QB | 2002 | NE | 92 | 84 | medium | Elite 92 with no award, star production, or scouting prior to justify it |
| Daunte Culpepper | QB | 2003 | MIN | 92 | 84 | medium | Elite 92 with no award, star production, or scouting prior to justify it |
| Matt Hasselbeck | QB | 2003 | SEA | 92 | 84 | medium | Elite 92 with no award, star production, or scouting prior to justify it |
| Jake Delhomme | QB | 2004 | CAR | 92 | 84 | medium | Elite 92 with no award, star production, or scouting prior to justify it |

Full lists: `reports/underrated_players.csv`, `reports/overrated_players.csv`, `reports/rating_errors.csv`, `reports/rating_warnings.csv`.
