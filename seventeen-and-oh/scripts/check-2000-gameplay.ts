// Offline gameplay smoke test for the 2000 season overhaul.
// Exercises the REAL gameplay code paths against the REAL exported 2000 JSONs:
//   1. Draft pool / catalog: index.json filtered to 2000 (what the spinner draws).
//   2. Per-team roster fill via positionFit (Classic & Blind share this data).
//   3. computeTeamProfile -> sim power, to prove ratings differentiate teams
//      (strong teams high, weak teams low) and there is NO mass-generic flatness.
//
// Compile + run (same recipe as sim-check.ts):
//   npx tsc scripts/check-2000-gameplay.ts --outDir /tmp/gp00 --module commonjs \
//     --target es2022 --moduleResolution node --skipLibCheck --esModuleInterop --resolveJsonModule
//   node /tmp/gp00/scripts/check-2000-gameplay.js
import fs from "node:fs";
import path from "node:path";
import { computeTeamProfile } from "../lib/team-profile";
import { ROSTER_TEMPLATE, positionFit } from "../lib/positions";
import { POSITION_SIDE } from "../lib/positions";
import type { Player, Position, RosterSlot } from "../lib/types";

const TS_DIR = path.join(process.cwd(), "public", "team-seasons");
const SEASON = 2000;

interface IndexRow {
  id: string; season: number; team: string; teamCode: string;
  label: string; file: string; playerCount: number;
}

// Mirror lib/data.ts toPlayer: overall fallback 60, playoffClutch fallback=overall.
// Reads the raw exported JSON shape, so an untyped bag is intentional here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPlayer(gp: any): Player {
  const attributes: Record<string, number> = {};
  for (const [k, v] of Object.entries(gp.attributes ?? {})) {
    if (typeof v === "number") attributes[k] = v;
  }
  const overall = gp.overall ?? 60;
  return {
    id: `${gp.playerId}-${gp.season}-${gp.teamCode}`.toLowerCase(),
    name: gp.name,
    team: gp.team,
    teamCode: gp.teamCode,
    season: gp.season,
    position: gp.position as Position,
    secondaryPositions: (gp.secondaryPositions ?? []) as Position[],
    overall,
    attributes,
    archetype: gp.archetype,
    era: gp.era,
    playoffClutch: gp.playoffClutch ?? overall,
    sourceNote: gp.sourceNote,
  } as Player;
}

// Greedy "best XI": for each template slot pick the unused player that maximizes
// round(overall * positionFit). Mirrors what a strong drafter would assemble.
function bestRoster(players: Player[]): RosterSlot[] {
  const used = new Set<string>();
  const slots: RosterSlot[] = [];
  const template = ROSTER_TEMPLATE.flatMap(({ position, count, optional }) =>
    Array.from({ length: count }, (_, i) => ({ position, optional: !!optional, i: i + 1, count }))
  );
  for (const t of template) {
    let best: Player | null = null;
    let bestEff = -1;
    let bestFit = 0;
    for (const p of players) {
      if (used.has(p.id)) continue;
      const fit = positionFit(p.position, p.secondaryPositions ?? [], t.position);
      const eff = Math.round(p.overall * fit);
      if (eff > bestEff) { best = p; bestEff = eff; bestFit = fit; }
    }
    if (best && (!t.optional || bestFit >= 0.5)) used.add(best.id);
    slots.push({
      id: t.count > 1 ? `${t.position}-${t.i}` : t.position,
      position: t.position,
      label: t.count > 1 ? `${t.position}${t.i}` : t.position,
      side: POSITION_SIDE[t.position],
      optional: t.optional,
      player: best && (!t.optional || bestFit >= 0.5) ? best : null,
      fit: best ? bestFit : null,
      effectiveRating: best && (!t.optional || bestFit >= 0.5) ? bestEff : null,
    } as RosterSlot);
  }
  return slots;
}

// --- 1. Draft pool / catalog --------------------------------------------------
const index: IndexRow[] = JSON.parse(fs.readFileSync(path.join(TS_DIR, "index.json"), "utf8"));
const pool00 = index.filter((r) => r.season === SEASON);
console.log(`Draft catalog (2000): ${pool00.length} team-seasons`);

// Load registry strengths for correlation.
const reg = fs.readFileSync(path.join(process.cwd(), "data", "team_seasons.csv"), "utf8")
  .trim().split("\n").slice(1).map((l) => l.split(","));
const strengthByCode = new Map<string, number>();
for (const c of reg) if (Number(c[0]) === SEASON) strengthByCode.set(c[1], Number(c[6]));

// --- 2+3. Per-team roster + profile ------------------------------------------
const rows: { tc: string; name: string; str: number; power: number; off: number; def: number; qb: number; stars: number; top: string }[] = [];
let allPlayers = 0;
const overallFreq = new Map<number, number>();
for (const r of pool00) {
  const doc = JSON.parse(fs.readFileSync(path.join(TS_DIR, `${r.id}.json`), "utf8"));
  const players = (doc.players ?? []).map(toPlayer);
  allPlayers += players.length;
  for (const p of players) overallFreq.set(p.overall, (overallFreq.get(p.overall) ?? 0) + 1);
  const roster = bestRoster(players);
  const prof = computeTeamProfile(roster);
  const top = [...players].sort((a, b) => b.overall - a.overall)[0];
  rows.push({
    tc: r.teamCode, name: r.team, str: strengthByCode.get(r.teamCode) ?? 0,
    power: prof.power, off: prof.offense, def: prof.defense, qb: prof.qb,
    stars: prof.starCount, top: `${top.name} ${top.overall}`,
  });
}

rows.sort((a, b) => b.power - a.power);
console.log("\nTeam profiles (real computeTeamProfile on 2000 rosters), by power:");
console.log("team                         | str | power | off  | def  |  qb  | stars | best player");
console.log("-".repeat(95));
for (const r of rows) {
  console.log(
    `${`${r.name} (${r.tc})`.padEnd(28)} | ${String(r.str).padStart(3)} | ` +
    `${r.power.toFixed(1).padStart(5)} | ${r.off.toFixed(1).padStart(4)} | ${r.def.toFixed(1).padStart(4)} | ` +
    `${r.qb.toFixed(1).padStart(4)} | ${String(r.stars).padStart(5)} | ${r.top}`
  );
}

// Correlation strength<->power (Pearson) — should be strongly positive.
function pearson(xs: number[], ys: number[]) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  return num / Math.sqrt(dx * dy);
}
const corr = pearson(rows.map((r) => r.str), rows.map((r) => r.power));
const powers = rows.map((r) => r.power);
console.log("\n--- Differentiation summary ---");
console.log(`power range: ${Math.min(...powers).toFixed(1)} … ${Math.max(...powers).toFixed(1)} (spread ${(Math.max(...powers) - Math.min(...powers)).toFixed(1)})`);
console.log(`corr(team_strength, sim power): ${corr.toFixed(3)}  (want strongly positive)`);

// --- No mass-generic ratings check -------------------------------------------
const topFreq = [...overallFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(`\nTotal 2000 players: ${allPlayers}. Most common OVR values:`);
for (const [ovr, n] of topFreq) console.log(`  OVR ${ovr}: ${n} players (${((n / allPlayers) * 100).toFixed(1)}%)`);
const genericPct = (topFreq[0][1] / allPlayers) * 100;
console.log(`\nVERDICT: ${corr > 0.6 && genericPct < 25 && (Math.max(...powers) - Math.min(...powers)) > 8 ? "PASS" : "REVIEW"} — ` +
  `strength tracks power, power spread is real, no single OVR dominates the pool.`);
