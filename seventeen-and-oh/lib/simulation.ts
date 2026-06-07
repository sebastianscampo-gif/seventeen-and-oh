import {
  Ending,
  GameResult,
  MatchupEdge,
  ResultExplanation,
  SeasonOdds,
  SimulationResult,
  TeamProfile,
} from "./types";
import { SIM_CONFIG as C } from "./sim-config";

// ---------------------------------------------------------------------------
// 17-0 probability-based season simulator.
//
// Nothing here is deterministic: team strength only ever sets ODDS. A great
// roster is favored every week but can drop a trap game; a flawed roster can
// catch fire and steal a title. The regular season is moderately random, the
// single-elimination playoffs are more volatile, and matchups + star/clutch
// power decide who survives. See lib/sim-config.ts for every tunable knob.
// ---------------------------------------------------------------------------

// --- small helpers ---------------------------------------------------------
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function gaussian(mean: number, sd: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const OPPONENT_NAMES = [
  "Dallas Cowboys", "Green Bay Packers", "Pittsburgh Steelers", "Buffalo Bills",
  "Philadelphia Eagles", "Denver Broncos", "Miami Dolphins", "Minnesota Vikings",
  "Detroit Lions", "Cincinnati Bengals", "Cleveland Browns", "Las Vegas Raiders",
  "Los Angeles Chargers", "Houston Texans", "Jacksonville Jaguars", "Tennessee Titans",
  "New York Giants", "Washington Commanders", "Atlanta Falcons", "Carolina Panthers",
  "New Orleans Saints", "Arizona Cardinals", "Indianapolis Colts", "New York Jets",
  "Seattle Seahawks", "San Francisco 49ers", "Tampa Bay Buccaneers", "Chicago Bears",
  "Kansas City Chiefs", "Baltimore Ravens", "Los Angeles Rams", "New England Patriots",
];

type Tier = keyof typeof C.OPPONENT_TIERS;

interface Opponent {
  name: string;
  tier: Tier;
  power: number;
  // The six units the matchup engine compares against the user's roster.
  passOff: number;
  rushOff: number;
  oLine: number;
  passRush: number;
  runDef: number;
  secondary: number;
}

// --- opponent generation ---------------------------------------------------
function rollTier(): Tier {
  const tiers = Object.entries(C.OPPONENT_TIERS) as [Tier, { weight: number }][];
  const total = tiers.reduce((a, [, t]) => a + t.weight, 0);
  let r = Math.random() * total;
  for (const [name, t] of tiers) {
    r -= t.weight;
    if (r <= 0) return name;
  }
  return tiers[0][0];
}

function makeOpponent(tier: Tier, name: string): Opponent {
  const [lo, hi] = C.OPPONENT_TIERS[tier].range;
  const power = randInt(lo, hi);
  const unit = () =>
    clamp(Math.round(power + gaussian(0, C.OPPONENT_UNIT_SPREAD)), 55, 99);
  return {
    name,
    tier,
    power,
    passOff: unit(),
    rushOff: unit(),
    oLine: unit(),
    passRush: unit(),
    runDef: unit(),
    secondary: unit(),
  };
}

function generateSchedule(): Opponent[] {
  const names = [...OPPONENT_NAMES].sort(() => Math.random() - 0.5);
  return Array.from({ length: 17 }, (_, i) =>
    makeOpponent(rollTier(), names[i % names.length])
  );
}

const PLAYOFF_TIER: Record<string, Tier> = {
  "Wild Card": "good",
  "Divisional Round": "great",
  "Conference Championship": "great",
  "Super Bowl": "elite",
};

function makePlayoffOpponent(round: string): Opponent {
  // Conference title / Super Bowl opponents skew to the top of their tier.
  const base = PLAYOFF_TIER[round] ?? "great";
  const opp = makeOpponent(base, pick(OPPONENT_NAMES));
  if (round === "Super Bowl") opp.power = clamp(opp.power + 1, 0, 99);
  return opp;
}

// --- matchup engine --------------------------------------------------------
const EDGE_DEFS: { key: string; label: string; get: (u: TeamProfile, o: Opponent) => number }[] = [
  { key: "passOff_vs_secondary", label: "Passing offense vs their secondary", get: (u, o) => u.passOff - o.secondary },
  { key: "oLine_vs_passRush", label: "Offensive line vs their pass rush", get: (u, o) => u.oLine - o.passRush },
  { key: "rushOff_vs_runDef", label: "Rushing offense vs their run defense", get: (u, o) => u.rushOff - o.runDef },
  { key: "secondary_vs_passOff", label: "Secondary vs their passing offense", get: (u, o) => u.secondary - o.passOff },
  { key: "passRush_vs_oLine", label: "Pass rush vs their offensive line", get: (u, o) => u.passRush - o.oLine },
  { key: "runDef_vs_rushOff", label: "Run defense vs their rushing offense", get: (u, o) => u.runDef - o.rushOff },
];

function matchupEdges(user: TeamProfile, opp: Opponent): { total: number; edges: MatchupEdge[] } {
  const edges: MatchupEdge[] = EDGE_DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    value: clamp(d.get(user, opp) * C.MATCHUP_SENSITIVITY, -C.MATCHUP_UNIT_CAP, C.MATCHUP_UNIT_CAP),
  }));
  const raw = edges.reduce((a, e) => a + e.value, 0);
  const total = clamp(raw, -C.MATCHUP_TOTAL_CAP, C.MATCHUP_TOTAL_CAP) * C.UPSET_FACTOR;
  return { total, edges };
}

// Extra power the user carries ONLY in the playoffs: stars, clutch and QB play
// punch above the regular-season average in January (and weak QBs drag it down).
function playoffBonus(user: TeamProfile): number {
  const bonus =
    user.starCount * C.STAR_POWER_PLAYOFF_BONUS +
    (user.clutch - 75) * C.CLUTCH_WEIGHT +
    (user.qb - 85) * C.PLAYOFF_QB_FACTOR;
  return clamp(bonus, C.PLAYOFF_BONUS_CLAMP[0], C.PLAYOFF_BONUS_CLAMP[1]);
}

interface WinProb {
  prob: number;
  diff: number;
  edges: MatchupEdge[];
}

// Quick "vs a league-average opponent" per-game win probability, used for the
// pre-simulation outlook on the score screen. Same scale as a regular-season
// game with a neutral matchup.
const AVERAGE_OPPONENT_POWER = 82;
export function baselineWinProb(power: number): number {
  const diff = power - AVERAGE_OPPONENT_POWER;
  const scale = C.ELO_SCALE + C.REGULAR_SEASON_RANDOMNESS;
  return clamp(1 / (1 + Math.pow(10, -diff / scale)), 0.02, 0.98);
}

function winProbability(
  user: TeamProfile,
  opp: Opponent,
  playoff: boolean,
  homeField: boolean
): WinProb {
  const { total, edges } = matchupEdges(user, opp);
  let diff = user.power - opp.power + total;
  if (homeField) diff += C.HOME_FIELD_ADVANTAGE;
  if (playoff) diff += playoffBonus(user);
  const scale = C.ELO_SCALE + (playoff ? C.PLAYOFF_RANDOMNESS : C.REGULAR_SEASON_RANDOMNESS);
  const prob = clamp(1 / (1 + Math.pow(10, -diff / scale)), 0.02, 0.98);
  return { prob, diff, edges };
}

// --- score / narrative -----------------------------------------------------
function makeScores(userWon: boolean, effDiff: number): [number, number] {
  const expected = clamp(Math.abs(effDiff) * 0.7, 1, 22);
  const margin = clamp(Math.round(expected + gaussian(0, 6)), 1, 38);
  const winnerScore = clamp(Math.round(20 + gaussian(0, 7)), 10, 45);
  const loserScore = clamp(winnerScore - margin, 0, winnerScore - 1);
  return userWon ? [winnerScore, loserScore] : [loserScore, winnerScore];
}

const FAVORITE_LOSS_MSG: Record<string, string> = {
  oLine_vs_passRush: "Your offensive line collapsed against a relentless pass rush.",
  secondary_vs_passOff: "Your secondary couldn't slow their passing attack.",
  runDef_vs_rushOff: "Their ground game wore down your front seven.",
  passOff_vs_secondary: "Their secondary smothered your receivers all day.",
  rushOff_vs_runDef: "You couldn't run the ball against a stout front.",
  passRush_vs_oLine: "You never got any pressure on their quarterback.",
};

const UNDERDOG_WIN_MSG: Record<string, string> = {
  passRush_vs_oLine: "Your pass rush took over and stole the game.",
  secondary_vs_passOff: "Your secondary locked down their passing attack.",
  runDef_vs_rushOff: "Your defense stuffed the run and controlled the game.",
  passOff_vs_secondary: "Your passing attack carved up their secondary.",
  rushOff_vs_runDef: "You imposed your will on the ground.",
  oLine_vs_passRush: "Your offensive line dominated the line of scrimmage.",
};

function gameNote(
  win: boolean,
  upset: boolean,
  playoff: boolean,
  edges: MatchupEdge[],
  profile: TeamProfile,
  margin: number
): string | null {
  if (upset) {
    const sorted = [...edges].sort((a, b) => a.value - b.value);
    if (!win) {
      if (profile.qb < 76)
        return "Your quarterback couldn't keep pace — turnovers changed the game.";
      return FAVORITE_LOSS_MSG[sorted[0].key] ?? "The matchup exposed a weakness on your roster.";
    }
    const best = sorted[sorted.length - 1];
    return (
      UNDERDOG_WIN_MSG[best.key] ??
      (profile.defense >= 86
        ? "Your defense carried you to an upset win."
        : "You found a way to win as the underdog.")
    );
  }
  if (playoff) {
    if (win) return margin >= 17 ? "A statement win." : margin <= 6 ? "Survived a nail-biter." : "Took care of business.";
    return margin <= 6 ? "Came up just short in a tight one." : "Outmatched when it mattered most.";
  }
  return null;
}

function playGame(
  round: string,
  opp: Opponent,
  profile: TeamProfile,
  playoff: boolean,
  homeField: boolean
): GameResult {
  const { prob, diff, edges } = winProbability(profile, opp, playoff, homeField);
  const win = Math.random() < prob;
  const [ourScore, oppScore] = makeScores(win, diff);
  const upset = win
    ? opp.power > profile.power + 2
    : profile.power > opp.power + 2;
  const note = gameNote(win, upset, playoff, edges, profile, Math.abs(ourScore - oppScore));
  return {
    round,
    opponent: opp.name,
    opponentPower: Math.round(opp.power),
    win,
    ourScore,
    oppScore,
    winProb: round1(prob * 100) / 100,
    homeField,
    upset,
    note,
    edges: edges.map((e) => ({ ...e, value: round1(e.value) })),
  };
}

// --- playoff seeding -------------------------------------------------------
function seedFor(wins: number): number {
  if (wins >= 14) return 1;
  if (wins === 13) return 2;
  if (wins === 12) return 3;
  if (wins === 11) return 4;
  if (wins === 10) return 5;
  if (wins === 9) return 6;
  return 7;
}

function playoffPath(seed: number): { round: string; homeField: boolean }[] {
  const path: { round: string; homeField: boolean }[] = [];
  if (seed > 2) path.push({ round: "Wild Card", homeField: seed <= 4 });
  path.push({ round: "Divisional Round", homeField: seed <= 2 });
  path.push({ round: "Conference Championship", homeField: seed === 1 });
  path.push({ round: "Super Bowl", homeField: false });
  return path;
}

const qualOdds = (wins: number) => C.PLAYOFF_QUALIFICATION_ODDS[wins] ?? 0;

// --- Monte-Carlo odds projection (debug) -----------------------------------
// Resamples whole seasons (fresh schedules each run) to estimate the roster's
// intrinsic odds, independent of the one schedule the player actually drew.
// Exported so balance can be checked offline (scripts/sim-check.ts).
export function projectOdds(profile: TeamProfile): SeasonOdds {
  const runs = C.PROJECTION_RUNS;
  let totalWins = 0;
  let madeCount = 0;
  let sbCount = 0;
  let perfectCount = 0;
  const winHist = new Array(18).fill(0);

  for (let r = 0; r < runs; r++) {
    const schedule = generateSchedule();
    let wins = 0;
    for (const opp of schedule) {
      if (Math.random() < winProbability(profile, opp, false, false).prob) wins++;
    }
    totalWins += wins;
    winHist[wins]++;
    const perfect = wins === 17;
    if (Math.random() < qualOdds(wins)) {
      madeCount++;
      let alive = true;
      for (const step of playoffPath(seedFor(wins))) {
        const opp = makePlayoffOpponent(step.round);
        if (Math.random() >= winProbability(profile, opp, true, step.homeField).prob) {
          alive = false;
          break;
        }
      }
      if (alive) {
        sbCount++;
        if (perfect) perfectCount++;
      }
    }
  }

  return {
    expectedWins: round1(totalWins / runs),
    playoffOdds: madeCount / runs,
    superBowlOdds: sbCount / runs,
    perfectOdds: perfectCount / runs,
    winDistribution: winHist.map((n) => n / runs),
  };
}

// --- ending classification -------------------------------------------------
function classifyEnding(args: {
  perfect: boolean;
  champion: boolean;
  madePlayoffs: boolean;
  wins: number;
  losses: number;
  power: number;
  playoffs: GameResult[];
  eliminatedRound: string | null;
}): { ending: Ending; title: string; subtitle: string } {
  const { perfect, champion, madePlayoffs, wins, losses, power, playoffs, eliminatedRound } = args;
  const reached = (name: string) => playoffs.some((g) => g.round === name);
  const lostFirst = madePlayoffs && playoffs.length >= 1 && !playoffs[0].win;
  const reachedDeep = reached("Conference Championship") || reached("Super Bowl");
  const playoffUpsetWins = playoffs.filter((g) => g.win && g.upset).length;
  const elite = power >= C.ELITE_POWER_THRESHOLD;
  const rec = `${wins}-${losses}`;

  if (perfect && champion)
    return {
      ending: "perfect",
      title: "Perfect Dynasty: 17-0 + Super Bowl Champions",
      subtitle: "A flawless 20-0 run to immortality. The greatest season ever assembled.",
    };
  if (perfect)
    return {
      ending: "ringless-perfect",
      title: "Perfect Regular Season, No Ring",
      subtitle: `17-0, then it all came apart in the ${eliminatedRound}. History will remember the collapse.`,
    };
  if (champion) {
    if (power < 86 || playoffUpsetWins >= 2)
      return {
        ending: "upset-champ",
        title: "Upset Champions",
        subtitle: `Not the most talented team in the field at ${rec}, but you caught fire and stole it all with ${playoffUpsetWins} postseason upset${playoffUpsetWins === 1 ? "" : "s"}.`,
      };
    return {
      ending: "champ-imperfect",
      title: "Super Bowl Champions, But Not Perfect",
      subtitle: `Finished ${rec}, then ran the table in January to win it all.`,
    };
  }
  if (elite && (!madePlayoffs || lostFirst))
    return {
      ending: "great-team-bad-ending",
      title: "Great Team, Bad Ending",
      subtitle: madePlayoffs
        ? `One of the best rosters you can build, bounced in the ${eliminatedRound}. A season wasted.`
        : `Elite on paper at ${rec}, yet somehow watching January from home. Brutal.`,
    };
  if (madePlayoffs && reachedDeep)
    return {
      ending: "deep-run",
      title: "Deep Playoff Run",
      subtitle: `A real contender at ${rec}, but the run ended in the ${eliminatedRound}.`,
    };
  if (madePlayoffs && lostFirst)
    return {
      ending: "one-and-done",
      title: "One-and-Done",
      subtitle: `Made the field at ${rec}, but a quick exit in the ${eliminatedRound}.`,
    };
  if (madePlayoffs)
    return {
      ending: "deep-run",
      title: "Deep Playoff Run",
      subtitle: `Won a round at ${rec} before falling in the ${eliminatedRound}.`,
    };
  if (wins <= 6)
    return {
      ending: "disappointing",
      title: "Disappointing Season",
      subtitle: `It never came together. ${rec} and out of the race early.`,
    };
  return {
    ending: "missed-playoffs",
    title: "Missed the Playoffs",
    subtitle: `Finished ${rec}. Close, but not enough to reach January.`,
  };
}

// --- result explanation ----------------------------------------------------
function explainResult(args: {
  ending: Ending;
  profile: TeamProfile;
  wins: number;
  losses: number;
  madePlayoffs: boolean;
  champion: boolean;
  playoffs: GameResult[];
  eliminatedRound: string | null;
}): ResultExplanation {
  const { ending, profile, wins, losses, madePlayoffs, champion, playoffs, eliminatedRound } = args;
  const reachedSB = playoffs.some((g) => g.round === "Super Bowl");
  const playoffUpsetWins = playoffs.filter((g) => g.win && g.upset).length;
  const strong = profile.bestUnit;
  const weak = profile.weakestUnit;
  const s = strong.name.toLowerCase();
  const w = weak.name.toLowerCase();

  const qbNote =
    profile.qb >= 90 ? "elite quarterback play" : profile.qb < 78 ? "shaky quarterback play" : "steady quarterback play";

  let summary: string;
  switch (ending) {
    case "perfect":
      summary = `A roster with no holes: your ${s} (${strong.rating}) overwhelmed everyone and ${qbNote} closed it out. Twenty wins, zero losses, immortality.`;
      break;
    case "ringless-perfect":
      summary = `Seventeen straight behind your ${s} (${strong.rating}) — but the single-elimination playoffs are a different game, and your ${w} (${weak.rating}) finally got exposed.`;
      break;
    case "upset-champ":
      summary = `You weren't the most talented team in the bracket, but your ${s} (${strong.rating}) peaked at the perfect time and you stole the title with ${playoffUpsetWins} postseason upset${playoffUpsetWins === 1 ? "" : "s"}.`;
      break;
    case "champ-imperfect":
      summary = `You dropped ${losses} along the way, but a balanced team led by your ${s} (${strong.rating}) got hot in January and finished the job.`;
      break;
    case "great-team-bad-ending":
      summary = madePlayoffs
        ? `On paper one of the best rosters you can draft (power ${profile.power}), but a cold night and your ${w} (${weak.rating}) ended it early. The talent deserved better.`
        : `Loaded on paper (power ${profile.power}), yet your ${w} (${weak.rating}) and a few bad bounces cost you a January berth entirely.`;
      break;
    case "deep-run":
      summary = `A genuine contender carried by your ${s} (${strong.rating}), but your ${w} (${weak.rating}) came up a step short of a ring.`;
      break;
    case "one-and-done":
      summary = `You made the field, but ${qbNote} and a thin ${w} (${weak.rating}) meant a quick postseason exit.`;
      break;
    case "missed-playoffs":
      summary = `A middling ${wins}-${losses}: your ${s} (${strong.rating}) kept you competitive, but your ${w} (${weak.rating}) cost you too many games to reach January.`;
      break;
    default:
      summary = `It never clicked. Your ${w} (${weak.rating}) was a weekly liability and the roster simply wasn't deep enough.`;
  }

  const playoffResult = !madePlayoffs
    ? "Did not qualify for the playoffs."
    : champion
    ? "Won the Super Bowl."
    : `Eliminated in the ${eliminatedRound}.`;

  const superBowlResult = champion
    ? "Super Bowl Champions."
    : reachedSB
    ? "Lost in the Super Bowl."
    : "Did not reach the Super Bowl.";

  return {
    summary,
    offense: profile.offense,
    defense: profile.defense,
    bestUnit: strong,
    weakestUnit: weak,
    bestPlayer: profile.bestPlayer,
    biggestWeakness: profile.biggestWeakness,
    playoffResult,
    superBowlResult,
  };
}

// --- top-level entry point -------------------------------------------------
export function simulateSeason(profile: TeamProfile): SimulationResult {
  const schedule = generateSchedule();
  const regularSeason = schedule.map((opp) => playGame("Regular Season", opp, profile, false, false));

  const wins = regularSeason.filter((g) => g.win).length;
  const losses = 17 - wins;
  const perfectRegularSeason = wins === 17;

  const madePlayoffs = Math.random() < qualOdds(wins);
  const playoffs: GameResult[] = [];
  let superBowlChampion = false;
  let eliminatedRound: string | null = null;
  let seed: number | null = null;

  if (madePlayoffs) {
    seed = seedFor(wins);
    let alive = true;
    for (const step of playoffPath(seed)) {
      const opp = makePlayoffOpponent(step.round);
      const g = playGame(step.round, opp, profile, true, step.homeField);
      playoffs.push(g);
      if (!g.win) {
        alive = false;
        eliminatedRound = step.round;
        break;
      }
    }
    superBowlChampion = alive;
  } else {
    eliminatedRound = "Missed Playoffs";
  }

  const { ending, title, subtitle } = classifyEnding({
    perfect: perfectRegularSeason,
    champion: superBowlChampion,
    madePlayoffs,
    wins,
    losses,
    power: profile.power,
    playoffs,
    eliminatedRound,
  });

  const explanation = explainResult({
    ending,
    profile,
    wins,
    losses,
    madePlayoffs,
    champion: superBowlChampion,
    playoffs,
    eliminatedRound,
  });

  const odds = projectOdds(profile);

  return {
    wins,
    losses,
    perfectRegularSeason,
    madePlayoffs,
    superBowlChampion,
    seed,
    teamPower: profile.power,
    regularSeason,
    playoffs,
    eliminatedRound,
    ending,
    endingTitle: title,
    endingSubtitle: subtitle,
    profile,
    explanation,
    odds,
  };
}
