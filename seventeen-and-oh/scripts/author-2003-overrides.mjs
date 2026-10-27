// Author curated 2003 rating overrides (5th season in the 1999->2003 overhaul).
//
// PHILOSOPHY (per the brief):
//   - Every meaningful player is rated INDIVIDUALLY, not by a flat fallback.
//   - A star on a bad team stays a star (LaDainian Tomlinson, Jamal Williams,
//     Champ Bailey). A backup on a great team is NOT priced like a starter (true
//     depth falls to the engine's seeded depth-dispersal, band ~54-78).
//   - 90+ is special, 95+ is extremely rare. We do NOT inflate the league.
//
// WHY 2003 NEEDS A HEAVY CURATED PASS: defensive box scores, awards and kicking
// stats are empty for 2003, so the engine cannot grade any DL/EDGE/LB/CB/S, the
// OL, or the specialists -- it clusters each position group onto a single team-
// scaled ladder identical across all 32 teams (every team's top EDGE 82, top DT
// 80/81, top CB 81/82, top LT 81/82, top C 79...). That is exactly the cluster
// the brief forbids. So we hand-rate every team's defensive/OL/specialist
// STARTERS plus key rotation players, and we CAP the offensive skill players the
// engine over-scaled off raw box score (Randy Moss 99, Torry Holt 99, Chad
// Ochocinco 95, Derrick Mason 94, Hines Ward 94, Shannon Sharpe 92...). We also
// LIFT the true elites the engine buries in the statless cluster (Walter Jones
// 82->92, Orlando Pace 77->92, Willie Roaf 81->90, Will Shields 79->90, Alan
// Faneca 75->90, Steve Hutchinson 70->89, Chris Samuels 66->86, Olin Kreutz
// 71->86, Matt Birk 79->88, Kevin Williams 66->84, Kris Jenkins 70->87, Julius
// Peppers 66->88, Mike Rucker 71->85, Dwight Freeney 72->87, Champ Bailey
// 83->91, Chris McAlister 77->87, Dre Bly 77->85, Adewale Ogunleye 66->86).
//
// DATA NOTE: the 2003 import has almost no LB/S rows (13 of each league-wide) and
// is missing several defensive stars entirely (Ray Lewis, Ed Reed, Brian
// Urlacher, Derrick Brooks, John Lynch, Brian Dawkins, Junior Seau, Rod Woodson,
// Terrell Suggs all absent). We can only rate players present in the import; the
// defenders that exist are coded EDGE/DT/CB and are rated here.
//
// TOP END (95+, deliberately extremely rare -- the 2003 award winners + records):
//   Manning 96 (co-MVP), Jamal Lewis 96 (2066 yds, OPOY), Holmes 96 (27 rush TD
//   record), Moss 95 (1632/17), McNair 95 (co-MVP, 100.4 rtg). Nobody sits at
//   97-99 -- that tier stays reserved for all-time peak seasons.
//
// AGING-LEGEND CORRECTIONS: season-agnostic legend rows (empty season) otherwise
// leak a PEAK rating into 2003. For legends still active in 2003 we append a
// 2003-specific row at actual 2003 form; apply-overrides precedence (last match
// wins) makes the 2003 value win for 2003 only: Bruce Smith 97->74 (age 40),
// John Randle 93->76 (age 36), Jerry Rice 99->80 (age 41), Larry Allen 96->89,
// Jonathan Ogden 96->95 (1st-team All-Pro), Jason Taylor 93->90.
//
// MECHANISM: we only set `overall` (+ audit metadata). apply-overrides.mjs then
// re-derives position-appropriate attributes via projectAttributes(group, overall).
// Match key = player_id (+ season + team_code). We resolve name+team -> player_id
// and position from reports/_work/2003_before.csv so ids/positions are exact.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCsv, writeCsv } from "./lib/csv.mjs";
import { OVERRIDE_COLUMNS } from "./lib/schema.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BEFORE = path.join(ROOT, "reports/_work/2003_before.csv");
const OVERRIDES = path.join(ROOT, "data/rating_overrides.csv");

const SEASON = "2003";
const REVIEWER = "ratings-overhaul-2003";
const TODAY = "2026-06-10";
const CONFIDENCE = "0.9";

// CURATED[team_code] = { "Exact Player Name": [overall, "reason"] }
// Names must match reports/_work/2003_before.csv exactly (resolver warns on miss).
const CURATED = {
  // ===================== AFC EAST =====================
  BUF: {
    "Drew Bledsoe": [78, "16-game starter, 2860 yds 11/12 — middling vet"],
    "Travis Henry": [85, "1353 rush/10 TD workhorse, Pro Bowl"],
    "Eric Moulds": [85, "true No.1 WR, 64-780 (down QB year)"],
    "Josh Reed": [76, "58-588 slot starter"],
    "Bobby Shaw": [74, "56-732 complementary WR"],
    "Mark Campbell": [72, "starting TE, 34-339"],
    "Ruben Brown": [84, "Pro Bowl left guard"],
    "Jonas Jennings": [80, "quality starting left tackle"],
    "Trey Teague": [76, "starting center"],
    "Sam Adams": [84, "Pro Bowl run-stuffing DT"],
    "Pat Williams": [83, "stout nose tackle"],
    "Aaron Schobel": [83, "ascending edge rusher"],
    "Antoine Winfield": [85, "elite cover/tackling corner"],
    "Nate Clements": [83, "very good starting corner"],
    "Rian Lindell": [75, "starting placekicker"],
    "Brian Moorman": [80, "Pro Bowl punter"],
  },
  MIA: {
    "Jay Fiedler": [76, "starting QB, 2138 yds, game-manager"],
    "Ricky Williams": [89, "1372 rush/9 TD bell-cow, 392 carries"],
    "Chris Chambers": [86, "64-963/11 No.1 receiver"],
    "Randy McMichael": [80, "49-598 every-down TE"],
    "Mark Dixon": [78, "starting left guard"],
    "Tim Ruddy": [78, "steady starting center"],
    "Todd Wade": [76, "starting right tackle"],
    "Jason Taylor": [90, "elite edge rusher, ~13 sacks (aging-legend row capped to 2003 form)"],
    "Adewale Ogunleye": [86, "15.5-sack breakout edge"],
    "Rob Burnett": [76, "veteran rotation end"],
    "Tim Bowens": [82, "stout starting DT"],
    "Patrick Surtain": [88, "Pro Bowl shutdown corner"],
    "Sam Madison": [87, "Pro Bowl ball-hawk corner"],
    "Terrell Buckley": [76, "veteran nickel/starter"],
    "Olindo Mare": [84, "elite accurate placekicker"],
    "Matt Turk": [74, "starting punter"],
  },
  NE: {
    "Tom Brady": [89, "Super Bowl MVP, 14-2, 23/12 — top-tier winner"],
    "Kevin Faulk": [79, "versatile committee back, 638 rush + 48 rec"],
    "Antowain Smith": [76, "early-down starter, 642 rush"],
    "Deion Branch": [82, "57-803 lead receiver"],
    "Troy Brown": [80, "clutch slot veteran, 40-472"],
    "David Givens": [77, "34-510/6 starter"],
    "Daniel Graham": [80, "blocking/receiving starting TE"],
    "Christian Fauria": [76, "receiving TE, 28-285"],
    "Matt Light": [84, "Pro Bowl-caliber left tackle, SB line"],
    "Damien Woody": [83, "Pro Bowl interior lineman"],
    "Joe Andruzzi": [79, "tough starting guard"],
    "Dan Koppen": [76, "rookie starting center"],
    "Tom Ashworth": [74, "starting right tackle"],
    "Richard Seymour": [89, "All-Pro anchor of the No.1 SB defense"],
    "Ted Washington": [84, "massive run-stuffing nose tackle"],
    "Bobby Hamilton": [76, "starting defensive end"],
    "Ty Law": [89, "All-Pro shutdown corner, playoff hero"],
    "Tyrone Poole": [82, "excellent complementary corner"],
    "Asante Samuel": [75, "rookie nickel corner"],
    "Adam Vinatieri": [85, "clutch elite placekicker"],
  },
  NYJ: {
    "Chad Pennington": [79, "efficient starter, injury-shortened (2139 yds)"],
    "Vinny Testaverde": [70, "veteran backup, 1385 yds"],
    "Curtis Martin": [85, "1308-yard workhorse"],
    "Santana Moss": [86, "74-1105/10 breakout"],
    "Curtis Conway": [78, "46-640 No.2 receiver"],
    "Wayne Chrebet": [72, "veteran slot"],
    "Anthony Becht": [76, "blocking TE, 40-356"],
    "Kevin Mawae": [90, "All-Pro center, best at the position"],
    "Jason Fabini": [80, "quality left tackle"],
    "Kareem McKenzie": [80, "strong right tackle"],
    "John Abraham": [88, "elite edge rusher, Pro Bowl"],
    "Shaun Ellis": [84, "very good base end"],
    "Jason Ferguson": [80, "solid starting nose tackle"],
    "Dewayne Robertson": [78, "rookie No.4 pick DT, immediate starter"],
    "Donnie Abraham": [78, "veteran starting corner"],
    "Aaron Beasley": [76, "starting corner"],
    "Doug Brien": [75, "starting placekicker"],
  },

  // ===================== AFC NORTH =====================
  BAL: {
    "Jamal Lewis": [96, "2066 rush yds (2nd-most ever then), OPOY"],
    "Kyle Boller": [68, "rookie starter, struggled (1260 yds)"],
    "Chester Taylor": [74, "change-up back"],
    "Travis Taylor": [76, "nominal No.1 WR, 39-632"],
    "Marcus Robinson": [75, "31-451/6 red-zone WR"],
    "Todd Heap": [87, "Pro Bowl receiving TE, 57-693"],
    "Jonathan Ogden": [95, "1st-team All-Pro left tackle (legend row capped to 2003)"],
    "Edwin Mulitalo": [80, "quality starting left guard"],
    "Orlando Brown": [78, "mountain right tackle"],
    "Mike Flynn": [76, "starting center"],
    "Kelly Gregg": [82, "stout every-down nose tackle"],
    "Marques Douglas": [76, "starting defensive end"],
    "Anthony Weaver": [75, "young starting end"],
    "Chris McAlister": [87, "All-Pro shutdown corner"],
    "Gary Baxter": [80, "physical starting corner"],
    "Matt Stover": [84, "elite accurate placekicker"],
  },
  CIN: {
    "Jon Kitna": [83, "Comeback POY, 3605 yds 26/15"],
    "Carson Palmer": [66, "redshirt rookie No.1 pick, did not play"],
    "Rudi Johnson": [82, "967-yard lead back"],
    "Corey Dillon": [80, "declining/injured vet, 541 rush"],
    "Chad Ochocinco": [88, "90-1355/10 Pro Bowl No.1 WR"],
    "Peter Warrick": [82, "79-819/7 dynamic complement"],
    "Willie Anderson": [88, "All-Pro right tackle"],
    "Levi Jones": [79, "young starting left tackle"],
    "Rich Braham": [78, "starting center"],
    "Eric Steinbach": [78, "rookie starting guard"],
    "Mike Goff": [78, "starting right guard"],
    "Justin Smith": [82, "disruptive young left end"],
    "Duane Clemons": [74, "starting defensive end"],
    "John Thornton": [78, "starting defensive tackle"],
    "Tory James": [80, "ball-hawk starting corner"],
    "Artrell Hawkins": [74, "starting corner"],
    "Shayne Graham": [80, "very accurate placekicker"],
  },
  CLE: {
    "Tim Couch": [72, "split starter, 1319 yds"],
    "Kelly Holcomb": [73, "split starter, 1797 yds"],
    "Jamel White": [74, "pass-catching back, 46 rec"],
    "William Green": [70, "early-down back, 559 rush"],
    "Dennis Northcutt": [80, "62-729 lead receiver/returner"],
    "Andre Davis": [78, "40-576/5 deep threat"],
    "Quincy Morgan": [77, "38-516/3 starter"],
    "Ryan Tucker": [78, "versatile starting lineman"],
    "Jeff Faine": [76, "rookie No.21 pick starting center"],
    "Shaun O'Hara": [76, "starting interior lineman"],
    "Orpheus Roye": [80, "stout starting defensive end"],
    "Gerard Warren": [78, "No.3-pick starting DT"],
    "Kenard Lang": [78, "starting defensive end"],
    "Courtney Brown": [76, "talented oft-injured No.1-pick end"],
    "Anthony Henry": [78, "starting corner"],
    "Daylon McCutcheon": [76, "starting corner"],
    "Phil Dawson": [80, "very reliable placekicker"],
    "Chris Gardocki": [80, "elite directional punter"],
  },
  PIT: {
    "Tommy Maddox": [78, "starting QB, 3414 yds 18/17"],
    "Jerome Bettis": [80, "short-yardage workhorse, 811 rush"],
    "Amos Zereoue": [76, "change-up starter, 433 rush + 40 rec"],
    "Hines Ward": [88, "95-1163/10 Pro Bowl No.1"],
    "Plaxico Burress": [83, "60-860 big-bodied No.2"],
    "Antwaan Randle El": [76, "slot/gadget weapon"],
    "Alan Faneca": [90, "All-Pro left guard"],
    "Jeff Hartings": [84, "Pro Bowl center"],
    "Marvel Smith": [80, "starting left tackle"],
    "Kendall Simmons": [74, "young starting guard"],
    "Aaron Smith": [82, "excellent 3-4 defensive end"],
    "Kimo Von Oelhoffen": [76, "starting defensive end"],
    "Casey Hampton": [85, "Pro Bowl nose tackle"],
    "Chad Scott": [76, "starting corner"],
    "Deshea Townsend": [76, "starting/nickel corner"],
    "DeWayne Washington": [74, "veteran starting corner"],
    "Jeff Reed": [76, "starting placekicker"],
    "Josh Miller": [78, "quality starting punter"],
  },

  // ===================== AFC SOUTH =====================
  HOU: {
    "David Carr": [74, "young starter, 2013 yds (12 starts)"],
    "Domanick Williams": [84, "1031 rush/8 TD rookie lead back, 47 rec"],
    "Andre Johnson": [84, "66-976 rookie No.1 receiver"],
    "Corey Bradford": [75, "24-460/4 deep threat"],
    "Billy Miller": [75, "40-355 receiving TE"],
    "Steve McKinney": [76, "starting interior lineman"],
    "Chester Pitts": [74, "young starting guard"],
    "Zach Wiegert": [76, "veteran starting guard"],
    "Gary Walker": [83, "Pro Bowl defensive tackle"],
    "Seth Payne": [78, "stout starting DT"],
    "Aaron Glenn": [83, "Pro Bowl starting corner"],
    "Kenny Wright": [73, "starting corner"],
    "Kris Brown": [76, "starting placekicker"],
  },
  IND: {
    "Peyton Manning": [96, "co-MVP, 4267 yds 29/10"],
    "Edgerrin James": [89, "1259 rush back off ACL, 51 rec"],
    "Marvin Harrison": [93, "94-1272/10 All-Pro receiver"],
    "Reggie Wayne": [84, "68-838 ascending No.2"],
    "Marcus Pollard": [80, "40-541 receiving TE"],
    "Dallas Clark": [76, "rookie receiving TE"],
    "Tarik Glenn": [85, "Pro Bowl left tackle"],
    "Jeff Saturday": [84, "Pro Bowl center"],
    "Ryan Diem": [78, "starting right tackle"],
    "Dwight Freeney": [87, "Pro Bowl edge rusher, 11 sacks, dynamic"],
    "Chad Bratzke": [78, "veteran starting end"],
    "Robert Mathis": [76, "rookie pass-rush specialist"],
    "Montae Reagor": [76, "starting defensive tackle"],
    "Walt Harris": [78, "starting corner"],
    "David Macklin": [74, "starting corner"],
    "Mike Vanderjagt": [86, "perfect season, 37/37 FG, All-Pro"],
  },
  JAX: {
    "Byron Leftwich": [77, "rookie starter, 2819 yds 14/17"],
    "Fred Taylor": [89, "1572-yard workhorse"],
    "Jimmy Smith": [84, "Pro Bowl possession No.1, 54-805"],
    "Kevin Johnson": [78, "58-634 complement"],
    "Troy Edwards": [73, "35-487 slot"],
    "Kyle Brady": [74, "blocking TE"],
    "Brad Meester": [78, "starting center"],
    "Maurice Williams": [76, "starting right tackle"],
    "Chris Naeole": [74, "starting guard"],
    "Vincent Manuwai": [74, "rookie starting guard"],
    "Marcus Stroud": [87, "Pro Bowl dominant DT"],
    "John Henderson": [84, "very good young DT"],
    "Hugh Douglas": [78, "veteran edge (down FA year)"],
    "Fernando Bryant": [78, "starting corner"],
    "Rashean Mathis": [75, "rookie ball-hawk corner"],
    "Seth Marler": [70, "starting placekicker"],
    "Chris Hanson": [76, "quality starting punter"],
  },
  TEN: {
    "Steve McNair": [95, "co-MVP, 24/7, 100.4 rating"],
    "Eddie George": [82, "1031-yard workhorse (declining)"],
    "Derrick Mason": [86, "95-1303/8 Pro Bowl No.1 + returner"],
    "Justin McCareins": [80, "47-813/7 deep threat"],
    "Drew Bennett": [74, "32-504 emerging WR"],
    "Erron Kinney": [76, "41-393 receiving TE"],
    "Brad Hopkins": [83, "Pro Bowl left tackle"],
    "Benji Olson": [80, "very good right guard"],
    "Fred Miller": [76, "starting right tackle"],
    "Justin Hartwig": [74, "starting center"],
    "Jevon Kearse": [87, "Pro Bowl elite edge (The Freak)"],
    "Kevin Carter": [83, "very good base end/tackle"],
    "Albert Haynesworth": [80, "talented young DT"],
    "Robaire Smith": [74, "starting defensive end"],
    "Samari Rolle": [85, "Pro Bowl-caliber corner"],
    "Andre Dyson": [78, "starting corner"],
    "Gary Anderson": [76, "veteran placekicker"],
    "Craig Hentrich": [80, "Pro Bowl punter"],
  },

  // ===================== AFC WEST =====================
  DEN: {
    "Jake Plummer": [80, "starter, 2183 yds 15/7 (11 games)"],
    "Clinton Portis": [91, "1591 rush/14 TD, 18 total TD"],
    "Rod Smith": [85, "74-846 Pro Bowl-caliber No.1"],
    "Ashley Lelie": [78, "37-628 deep threat"],
    "Shannon Sharpe": [83, "62-770/8 (age 35, aging legend)"],
    "Tom Nalen": [86, "All-Pro zone-blocking center"],
    "Matt Lepsis": [80, "starting left tackle"],
    "Ben Hamilton": [76, "starting guard"],
    "Dan Neil": [76, "starting guard"],
    "Trevor Pryce": [84, "Pro Bowl-caliber defensive end"],
    "Bert Berry": [78, "productive edge rusher"],
    "Reggie Hayward": [76, "starting defensive end"],
    "Daryl Gardener": [80, "stout defensive tackle when healthy"],
    "Deltha O'Neal": [78, "talented starting corner"],
    "Kelly Herndon": [74, "starting corner"],
    "Jason Elam": [85, "elite placekicker"],
  },
  KC: {
    "Trent Green": [88, "4039 yds 24/12, explosive offense"],
    "Priest Holmes": [96, "1420 rush + single-season-record 27 TD"],
    "Tony Gonzalez": [93, "71-915/10 All-Pro tight end"],
    "Eddie Kennison": [82, "56-854 lead receiver"],
    "Johnnie Morton": [80, "50-740 No.2"],
    "Dante' Hall": [80, "All-Pro return man, electric"],
    "Tony Richardson": [72, "elite lead-blocking fullback"],
    "Willie Roaf": [90, "All-Pro left tackle"],
    "Will Shields": [90, "All-Pro right guard"],
    "Brian Waters": [84, "Pro Bowl left guard"],
    "Casey Wiegmann": [80, "very good starting center"],
    "John Tait": [80, "quality right tackle"],
    "Vonnie Holliday": [80, "good two-way defensive end"],
    "Eric Hicks": [76, "starting defensive end"],
    "John Browning": [78, "starting defensive tackle"],
    "Ryan Sims": [72, "No.6-pick DT, disappointing"],
    "Dexter McCleon": [76, "starting corner"],
    "Eric Warfield": [75, "starting corner"],
    "Morten Andersen": [78, "veteran placekicker"],
  },
  LV: {
    "Rich Gannon": [72, "2002 MVP collapsed/injured, 7 games (1274 yds)"],
    "Rick Mirer": [65, "journeyman fill-in starter"],
    "Charlie Garner": [78, "dual-threat back, 553 rush + 48 rec"],
    "Tyrone Wheatley": [74, "early-down back, 678 rush"],
    "Jerry Rice": [80, "63-861 at age 41 (legend row capped to 2003)"],
    "Tim Brown": [78, "51-563 at age 37 (declining)"],
    "Jerry Porter": [75, "28-361 ascending WR"],
    "Lincoln Kennedy": [82, "Pro Bowl right tackle (team declined)"],
    "Barret Robbins": [74, "starting center"],
    "Barry Sims": [73, "starting left tackle"],
    "Charles Woodson": [84, "still-excellent corner on a 4-12 team"],
    "Phillip Buchanon": [74, "young starting corner"],
    "Nnamdi Asomugha": [72, "rookie corner"],
    "Roderick Coleman": [76, "pass-rush defensive tackle"],
    "Trace Armstrong": [73, "aging rotation rusher"],
    "Sebastian Janikowski": [80, "big-leg placekicker"],
    "Shane Lechler": [85, "All-Pro punter"],
  },
  LAC: {
    "LaDainian Tomlinson": [94, "1645 rush/13 TD + 100 catches, lone star"],
    "Drew Brees": [72, "struggling/benched young starter (2108 yds 11/15)"],
    "Doug Flutie": [68, "veteran spot starter"],
    "Lorenzo Neal": [74, "elite lead-blocking fullback"],
    "David Boston": [82, "70-880/7 No.1 receiver"],
    "Antonio Gates": [78, "rookie TE breakout beginning"],
    "Damion McIntosh": [76, "starting left tackle"],
    "Cory Raymer": [74, "starting center"],
    "Jamal Williams": [86, "elite nose tackle, Pro Bowl-caliber"],
    "Marcellus Wiley": [80, "starting edge rusher (declining)"],
    "Raylee Johnson": [73, "rotation pass rusher"],
    "Quentin Jammer": [76, "developing No.5-pick corner"],
    "Sammy Davis": [72, "rookie corner"],
    "Drayton Florence": [74, "young starting corner"],
    "Steve Christie": [74, "veteran placekicker"],
    "Darren Bennett": [76, "quality veteran punter"],
  },

  // ===================== NFC EAST =====================
  DAL: {
    "Quincy Carter": [76, "16-game starter, 3302 yds 17/21, game-manager"],
    "Troy Hambrick": [76, "lead back, 972 rush behind a good line"],
    "Richie Anderson": [74, "pass-catching back/FB, 45 rec"],
    "Terry Glenn": [80, "52-799 lead receiver"],
    "Joey Galloway": [78, "deep threat, 34-672"],
    "Antonio Bryant": [76, "44-733 ascending WR"],
    "Jason Witten": [78, "rookie starting TE, 35-347"],
    "Larry Allen": [89, "All-Pro guard (legend row capped to 2003 form)"],
    "Flozell Adams": [84, "Pro Bowl-caliber left tackle"],
    "Andre Gurode": [74, "young interior lineman"],
    "Greg Ellis": [82, "productive starting edge rusher"],
    "La'Roi Glover": [86, "Pro Bowl penetrating DT, defensive leader"],
    "Terence Newman": [80, "No.5-pick rookie starting corner"],
    "Mario Edwards": [74, "starting corner"],
    "Billy Cundiff": [75, "starting placekicker"],
  },
  NYG: {
    "Kerry Collins": [78, "16-game starter, 3322 yds 18/16"],
    "Tiki Barber": [86, "1216 rush + 69 rec, dynamic dual-threat"],
    "Amani Toomer": [84, "63-920 No.1 receiver"],
    "Ike Hilliard": [78, "48-549 possession WR"],
    "Jeremy Shockey": [84, "Pro Bowl receiving TE, 48-535"],
    "Luke Petitgout": [80, "starting left tackle"],
    "Rich Seubert": [74, "starting guard (season-ending injury)"],
    "Chris Bober": [73, "starting interior lineman"],
    "Michael Strahan": [89, "league-leading 18.5 sacks, 1st-team All-Pro"],
    "Keith Hamilton": [78, "veteran starting DT"],
    "Cornelius Griffin": [78, "starting defensive tackle"],
    "Osi Umenyiora": [73, "rookie rotation end"],
    "Will Allen": [78, "young starting corner"],
    "Ralph Brown": [72, "nickel corner"],
    "Brett Conway": [73, "placekicker"],
    "Jeff Feagles": [78, "veteran directional punter"],
  },
  PHI: {
    "Donovan McNabb": [88, "Pro Bowl QB, led PHI to NFC title game"],
    "Brian Westbrook": [84, "dynamic dual-threat, 613 rush + 37 rec"],
    "Duce Staley": [78, "early-down back, 463 rush"],
    "Correll Buckhalter": [74, "rotation back"],
    "James Thrash": [76, "38-558 starter"],
    "Todd Pinkston": [74, "36-575 deep threat"],
    "L.J. Smith": [74, "rookie receiving TE"],
    "Tra Thomas": [84, "Pro Bowl left tackle"],
    "Jon Runyan": [83, "very good starting right tackle"],
    "Jermane Mayberry": [80, "Pro Bowl-caliber guard"],
    "Hank Fraley": [76, "starting center"],
    "Corey Simon": [82, "stout penetrating DT"],
    "Darwin Walker": [80, "productive interior rusher"],
    "Hollis Thomas": [76, "run-stuffing nose tackle"],
    "Troy Vincent": [84, "Pro Bowl starting corner"],
    "Bobby Taylor": [82, "very good starting corner"],
    "Lito Sheppard": [76, "young nickel/starter"],
    "Sheldon Brown": [76, "young starting corner"],
    "David Akers": [86, "All-Pro elite placekicker"],
  },
  WAS: {
    "Patrick Ramsey": [73, "young starter, 1714 yds (injury-shortened)"],
    "Trung Canidate": [72, "early-down back"],
    "Rock Cartwright": [70, "depth back/returner"],
    "Laveranues Coles": [87, "82-1204 Pro Bowl-caliber No.1 receiver"],
    "Rod Gardner": [78, "59-600 No.2"],
    "Darnerien McCants": [72, "red-zone WR"],
    "Chris Samuels": [86, "Pro Bowl left tackle"],
    "Randy Thomas": [80, "very good starting guard"],
    "Jon Jansen": [80, "durable starting right tackle"],
    "Derrick Dockery": [73, "rookie starting guard"],
    "Bruce Smith": [74, "age-40 rotation end chasing sack record (legend row capped)"],
    "Regan Upshaw": [74, "rotation edge rusher"],
    "Renaldo Wynn": [74, "starting defensive end"],
    "Bernard Holsey": [73, "starting defensive tackle"],
    "Champ Bailey": [91, "elite shutdown corner (final WAS year)"],
    "Fred Smoot": [81, "very good starting corner"],
    "Rashad Bauman": [72, "nickel corner"],
    "John Hall": [76, "placekicker"],
    "Bryan Barker": [73, "veteran punter"],
  },

  // ===================== NFC NORTH =====================
  CHI: {
    "Kordell Stewart": [70, "veteran starter, struggled and benched"],
    "Anthony Thomas": [78, "lead back, 581 rush"],
    "Marty Booker": [80, "70-1070 No.1 receiver"],
    "Dez White": [76, "38-498 No.2"],
    "Desmond Clark": [78, "starting receiving TE"],
    "Olin Kreutz": [86, "Pro Bowl center, best in NFC"],
    "Chris Villarrial": [76, "starting guard"],
    "Mike Gandy": [73, "young starting tackle"],
    "Alex Brown": [78, "ascending edge rusher"],
    "Phillip Daniels": [78, "starting defensive end"],
    "Keith Traylor": [78, "massive run-stuffing nose tackle"],
    "Bryan Robinson": [74, "starting defensive tackle"],
    "Charles Tillman": [78, "rookie starting corner, immediate impact"],
    "R.W. McQuarters": [76, "starting corner/returner"],
    "Jerry Azumah": [74, "starting corner"],
    "Paul Edinger": [74, "starting placekicker"],
    "Brad Maynard": [74, "starting punter"],
  },
  DET: {
    "Joey Harrington": [74, "young starter, 2880 yds 17/22"],
    "Shawn Bryson": [74, "committee back"],
    "Az-Zahir Hakim": [76, "57-587 slot/returner"],
    "Bill Schroeder": [74, "44-587 veteran WR"],
    "Charles Rogers": [70, "No.2-pick rookie, broke collarbone (3 games)"],
    "Mikhael Ricks": [73, "receiving TE"],
    "Jeff Backus": [78, "durable starting left tackle"],
    "Dominic Raiola": [76, "starting center"],
    "Stockar McDougle": [74, "starting right tackle"],
    "Shaun Rogers": [84, "Pro Bowl disruptive DT"],
    "Dan Wilkinson": [76, "veteran starting DT"],
    "James Hall": [78, "productive starting edge"],
    "Robert Porcher": [76, "aging veteran end"],
    "Dre' Bly": [85, "Pro Bowl ball-hawk corner, 6 INT"],
    "Otis Smith": [73, "veteran starting corner"],
    "Jason Hanson": [85, "elite long-range placekicker"],
  },
  GB: {
    "Brett Favre": [88, "Pro Bowl, 3361 yds 32/21, division winner"],
    "Ahman Green": [93, "franchise-record 1883 rush + 367 rec, 2nd-team All-Pro"],
    "Najeh Davenport": [72, "change-up back"],
    "Javon Walker": [80, "41-716 ascending No.1"],
    "Donald Driver": [80, "52-621 steady starter"],
    "Robert Ferguson": [74, "38-520 No.3"],
    "Bubba Franks": [78, "Pro Bowl red-zone TE"],
    "Mike Wahle": [82, "very good starting left guard"],
    "Marco Rivera": [84, "Pro Bowl right guard"],
    "Mike Flanagan": [78, "starting center"],
    "Chad Clifton": [80, "quality starting left tackle"],
    "Mark Tauscher": [78, "solid starting right tackle"],
    "Kabeer Gbaja-Biamila": [84, "team-leading 10-sack edge rusher"],
    "Aaron Kampman": [74, "young starting end"],
    "Grady Jackson": [80, "stout run-stuffing nose tackle"],
    "Al Harris": [82, "physical press starting corner"],
    "Mike McKenzie": [80, "very good starting corner"],
    "Ryan Longwell": [82, "very reliable placekicker"],
    "Josh Bidwell": [74, "starting punter"],
  },
  MIN: {
    "Daunte Culpepper": [87, "Pro Bowl, 3479 yds 25/11, 96.4 rating"],
    "Moe Williams": [80, "lead back, 745 rush + 11 total TD"],
    "Onterrio Smith": [73, "rookie change-up back"],
    "Randy Moss": [95, "1632 yds/17 TD, 1st-team All-Pro, league's best WR"],
    "Nate Burleson": [74, "rookie No.2 receiver"],
    "Jim Kleinsasser": [76, "blocking/receiving TE"],
    "Matt Birk": [88, "All-Pro center, best in the NFC"],
    "Bryant McKinnie": [80, "ascending No.7-pick left tackle"],
    "David Dixon": [78, "mauling starting right guard"],
    "Chris Liwienski": [74, "starting guard"],
    "Lance Johnstone": [79, "productive sack-specialist edge"],
    "Kevin Williams": [84, "All-Rookie disruptive DT, future star"],
    "Chris Hovan": [80, "penetrating starting nose tackle"],
    "Fred Robbins": [74, "starting defensive tackle"],
    "Brian Williams": [74, "starting corner"],
    "Denard Walker": [74, "veteran starting corner"],
    "Aaron Elling": [70, "fill-in placekicker"],
  },

  // ===================== NFC SOUTH =====================
  ATL: {
    "Doug Johnson": [68, "fill-in starter for injured Vick, turnover-prone"],
    "Michael Vick": [74, "broke leg in preseason, only 4 games (electric talent)"],
    "T.J. Duckett": [78, "early-down/goal-line back, 779 rush"],
    "Warrick Dunn": [78, "dual-threat back, 672 rush + 37 rec"],
    "Peerless Price": [80, "64-838 No.1 receiver"],
    "Alge Crumpler": [82, "Pro Bowl-caliber receiving TE"],
    "Todd McClure": [76, "starting center"],
    "Bob Whitfield": [76, "veteran starting left tackle"],
    "Kynan Forney": [74, "starting guard"],
    "Patrick Kerney": [84, "team-leading edge rusher, very good"],
    "Brady Smith": [76, "starting defensive end"],
    "Travis Hall": [76, "veteran starting DT"],
    "Ellis Johnson": [74, "starting defensive tackle"],
    "Tyrone Williams": [76, "veteran starting corner"],
    "Juran Bolden": [74, "starting corner"],
    "Allen Rossum": [75, "elite return man, starting corner"],
    "Jay Feely": [74, "starting placekicker"],
  },
  CAR: {
    "Jake Delhomme": [82, "led CAR to Super Bowl, clutch 3219 yds 19/16"],
    "Stephen Davis": [86, "1444 rush/8 TD bell-cow, Pro Bowl"],
    "DeShaun Foster": [74, "change-up back"],
    "Steve Smith": [87, "88-1110/7 dynamic WR + return man"],
    "Muhsin Muhammad": [82, "54-837 physical No.2"],
    "Ricky Proehl": [73, "veteran slot, clutch"],
    "Jordan Gross": [80, "No.8-pick rookie starting tackle"],
    "Kevin Donnalley": [76, "veteran starting guard"],
    "Jeff Mitchell": [76, "starting center"],
    "Todd Steussie": [76, "veteran starting tackle"],
    "Julius Peppers": [88, "elite young edge rusher, 7 sacks + dominant vs run"],
    "Mike Rucker": [85, "12-sack Pro Bowl edge rusher"],
    "Al Wallace": [74, "rotation edge"],
    "Kris Jenkins": [87, "Pro Bowl dominant nose tackle"],
    "Brentson Buckner": [78, "stout starting DT"],
    "Ricky Manning": [78, "rookie nickel corner, playoff star"],
    "Terry Cousin": [74, "starting corner"],
    "Reggie Howard": [74, "starting corner"],
    "John Kasay": [82, "very reliable placekicker"],
    "Todd Sauerbrun": [84, "All-Pro big-leg punter"],
  },
  NO: {
    "Aaron Brooks": [83, "3546 yds 24/8, efficient dual-threat starter"],
    "Deuce McAllister": [91, "1641 rush/8 + 69 rec, Pro Bowl workhorse"],
    "Joe Horn": [88, "Pro Bowl No.1 receiver, 73-923"],
    "Jerome Pathon": [76, "58-633 No.2"],
    "Donte' Stallworth": [74, "deep threat (injury-limited)"],
    "Boo Williams": [78, "receiving TE"],
    "Wayne Gandy": [80, "durable starting left tackle"],
    "LeCharles Bentley": [84, "Pro Bowl center"],
    "Kendyl Jacox": [74, "starting guard"],
    "Victor Riley": [73, "starting right tackle"],
    "Charles Grant": [80, "ascending edge rusher"],
    "Darren Howard": [80, "productive starting end"],
    "Willie Whitehead": [74, "starting defensive tackle"],
    "Johnathan Sullivan": [72, "No.6-pick rookie DT, disappointing"],
    "Kenny Smith": [73, "rotation defensive tackle"],
    "Ashley Ambrose": [76, "veteran starting corner"],
    "Fred Thomas": [74, "starting corner"],
    "Dale Carter": [73, "veteran corner"],
    "John Carney": [80, "very accurate placekicker"],
    "Mitch Berger": [72, "starting punter"],
  },
  TB: {
    "Brad Johnson": [80, "defending SB QB, 3811 yds 26/21 (offense slipped)"],
    "Michael Pittman": [80, "lead back, 627 rush + 46 rec"],
    "Thomas Jones": [76, "change-up back"],
    "Keenan McCardell": [80, "84-1174 No.1 receiver"],
    "Keyshawn Johnson": [76, "deactivated midseason in Gruden feud (10 games)"],
    "Mike Alstott": [70, "injury-shortened season (6 games)"],
    "Ken Dilger": [73, "veteran receiving TE"],
    "Roman Oben": [78, "starting left tackle"],
    "Kerry Jenkins": [74, "starting guard"],
    "John Wade": [74, "starting center"],
    "Cosey Coleman": [73, "starting guard"],
    "Kenyatta Walker": [73, "starting right tackle"],
    "Simeon Rice": [88, "elite edge rusher, 15 sacks"],
    "Warren Sapp": [85, "still-excellent penetrating DT (decline from peak)"],
    "Greg Spires": [76, "starting defensive end"],
    "Anthony McFarland": [80, "stout starting DT"],
    "Chuck Darby": [73, "rotation defensive tackle"],
    "Ronde Barber": [88, "Pro Bowl shutdown corner, playmaker"],
    "Brian Kelly": [84, "led NFL with 8 INT, very good corner"],
    "Corey Ivy": [72, "nickel corner"],
    "Martin Gramatica": [78, "starting placekicker"],
    "Tom Tupa": [73, "starting punter"],
  },

  // ===================== NFC WEST =====================
  ARI: {
    "Jeff Blake": [74, "veteran spot starter, 2154 yds"],
    "Marcel Shipp": [78, "lead back, 830 rush"],
    "Emmitt Smith": [72, "age-34 legend, 256 rush in 10 games"],
    "Anquan Boldin": [87, "Offensive ROY, 101-1377/8 rookie sensation"],
    "Bryant Johnson": [73, "rookie No.2 receiver"],
    "Freddie Jones": [78, "receiving TE"],
    "Leonard Davis": [76, "mammoth starting tackle"],
    "L.J. Shelton": [74, "starting tackle"],
    "Pete Kendall": [76, "veteran starting guard"],
    "Anthony Clement": [72, "starting tackle"],
    "Fred Wakefield": [72, "rotation defensive end"],
    "Dennis Johnson": [72, "starting defensive tackle"],
    "Russell Davis": [73, "starting defensive tackle"],
    "Barron Tanner": [72, "rotation defensive tackle"],
    "David Barrett": [74, "starting corner"],
    "Renaldo Hill": [72, "starting corner"],
    "Neil Rackers": [74, "starting placekicker"],
    "Scott Player": [76, "quality starting punter"],
  },
  LAR: {
    "Marc Bulger": [84, "Pro Bowl, 3845 yds 22/22, efficient"],
    "Marshall Faulk": [85, "still-excellent but declining (818 rush + 45 rec)"],
    "Torry Holt": [94, "league-leading 1696 yds/12, 1st-team All-Pro"],
    "Isaac Bruce": [85, "82-1330 elite complementary WR"],
    "Dane Looker": [74, "slot starter"],
    "Brandon Manumaleuna": [74, "blocking TE"],
    "Orlando Pace": [92, "All-Pro left tackle, best in football"],
    "Adam Timmerman": [82, "Pro Bowl right guard"],
    "Andy McCollum": [78, "starting center"],
    "Leonard Little": [84, "12.5-sack Pro Bowl edge rusher"],
    "Grant Wistrom": [78, "productive starting end"],
    "Tyoka Jackson": [76, "starting defensive tackle"],
    "Brian Young": [76, "rotation defensive tackle"],
    "Ryan Pickett": [74, "young starting DT"],
    "Damione Lewis": [73, "rotation defensive tackle"],
    "Travis Fisher": [76, "young starting corner"],
    "Jerametrius Butler": [76, "starting corner"],
    "Jeff Wilkins": [84, "Pro Bowl placekicker, 39 FG"],
  },
  SF: {
    "Jeff Garcia": [82, "Pro Bowl-level vet, down year (18/13)"],
    "Kevan Barlow": [80, "lead back, 1024 rush"],
    "Garrison Hearst": [76, "veteran committee back"],
    "Terrell Owens": [88, "80-1102/9 dominant No.1 receiver"],
    "Tai Streets": [76, "72-693 No.2"],
    "Cedrick Wilson": [73, "No.3 receiver"],
    "Derrick Deese": [78, "veteran starting left tackle"],
    "Jeremy Newberry": [82, "Pro Bowl-caliber center"],
    "Ron Stone": [76, "veteran starting guard"],
    "Scott Gragg": [76, "starting right tackle"],
    "Andre Carter": [82, "ascending edge rusher"],
    "Chidi Ahanotu": [74, "veteran rotation end"],
    "Bryant Young": [85, "still-excellent veteran DT"],
    "Anthony Adams": [73, "young rotation DT"],
    "Ahmed Plummer": [78, "starting corner"],
    "Jason Webster": [76, "starting corner"],
    "Todd Peterson": [76, "starting placekicker"],
  },
  SEA: {
    "Matt Hasselbeck": [87, "Pro Bowl breakout, 3841 yds 26/15"],
    "Shaun Alexander": [89, "1435 rush/14 TD + 16 total TD, Pro Bowl"],
    "Mack Strong": [73, "lead-blocking fullback"],
    "Darrell Jackson": [85, "68-1137/9 No.1 receiver"],
    "Koren Robinson": [80, "65-896 dynamic No.2"],
    "Bobby Engram": [78, "reliable slot, 52-637"],
    "Itula Mili": [76, "receiving TE"],
    "Walter Jones": [92, "All-Pro left tackle, elite pass protector"],
    "Steve Hutchinson": [89, "Pro Bowl mauling left guard"],
    "Robbie Tobeck": [80, "very good starting center"],
    "Chris Gray": [76, "starting guard"],
    "Chike Okeafor": [78, "starting edge rusher"],
    "Brandon Mitchell": [74, "starting defensive end"],
    "John Randle": [76, "age-36 rotation DT (legend row capped to 2003)"],
    "Rocky Bernard": [74, "young rotation DT"],
    "Norman Hand": [74, "run-stuffing nose tackle"],
    "Shawn Springs": [82, "very good starting corner"],
    "Marcus Trufant": [78, "No.11-pick rookie starting corner"],
    "Ken Lucas": [76, "young starting corner"],
    "Josh Brown": [76, "starting placekicker"],
  },
};

// ---------------------------------------------------------------------------
// Resolve + build rows.
// ---------------------------------------------------------------------------
const before = readCsv(BEFORE);
const byKey = new Map();
for (const r of before) byKey.set(`${r.team_code}|${r.name}`, r);

const newRows = [];
const misses = [];
let teamCount = 0;
for (const [team, players] of Object.entries(CURATED)) {
  teamCount++;
  for (const [name, spec] of Object.entries(players)) {
    const [overall, reason] = Array.isArray(spec) ? spec : [spec, ""];
    if (!overall || Number(overall) <= 0) continue; // sentinel: skip
    const rec = byKey.get(`${team}|${name}`);
    if (!rec) {
      misses.push(`${team} | ${name} (ovr ${overall})`);
      continue;
    }
    newRows.push({
      player_id: rec.player_id,
      name,
      season: SEASON,
      team_code: team,
      position: rec.position,
      status: "",
      review_status: "approved",
      reviewed_by: REVIEWER,
      last_updated: TODAY,
      rating_confidence: CONFIDENCE,
      reason,
      overall: String(overall),
    });
  }
}

// Preserve every existing override row EXCEPT any prior 2003 row (idempotent
// re-run). Season-agnostic legend rows (season === "") are preserved, and the
// 2003-specific corrections appended above override them for 2003 via
// apply-overrides precedence (last match wins).
const existing = readCsv(OVERRIDES);
const kept = existing.filter((r) => r.season !== SEASON);

const merged = [...kept, ...newRows];
writeCsv(OVERRIDES, merged, OVERRIDE_COLUMNS);

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------
console.log(
  `authored ${newRows.length} curated 2003 overrides across ${teamCount} teams`,
);
console.log(
  `preserved ${kept.length} existing rows (season-agnostic legends + other seasons)`,
);
console.log(`overrides file now has ${merged.length} data rows`);

// Distribution sanity (curated only).
const buckets = { "95+": 0, "90-94": 0, "85-89": 0, "80-84": 0, "75-79": 0, "70-74": 0, "<70": 0 };
for (const r of newRows) {
  const o = Number(r.overall);
  if (o >= 95) buckets["95+"]++;
  else if (o >= 90) buckets["90-94"]++;
  else if (o >= 85) buckets["85-89"]++;
  else if (o >= 80) buckets["80-84"]++;
  else if (o >= 75) buckets["75-79"]++;
  else if (o >= 70) buckets["70-74"]++;
  else buckets["<70"]++;
}
console.log("curated overall distribution:", JSON.stringify(buckets));

if (misses.length) {
  console.log(`\n⚠ ${misses.length} UNMATCHED names (check spelling/team in before.csv):`);
  for (const m of misses) console.log("  " + m);
} else {
  console.log("\n✓ all curated names resolved to player_ids");
}
