"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { GameMode, Player, Position, RosterSlot, TeamSeason } from "@/lib/types";
import type { TeamSeasonSummary } from "@/lib/data";
import { fitTier, POSITION_NAMES, positionFit } from "@/lib/positions";
import { effectiveRating } from "@/lib/scoring";
import { getTeamColorTheme } from "@/lib/teamColorThemes";
import TeamSeasonSpinner from "./TeamSeasonSpinner";
import FootballFormationMap from "./FootballFormationMap";
import RosterDetailsPanel from "./RosterDetailsPanel";

const POSITION_ORDER: Position[] = [
  "QB", "RB", "WR", "TE", "LT", "LG", "C", "RG", "RT",
  "EDGE", "DT", "LB", "CB", "S", "K", "P",
];

const OL_POSITIONS: Position[] = ["LT", "LG", "C", "RG", "RT"];

const attrLabel = (k: string) =>
  k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function topAttributes(p: Player, n = 3): [string, number][] {
  return Object.entries(p.attributes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function computeRosterNeeds(roster: RosterSlot[]): string[] {
  const empty = roster.filter((s) => !s.player && !s.optional);
  if (!empty.length) return ["Roster complete"];

  const needs: string[] = [];
  const emptyOl = OL_POSITIONS.filter((p) =>
    empty.some((s) => s.position === p)
  );

  for (const pos of POSITION_ORDER) {
    const count = empty.filter((s) => s.position === pos).length;
    if (!count) continue;
    if (OL_POSITIONS.includes(pos)) continue;
    needs.push(count === 1 ? `Need ${pos}` : `Need ${pos} (×${count})`);
  }

  if (emptyOl.length >= 3) {
    needs.push("Offensive line incomplete");
  } else {
    for (const pos of emptyOl) {
      needs.push(`Need ${pos}`);
    }
  }

  return needs.slice(0, 8);
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
      className={`flex w-full items-center justify-between gap-2 rounded-xl p-2.5 text-left ring-1 transition ${
        selected
          ? "bg-emerald-500/15 ring-emerald-400/50"
          : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.08] hover:ring-white/25"
      }`}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">
          {player.name}
        </div>
        {reveal ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {topAttributes(player, 2).map(([k, v]) => (
              <span
                key={k}
                className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50"
              >
                {attrLabel(k)} {v}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-0.5 text-[11px] text-white/35">
            {POSITION_NAMES[player.position]}
          </div>
        )}
      </div>
      {reveal ? (
        <div className="shrink-0 text-right">
          <div className="text-lg font-black text-white">{player.overall}</div>
          <div className="text-[9px] uppercase tracking-wider text-white/40">
            OVR
          </div>
        </div>
      ) : (
        <div className="shrink-0 rounded-lg bg-white/5 px-2 py-1 font-mono text-xs font-bold text-white/60">
          {player.position}
        </div>
      )}
    </button>
  );
}

function RosterNeedsSummary({ roster }: { roster: RosterSlot[] }) {
  const needs = computeRosterNeeds(roster);
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        Roster Needs
      </div>
      <ul className="space-y-1">
        {needs.map((need) => (
          <li
            key={need}
            className="flex items-center gap-2 text-xs text-white/60"
          >
            <span className="h-1 w-1 shrink-0 rounded-full bg-amber-400/80" />
            {need}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlacementOptions({
  pending,
  validSlots,
  reveal,
  onPlace,
  onCancel,
}: {
  pending: Player;
  validSlots: {
    slot: RosterSlot;
    fit: number;
    effective: number;
  }[];
  reveal: boolean;
  onPlace: (slotId: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-400/30">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/70">
        Confirm placement
      </div>
      <div className="mt-1 truncate text-sm font-bold text-white">
        {pending.name}
        <span className="ml-1 font-normal text-white/50">
          · {pending.position}
          {reveal ? ` · ${pending.overall} OVR` : ""}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-white/50">
        Choose a position on the field or confirm below.
      </p>
      <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
        {validSlots.map(({ slot, fit, effective }, i) => {
          const tier = fitTier(fit);
          return (
            <button
              key={slot.id}
              onClick={() => onPlace(slot.id)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs ring-1 transition hover:bg-white/10 ${
                i === 0
                  ? "bg-emerald-500/15 ring-emerald-400/40"
                  : "bg-white/[0.04] ring-white/10"
              }`}
            >
              <span className="font-semibold text-white">
                {slot.label}
                {i === 0 && (
                  <span className="ml-1.5 font-normal text-emerald-300/80">
                    best fit
                  </span>
                )}
              </span>
              <span className="shrink-0 text-white/50">
                {tier.label}
                {reveal ? ` · ${effective}` : ""}
              </span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onCancel}
        className="mt-2 w-full rounded-lg bg-white/10 py-1.5 text-xs font-medium text-white/70 ring-1 ring-white/10 transition hover:bg-white/20 hover:text-white"
      >
        Cancel
      </button>
    </div>
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
  const theme = getTeamColorTheme(teamSeason?.teamCode ?? "");
  const teamVars = {
    "--team-primary": theme.primary,
    "--team-secondary": theme.secondary,
    "--team-accent": theme.accent,
    "--team-text": theme.text,
    "--team-border": theme.border,
    "--team-glow": theme.glow,
    "--team-gradient": theme.gradient,
  } as React.CSSProperties;
  const filled = roster.filter((s) => s.player).length;
  const total = roster.length;

  const fieldRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pending) return;
    const narrow = window.matchMedia("(max-width: 1023px)").matches;
    if (narrow) {
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

  const flatPlayers = useMemo(
    () => groups.flatMap((g) => g.players),
    [groups]
  );

  const validSlots = useMemo(() => {
    if (!pending) return [];
    return roster
      .filter((s) => !s.player)
      .map((s) => ({
        slot: s,
        fit: positionFit(
          pending.position,
          pending.secondaryPositions,
          s.position
        ),
        effective: effectiveRating(pending, s.position),
      }))
      .filter((x) => x.fit > 0.15)
      .sort((a, b) => b.effective - a.effective);
  }, [pending, roster]);

  const suggestedSlotId = validSlots[0]?.slot.id ?? null;

  function placePlayer(slotId: string) {
    if (!pending) return;
    onDraft(pending, slotId);
    setPending(null);
    setInspectedSlotId(null);
  }

  const teamSeasonCard = teamSeason && !loadingRoster && (
    <div
      className="overflow-hidden rounded-2xl p-3.5 transition-all duration-300"
      style={{
        ...teamVars,
        background:
          "linear-gradient(135deg, rgba(2,6,12,0.28) 0%, rgba(2,6,12,0.58) 100%), var(--team-gradient)",
        boxShadow:
          "inset 0 0 0 1px color-mix(in srgb, var(--team-border) 45%, transparent), 0 18px 48px -24px var(--team-glow)",
      }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: theme.mutedText }}
      >
        Current team-season
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className="text-xl font-black tracking-tight"
          style={{ color: "var(--team-accent)" }}
        >
          {teamSeason.season}
        </span>
        <span
          className="text-lg font-bold leading-tight"
          style={{ color: "var(--team-text)" }}
        >
          {teamSeason.team}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-white/45">{teamSeason.label}</p>
    </div>
  );

  const playerSelection = teamSeason && !loadingRoster && (
    <div
      style={teamVars}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Available players
        </div>
        <span className="text-[10px] text-white/30">
          {flatPlayers.length} left
        </span>
      </div>
      <div
        className={`min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5 max-lg:max-h-[min(42vh,28rem)] ${
          pending ? "pointer-events-none opacity-40" : ""
        }`}
      >
        {groups.map((g) => (
          <div key={g.pos}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-white/40">
                {g.pos}
              </span>
              <div
                className="h-px flex-1"
                style={{
                  background:
                    "linear-gradient(to right, color-mix(in srgb, var(--team-border) 38%, transparent) 0%, rgba(255,255,255,0.06) 55%, transparent 100%)",
                }}
              />
            </div>
            <div className="space-y-1.5">
              {g.players.map((p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  reveal={reveal}
                  selected={pending?.id === p.id}
                  onClick={() => {
                    setPending(p);
                    setInspectedSlotId(null);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-4 lg:py-5">
      {/* Round progress — full width header */}
      <div className="mb-3 shrink-0">
        <div className="flex items-center justify-between text-xs font-medium text-white/50">
          <span>
            Round <span className="text-white">{filled + 1}</span> of {total}
          </span>
          <span className="uppercase tracking-wider">
            {mode === "classic" ? "Classic Mode" : "Blind Mode"}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all"
            style={{ width: `${(filled / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Two-column draft layout */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,34%)] lg:items-start">
        {/* LEFT: Football field / roster board */}
        <div
          ref={fieldRef}
          className="order-3 min-w-0 scroll-mt-4 lg:order-1"
        >
          <FootballFormationMap
            rosterSlots={roster}
            selectedDraftedPlayer={pending}
            mode={mode}
            showRatings={reveal}
            activeSlotId={inspectedSlotId}
            suggestedSlotId={suggestedSlotId}
            onSlotClick={(id) => setInspectedSlotId(id)}
            onAssignPlayerToSlot={(_playerId, slotId) => placePlayer(slotId)}
          />

          {pending && (
            <div className="mt-3 hidden items-center justify-between gap-3 rounded-xl bg-emerald-500/10 px-4 py-3 ring-1 ring-emerald-400/30 lg:flex">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/70">
                  On the clock
                </div>
                <div className="truncate font-bold text-white">
                  {pending.name}
                  <span className="ml-1 font-normal text-white/50">
                    · tap a glowing position or confirm in the sidebar
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Draft sidebar — dashboard + team-season + players */}
        <aside className="order-1 flex min-h-0 flex-col gap-3 lg:order-2 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5.5rem)]">
          {/* Desktop: dashboard at top */}
          <div className="hidden shrink-0 lg:block">
            <RosterDetailsPanel
              roster={roster}
              mode={mode}
              pending={pending}
              activeSlotId={inspectedSlotId}
            />
          </div>

          {/* Spinner — hidden while placing a player */}
          {!pending && (
            <div className="shrink-0">
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
            </div>
          )}

          {loadingRoster && (
            <div className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white/[0.03] py-5 text-sm text-white/50 ring-1 ring-white/10">
              <svg
                className="h-4 w-4 animate-spin text-white/60"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
                />
              </svg>
              Revealing the roster…
            </div>
          )}

          {!teamSeason && !loadingRoster && !pending && (
            <p className="shrink-0 text-center text-sm text-white/40">
              Spin to lock in a team-season, then draft one of its players.
            </p>
          )}

          {teamSeasonCard}

          {pending && validSlots.length > 0 && (
            <PlacementOptions
              pending={pending}
              validSlots={validSlots}
              reveal={reveal}
              onPlace={placePlayer}
              onCancel={() => setPending(null)}
            />
          )}

          {/* Scrollable player list fills remaining sidebar height on desktop */}
          {playerSelection}

          <div className="shrink-0">
            <RosterNeedsSummary roster={roster} />
          </div>

          {/* Mobile: dashboard at bottom */}
          <div className="shrink-0 lg:hidden">
            <RosterDetailsPanel
              roster={roster}
              mode={mode}
              pending={pending}
              activeSlotId={inspectedSlotId}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
