"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { GameMode, Player, Position, RosterSlot, TeamSeason } from "@/lib/types";
import type { TeamSeasonSummary } from "@/lib/data";
import { POSITION_NAMES } from "@/lib/positions";
import { teamTheme } from "@/lib/teamColors";
import TeamSeasonSpinner from "./TeamSeasonSpinner";
import FootballFormationMap from "./FootballFormationMap";
import RosterDetailsPanel from "./RosterDetailsPanel";

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
  selected,
  onClick,
}: {
  player: Player;
  reveal: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between gap-3 rounded-xl p-3 text-left ring-1 transition ${
        selected
          ? "bg-emerald-500/15 ring-emerald-400/50"
          : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.08] hover:ring-white/25"
      }`}
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

export default function DraftScreen({
  mode,
  roster,
  catalog,
  teamSeason,
  draftedIds,
  loadingRoster,
  avoidId,
  seed,
  debug,
  onSpinComplete,
  onDraft,
}: {
  mode: GameMode;
  roster: RosterSlot[];
  catalog: TeamSeasonSummary[];
  teamSeason: TeamSeason | null;
  draftedIds: string[];
  loadingRoster: boolean;
  avoidId: string | null;
  seed?: number;
  debug?: boolean;
  onSpinComplete: (pick: TeamSeasonSummary) => void;
  onDraft: (player: Player, slotId: string) => void;
}) {
  const [pending, setPending] = useState<Player | null>(null);
  const [inspectedSlotId, setInspectedSlotId] = useState<string | null>(null);
  const reveal = mode === "classic";
  const theme = teamTheme(teamSeason?.teamCode ?? "");
  const filled = roster.filter((s) => s.player).length;
  const total = roster.length;

  // Bring the field into view when the user picks a player to place — on mobile
  // the draftable list sits below the field, so the target needs to scroll up.
  const fieldRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pending) {
      fieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [pending]);

  const groups = useMemo(() => {
    if (!teamSeason) return [];
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

  function placePlayer(slotId: string) {
    if (!pending) return;
    onDraft(pending, slotId);
    setPending(null);
    setInspectedSlotId(null);
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
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

      <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
        <div className="min-w-0 space-y-4">
          {/* The team you're building — the central roster interface. */}
          <div ref={fieldRef} className="scroll-mt-4">
            <FootballFormationMap
              rosterSlots={roster}
              selectedDraftedPlayer={pending}
              mode={mode}
              showRatings={reveal}
              activeSlotId={inspectedSlotId}
              onSlotClick={(id) => setInspectedSlotId(id)}
              onAssignPlayerToSlot={(_playerId, slotId) => placePlayer(slotId)}
            />

            {pending && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 px-4 py-3 ring-1 ring-emerald-400/30">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/70">
                    On the clock
                  </div>
                  <div className="truncate font-bold text-white">
                    {pending.name}
                    <span className="ml-1 font-normal text-white/50">
                      · {pending.position}
                      {reveal ? ` · ${pending.overall} OVR` : ""}
                    </span>
                  </div>
                  <div className="text-xs text-white/50">
                    Tap a glowing position on the field to place him.
                  </div>
                </div>
                <button
                  onClick={() => setPending(null)}
                  className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white/70 ring-1 ring-white/10 transition hover:bg-white/20 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* This round's team-season is chosen by spinning the wheel. The
              spinner remounts each round (key=filled) so it resets to idle. */}
          {!pending && (
            <TeamSeasonSpinner
              key={filled}
              teamSeasons={catalog}
              onSpinComplete={onSpinComplete}
              disabled={loadingRoster}
              mode={mode}
              avoidId={avoidId}
              seed={seed == null ? undefined : seed + filled}
              debug={debug}
            />
          )}

          {loadingRoster && (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-white/[0.03] py-6 text-sm text-white/50 ring-1 ring-white/10">
              <svg
                className="h-4 w-4 animate-spin text-white/60"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
              Revealing the roster…
            </div>
          )}

          {!teamSeason && !loadingRoster && !pending && (
            <p className="text-center text-sm text-white/40">
              Spin to lock in a team-season, then draft one of its players onto
              the field.
            </p>
          )}

          {teamSeason && !loadingRoster && (
            <div className={pending ? "pointer-events-none opacity-40" : ""}>
              <div
                className="mb-4 overflow-hidden rounded-2xl p-4 ring-1 ring-white/10"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}cc 55%, #080b12 150%)`,
                }}
              >
                <div className="text-xs font-semibold uppercase tracking-widest text-white/60">
                  Pick a player to draft
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                  <span
                    className="text-2xl font-black tracking-tight"
                    style={{ color: theme.accent }}
                  >
                    {teamSeason.season}
                  </span>
                  <span className="text-xl font-bold text-white">
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
                          selected={pending?.id === p.id}
                          onClick={() => setPending(p)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <RosterDetailsPanel
            roster={roster}
            mode={mode}
            pending={pending}
            activeSlotId={inspectedSlotId}
          />
        </div>
      </div>
    </div>
  );
}
