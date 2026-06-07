// Small shared helpers for the 17-0 data pipeline.

import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to the project root (one level up from /scripts). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Resolve a path relative to the project root. */
export const fromRoot = (...p) => path.join(ROOT, ...p);

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const roundTo = (n, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Parse a number, returning `fallback` for blank/invalid input. */
export function num(value, fallback = null) {
  if (value == null || value === "") return fallback;
  const n = Number(String(value).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

/** Truthy-string parser for CSV booleans. */
export function bool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return /^(1|true|yes|y)$/i.test(String(value).trim());
}

/** "a; b ,c" -> ["a","b","c"] (semicolon or comma separated, trimmed, no blanks). */
export function list(value) {
  if (!value) return [];
  return String(value)
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Lower-kebab slug, ASCII-folded (e.g., "Donté Stallworth" -> "donte-stallworth"). */
export function slugify(name) {
  return String(name)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Stable player_id from a name. A roster row may also provide an explicit
 * player_id; this is only the fallback used when that column is blank.
 */
export function playerIdFromName(name) {
  return slugify(name);
}

/** Deterministic 32-bit hash of a string (FNV-1a) -> unsigned int. */
export function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic pseudo-random value in [-1, 1] derived from a seed string.
 * Used to give attributes a stable, reproducible spread without real RNG.
 */
export function jitter(seed) {
  return (hashStr(seed) / 0xffffffff) * 2 - 1;
}

/** Map a season year to a coarse era label. */
export function eraOf(season) {
  const decade = Math.floor(season / 10) * 10;
  return `${decade}s`;
}

/** "2007 New England Patriots" */
export const teamSeasonLabel = (season, teamName) => `${season} ${teamName}`;

/** Canonical id used across the pipeline + game: `${season}_${teamCode}`. */
export const teamSeasonId = (season, teamCode) => `${season}_${teamCode}`;

/** snake_case / kebab -> camelCase (passRating, manCoverage, ...). */
export function camel(key) {
  return key.replace(/[-_]([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** Console helpers that keep script output tidy and greppable. */
export const log = {
  step: (msg) => console.log(`\n→ ${msg}`),
  info: (msg) => console.log(`  ${msg}`),
  ok: (msg) => console.log(`  ✓ ${msg}`),
  warn: (msg) => console.warn(`  ! ${msg}`),
};
