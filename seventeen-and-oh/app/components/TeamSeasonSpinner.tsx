"use client";
import { useEffect, useRef, useState } from "react";
import type { TeamSeasonSummary } from "@/lib/data";
import type { GameMode } from "@/lib/types";
import {
  mulberry32,
  randomSeed,
  selectRandomTeamSeason,
  isValidTeamSeason,
} from "@/lib/draft-select";
import { teamTheme } from "@/lib/teamColors";

// A slot-machine / wheel-spin selector for one team-season. The two reels (TEAM
// and SEASON) flip rapidly through *whole, valid* catalog entries — never a team
// and a season chosen independently — then decelerate and lock on a single real
// team-season. The landed entry is reported via onSpinComplete so the parent can
// load its roster.
//
// The component owns its full lifecycle: idle → spinning → landed (it keeps
// showing the result). To start a fresh round, remount it with a changing `key`.

export interface TeamSeasonSpinnerProps {
  /** The lightweight catalog to cycle through. Each entry is a valid combo. */
  teamSeasons: TeamSeasonSummary[];
  /** Fired exactly once when the reels lock on the final pick. */
  onSpinComplete: (pick: TeamSeasonSummary) => void;
  /** Block interaction (e.g. while the parent is loading the landed roster). */
  disabled?: boolean;
  /** Draft mode — team/season are shown in both; used for the debug readout. */
  mode: GameMode;
  /** Avoid an immediate back-to-back repeat of this id when possible. */
  avoidId?: string | null;
  /** Seed for a reproducible spin (same seed → same pick + duration). */
  seed?: number;
  /** Show the dev/debug readout under the wheel. */
  debug?: boolean;
}

type Phase = "idle" | "spinning" | "landed";

interface SpinMeta {
  pick: TeamSeasonSummary;
  duration: number;
  seed: number;
  valid: boolean;
}

/** Track the OS "reduce motion" setting so we can skip the rapid animation. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function Reel({
  label,
  value,
  spinning,
  landed,
  glow,
}: {
  label: string;
  value: string | null;
  spinning: boolean;
  landed: boolean;
  glow: string;
}) {
  return (
    <div
      className={`relative flex-1 overflow-hidden rounded-2xl ring-1 transition-shadow duration-300 ${
        landed ? "ring-white/25" : "ring-white/10"
      }`}
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(8,11,18,0.6) 55%, rgba(8,11,18,0.9) 100%)",
        boxShadow: landed ? `0 0 0 1px ${glow}55, 0 12px 40px -12px ${glow}aa` : undefined,
      }}
    >
      {/* slot-window sheen: subtle fades top & bottom to read like a reel */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/40 to-transparent" />
      <div className="flex h-28 flex-col items-center justify-center px-3 sm:h-32">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          {label}
        </div>
        {value ? (
          <div
            key={value}
            className={`text-center text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl ${
              spinning ? "reel-roll blur-[0.4px]" : landed ? "reel-pop" : ""
            }`}
          >
            {value}
          </div>
        ) : (
          <div className="text-2xl font-black tracking-tight text-white/15 sm:text-3xl">
            —
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamSeasonSpinner({
  teamSeasons,
  onSpinComplete,
  disabled = false,
  mode,
  avoidId = null,
  seed,
  debug = false,
}: TeamSeasonSpinnerProps) {
  const prefersReduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [display, setDisplay] = useState<TeamSeasonSummary | null>(null);
  const [meta, setMeta] = useState<SpinMeta | null>(null);

  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any in-flight animation if we unmount mid-spin (parent remounts the
  // component per round, so this fires between rounds).
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    };
  }, []);

  const ready = teamSeasons.length > 0;
  const interactive = phase === "idle" && !disabled && ready;

  function land(pick: TeamSeasonSummary) {
    setDisplay(pick);
    setPhase("landed");
    onSpinComplete(pick);
  }

  function startSpin() {
    if (phase !== "idle" || disabled || !ready) return; // no double-spin

    // Fix the outcome up front from the SEEDED rng so it is fully reproducible
    // and immune to frame-rate jitter. The cosmetic per-tick flicker below uses
    // Math.random instead, so it can never change where we land.
    const seedUsed = seed ?? randomSeed();
    const rng = mulberry32(seedUsed);
    const pick = selectRandomTeamSeason(teamSeasons, { avoidId, rng });
    const duration = Math.round(1500 + rng() * 1000); // 1.5–2.5s
    setMeta({
      pick,
      duration,
      seed: seedUsed,
      valid: isValidTeamSeason(teamSeasons, pick.id),
    });
    setPhase("spinning");

    if (prefersReduced) {
      // Accessibility: no rapid cycling — a short fade straight to the result.
      setDisplay(pick);
      timeoutRef.current = setTimeout(() => land(pick), 420);
      return;
    }

    // Completion is driven by a timer, NOT the animation-frame loop, so the round
    // always finishes after `duration` even if requestAnimationFrame is throttled
    // or paused (e.g. the tab is backgrounded mid-spin). rAF only does the
    // cosmetic reel flicker, which is fine to drop while hidden.
    timeoutRef.current = setTimeout(() => land(pick), duration);

    const startedAt = performance.now();
    let lastTickAt = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      if (elapsed >= duration) return; // the timeout owns the final landing
      const t = elapsed / duration;
      // Tick interval grows with t² → the reels visibly decelerate before stop.
      const interval = 45 + 210 * t * t;
      if (elapsed - lastTickAt >= interval) {
        lastTickAt = elapsed;
        // Cosmetic only: a random *valid* catalog entry, so every frame on
        // screen is a real team-season combo.
        setDisplay(teamSeasons[Math.floor(Math.random() * teamSeasons.length)]);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.key === "Enter" || e.key === " ") && interactive) {
      e.preventDefault();
      startSpin();
    }
  }

  const spinning = phase === "spinning";
  const landed = phase === "landed";
  const glow = display ? teamTheme(display.teamCode).accent : "#60a5fa";

  return (
    <div className="w-full">
      {/* Tap-anywhere spin area */}
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : -1}
        aria-label={interactive ? "Spin the wheel" : undefined}
        onClick={interactive ? startSpin : undefined}
        onKeyDown={onKeyDown}
        className={`rounded-3xl bg-white/[0.02] p-4 ring-1 ring-white/10 sm:p-5 ${
          interactive ? "cursor-pointer transition hover:ring-white/20" : ""
        }`}
      >
        <div className="flex items-stretch gap-3 sm:gap-4">
          <Reel
            label="Team"
            value={display ? display.team : null}
            spinning={spinning}
            landed={landed}
            glow={glow}
          />
          <div
            className={`flex w-8 shrink-0 items-center justify-center text-3xl font-light sm:w-10 sm:text-4xl ${
              landed ? "text-white/50" : "text-white/20"
            }`}
            aria-hidden
          >
            ×
          </div>
          <Reel
            label="Season"
            value={display ? String(display.season) : null}
            spinning={spinning}
            landed={landed}
            glow={glow}
          />
        </div>

        {/* Screen-reader announcement of the locked result */}
        <div className="sr-only" aria-live="polite">
          {landed && display ? `${display.label} selected` : ""}
        </div>

        {/* Button + helper text */}
        <div className="mt-5 flex flex-col items-center">
          {!landed ? (
            <button
              type="button"
              onClick={interactive ? startSpin : undefined}
              disabled={!interactive}
              aria-busy={spinning}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-3.5 text-base font-bold tracking-tight text-white shadow-lg transition ${
                spinning
                  ? "cursor-wait bg-white/10"
                  : interactive
                    ? "bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500"
                    : "cursor-not-allowed bg-white/5 text-white/40"
              }`}
            >
              {spinning ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin text-white/80"
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
                  Spinning…
                </>
              ) : (
                <>
                  <span aria-hidden>🏟️</span>
                  {ready ? "Spin the Wheel" : "Loading teams…"}
                </>
              )}
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-1.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
              <span aria-hidden>✓</span> Locked in — {display?.label}
            </div>
          )}

          {!landed && (
            <p className="mt-3 text-xs text-white/40">
              {spinning ? "Landing on a team-season…" : "or tap anywhere to spin"}
            </p>
          )}
        </div>
      </div>

      {debug && (
        <div className="mt-3 rounded-xl bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-white/55 ring-1 ring-white/10">
          <div className="mb-1 font-semibold uppercase tracking-wider text-white/40">
            debug · spin wheel
          </div>
          {meta ? (
            <div className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
              <span>team-season id: <span className="text-white/80">{meta.pick.id}</span></span>
              <span>roster file: <span className="text-white/80">{meta.pick.id}.json</span></span>
              <span>players available: <span className="text-white/80">{meta.pick.playerCount}</span></span>
              <span>valid team-season: <span className={meta.valid ? "text-emerald-300" : "text-rose-300"}>{meta.valid ? "yes" : "NO"}</span></span>
              <span>spin duration: <span className="text-white/80">{meta.duration}ms</span></span>
              <span>seed: <span className="text-white/80">{meta.seed}{seed != null ? " (fixed)" : ""}</span></span>
              <span>reduced motion: <span className="text-white/80">{prefersReduced ? "on" : "off"}</span></span>
              <span>mode: <span className="text-white/80">{mode}</span></span>
              <span>catalog size: <span className="text-white/80">{teamSeasons.length}</span></span>
              <span>phase: <span className="text-white/80">{phase}</span></span>
            </div>
          ) : (
            <div className="text-white/40">
              awaiting first spin · catalog size {teamSeasons.length} · mode {mode}
              {seed != null ? ` · seed ${seed} (fixed)` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
