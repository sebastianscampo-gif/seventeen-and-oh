"use client";
import { useMemo, useState } from "react";
import { GameMode, Player, Position, RosterSlot, TeamSeason } from "@/lib/types";
import { effectiveRating } from "@/lib/scoring";
import {
  positionFit,
  fitTier,
  FitTone,
  POSITION_NAMES,
} from "@/lib/positions";
import { teamTheme } from "@/lib/teamColors";
import RosterPanel from "./RosterPanel";

const TONE_BADGE: Record<FitTone, string> = {
  natural: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  similar: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  emergency: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  wrong: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

const POSITION_ORDER: Position[] = [
  "QB", "RB", "WR", "TE", "LT", "LG", "C", "RG", "RT",
  "EDGE", "DT", "LB", "CB", "S", "K", "P",
];

const attrLabel = (k: string) =>
  k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function topAttributes(p: Player, n = 3): [string, number][] {
  return Object.entries(p.attributes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function PlayerCard({
  player,
  reveal,
  onClick,
}: {
  player: Player;
  reveal: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:ring-white/25"
    >
      <div className="min-w-0">
        <div className="truncate font-semibold text-white">{player.name}</div>
        {reveal ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {topAttributes(player).map(([k, v]) => (
              <span
                key={k}
                className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50"
              >
                {attrLabel(k)} {v}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-1 text-xs text-white/35">
            {POSITION_NAMES[player.position]}
          </div>
        )}
      </div>
      {reveal ? (
        <div className="shrink-0 text-right">
          <div className="text-xl font-black text-white">{player.overall}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">
            OVR
          </div>
        </div>
      ) : (
        <div className="shrink-0 rounded-lg bg-white/5 px-2 py-1 font-mono text-sm font-bold text-white/60">
          {player.position}
        </div>
      )}
    </button>
  );
}

function SlotPicker({
  player,
  openSlots,
  reveal,
  onPick,
  onClose,
}: {
  player: Player;
  openSlots: RosterSlot[];
  reveal: boolean;
  onPick: (slotId: string) => void;
  onClose: () => void;
}) {
  const ranked = openSlots
    .map((s) => {
      const fit = positionFit(player.position, player.secondaryPositions, s.position);
      return { slot: s, fit, eff: effectiveRating(player, s.position), tier: fitTier(fit) };
    })
    .sort((a, b) => b.fit - a.fit);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[82vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-[#10141d] ring-1 ring-white/15 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-white/40">
              Assign a position
            </div>
            <div className="truncate text-lg font-bold text-white">
              {player.name}
            </div>
            <div className="truncate text-xs text-white/50">
              {POSITION_NAMES[player.position]}
              {player.secondaryPositions.length > 0 &&
                ` · also ${player.secondaryPositions.join(", ")}`}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-sm text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
        </div>
        <div className="max-h-[58vh] space-y-1 overflow-y-auto p-3">
          {ranked.map(({ slot, eff, tier }) => (
            <button
              key={slot.id}
              onClick={() => onPick(slot.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5 text-left ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-white/25"
            >
              <span className="flex items-center gap-2">
                <span className="w-9 font-mono text-sm font-semibold text-white/70">
                  {slot.label}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ${TONE_BADGE[tier.tone]}`}
                >
                  {tier.label}
                </span>
              </span>
              {reveal && (
                <span className="font-mono text-sm font-bold text-white">{eff}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DraftScreen({
  mode,
  roster,
  teamSeason,
  draftedIds,
  onDraft,
}: {
  mode: GameMode;
  roster: RosterSlot[];
  teamSeason: TeamSeason;
  draftedIds: string[];
  onDraft: (player: Player, slotId: string) => void;
}) {
  const [pending, setPending] = useState<Player | null>(null);
  const reveal = mode === "classic";
  const theme = teamTheme(teamSeason.teamCode);
  const filled = roster.filter((s) => s.player).length;
  const total = roster.length;

  const groups = useMemo(() => {
    const available = teamSeason.players.filter(
      (p) => !draftedIds.includes(p.id)
    );
    return POSITION_ORDER.map((pos) => ({
      pos,
      players: available
        .filter((p) => p.position === pos)
        .sort((a, b) =>
          mode === "classic"
            ? b.overall - a.overall
            : a.name.localeCompare(b.name)
        ),
    })).filter((g) => g.players.length);
  }, [teamSeason, draftedIds, mode]);

  const openSlots = roster.filter((s) => !s.player);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-white/50">
        <span>
          Round <span className="text-white">{filled + 1}</span> of {total}
        </span>
        <span className="uppercase tracking-wider">
          {mode === "classic" ? "Classic Mode" : "Blind Mode"}
        </span>
      </div>
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400 transition-all"
          style={{ width: `${(filled / total) * 100}%` }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          <div
            className="mb-4 overflow-hidden rounded-2xl p-5 ring-1 ring-white/10"
            style={{
              background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}cc 55%, #080b12 150%)`,
            }}
          >
            <div className="text-xs font-semibold uppercase tracking-widest text-white/60">
              On the clock — pick one player
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
              <span
                className="text-3xl font-black tracking-tight"
                style={{ color: theme.accent }}
              >
                {teamSeason.season}
              </span>
              <span className="text-2xl font-bold text-white">
                {teamSeason.team}
              </span>
            </div>
          </div>

          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.pos}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-white/40">
                    {g.pos}
                  </span>
                  <span className="text-xs text-white/30">
                    {POSITION_NAMES[g.pos]}
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.players.map((p) => (
                    <PlayerCard
                      key={p.id}
                      player={p}
                      reveal={reveal}
                      onClick={() => setPending(p)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <RosterPanel roster={roster} reveal={reveal} />
        </div>
      </div>

      {pending && (
        <SlotPicker
          player={pending}
          openSlots={openSlots}
          reveal={reveal}
          onPick={(slotId) => {
            onDraft(pending, slotId);
            setPending(null);
          }}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
