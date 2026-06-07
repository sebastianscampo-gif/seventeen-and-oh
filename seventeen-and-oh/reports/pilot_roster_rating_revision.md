# Pilot Roster Rating Revision — 17-0

_Phase 2, Step 8. Written 2026-06-07. Regenerates the nine pilot team-seasons with
the reworked engine (within-roster depth ranking + role tiers + honest confidence
tiers + position-prior softening) and the expanded legend overrides, then compares
each roster against its Phase 1 baseline. "Before" = `data/backups/ratings.pre-phase2.20260607.csv`;
"after" = the current `data/processed/ratings.csv`. Reproduce with
`node scripts/generate-ratings.mjs && node scripts/apply-overrides.mjs`._

## Why these nine

These are the brief's pilot teams: one catastrophically flat bio-only import (1996
NYG) and eight hand-curated contenders. Together they exercise both failure modes the
audit found — the flat ~70 roster and the compressed-at-the-top curated roster — so a
fix that works here is ready to scale.

## Before → after at a glance

| Team | Before avg | After avg | Before spread | After spread | Before %-same | Overrides | Review |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1996 NYG | 69.8 | 69.8 | 1 | 15* | 78% | 1 | 3 |
| 1985 CHI | 85.0 | 86.3 | 14 | 18 | 17% | 4 | 2 |
| 1999 STL | 84.0 | 85.2 | 14 | 19 | 17% | 4 | 2 |
| 2000 BAL | 83.5 | 84.4 | 24 | 22 | 17% | 4 | 0 |
| 2007 NE | 87.1 | 87.4 | 17 | 17 | 22% | 3 | 0 |
| 2013 SEA | 84.2 | 85.2 | 12 | 15 | 21% | 5 | 0 |
| 2018 KC | 84.0 | 84.9 | 14 | 18 | 17% | 3 | 2 |
| 2020 TB | 84.6 | 85.2 | 9 | 11 | 20% | 2 | 4 |
| 2023 SF | 84.4 | 85.6 | 13 | 16 | 17% | 5 | 2 |

_\*1996 NYG: the engine alone widens the bio-only roster from a 1-point band to a
3-point positional gradient (68–71) and drops it from 78% to 45% on one number; the
15-point spread shown comes from the single Strahan override at 83. See below._

**The headline:** averages barely move (the biggest shift is +1.3 on the 1985 Bears).
This is the proof the brief asked for — the rework **separates** players, it does not
**inflate** them. Spread widens, the share of identical ratings falls, every star is
backed by either real evidence or a curated override, and every thin-evidence
near-elite is flagged for review instead of being passed off as certain.

---

## 1996 New York Giants — the flagship flat roster

| | Before | After |
| --- | --- | --- |
| Average | 69.8 | 69.8 |
| Spread (max−min) | 1 (69–70) | 3 generated (68–71), 15 with override (68–83) |
| % on one rating | 78% at 70 | 45% at 70 |
| Top rating | 70 | 83 (Strahan, override) / 71 generated |

- **Top 5:** 83 EDGE Michael Strahan\* · 71 K Brad Daluiso · 71 QB Danny Kanell · 71 QB
  Dave Brown · 71 LT Greg Bishop
- **Bottom 5:** 68 LG Jerry Reynolds · 68 LG Lance Smith · 68 LG Rob Zatechka · 68 LG
  Ron Stone · 68 LG Scott Davis
- **Needs review (3):** Danny Kanell (QB 71), Dave Brown (QB 71), Stan White (QB 71)

**Why the new version is better.** This 60-man roster is a pure bio import: no starts,
no stats, no awards, no experience — the audit's worst case (78% rated exactly 70).
The honest truth is that the data cannot tell most of these players apart, so the
engine does not pretend to. What it *can* do without inventing facts: (1) spread the
baseline by **position value**, turning one flat number into a 68→71 gradient (QB/LT/
edge above interior OL); (2) mark every rating **low-confidence**; (3) flag the QB room
for review, because one of Brown/Kanell/White was the real starter and the data can't
say which; and (4) accept the one curated **override** — Michael Strahan, the roster's
lone future Hall of Famer — at an era-appropriate **83** (an ascending pre-prime
starter, not a 99). The average is unchanged: we did not lift the roster, we shaped it.

\* manual override.

---

## 1985 Chicago Bears

- **Before:** avg 85.0, spread 14, 17% identical. **After:** avg 86.3, spread 18, 4
  overrides, 2 review.
- **Top 5:** 96 RB Walter Payton\* · 96 LB Mike Singletary\* · 95 EDGE Richard Dent\* ·
  91 DT Dan Hampton\* · 88 LT Jimbo Covert
- **Bottom 5:** 83 CB Mike Richardson · 83 RG Tom Thayer · 82 K Kevin Butler · 81 TE
  Emery Moorehead · 78 P Maury Buford
- **Needs review (2):** Jimbo Covert (LT 88), Steve McMichael (DT 88)

**Why better.** Phase 1 rated the legendary 46 defense and Payton well but left them as
unmarked generated numbers, indistinguishable in provenance from a role player. Now
Payton, Singletary, Dent, and Hampton are **locked overrides** at canonical,
era-appropriate values, while the two remaining 88-rated starters with no box score
(Covert, McMichael) are surfaced for review — both legitimate override candidates a
human should confirm.

## 1999 St. Louis Rams

- **Before:** avg 84.0, spread 14, 17% identical. **After:** avg 85.2, spread 19, 4
  overrides, 2 review.
- **Top 5:** 97 QB Kurt Warner\* · 97 RB Marshall Faulk\* · 93 LT Orlando Pace\* · 90 WR
  Isaac Bruce\* · 89 EDGE Kevin Carter
- **Bottom 5:** 82 S Billy Jenkins · 82 DT Ray Agnew · 81 C Mike Gruttadauria · 79 TE
  Roland Williams · 78 P Mike Horan
- **Needs review (2):** Kevin Carter (EDGE 89), Torry Holt (WR 88)

**Why better.** The Greatest Show on Turf core (Warner MVP, Faulk OPOY, Pace, Bruce) is
locked at canonical values. The flag on Torry Holt (88) is the system working as
intended: a near-elite rookie-year receiver with no override is held back for human
confirmation rather than silently rated as certain.

## 2000 Baltimore Ravens

- **Before:** avg 83.5, spread 24, 17% identical. **After:** avg 84.4, spread 22, 4
  overrides, 0 review.
- **Top 5:** 99 LB Ray Lewis\* · 94 LT Jonathan Ogden\* · 90 S Rod Woodson\* · 88 TE
  Shannon Sharpe\* · 87 CB Chris McAlister
- **Bottom 5:** 80 CB Robert Bailey · 80 QB Trent Dilfer · 78 WR Brandon Stokley · 78 P
  Kyle Richardson · 77 WR Patrick Johnson
- **Needs review (0):** none

**Why better.** The record-setting defense is now anchored by four locked legends, and
the offense reads honestly — a game-managing Dilfer at 80, not inflated to match the
defense. The roster keeps its wide, realistic spread (77→99).

## 2007 New England Patriots

- **Before:** avg 87.1, spread 17, 22% identical. **After:** avg 87.4, spread 17, 3
  overrides, 0 review.
- **Top 5:** 99 WR Randy Moss\* · 99 QB Tom Brady\* · 94 CB Asante Samuel · 91 EDGE Mike
  Vrabel · 90 WR Wes Welker\*
- **Bottom 5:** 84 RG Stephen Neal · 83 P Chris Hanson · 83 CB Ellis Hobbs · 83 RT Nick
  Kaczur · 82 S James Sanders
- **Needs review (0):** none

**Why better.** The 16-0 offense keeps Brady and Moss's record-season 99s (now joined
by a locked Welker), and the partial box score this roster carries means the rest of
the unit is evidence-backed rather than inferred — no review flags needed.

## 2013 Seattle Seahawks

- **Before:** avg 84.2, spread 12, 21% identical. **After:** avg 85.2, spread 15, 5
  overrides, 0 review.
- **Top 5:** 94 CB Richard Sherman\* · 93 S Earl Thomas\* · 91 RB Marshawn Lynch\* · 90 S
  Kam Chancellor\* · 90 LB Bobby Wagner\*
- **Bottom 5:** 82 CB Walter Thurmond · 81 RG J.R. Sweezy · 81 LG James Carpenter · 81 TE
  Zach Miller · 79 P Jon Ryan
- **Needs review (0):** none

**Why better.** The entire Legion of Boom plus Wagner and Lynch are locked at canonical
values, while the offensive line (Sweezy, Carpenter at 81) and the punter (79) sit
honestly below them — the gradient between a championship secondary and a
developmental O-line is now explicit.

## 2018 Kansas City Chiefs

- **Before:** avg 84.0, spread 14, 17% identical. **After:** avg 84.9, spread 18, 3
  overrides, 2 review.
- **Top 5:** 96 QB Patrick Mahomes\* · 93 TE Travis Kelce\* · 92 WR Tyreek Hill\* · 89 DT
  Chris Jones · 89 RT Mitchell Schwartz
- **Bottom 5:** 81 S Daniel Sorensen · 81 P Dustin Colquitt · 81 LB Reggie Ragland · 80
  LG Cameron Erving · 78 WR Chris Conley
- **Needs review (2):** Chris Jones (DT 89), Mitchell Schwartz (RT 89)

**Why better.** Mahomes's 50-TD MVP season is locked at 96, his skill weapons at 92–93.
The two flagged players (Jones, Schwartz at 89) are exactly the borderline elites — a
disruptive interior rusher and an All-Pro tackle — that warrant a human override
decision rather than an automatic near-90.

## 2020 Tampa Bay Buccaneers

- **Before:** avg 84.6, spread 9, 20% identical. **After:** avg 85.2, spread 11, 2
  overrides, 4 review.
- **Top 5:** 90 QB Tom Brady\* · 89 WR Mike Evans\* · 88 WR Chris Godwin · 88 EDGE
  Shaquil Barrett · 88 RT Tristan Wirfs
- **Bottom 5:** 83 RB Ronald Jones II · 83 CB Sean Murphy-Bunting · 82 RG Alex Cappa ·
  81 K Ryan Succop · 79 P Bradley Pinion
- **Needs review (4):** Chris Godwin (WR 88), Shaquil Barrett (EDGE 88), Tristan Wirfs
  (RT 88), Vita Vea (DT 88)
- **Note:** the tightest pre-existing roster (spread 9). Brady is locked at an
  age-appropriate **90** — a Super Bowl winner, not priced like his 2007 self. The four
  88-rated stars flagged for review are the densest cluster of "great but unconfirmed"
  players in the pilots, a good test of the review queue.

## 2023 San Francisco 49ers

- **Before:** avg 84.4, spread 13, 17% identical. **After:** avg 85.6, spread 16, 5
  overrides, 2 review.
- **Top 5:** 95 RB Christian McCaffrey\* · 94 EDGE Nick Bosa\* · 94 LT Trent Williams\* ·
  92 LB Fred Warner\* · 91 TE George Kittle\*
- **Bottom 5:** 81 CB Isaiah Oliver · 80 K Jake Moody · 80 P Mitch Wishnowsky · 80 RG
  Spencer Burford · 79 WR Jauan Jennings
- **Needs review (2):** Brandon Aiyuk (WR 88), Deebo Samuel (WR 88)

**Why better.** Five locked All-Pros (McCaffrey OPOY at the top) anchor the roster, and
the two flagged receivers (Aiyuk, Deebo at 88) are precisely the next-tier stars a
reviewer should weigh for promotion — the queue points a human at the right two names,
not the whole roster.

---

## What the pilot proves

1. **Separation, not inflation.** Average overall moves by at most ~1.3 points on any
   pilot; the 1996 NYG average is unchanged. The work went into spread and provenance.
2. **Flat rosters get honest gradients.** The worst case (1996 NYG) drops from 78% to
   45% on one number using only position value, with every rating marked low-confidence
   and the ambiguous QB room flagged — no invented starters.
3. **Curated rosters get locked legends + confidence.** 31 marquee players across the
   pilots are now manual overrides at era-appropriate values; the rest carry explicit
   confidence tiers.
4. **The review queue is targeted.** It surfaces a handful of genuine "great but
   unconfirmed" players per roster (Holt, McMichael, Jones, Deebo, Aiyuk, the Bucs'
   88-cluster) — the exact names a human should adjudicate — rather than dumping the
   whole roster into review.

This is the pattern the full regeneration (Step 12) applies to all 1,760 team-seasons.
