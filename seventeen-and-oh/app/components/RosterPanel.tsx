import { RosterSlot, Side } from "@/lib/types";
import { fitTier, FitTone } from "@/lib/positions";

const TONE: Record<FitTone, string> = {
  natural: "text-emerald-300",
  similar: "text-sky-300",
  emergency: "text-amber-300",
  wrong: "text-rose-300",
};

const SIDE_LABEL: Record<Side, string> = {
  OFF: "Offense",
  DEF: "Defense",
  ST: "Special Teams",
};

function SlotRow({
  slot,
  reveal,
  highlight,
}: {
  slot: RosterSlot;
  reveal: boolean;
  highlight: boolean;
}) {
  const filled = !!slot.player;
  const tier = slot.fit != null ? fitTier(slot.fit) : null;
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm ring-1 ${
        highlight
          ? "bg-white/10 ring-white/30"
          : filled
            ? "bg-white/[0.04] ring-white/10"
            : "ring-white/5"
      }`}
    >
      <span className="w-9 shrink-0 font-mono text-xs font-semibold text-white/50">
        {slot.label}
      </span>
      {filled ? (
        <span className="flex-1 truncate text-white/90">{slot.player!.name}</span>
      ) : (
        <span className="flex-1 text-white/25">
          {slot.optional ? "optional" : "—"}
        </span>
      )}
      {filled && tier && (
        <span className={`shrink-0 text-[11px] font-semibold ${TONE[tier.tone]}`}>
          {reveal ? slot.effectiveRating : tier.label}
        </span>
      )}
    </div>
  );
}

export default function RosterPanel({
  roster,
  reveal,
  highlightSlotId,
}: {
  roster: RosterSlot[];
  reveal: boolean;
  highlightSlotId?: string | null;
}) {
  const sides: Side[] = ["OFF", "DEF", "ST"];
  const filledCount = roster.filter((s) => s.player).length;
  return (
    <div className="rounded-xl bg-black/30 p-3 ring-1 ring-white/10">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Roster
        </h3>
        <span className="text-xs font-medium text-white/40">
          {filledCount}/{roster.length}
        </span>
      </div>
      <div className="space-y-3">
        {sides.map((side) => {
          const slots = roster.filter((s) => s.side === side);
          if (!slots.length) return null;
          return (
            <div key={side}>
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                {SIDE_LABEL[side]}
              </div>
              <div className="space-y-1">
                {slots.map((s) => (
                  <SlotRow
                    key={s.id}
                    slot={s}
                    reveal={reveal}
                    highlight={highlightSlotId === s.id}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
