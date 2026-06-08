"use client";
import { useMemo } from "react";
import type { TeamSeasonSummary } from "@/lib/data";
import {
  findActivePresetId,
  getAvailableYears,
  getDecadePresets,
  getEraLabel,
  getTimelineHint,
  isPresetAvailable,
  type TimelinePreset,
  type TimelineRange,
} from "@/lib/timeline";

export interface RosterTimelineFilterProps {
  /** Full catalog the spinner draws from. Bounds + presets are derived from it. */
  teamSeasons: TeamSeasonSummary[];
  selectedStartYear: number;
  selectedEndYear: number;
  onChange: (range: TimelineRange) => void;
}

/**
 * Lets the player narrow the spin wheel to a specific era before the draft
 * starts. The range is two ends of a slider plus a row of one-click decade /
 * era presets that snap to actual data bounds.
 *
 * The component is fully derived from `teamSeasons` — drop more team-seasons
 * into the catalog and the timeline grows; remove some and presets that no
 * longer have data automatically disable themselves.
 */
export default function RosterTimelineFilter({
  teamSeasons,
  selectedStartYear,
  selectedEndYear,
  onChange,
}: RosterTimelineFilterProps) {
  const availableYears = useMemo(
    () => getAvailableYears(teamSeasons),
    [teamSeasons]
  );

  const presets = useMemo(
    () => getDecadePresets(availableYears),
    [availableYears]
  );

  // Bounds fall back to 0 while the catalog is still empty. Every hook above and
  // below runs unconditionally; the skeleton guard further down is the only
  // conditional, and it lives *after* the last hook so hook order never shifts
  // (React Rules of Hooks).
  const hasData = availableYears.length > 0;
  const minYear = hasData ? availableYears[0] : 0;
  const maxYear = hasData ? availableYears[availableYears.length - 1] : 0;

  // Clamp incoming props so a stale parent value (e.g. catalog shrunk between
  // mounts) never paints an out-of-bounds slider thumb.
  const startYear = Math.max(minYear, Math.min(selectedStartYear, maxYear));
  const endYear = Math.max(startYear, Math.min(selectedEndYear, maxYear));
  const range: TimelineRange = { startYear, endYear };

  // Empty-catalog guard — render a skeleton so the parent's layout doesn't jump
  // when data finishes loading.
  if (!hasData) {
    return (
      <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
        <div className="text-xs font-semibold uppercase tracking-widest text-white/40">
          Roster Timeline
        </div>
        <div className="mt-4 h-2 animate-pulse rounded-full bg-white/10" />
        <div className="mt-3 text-sm text-white/40">Loading rosters…</div>
      </div>
    );
  }

  const activePresetId = findActivePresetId(presets, range);
  const eraLabel = getEraLabel(range, minYear, maxYear, activePresetId, presets);
  const hint = getTimelineHint(range, minYear, maxYear);

  // Percent positions for the visual fill — both thumbs are positioned by the
  // browser using `value`; we only need percentages for the colored span behind
  // them.
  const totalSpan = Math.max(1, maxYear - minYear);
  const pctStart = ((startYear - minYear) / totalSpan) * 100;
  const pctEnd = ((endYear - minYear) / totalSpan) * 100;

  // Slider drag: clamp so the start handle can't pass the end handle (and vice
  // versa). Single-year selection is allowed — start === end is valid.
  const setStart = (v: number) => {
    const clamped = Math.max(minYear, Math.min(v, endYear));
    if (clamped !== startYear) onChange({ startYear: clamped, endYear });
  };
  const setEnd = (v: number) => {
    const clamped = Math.min(maxYear, Math.max(v, startYear));
    if (clamped !== endYear) onChange({ startYear, endYear: clamped });
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10 sm:p-5">
      {/* Header row: title + live readout */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-white/50">
            Roster Timeline
          </div>
          <div className="mt-0.5 text-xs text-white/40">
            Choose which roster years can appear in your draft.
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-white">
            {startYear === endYear ? startYear : `${startYear}–${endYear}`}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-sky-300/90">
            {eraLabel}
          </div>
        </div>
      </div>

      {/* Preset buttons — wrap on mobile, scroll-free */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <PresetButton
            key={preset.id}
            preset={preset}
            active={activePresetId === preset.id}
            available={
              preset.id === "custom" || isPresetAvailable(preset, availableYears)
            }
            onClick={() =>
              onChange({
                startYear: preset.startYear,
                endYear: preset.endYear,
              })
            }
          />
        ))}
      </div>

      {/* Dual-handle range slider */}
      <div className="mt-5 px-1">
        <div className="relative h-6">
          {/* Inactive track */}
          <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />
          {/* Selected span — glow scales with how close the handles are. */}
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-sky-500 to-sky-300 shadow-[0_0_14px_rgba(56,189,248,0.55)]"
            style={{
              left: `${pctStart}%`,
              width: `${Math.max(0.5, pctEnd - pctStart)}%`,
            }}
          />
          {/* Two overlapping range inputs — the track is hidden via CSS so only
              the thumbs are visible. The end-input sits on top so its thumb
              stays grabbable when both pile up at the same year. */}
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={startYear}
            onChange={(e) => setStart(Number(e.target.value))}
            className="timeline-thumb absolute inset-0 z-20 h-full w-full appearance-none bg-transparent"
            aria-label="Start year"
          />
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={endYear}
            onChange={(e) => setEnd(Number(e.target.value))}
            className="timeline-thumb absolute inset-0 z-30 h-full w-full appearance-none bg-transparent"
            aria-label="End year"
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-white/35">
          <span>{minYear}</span>
          <span>{maxYear}</span>
        </div>
      </div>

      {/* Footer: hint */}
      <div className="mt-4 border-t border-white/5 pt-3 text-xs">
        <span className="text-white/45">{hint}</span>
      </div>
    </div>
  );
}

function PresetButton({
  preset,
  active,
  available,
  onClick,
}: {
  preset: TimelinePreset;
  active: boolean;
  available: boolean;
  onClick: () => void;
}) {
  const disabled = !available;
  const classes = [
    "rounded-full px-3 py-1 text-xs font-semibold transition",
    disabled
      ? "cursor-not-allowed bg-white/[0.02] text-white/20 ring-1 ring-white/5"
      : active
        ? "bg-sky-400/20 text-sky-200 ring-1 ring-sky-400/60 shadow-[0_0_10px_rgba(56,189,248,0.35)]"
        : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white",
  ].join(" ");
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={
        disabled
          ? "No rosters available in this range"
          : `${preset.startYear}–${preset.endYear}`
      }
      className={classes}
    >
      {preset.label}
    </button>
  );
}
