"use client";
import { Ending, GameResult, SimulationResult } from "@/lib/types";

const ENDING_STYLE: Record<Ending, { ring: string; glow: string }> = {
  perfect: { ring: "ring-amber-400/50", glow: "from-amber-400/25" },
  "ringless-perfect": { ring: "ring-sky-400/40", glow: "from-sky-400/20" },
  "champ-imperfect": { ring: "ring-emerald-400/40", glow: "from-emerald-400/20" },
  "playoff-loss": { ring: "ring-white/15", glow: "from-white/10" },
  "missed-playoffs": { ring: "ring-rose-400/30", glow: "from-rose-400/15" },
};

function GameRow({ g }: { g: GameResult }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm ring-1 ring-white/5">
      <span
        className={`w-6 shrink-0 text-center font-black ${
          g.win ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        {g.win ? "W" : "L"}
      </span>
      <span className="flex-1 truncate text-white/80">{g.opponent}</span>
      <span className="font-mono text-white/60">
        {g.ourScore}–{g.oppScore}
      </span>
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
  const style = ENDING_STYLE[sim.ending];
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div
        className={`relative overflow-hidden rounded-2xl bg-white/[0.04] p-6 text-center ring-1 ${style.ring}`}
      >
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b ${style.glow} to-transparent`}
        />
        <div className="relative">
          <div className="text-5xl font-black tracking-tighter text-white sm:text-6xl">
            {sim.wins}-{sim.losses}
          </div>
          <h2 className="mt-3 text-xl font-bold text-white sm:text-2xl">
            {sim.endingTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-white/60">
            {sim.endingSubtitle}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            Regular Season ({sim.wins}-{sim.losses})
          </h3>
          <div className="space-y-1">
            {sim.regularSeason.map((g, i) => (
              <GameRow key={i} g={g} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            Postseason
          </h3>
          {sim.playoffs.length > 0 ? (
            <div className="space-y-2">
              {sim.playoffs.map((g, i) => (
                <div key={i}>
                  <div className="mb-0.5 text-[11px] font-medium text-white/40">
                    {g.round}
                  </div>
                  <GameRow g={g} />
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
