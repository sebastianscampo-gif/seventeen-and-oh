"use client";
import { GameMode } from "@/lib/types";

export default function StartScreen({
  onStart,
}: {
  onStart: (mode: GameMode) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 py-12 text-center">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white/50 ring-1 ring-white/10">
        NFL Historical Draft
      </div>
      <h1 className="bg-gradient-to-b from-white to-white/50 bg-clip-text text-7xl font-black tracking-tighter text-transparent sm:text-8xl">
        17-0
      </h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">
        Draft one player at a time from legendary NFL team-seasons. Build a full
        24-man roster, then chase a flawless regular season and a Super Bowl
        ring.
      </p>

      <div className="mt-10 grid w-full gap-3 sm:grid-cols-2">
        <button
          onClick={() => onStart("classic")}
          className="group rounded-2xl bg-white/5 p-5 text-left ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-white/25"
        >
          <div className="text-lg font-bold text-white">Classic</div>
          <p className="mt-1 text-sm text-white/55">
            See overalls, key attributes, and position fit before every pick.
          </p>
          <div className="mt-3 text-sm font-semibold text-emerald-300 opacity-0 transition group-hover:opacity-100">
            Start drafting →
          </div>
        </button>

        <button
          onClick={() => onStart("blind")}
          className="group rounded-2xl bg-white/5 p-5 text-left ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-white/25"
        >
          <div className="text-lg font-bold text-white">Blind</div>
          <p className="mt-1 text-sm text-white/55">
            Names and positions only — ratings stay hidden. Trust your NFL
            knowledge.
          </p>
          <div className="mt-3 text-sm font-semibold text-sky-300 opacity-0 transition group-hover:opacity-100">
            Start drafting →
          </div>
        </button>
      </div>

      <p className="mt-8 text-xs text-white/30">
        Goal: 17-0 in the regular season, run the playoffs, win the Super Bowl.
      </p>
    </div>
  );
}
