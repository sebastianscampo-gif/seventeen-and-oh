// lib/draft-select.ts
// Selection + roster-loading helpers for the "spin the wheel" team-season draft
// mechanic. Framework-free so they can be unit-tested and reused by both the
// orchestrator (app/page.tsx) and the <TeamSeasonSpinner> component.
//
// THE DATA RULE: a draft result must ALWAYS be one complete, real entry from the
// team-season catalog. We never pick a team and a season independently — that
// could invent a combo that never existed (e.g. "1985 Kansas City Chiefs"). Every
// function here returns a whole TeamSeasonSummary, so a team and its season stay
// inseparable and the result is guaranteed to exist in the database.

import { loadTeamSeason, type TeamSeasonSummary } from "./data";
import type { TeamSeason } from "./types";

/** Deterministic 0..1 PRNG (mulberry32). Same seed → same stream, for repro. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh 32-bit seed for an unseeded spin (still surfaced in debug mode). */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

export interface SelectOptions {
  /** Avoid landing on this id (no back-to-back repeat) when possible. */
  avoidId?: string | null;
  /** Injected RNG for reproducible spins; defaults to Math.random. */
  rng?: () => number;
}

/**
 * Pick ONE complete team-season at random from the catalog. The returned object
 * is a whole valid entry — team and season are never recombined — so the result
 * is guaranteed to exist in the database. Avoids an immediate repeat when asked
 * and when the catalog has more than one entry.
 */
export function selectRandomTeamSeason(
  teamSeasons: TeamSeasonSummary[],
  opts: SelectOptions = {},
): TeamSeasonSummary {
  if (teamSeasons.length === 0) {
    throw new Error("selectRandomTeamSeason: empty catalog");
  }
  const rng = opts.rng ?? Math.random;
  const pool =
    opts.avoidId && teamSeasons.length > 1
      ? teamSeasons.filter((t) => t.id !== opts.avoidId)
      : teamSeasons;
  return pool[Math.floor(rng() * pool.length)];
}

/** Load the full roster (Player[] inside a TeamSeason) for a selected entry. */
export async function getRosterForTeamSeason(
  teamSeason: Pick<TeamSeasonSummary, "id">,
): Promise<TeamSeason> {
  return loadTeamSeason(teamSeason.id);
}

/** True when an entry really belongs to the catalog (debug / validity guard). */
export function isValidTeamSeason(
  teamSeasons: TeamSeasonSummary[],
  id: string,
): boolean {
  return teamSeasons.some((t) => t.id === id);
}

export interface CanSpinState {
  catalogSize: number;
  rosterFull: boolean;
  teamSeasonLocked: boolean; // a roster is already revealed for this round
  loading: boolean; // a roster fetch is in flight
}

/** Whether the user is allowed to start a spin right now. */
export function canSpin(state: CanSpinState): boolean {
  return (
    state.catalogSize > 0 &&
    !state.rosterFull &&
    !state.teamSeasonLocked &&
    !state.loading
  );
}
