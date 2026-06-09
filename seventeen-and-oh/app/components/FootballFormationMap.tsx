"use client";
import { GameMode, Player, RosterSlot, Side } from "@/lib/types";
import { fitTier, FitTone, positionFit } from "@/lib/positions";
import { effectiveRating } from "@/lib/scoring";
import { FIELD_POSITIONS, LINE_OF_SCRIMMAGE } from "@/lib/field-layout";

export interface FootballFormationMapProps {
  rosterSlots: RosterSlot[];
  /** When set, the map enters "placement" mode: open slots become drop targets. */
  selectedDraftedPlayer?: Player | null;
  mode: GameMode;
  /** Inspect a slot (view details). Called when NOT placing a player. */
  onSlotClick?: (slotId: string) => void;
  /** Drop the pending player onto an open slot. Called only in placement mode. */
  onAssignPlayerToSlot?: (playerId: string, slotId: string) => void;
  /** Classic mode reveals ratings; Blind hides them behind the fit tier. */
  showRatings: boolean;
  /** Slot currently highlighted in the details panel. */
  activeSlotId?: string | null;
  /** Best-fit open slot for the pending player — gets an extra glow. */
  suggestedSlotId?: string | null;
}

// Per-side identity colors: offense blue, defense red, special teams amber.
const SIDE_COLOR: Record<Side, { fill: string; ring: string; tag: string }> = {
  OFF: { fill: "bg-sky-500/20", ring: "ring-sky-400/50", tag: "text-sky-200/80" },
  DEF: { fill: "bg-rose-500/20", ring: "ring-rose-400/50", tag: "text-rose-200/80" },
  ST: { fill: "bg-amber-400/15", ring: "ring-amber-300/50", tag: "text-amber-200/80" },
};

const TONE_RING: Record<FitTone, string> = {
  natural: "ring-emerald-400",
  similar: "ring-sky-400",
  emergency: "ring-amber-400",
  wrong: "ring-rose-500",
};
const TONE_TEXT: Record<FitTone, string> = {
  natural: "text-emerald-300",
  similar: "text-sky-300",
  emergency: "text-amber-300",
  wrong: "text-rose-300",
};
// Short, marker-friendly fit labels (the full fitTier labels are too long here).
const TONE_LABEL: Record<FitTone, string> = {
  natural: "Natural",
  similar: "Good",
  emergency: "Risky",
  wrong: "Bad",
};

/** "Tom Brady" -> "Brady"; keeps multi-word surnames / suffixes. */
function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
}

function SlotMarker({
  slot,
  pending,
  showRatings,
  active,
  suggested,
  onSlotClick,
  onAssignPlayerToSlot,
}: {
  slot: RosterSlot;
  pending: Player | null;
  showRatings: boolean;
  active: boolean;
  suggested: boolean;
  onSlotClick?: (slotId: string) => void;
  onAssignPlayerToSlot?: (playerId: string, slotId: string) => void;
}) {
  const coord = FIELD_POSITIONS[slot.id];
  if (!coord) return null;

  const color = SIDE_COLOR[slot.side];
  const filled = !!slot.player;
  const placing = !!pending;
  const open = !filled;

  // Evaluate the pending player's fit at this open slot (placement mode only).
  let placeTone: FitTone | null = null;
  let placeDelta = 0;
  if (placing && open && pending) {
    const fit = positionFit(pending.position, pending.secondaryPositions, slot.position);
    placeTone = fitTier(fit).tone;
    placeDelta = effectiveRating(pending, slot.position) - pending.overall;
  }

  const isDropTarget = placing && open;
  const inert = placing && filled; // filled slots can't be reassigned mid-draft
  const canInspect = !placing && !!onSlotClick;
  const interactive = isDropTarget || canInspect;

  const handle = () => {
    if (isDropTarget && pending && onAssignPlayerToSlot) {
      onAssignPlayerToSlot(pending.id, slot.id);
    } else if (canInspect && onSlotClick) {
      onSlotClick(slot.id);
    }
  };

  const filledTone: FitTone | null =
    filled && slot.fit != null ? fitTier(slot.fit).tone : null;

  const classes = [
    "absolute flex w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-xl px-0.5 py-1 text-center leading-none ring-1 transition sm:w-[3.35rem]",
    inert ? "opacity-25" : "",
    active ? "z-30" : isDropTarget ? "z-20" : "z-10",
    isDropTarget
      ? `field-target cursor-pointer bg-slate-950/70 ring-2 ${TONE_RING[placeTone!]}${suggested ? " field-suggest animate-pulse" : ""}`
      : filled
        ? `${color.fill} ${color.ring} ${canInspect ? "cursor-pointer hover:ring-white/70" : ""}`
        : "border border-dashed border-white/20 bg-slate-950/45 ring-white/10",
    active ? "outline outline-2 outline-white/70" : "",
    suggested && isDropTarget ? "shadow-[0_0_16px_rgba(52,211,153,0.45)]" : "",
  ].join(" ");

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={handle}
      aria-label={
        filled
          ? `${slot.label}: ${slot.player!.name}`
          : `${slot.label}: empty`
      }
      style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
      className={classes}
    >
      <span
        className={`text-[8px] font-bold uppercase tracking-wide ${filled ? "text-white/70" : color.tag}`}
      >
        {slot.label}
      </span>

      {isDropTarget ? (
        <>
          <span className={`mt-0.5 text-[10px] font-bold ${TONE_TEXT[placeTone!]}`}>
            {TONE_LABEL[placeTone!]}
          </span>
          <span className="font-mono text-[9px] text-white/70">
            {placeDelta === 0 ? "best fit" : placeDelta}
          </span>
        </>
      ) : filled ? (
        <>
          <span className="mt-0.5 w-full truncate text-[10px] font-bold text-white">
            {lastName(slot.player!.name)}
          </span>
          <span
            className={`mt-0.5 font-mono text-[10px] font-semibold ${filledTone ? TONE_TEXT[filledTone] : "text-white"}`}
          >
            {showRatings
              ? slot.effectiveRating
              : filledTone
                ? TONE_LABEL[filledTone]
                : ""}
          </span>
        </>
      ) : (
        <span className="mt-0.5 text-[9px] font-medium text-white/30">
          {slot.optional ? "opt" : "Empty"}
        </span>
      )}
    </button>
  );
}

export default function FootballFormationMap({
  rosterSlots,
  selectedDraftedPlayer = null,
  mode,
  onSlotClick,
  onAssignPlayerToSlot,
  showRatings,
  activeSlotId = null,
  suggestedSlotId = null,
}: FootballFormationMapProps) {
  const pending = selectedDraftedPlayer;
  const placing = !!pending;

  // Mowed-grass stripes + faint yard lines, painted under the markers.
  const fieldBackground =
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 9%)," +
    "repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0 4.5%, rgba(255,255,255,0.02) 4.5% 9%)," +
    "linear-gradient(180deg, #135f37 0%, #16713f 50%, #114e30 100%)";

  return (
    <div className="rounded-2xl bg-black/30 p-2 ring-1 ring-white/10">
      <div className="overflow-x-auto">
        <div
          className="relative aspect-[16/10] min-w-[34rem] overflow-hidden rounded-xl ring-1 ring-white/15"
          style={{ background: fieldBackground }}
          aria-label={mode === "blind" ? "Formation map (ratings hidden)" : "Formation map"}
        >
          {/* Sidelines */}
          <div className="pointer-events-none absolute inset-y-0 left-[1.5%] w-px bg-white/20" />
          <div className="pointer-events-none absolute inset-y-0 right-[1.5%] w-px bg-white/20" />
          {/* Line of scrimmage */}
          <div
            className="pointer-events-none absolute inset-x-0 h-0.5 bg-white/45"
            style={{ top: `${LINE_OF_SCRIMMAGE}%` }}
          />
          {/* Side labels */}
          <span className="pointer-events-none absolute left-2 top-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-rose-200/60">
            Defense
          </span>
          <span className="pointer-events-none absolute bottom-1.5 left-2 text-[9px] font-black uppercase tracking-[0.2em] text-sky-200/60">
            Offense
          </span>

          {rosterSlots.map((slot) => (
            <SlotMarker
              key={slot.id}
              slot={slot}
              pending={pending}
              showRatings={showRatings}
              active={activeSlotId === slot.id}
              suggested={suggestedSlotId === slot.id}
              onSlotClick={onSlotClick}
              onAssignPlayerToSlot={onAssignPlayerToSlot}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-1 text-[10px] text-white/45">
        {placing ? (
          <>
            <span className="font-semibold text-white/60">Tap a position to place:</span>
            <Legend dot="bg-emerald-400" text="Natural" />
            <Legend dot="bg-sky-400" text="Good" />
            <Legend dot="bg-amber-400" text="Risky" />
            <Legend dot="bg-rose-500" text="Bad fit" />
          </>
        ) : (
          <>
            <Legend dot="bg-sky-400" text="Offense" />
            <Legend dot="bg-rose-400" text="Defense" />
            <Legend dot="bg-amber-300" text="Special teams" />
          </>
        )}
      </div>
    </div>
  );
}

function Legend({ dot, text }: { dot: string; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {text}
    </span>
  );
}
