"use client";
import { GameMode, Player, RosterSlot } from "@/lib/types";
import { fitTier, POSITION_NAMES } from "@/lib/positions";

const TONE_TEXT = {
  natural: "text-emerald-300",
  similar: "text-sky-300",
  emergency: "text-amber-300",
  wrong: "text-rose-300",
} as const;

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

const attrLabel = (k: string) =>
  k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function topAttributes(p: Player, n = 3): [string, number][] {
  return Object.entries(p.attributes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="font-mono font-semibold text-white">
          {value > 0 ? value : "—"}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The dashboard beside the field map: context for what you're doing right now
 * (placing a player / inspecting a slot), live team ratings, and the roster's
 * standout + weak link. Keeps the useful roster info while the field map stays
 * the primary visual.
 */
export default function RosterDetailsPanel({
  roster,
  mode,
  pending = null,
  activeSlotId = null,
}: {
  roster: RosterSlot[];
  mode: GameMode;
  pending?: Player | null;
  activeSlotId?: string | null;
}) {
  const reveal = mode === "classic";
  const filled = roster.filter((s) => s.player);
  const total = roster.length;

  const offEff = roster
    .filter((s) => s.side === "OFF" && s.player)
    .map((s) => s.effectiveRating ?? 0);
  const defEff = roster
    .filter((s) => s.side === "DEF" && s.player)
    .map((s) => s.effectiveRating ?? 0);

  const teamOvr = filled.length
    ? Math.round(mean(filled.map((s) => s.effectiveRating ?? 0)))
    : null;
  const offense = Math.round(mean(offEff));
  const defense = Math.round(mean(defEff));

  const weakLink = [...filled]
    .filter((s) => !s.optional)
    .sort((a, b) => (a.effectiveRating ?? 0) - (b.effectiveRating ?? 0))[0];
  const standout = [...filled].sort(
    (a, b) => (b.effectiveRating ?? 0) - (a.effectiveRating ?? 0)
  )[0];

  const activeSlot = activeSlotId
    ? roster.find((s) => s.id === activeSlotId) ?? null
    : null;

  return (
    <div className="space-y-3 rounded-xl bg-black/30 p-3 ring-1 ring-white/10">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Team Dashboard
        </h3>
        <span className="text-xs font-medium text-white/40">
          {filled.length}/{total}
        </span>
      </div>

      {/* Context card: placing > inspecting > default headline */}
      {pending ? (
        <div className="rounded-lg bg-white/[0.06] p-3 ring-1 ring-white/15">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Placing on the field
          </div>
          <div className="mt-0.5 truncate text-sm font-bold text-white">
            {pending.name}
          </div>
          <div className="text-xs text-white/50">
            {POSITION_NAMES[pending.position]}
            {pending.secondaryPositions.length > 0 &&
              ` · also ${pending.secondaryPositions.join(", ")}`}
            {reveal && ` · ${pending.overall} OVR`}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {topAttributes(pending).map(([k, v]) => (
              <span
                key={k}
                className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50"
              >
                {attrLabel(k)}
                {reveal ? ` ${v}` : ""}
              </span>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-emerald-300/90">
            Tap a glowing position on the field to assign him.
          </div>
        </div>
      ) : activeSlot && activeSlot.player ? (
        <InspectCard slot={activeSlot} reveal={reveal} />
      ) : activeSlot ? (
        <div className="rounded-lg bg-white/[0.04] p-3 ring-1 ring-white/10">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            {activeSlot.label} — {POSITION_NAMES[activeSlot.position]}
          </div>
          <div className="mt-0.5 text-sm text-white/50">
            Empty slot — draft a {activeSlot.position} to fill it.
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-white/[0.04] p-3 ring-1 ring-white/10">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              {reveal ? "Team OVR so far" : "Players placed"}
            </span>
            <span className="text-2xl font-black text-white">
              {reveal ? (teamOvr ?? "—") : filled.length}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-white/45">
            {filled.length < total
              ? "Tap any filled position to inspect a player."
              : "Roster complete."}
          </div>
        </div>
      )}

      {/* Live ratings (classic only — blind keeps them hidden) */}
      {reveal && (
        <div className="space-y-2.5 rounded-lg bg-white/[0.04] p-3 ring-1 ring-white/10">
          <MiniBar label="Offense" value={offense} />
          <MiniBar label="Defense" value={defense} />
        </div>
      )}

      {/* Standout + biggest weakness once the roster has some shape */}
      {reveal && filled.length >= 4 && (
        <div className="space-y-2 rounded-lg bg-white/[0.04] p-3 ring-1 ring-white/10">
          {standout && (
            <Highlight
              caption="Standout"
              slot={standout}
              accent="text-emerald-300"
            />
          )}
          {weakLink && (
            <Highlight
              caption="Biggest weakness"
              slot={weakLink}
              accent="text-rose-300"
            />
          )}
        </div>
      )}
    </div>
  );
}

function InspectCard({ slot, reveal }: { slot: RosterSlot; reveal: boolean }) {
  const p = slot.player!;
  const tier = slot.fit != null ? fitTier(slot.fit) : null;
  return (
    <div className="rounded-lg bg-white/[0.06] p-3 ring-1 ring-white/15">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            {slot.label} — {POSITION_NAMES[slot.position]}
          </div>
          <div className="truncate text-sm font-bold text-white">{p.name}</div>
          <div className="truncate text-xs text-white/50">
            {p.season} {p.team}
          </div>
        </div>
        {reveal && (
          <div className="shrink-0 text-right">
            <div className="text-xl font-black text-white">
              {slot.effectiveRating}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-white/40">
              {slot.effectiveRating !== p.overall ? `was ${p.overall}` : "OVR"}
            </div>
          </div>
        )}
      </div>
      {tier && (
        <div className={`mt-1.5 text-[11px] font-semibold ${TONE_TEXT[tier.tone]}`}>
          {tier.label}
          {tier.tone !== "natural" && p.position !== slot.position
            ? ` · natural ${p.position}`
            : ""}
        </div>
      )}
      {reveal && (
        <div className="mt-2 flex flex-wrap gap-1">
          {topAttributes(p).map(([k, v]) => (
            <span
              key={k}
              className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50"
            >
              {attrLabel(k)} {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Highlight({
  caption,
  slot,
  accent,
}: {
  caption: string;
  slot: RosterSlot;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-white/35">
          {caption}
        </div>
        <div className="truncate text-sm font-semibold text-white/90">
          {slot.player!.name}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={`font-mono text-sm font-bold ${accent}`}>
          {slot.effectiveRating}
        </div>
        <div className="text-[9px] uppercase tracking-wider text-white/30">
          {slot.label}
        </div>
      </div>
    </div>
  );
}
