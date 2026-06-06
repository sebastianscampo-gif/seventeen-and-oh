import playersData from "@/data/players.json";
import { Player, TeamSeason } from "./types";

// The dataset is a flat array of players so it can be swapped for a larger
// JSON/CSV import later without touching the rest of the app.
const players = playersData as unknown as Player[];

export function getAllPlayers(): Player[] {
  return players;
}

export function getTeamSeasons(): TeamSeason[] {
  const map = new Map<string, TeamSeason>();
  for (const p of players) {
    const id = `${p.season}-${p.teamCode}`;
    let ts = map.get(id);
    if (!ts) {
      ts = {
        id,
        team: p.team,
        teamCode: p.teamCode,
        season: p.season,
        label: `${p.season} ${p.team}`,
        players: [],
      };
      map.set(id, ts);
    }
    ts.players.push(p);
  }
  return [...map.values()].sort((a, b) => a.season - b.season);
}
