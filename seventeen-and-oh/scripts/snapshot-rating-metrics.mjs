// Snapshot every exported team-season's rating metrics to a JSON file so we can
// diff BEFORE vs AFTER the engine fix. Usage:
//   node scripts/snapshot-rating-metrics.mjs <label>
// writes reports/_snapshots/<label>.json and prints database-wide aggregates.

import fs from "node:fs";
import path from "node:path";
import { allRosterMetrics, isSuspicious } from "./lib/roster-metrics.mjs";

const label = process.argv[2] || "snapshot";
const outDir = path.join(process.cwd(), "reports", "_snapshots");
fs.mkdirSync(outDir, { recursive: true });

const metrics = allRosterMetrics();
const byId = {};
for (const m of metrics) byId[`${m.season}_${m.team_code}`] = m;

const n = metrics.length;
const totalPlayers = metrics.reduce((a, m) => a + m.players_total, 0);
const avgOfAvg =
  metrics.reduce((a, m) => a + m.avg_ovr, 0) / Math.max(n, 1);
const avgPct6771 =
  metrics.reduce((a, m) => a + m.pct_67_71, 0) / Math.max(n, 1);
const avgSpread =
  metrics.reduce((a, m) => a + m.rating_spread, 0) / Math.max(n, 1);
const avgMax = metrics.reduce((a, m) => a + m.max_ovr, 0) / Math.max(n, 1);
const suspicious = metrics.filter(isSuspicious).length;

// Database-wide player-level band share.
let playersInBand = 0;
for (const m of metrics) playersInBand += (m.pct_67_71 / 100) * m.players_total;

const aggregate = {
  label,
  generatedAt: new Date().toISOString(),
  teamSeasons: n,
  totalPlayers,
  avgRosterAvgOvr: Math.round(avgOfAvg * 10) / 10,
  avgRosterMaxOvr: Math.round(avgMax * 10) / 10,
  avgRosterSpread: Math.round(avgSpread * 10) / 10,
  avgPct67to71: Math.round(avgPct6771 * 10) / 10,
  dbPlayersIn67to71: Math.round(playersInBand),
  dbPctPlayersIn67to71:
    Math.round((1000 * playersInBand) / Math.max(totalPlayers, 1)) / 10,
  suspiciousRosters: suspicious,
  pctSuspiciousRosters: Math.round((1000 * suspicious) / Math.max(n, 1)) / 10,
};

fs.writeFileSync(
  path.join(outDir, `${label}.json`),
  JSON.stringify({ aggregate, byId }, null, 2)
);

console.log(`\n=== ${label.toUpperCase()} ===`);
for (const [k, v] of Object.entries(aggregate)) console.log(`  ${k}: ${v}`);
console.log(`\nwrote reports/_snapshots/${label}.json`);
