"use client";
import { useState } from "react";
import { RosterSlot, ScoreBreakdown } from "@/lib/types";
import { baselineWinProb } from "@/lib/simulation";
import { computeTeamProfile } from "@/lib/team-profile";
import FootballFormationMap from "./FootballFormationMap";

function Bar({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-white/70">{label}</span>
        <span className="font-mono font-semibold text-white">
          {value.toFixed(1)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/30">
        {hint}
      </div>
    </div>
  );
}

export default function ScoreScreen({
  score,
  roster,
  onSimulate,
  onRestart,
}: {
  score: ScoreBreakdown;
  roster: RosterSlot[];
  onSimulate: () => void;
  onRestart: () => void;
}) {
  const [inspectedSlotId, setInspectedSlotId] = useState<string | null>(null);
  const profile = computeTeamProfile(roster);
  const winPct = Math.round(baselineWinProb(profile.power) * 100);
  const inspected = inspectedSlotId
    ? roster.find((s) => s.id === inspectedSlotId) ?? null
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <div className="mb-1 text-center text-xs font-semibold uppercase tracking-widest text-white/40">
        Roster complete
      </div>
      <h2 className="mb-5 text-center text-2xl font-bold text-white">
        Your Team Rating
      </h2>

      {/* Field map hero — the finished team in formation. */}
      <div className="mb-3">
        <FootballFormationMap
          rosterSlots={roster}
          mode="classic"
          showRatings
          activeSlotId={inspectedSlotId}
          onSlotClick={(id) =>
            setInspectedSlotId((cur) => (cur === id ? null : id))
          }
        />
      </div>

      {/* Tap-to-inspect detail line under the field. */}
      <div className="mb-5 min-h-[1.5rem] text-center text-sm text-white/55">
        {inspected && inspected.player ? (
          <span>
            <span className="font-mono text-white/40">{inspected.label}</span>{" "}
            <span className="font-semibold text-white">
              {inspected.player.name}
            </span>{" "}
            · {inspected.player.season} {inspected.player.team} ·{" "}
            <span className="font-mono font-bold text-emerald-300">
              {inspected.effectiveRating} OVR
            </span>
            {inspected.effectiveRating !== inspected.player.overall &&
              ` (base ${inspected.player.overall})`}
          </span>
        ) : (
          <span className="text-white/30">
            Tap any position to inspect that player.
          </span>
        )}
      </div>

      <div className="space-y-5">
        <div className="flex items-center gap-5 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
          <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full bg-gradient-to-b from-emerald-400/20 to-transparent ring-2 ring-emerald-400/40">
            <span className="text-3xl font-black text-white">
              {score.total.toFixed(1)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              Overall
            </span>
          </div>
          <div className="flex-1">
            <div className="text-sm text-white/60">
              Projected per-game win chance
            </div>
            <div className="text-2xl font-bold text-emerald-300">{winPct}%</div>
            <div className="mt-1 text-xs text-white/40">
              Only a truly stacked roster realistically threatens 17-0.
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 sm:grid-cols-2 lg:grid-cols-5">
          <Bar label="Offense" value={score.offense} hint="40% weight" />
          <Bar label="Defense" value={score.defense} hint="40% weight" />
          <Bar label="Position Fit" value={score.fit} hint="10% weight" />
          <Bar label="Balance" value={score.balance} hint="5% weight" />
          <Bar label="Star Power" value={score.star} hint="5% weight" />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={onSimulate}
            className="flex-1 rounded-xl bg-emerald-500 px-5 py-3.5 text-center font-bold text-emerald-950 transition hover:bg-emerald-400"
          >
            Simulate the Season →
          </button>
          <button
            onClick={onRestart}
            className="rounded-xl bg-white/5 px-5 py-3.5 font-medium text-white/70 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}
