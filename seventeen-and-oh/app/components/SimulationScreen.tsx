"use client";
import { useState } from "react";
import { Ending, GameResult, SeasonOdds, SimulationResult } from "@/lib/types";
import { SIM_CONFIG } from "@/lib/sim-config";

const ENDING_STYLE: Record<Ending, { ring: string; glow: string; accent: string; badge: string }> = {
  perfect: { ring: "ring-amber-400/50", glow: "from-amber-400/25", accent: "text-amber-300", badge: "Immortal" },
  "ringless-perfect": { ring: "ring-sky-400/40", glow: "from-sky-400/20", accent: "text-sky-300", badge: "17-0, no ring" },
  "upset-champ": { ring: "ring-fuchsia-400/45", glow: "from-fuchsia-400/20", accent: "text-fuchsia-300", badge: "Cinderella" },
  "champ-imperfect": { ring: "ring-emerald-400/45", glow: "from-emerald-400/20", accent: "text-emerald-300", badge: "Champions" },
  "great-team-bad-ending": { ring: "ring-orange-400/40", glow: "from-orange-400/20", accent: "text-orange-300", badge: "Collapse" },
  "deep-run": { ring: "ring-indigo-400/40", glow: "from-indigo-400/20", accent: "text-indigo-300", badge: "Contender" },
  "one-and-done": { ring: "ring-white/20", glow: "from-white/10", accent: "text-white/70", badge: "Quick exit" },
  "missed-playoffs": { ring: "ring-rose-400/30", glow: "from-rose-400/15", accent: "text-rose-300", badge: "No January" },
  disappointing: { ring: "ring-red-500/30", glow: "from-red-500/15", accent: "text-red-300", badge: "Rebuild" },
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const pct1 = (n: number) => `${(n * 100).toFixed(n < 0.01 ? 2 : 1)}%`;

function ratingTone(r: number): string {
  if (r >= 90) return "text-emerald-300";
  if (r >= 84) return "text-lime-300";
  if (r >= 78) return "text-amber-300";
  return "text-rose-300";
}

function GameRow({ g, debug }: { g: GameResult; debug: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/5">
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
        <span className={`w-5 shrink-0 text-center font-black ${g.win ? "text-emerald-400" : "text-rose-400"}`}>
          {g.win ? "W" : "L"}
        </span>
        <span className="flex flex-1 items-center gap-1.5 truncate text-white/80">
          <span className="truncate">{g.opponent}</span>
          {g.homeField && <span className="text-[10px] text-white/30" title="Home field">(H)</span>}
          {g.upset && (
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${g.win ? "bg-fuchsia-500/20 text-fuchsia-300" : "bg-rose-500/20 text-rose-300"}`}>
              {g.win ? "Upset" : "Upset L"}
            </span>
          )}
        </span>
        {debug && (
          <span className="shrink-0 font-mono text-[11px] text-sky-300/80" title="Pre-game win probability">
            {pct(g.winProb)}
          </span>
        )}
        <span className="shrink-0 font-mono text-white/55">
          {g.ourScore}–{g.oppScore}
        </span>
      </div>
      {g.note && (
        <div className="border-t border-white/5 px-3 py-1.5 text-[11px] italic text-white/45">{g.note}</div>
      )}
    </div>
  );
}

function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-bold ${tone ?? "text-white/85"}`}>{value}</div>
      {sub && <div className="truncate text-[11px] text-white/40">{sub}</div>}
    </div>
  );
}

function OddsPanel({ odds, actualWins }: { odds: SeasonOdds; actualWins: number }) {
  const maxBar = Math.max(...odds.winDistribution, 0.001);
  return (
    <div className="mt-3 rounded-xl bg-sky-500/[0.06] p-4 ring-1 ring-sky-400/20">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
          Debug
        </span>
        <span className="text-xs text-white/50">
          True odds for this roster over {SIM_CONFIG.PROJECTION_RUNS.toLocaleString()} simulated seasons
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Expected wins" value={odds.expectedWins.toFixed(1)} />
        <StatTile label="Make playoffs" value={pct1(odds.playoffOdds)} tone="text-sky-300" />
        <StatTile label="Win Super Bowl" value={pct1(odds.superBowlOdds)} tone="text-emerald-300" />
        <StatTile label="17-0 + ring" value={pct1(odds.perfectOdds)} tone="text-amber-300" />
      </div>
      <div className="mt-4">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
          Final-record distribution (probability of each win total)
        </div>
        <div className="flex items-end gap-[3px]" style={{ height: 72 }}>
          {odds.winDistribution.map((p, w) => (
            <div key={w} className="flex flex-1 flex-col items-center justify-end" title={`${w} wins: ${pct1(p)}`}>
              <div
                className={`w-full rounded-t ${w === actualWins ? "bg-sky-300" : "bg-sky-400/30"}`}
                style={{ height: `${Math.max(2, (p / maxBar) * 60)}px` }}
              />
              <div className={`mt-1 text-[8px] ${w === actualWins ? "font-bold text-sky-200" : "text-white/30"}`}>{w}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SimulationScreen({
  sim,
  onRestart,
}: {
  sim: SimulationResult;
  onRestart: () => void;
}) {
  const [debug, setDebug] = useState(false);
  const style = ENDING_STYLE[sim.ending];
  const ex = sim.explanation;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      {/* Hero */}
      <div className={`relative overflow-hidden rounded-2xl bg-white/[0.04] p-6 text-center ring-1 ${style.ring}`}>
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b ${style.glow} to-transparent`} />
        <div className="relative">
          <div className={`mb-2 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ${style.ring} ${style.accent}`}>
            {style.badge}
          </div>
          <div className="text-5xl font-black tracking-tighter text-white sm:text-6xl">
            {sim.wins}-{sim.losses}
          </div>
          <h2 className={`mt-3 text-xl font-bold sm:text-2xl ${style.accent}`}>{sim.endingTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/60">{sim.endingSubtitle}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/40">
            <span>Team power <b className="text-white/70">{sim.teamPower.toFixed(1)}</b></span>
            {sim.seed && <span>Playoff seed <b className="text-white/70">#{sim.seed}</b></span>}
            <span>{ex.superBowlResult}</span>
          </div>
        </div>
      </div>

      {/* Why this happened */}
      <div className="mt-5 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Why it happened</h3>
        <p className="text-sm leading-relaxed text-white/75">{ex.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Offense" value={ex.offense.toFixed(1)} tone={ratingTone(ex.offense)} />
          <StatTile label="Defense" value={ex.defense.toFixed(1)} tone={ratingTone(ex.defense)} />
          <StatTile label="Best unit" value={ex.bestUnit.name} sub={`Rated ${ex.bestUnit.rating}`} tone="text-emerald-300" />
          <StatTile label="Weakest unit" value={ex.weakestUnit.name} sub={`Rated ${ex.weakestUnit.rating}`} tone="text-rose-300" />
          <StatTile label="Biggest star" value={ex.bestPlayer.name} sub={`${ex.bestPlayer.position} • ${ex.bestPlayer.rating}`} tone="text-amber-300" />
          <StatTile label="Weak link" value={ex.biggestWeakness.name} sub={`${ex.biggestWeakness.position} • ${ex.biggestWeakness.rating}`} tone="text-rose-300" />
          <StatTile label="Playoffs" value={ex.playoffResult} />
          <StatTile label="Super Bowl" value={ex.superBowlResult} />
        </div>
      </div>

      {/* Debug toggle */}
      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Game log</h3>
        <button
          onClick={() => setDebug((d) => !d)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition ${
            debug ? "bg-sky-500/20 text-sky-200 ring-sky-400/30" : "bg-white/[0.04] text-white/50 ring-white/10 hover:text-white/80"
          }`}
        >
          {debug ? "Hide odds" : "Show odds (debug)"}
        </button>
      </div>

      {debug && <OddsPanel odds={sim.odds} actualWins={sim.wins} />}

      {/* Game logs */}
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">
            Regular Season ({sim.wins}-{sim.losses})
          </h4>
          <div className="space-y-1">
            {sim.regularSeason.map((g, i) => (
              <GameRow key={i} g={g} debug={debug} />
            ))}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">Postseason</h4>
          {sim.playoffs.length > 0 ? (
            <div className="space-y-2">
              {sim.playoffs.map((g, i) => (
                <div key={i}>
                  <div className="mb-0.5 text-[11px] font-medium text-white/40">{g.round}</div>
                  <GameRow g={g} debug={debug} />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-white/[0.03] px-3 py-4 text-center text-sm text-white/40 ring-1 ring-white/5">
              Missed the playoffs.
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={onRestart}
          className="rounded-xl bg-white px-6 py-3 font-bold text-black transition hover:bg-white/90"
        >
          Draft again
        </button>
      </div>
    </div>
  );
}
