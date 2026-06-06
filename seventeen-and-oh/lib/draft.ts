import { TeamSeason } from "./types";

// Picks a random team-season, avoiding an immediate repeat when possible.
export function randomTeamSeason(
  pool: TeamSeason[],
  avoidId?: string
): TeamSeason {
  const choices =
    avoidId && pool.length > 1 ? pool.filter((t) => t.id !== avoidId) : pool;
  return choices[Math.floor(Math.random() * choices.length)];
}
