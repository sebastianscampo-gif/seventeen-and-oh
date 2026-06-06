import { Ending, GameResult, ScoreBreakdown, SimulationResult } from "./types";

const OPPONENTS = [
  "Dallas Cowboys", "Green Bay Packers", "Pittsburgh Steelers", "Buffalo Bills",
  "Philadelphia Eagles", "Denver Broncos", "Miami Dolphins", "Minnesota Vikings",
  "Detroit Lions", "Cincinnati Bengals", "Cleveland Browns", "Las Vegas Raiders",
  "Los Angeles Chargers", "Houston Texans", "Jacksonville Jaguars", "Tennessee Titans",
  "New York Giants", "Washington Commanders", "Atlanta Falcons", "Carolina Panthers",
  "New Orleans Saints", "Arizona Cardinals", "Indianapolis Colts", "New York Jets",
];

const PLAYOFF_ROUNDS = ["Divisional Round", "Conference Championship", "Super Bowl"];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Maps the 0..100 team score onto a per-game win probability.
// Only a truly stacked roster realistically threatens 17-0.
export function perGameWinProb(total: number): number {
  return clamp(0.5 + (total - 70) / 52, 0.32, 0.955);
}

function makeScores(win: boolean): [number, number] {
  const our = 13 + Math.floor(Math.random() * 25); // 13..37
  let opp = 10 + Math.floor(Math.random() * 24); // 10..33
  if (win) {
    if (opp >= our) opp = Math.max(3, our - (3 + Math.floor(Math.random() * 10)));
  } else if (opp <= our) {
    opp = our + (3 + Math.floor(Math.random() * 10));
  }
  return [our, opp];
}

function playGame(round: string, opponent: string, pWin: number): GameResult {
  const win = Math.random() < pWin;
  const [ourScore, oppScore] = makeScores(win);
  return { round, opponent, win, ourScore, oppScore };
}

export function simulateSeason(score: ScoreBreakdown): SimulationResult {
  const pWin = perGameWinProb(score.total);

  const schedule = shuffle(OPPONENTS).slice(0, 17);
  const regularSeason = schedule.map((o) => playGame("Regular Season", o, pWin));

  const wins = regularSeason.filter((g) => g.win).length;
  const losses = 17 - wins;
  const perfectRegularSeason = wins === 17;
  const madePlayoffs = perfectRegularSeason || wins >= 10;

  const playoffs: GameResult[] = [];
  let superBowlChampion = false;
  let eliminatedRound: string | null = null;

  if (madePlayoffs) {
    const playoffPWin = clamp(pWin - 0.05 + (score.star - 75) / 300, 0.3, 0.93);
    let alive = true;
    for (const r of PLAYOFF_ROUNDS) {
      const g = playGame(r, pick(OPPONENTS), playoffPWin);
      playoffs.push(g);
      if (!g.win) {
        alive = false;
        eliminatedRound = r;
        break;
      }
    }
    superBowlChampion = alive;
  } else {
    eliminatedRound = "Missed Playoffs";
  }

  let ending: Ending;
  let endingTitle: string;
  let endingSubtitle: string;

  if (perfectRegularSeason && superBowlChampion) {
    ending = "perfect";
    endingTitle = "Perfect Season Complete: 17-0 + Super Bowl Champions";
    endingSubtitle = "The ultimate ending. A flawless 20-0 run to immortality.";
  } else if (perfectRegularSeason) {
    ending = "ringless-perfect";
    endingTitle = "Perfect Regular Season, But No Ring";
    endingSubtitle = `17-0 in the regular season, then eliminated in the ${eliminatedRound}.`;
  } else if (superBowlChampion) {
    ending = "champ-imperfect";
    endingTitle = "Super Bowl Champions, But Not Perfect";
    endingSubtitle = `Finished ${wins}-${losses}, then ran the table to win it all.`;
  } else if (madePlayoffs) {
    ending = "playoff-loss";
    endingTitle = "Playoff Run Ends — No Ring";
    endingSubtitle = `Finished ${wins}-${losses}, eliminated in the ${eliminatedRound}.`;
  } else {
    ending = "missed-playoffs";
    endingTitle = "Season Over — Missed the Playoffs";
    endingSubtitle = `Finished ${wins}-${losses}. Not enough to reach January.`;
  }

  return {
    wins,
    losses,
    perfectRegularSeason,
    madePlayoffs,
    superBowlChampion,
    regularSeason,
    playoffs,
    eliminatedRound,
    ending,
    endingTitle,
    endingSubtitle,
    perGameWinProb: pWin,
  };
}
