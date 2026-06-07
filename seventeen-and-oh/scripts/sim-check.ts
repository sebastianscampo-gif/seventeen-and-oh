// Offline calibration harness for the season simulator. Builds synthetic
// balanced rosters at a range of power levels and prints the resulting win
// distribution + playoff / Super Bowl / perfect-season odds so balance can be
// tuned against the target ranges in the spec.
//
// Compile + run:
//   npx tsc scripts/sim-check.ts --outDir /tmp/simcheck --module commonjs \
//     --target es2022 --moduleResolution node --skipLibCheck --esModuleInterop
//   node /tmp/simcheck/scripts/sim-check.js
import { projectOdds, simulateSeason } from "../lib/simulation";
import type { Ending, Position, TeamProfile, UnitRating } from "../lib/types";

function makeProfile(power: number, overrides: Partial<TeamProfile> = {}): TeamProfile {
  const units: UnitRating[] = [
    { key: "qb", name: "Quarterback", rating: power },
    { key: "passOff", name: "Passing offense", rating: power },
    { key: "rushOff", name: "Rushing offense", rating: power },
    { key: "oLine", name: "Offensive line", rating: power },
    { key: "receivers", name: "Receivers", rating: power },
    { key: "passRush", name: "Pass rush", rating: power },
    { key: "runDef", name: "Run defense", rating: power },
    { key: "linebackers", name: "Linebackers", rating: power },
    { key: "secondary", name: "Secondary", rating: power },
  ];
  const starCount = Math.round(Math.max(0, Math.min(12, (power - 87) * 1.0)));
  const clutch = 75 + (power - 85) * 0.5;
  return {
    power,
    offense: power,
    defense: power,
    qb: power,
    passOff: power,
    rushOff: power,
    oLine: power,
    passRush: power,
    runDef: power,
    secondary: power,
    linebackers: power,
    receivers: power,
    specialTeams: power,
    starCount,
    clutch,
    units,
    bestUnit: units[0],
    weakestUnit: units[units.length - 1],
    bestPlayer: { name: "Star", position: "QB" as Position, rating: power },
    biggestWeakness: { name: "Weak", position: "S" as Position, rating: power },
    ...overrides,
  };
}

function pctRange(dist: number[]): [number, number] {
  let cum = 0;
  let p10 = 0;
  let p90 = 17;
  let set10 = false;
  for (let w = 0; w < dist.length; w++) {
    cum += dist[w];
    if (!set10 && cum >= 0.1) {
      p10 = w;
      set10 = true;
    }
    if (cum >= 0.9) {
      p90 = w;
      break;
    }
  }
  return [p10, p90];
}

function report(label: string, profile: TeamProfile) {
  const o = projectOdds(profile);
  const [lo, hi] = pctRange(o.winDistribution);
  console.log(
    `${label.padEnd(22)} | ${o.expectedWins.toFixed(1).padStart(5)} | ` +
      `${`${lo}-${hi}`.padStart(7)} | ${(o.playoffOdds * 100).toFixed(0).padStart(4)}% | ` +
      `${(o.superBowlOdds * 100).toFixed(1).padStart(5)}% | ${(o.perfectOdds * 100).toFixed(2).padStart(5)}%`
  );
}

console.log("Balanced rosters by power level:");
console.log("team                   | E[W] | 10-90% | PO   |  SB   | 17-0+ring");
console.log("-".repeat(70));
for (const p of [78, 80, 82, 85, 88, 90, 93, 96, 98, 100]) {
  report(`power ${p}`, makeProfile(p));
}

console.log("\nLopsided rosters (matchup-sensitivity check):");
console.log("team                   | E[W] | 10-90% | PO   |  SB   | 17-0+ring");
console.log("-".repeat(70));
// Great offense, leaky secondary — should win shootouts but be upset-prone.
report("90 off / 80 secondary", makeProfile(88, { secondary: 80, passOff: 95, offense: 92 }));
// Elite defense, average offense — steady, dangerous in playoffs.
report("95 def / 84 offense", makeProfile(89, { defense: 95, passRush: 95, secondary: 93, qb: 84, offense: 84 }));
// Strong team but a weak QB — should sag in the playoffs.
report("92 power / 74 QB", makeProfile(92, { qb: 74 }));

// --- Ending variety + a sample full result -------------------------------
function endingTally(power: number, runs: number) {
  const counts: Record<string, number> = {};
  let upsetNotes = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulateSeason(makeProfile(power));
    counts[r.ending] = (counts[r.ending] ?? 0) + 1;
    upsetNotes += [...r.regularSeason, ...r.playoffs].filter((g) => g.upset && g.note).length;
  }
  const order: Ending[] = [
    "perfect", "ringless-perfect", "upset-champ", "champ-imperfect",
    "great-team-bad-ending", "deep-run", "one-and-done", "missed-playoffs", "disappointing",
  ];
  console.log(`\npower ${power} — ${runs} seasons, ending distribution:`);
  for (const e of order) {
    if (counts[e]) console.log(`  ${e.padEnd(22)} ${((counts[e] / runs) * 100).toFixed(1)}%`);
  }
  console.log(`  (every upset carried an explanation: ${upsetNotes} upset notes across the run)`);
}

console.log("\n" + "=".repeat(70));
endingTally(88, 250);
endingTally(96, 200);
endingTally(80, 200);

// One full sample to eyeball the narrative end to end.
console.log("\n" + "=".repeat(70));
console.log("Sample full result (power 89):");
const sample = simulateSeason(makeProfile(89));
console.log(`  Record: ${sample.wins}-${sample.losses} | ending: ${sample.ending}`);
console.log(`  Title:  ${sample.endingTitle}`);
console.log(`  Sub:    ${sample.endingSubtitle}`);
console.log(`  Why:    ${sample.explanation.summary}`);
console.log(`  Playoffs: ${sample.explanation.playoffResult} | ${sample.explanation.superBowlResult}`);
const notable = [...sample.regularSeason, ...sample.playoffs].filter((g) => g.note).slice(0, 4);
for (const g of notable) {
  console.log(`  ${g.round} ${g.win ? "W" : "L"} ${g.ourScore}-${g.oppScore} vs ${g.opponent} (${pct(g.winProb)}): ${g.note}`);
}
function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
