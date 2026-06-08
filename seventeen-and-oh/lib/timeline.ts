import type { TeamSeasonSummary } from "./data";

/**
 * Roster timeline filter — restricts which team-seasons are eligible in the
 * Team×Season spin wheel. All helpers operate on the lightweight summaries so
 * they're cheap to call on every render. Year math is derived from the actual
 * data, never hardcoded — the database grows/shrinks and the UI adapts.
 */

export interface TimelinePreset {
  /** Stable id for selection state ("all", "1990s", "modernEra", ...). */
  id: string;
  /** Display label on the button. */
  label: string;
  /** Inclusive range bounds. */
  startYear: number;
  endYear: number;
}

export interface TimelineRange {
  startYear: number;
  endYear: number;
}

/** Sorted, deduped list of every season present in the catalog. */
export function getAvailableYears(catalog: TeamSeasonSummary[]): number[] {
  const set = new Set<number>();
  for (const s of catalog) set.add(s.season);
  return [...set].sort((a, b) => a - b);
}

/** Team-seasons whose season falls inside [startYear, endYear] inclusive. */
export function getTeamSeasonsByYearRange(
  catalog: TeamSeasonSummary[],
  startYear: number,
  endYear: number
): TeamSeasonSummary[] {
  const lo = Math.min(startYear, endYear);
  const hi = Math.max(startYear, endYear);
  return catalog.filter((s) => s.season >= lo && s.season <= hi);
}

/** Decade window snapped to available data — clamped so it never exceeds the
 *  catalog's actual bounds (avoids "1960s" presets when the data starts in 1966). */
function clampedDecade(
  decadeStart: number,
  availMin: number,
  availMax: number
): TimelineRange {
  return {
    startYear: Math.max(decadeStart, availMin),
    endYear: Math.min(decadeStart + 9, availMax),
  };
}

/**
 * Build the full set of preset buttons. The "Custom" preset is included so
 * the active-state UI has somewhere to land when the user adjusts the slider
 * off any decade — it's never something they pick directly.
 */
export function getDecadePresets(availableYears: number[]): TimelinePreset[] {
  if (!availableYears.length) return [];
  const availMin = availableYears[0];
  const availMax = availableYears[availableYears.length - 1];

  const presets: TimelinePreset[] = [
    { id: "all", label: "All", startYear: availMin, endYear: availMax },
  ];

  // Every decade between the dataset bounds gets a button. Each clamps to the
  // real data so e.g. "1960s" with a 1966-start dataset becomes 1966–1969.
  const firstDecade = Math.floor(availMin / 10) * 10;
  const lastDecade = Math.floor(availMax / 10) * 10;
  for (let d = firstDecade; d <= lastDecade; d += 10) {
    const { startYear, endYear } = clampedDecade(d, availMin, availMax);
    presets.push({
      id: `${d}s`,
      label: `${d}s`,
      startYear,
      endYear,
    });
  }

  // "Modern Era" — 2010 → present. Skipped if it'd land entirely outside data.
  if (availMax >= 2010) {
    presets.push({
      id: "modernEra",
      label: "Modern Era",
      startYear: Math.max(2010, availMin),
      endYear: availMax,
    });
  }

  presets.push({
    id: "custom",
    label: "Custom",
    startYear: availMin,
    endYear: availMax,
  });

  return presets;
}

/** True iff the preset's window contains at least one available year. */
export function isPresetAvailable(
  preset: TimelinePreset,
  availableYears: number[]
): boolean {
  return availableYears.some(
    (y) => y >= preset.startYear && y <= preset.endYear
  );
}

/** Which preset (if any) currently matches the selected range exactly. The
 *  "custom" preset is the fallback when nothing else lines up. */
export function findActivePresetId(
  presets: TimelinePreset[],
  range: TimelineRange
): string {
  const match = presets.find(
    (p) =>
      p.id !== "custom" &&
      p.startYear === range.startYear &&
      p.endYear === range.endYear
  );
  return match ? match.id : "custom";
}

/**
 * Display label for the selected window. Exact preset hits win first (so
 * clicking "Modern Era" shows "Modern Era"), then well-known era ranges from
 * the spec, then decade-snapped windows, then a custom fallback.
 */
export function getEraLabel(
  range: TimelineRange,
  availMin: number,
  availMax: number,
  activePresetId?: string,
  presets?: TimelinePreset[]
): string {
  const { startYear, endYear } = range;

  if (startYear === availMin && endYear === availMax) return "All-Time Draft";
  if (startYear === endYear) return `${startYear} Season`;

  if (activePresetId && activePresetId !== "custom" && presets) {
    const p = presets.find((x) => x.id === activePresetId);
    if (p) return p.label === "All" ? "All-Time Draft" : p.label;
  }

  // Spec-named era windows (canonical exact ranges)
  if (startYear === 1966 && endYear === 1979) return "Old School Era";
  if (startYear === 1980 && endYear === 1999) return "Classic Era";
  if (startYear === 2000 && endYear === 2009) return "Modern Rise";
  if (startYear === 2010 && endYear === availMax) return "Current Era";

  // Whole decade snap
  const decadeStart = Math.floor(startYear / 10) * 10;
  if (startYear === decadeStart && endYear === decadeStart + 9) {
    return `${decadeStart}s`;
  }

  return "Custom Range";
}

/** Short marketing copy under the timeline. Picks a tone based on selection
 *  width so the user gets quick feedback about their choice. */
export function getTimelineHint(
  range: TimelineRange,
  availMin: number,
  availMax: number
): string {
  const span = range.endYear - range.startYear + 1;
  const fullSpan = availMax - availMin + 1;
  if (span === fullSpan) {
    return "Maximum variety — every era in play.";
  }
  if (span === 1) {
    return "A single-season draft — pure era immersion.";
  }
  if (span <= 5) {
    return "Tight era focus — very era-specific rosters.";
  }
  if (span <= 15) {
    return "Era-flavored draft with some variety.";
  }
  return "Wide window — plenty of variety across eras.";
}
