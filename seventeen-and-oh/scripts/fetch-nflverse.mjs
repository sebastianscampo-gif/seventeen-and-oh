// fetch-nflverse.mjs
// Downloads REAL historical NFL rosters + weekly player stats from the public,
// free nflverse-data releases into data/raw/source/nflverse/. This is a one-time
// bulk download; files are cached (skipped if already present) so re-runs are
// cheap and offline-friendly.
//
// Source: https://github.com/nflverse/nflverse-data  (CC-BY-4.0 community data)
// Using a real public dataset is what lets us honor the project rule "do not
// hallucinate complete historical rosters" — every player here is real.
//
// Usage:
//   node scripts/fetch-nflverse.mjs --from 1965 --to 2024      (rosters + stats)
//   node scripts/fetch-nflverse.mjs --from 2023 --to 2024 --no-stats
//   npm run data:fetch -- --from 2020 --to 2024

import fs from "node:fs";
import { fromRoot, log } from "./lib/util.mjs";

const BASE = "https://github.com/nflverse/nflverse-data/releases/download";
const OUT = fromRoot("data", "raw", "source", "nflverse");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const FROM = parseInt(arg("from", "1965"), 10);
const TO = parseInt(arg("to", String(new Date().getFullYear() - 1)), 10);
const NO_STATS = process.argv.includes("--no-stats");

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return "cached";
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    return `ERR ${e.message}`;
  }
  if (!res.ok) return `HTTP ${res.status}`;
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return `${(buf.length / 1024).toFixed(0)}KB`;
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  log.step(`Fetching nflverse data ${FROM}-${TO}${NO_STATS ? " (rosters only)" : ""}`);

  let rosterOk = 0;
  let rosterMiss = 0;
  for (let y = FROM; y <= TO; y++) {
    const r = await download(`${BASE}/rosters/roster_${y}.csv`, `${OUT}/roster_${y}.csv`);
    if (r.startsWith("HTTP") || r.startsWith("ERR")) {
      log.warn(`roster_${y}.csv ${r}`);
      rosterMiss++;
    } else {
      log.info(`roster_${y}.csv ${r}`);
      rosterOk++;
    }
    if (!NO_STATS) {
      const s = await download(`${BASE}/player_stats/player_stats_${y}.csv`, `${OUT}/player_stats_${y}.csv`);
      if (s.startsWith("HTTP") || s.startsWith("ERR")) log.warn(`player_stats_${y}.csv ${s} (skipping stats for ${y})`);
      else log.info(`player_stats_${y}.csv ${s}`);
    }
  }
  log.ok(`${rosterOk} roster file(s) available in data/raw/source/nflverse/` + (rosterMiss ? `, ${rosterMiss} unavailable` : ""));
  log.info("next: node scripts/adapt-nflverse.mjs --from " + FROM + " --to " + TO);
}

run();
