"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import { GameMode } from "@/lib/types";
import type { TeamSeasonSummary } from "@/lib/data";
import {
  getAvailableYears,
  getTeamSeasonsByYearRange,
  type TimelineRange,
} from "@/lib/timeline";
import RosterTimelineFilter from "./RosterTimelineFilter";

export default function StartScreen({
  catalog,
  onStart,
}: {
  catalog: TeamSeasonSummary[];
  onStart: (mode: GameMode, range: TimelineRange) => void;
}) {
  const [mode, setMode] = useState<GameMode>("classic");
  const [range, setRange] = useState<TimelineRange | null>(null);

  const availableYears = useMemo(() => getAvailableYears(catalog), [catalog]);
  const ready = availableYears.length > 0;

  // The full-range default is derived from data, applied lazily once the
  // catalog has loaded. Until the user touches the timeline, "All" is implied.
  const effectiveRange: TimelineRange = useMemo(() => {
    if (range) return range;
    if (!ready) return { startYear: 0, endYear: 0 };
    return {
      startYear: availableYears[0],
      endYear: availableYears[availableYears.length - 1],
    };
  }, [range, ready, availableYears]);

  const selectedCount = useMemo(
    () =>
      ready
        ? getTeamSeasonsByYearRange(
            catalog,
            effectiveRange.startYear,
            effectiveRange.endYear
          ).length
        : 0,
    [catalog, ready, effectiveRange]
  );

  const canStart = ready && selectedCount > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-5 py-10">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white/50 ring-1 ring-white/10">
        NFL Historical Draft
      </div>
      <Image
        src="/logo.png"
        alt="17-0"
        width={640}
        height={593}
        priority
        className="h-auto w-60 drop-shadow-[0_12px_44px_rgba(56,189,248,0.22)] sm:w-72"
      />
      <p className="mt-5 max-w-md text-center text-base leading-relaxed text-white/60">
        Draft one player at a time from legendary NFL team-seasons. Build a full
        24-man roster, then chase a flawless regular season and a Super Bowl
        ring.
      </p>

      {/* Step 1 — mode */}
      <section className="mt-9 w-full">
        <StepLabel n={1} text="Choose your mode" />
        <div className="mt-3 grid w-full gap-3 sm:grid-cols-2">
          <ModeCard
            title="Classic"
            blurb="See overalls, key attributes, and position fit before every pick."
            accent="text-emerald-300"
            selected={mode === "classic"}
            onClick={() => setMode("classic")}
          />
          <ModeCard
            title="Blind"
            blurb="Names and positions only — ratings stay hidden. Trust your NFL knowledge."
            accent="text-sky-300"
            selected={mode === "blind"}
            onClick={() => setMode("blind")}
          />
        </div>
      </section>

      {/* Step 2 — timeline */}
      <section className="mt-7 w-full">
        <StepLabel n={2} text="Set your roster timeline" />
        <p className="mb-3 mt-1 text-xs text-white/40">
          Wider timelines create more variety. Smaller timelines create more
          era-specific drafts.
        </p>
        <RosterTimelineFilter
          teamSeasons={catalog}
          selectedStartYear={effectiveRange.startYear}
          selectedEndYear={effectiveRange.endYear}
          onChange={setRange}
        />
      </section>

      {/* Step 3 — start */}
      <section className="mt-7 w-full">
        {ready && selectedCount === 0 && (
          <div className="mb-3 rounded-xl bg-rose-500/10 px-4 py-3 text-center text-sm font-medium text-rose-200 ring-1 ring-rose-400/30">
            No rosters available for this timeline. Choose a wider range.
          </div>
        )}
        <button
          onClick={() => canStart && onStart(mode, effectiveRange)}
          disabled={!canStart}
          className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-center text-lg font-bold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
        >
          {ready ? "Start drafting →" : "Loading rosters…"}
        </button>
      </section>

      <p className="mt-8 text-center text-xs text-white/30">
        Goal: 17-0 in the regular season, run the playoffs, win the Super Bowl.
      </p>
    </div>
  );
}

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white/70 ring-1 ring-white/15">
        {n}
      </span>
      <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
        {text}
      </span>
    </div>
  );
}

function ModeCard({
  title,
  blurb,
  accent,
  selected,
  onClick,
}: {
  title: string;
  blurb: string;
  accent: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`group rounded-2xl p-5 text-left ring-1 transition ${
        selected
          ? "bg-white/10 ring-white/40"
          : "bg-white/5 ring-white/10 hover:bg-white/[0.08] hover:ring-white/25"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold text-white">{title}</div>
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full ring-2 transition ${
            selected ? "ring-emerald-400" : "ring-white/25"
          }`}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
        </span>
      </div>
      <p className="mt-1 text-sm text-white/55">{blurb}</p>
      <div
        className={`mt-3 text-sm font-semibold ${accent} ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-60"} transition`}
      >
        {selected ? "Selected" : "Tap to choose"}
      </div>
    </button>
  );
}
