// build.mjs — run the full data pipeline end to end.
//   import-rosters -> generate-ratings -> apply-overrides -> export-team-seasons
//
// Run:  node scripts/build.mjs   (or: npm run data:build)

import { execFileSync } from "node:child_process";
import { fromRoot } from "./lib/util.mjs";

const steps = [
  "import-rosters.mjs",
  "generate-ratings.mjs",
  "apply-overrides.mjs",
  "export-team-seasons.mjs",
];

console.log("17-0 data pipeline\n==================");
for (const step of steps) {
  execFileSync(process.execPath, [fromRoot("scripts", step)], { stdio: "inherit" });
}
console.log("\n✓ Pipeline complete. Game data is in public/team-seasons/ (served on demand).");
