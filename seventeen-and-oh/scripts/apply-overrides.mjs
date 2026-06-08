// apply-overrides.mjs
// Overlays data/rating_overrides.csv onto data/processed/ratings.csv.
//
// Match key: player_id (required). season and team_code are optional — leave
// them blank to apply an override to every season/team of that player (handy
// for a franchise legend), or set them to target one specific player-season.
//
// Any non-blank rating field in the override replaces the generated value.
// Status: explicit `status` column wins; otherwise an override that sets at
// least one rating value becomes `manual_override`, and one that sets none
// becomes `manually_reviewed` (a reviewer signing off on generated numbers).
//
// Run:  node scripts/apply-overrides.mjs   (or: npm run data:overrides)

import { readCsv, writeCsv } from "./lib/csv.mjs";
import {
  RATING_FIELDS, RATINGS_COLUMNS, ATTRIBUTE_FIELDS, POSITION_GROUP,
  STATUS, SOURCE, ALL_STATUSES,
} from "./lib/schema.mjs";
import { projectAttributes } from "./lib/ratings-engine.mjs";
import { fromRoot, log, num } from "./lib/util.mjs";

function run() {
  log.step("Applying manual overrides");

  const ratings = readCsv(fromRoot("data", "processed", "ratings.csv"));
  if (ratings.length === 0) {
    log.warn("No ratings.csv — run generate-ratings first.");
    return;
  }
  const overrides = readCsv(fromRoot("data", "rating_overrides.csv"));
  if (overrides.length === 0) {
    log.info("No overrides file (or it is empty) — leaving generated ratings as-is.");
    writeCsv(fromRoot("data", "processed", "ratings.csv"), ratings, RATINGS_COLUMNS);
    return;
  }

  let applied = 0;
  let unmatched = 0;

  let skipped = 0;

  for (const ov of overrides) {
    const pid = (ov.player_id || "").trim();
    if (!pid) continue;
    // A reviewer can park an entry without it taking effect by tagging its
    // review_status. Anything else (approved, reviewed, blank, ...) applies —
    // overrides always take priority over generated ratings.
    const review = (ov.review_status || "").trim().toLowerCase();
    if (review === "rejected" || review === "draft" || review === "wip") {
      skipped++;
      continue;
    }
    const ovSeason = (ov.season || "").trim();
    const ovTeam = (ov.team_code || "").trim();

    const matches = ratings.filter(
      (r) =>
        r.player_id === pid &&
        (ovSeason === "" || String(r.season) === ovSeason) &&
        (ovTeam === "" || r.team_code === ovTeam)
    );
    if (matches.length === 0) {
      log.warn(`Override for "${pid}"${ovSeason ? " " + ovSeason : ""}${ovTeam ? " " + ovTeam : ""} matched no rating row.`);
      unmatched++;
      continue;
    }

    const fieldsSet = RATING_FIELDS.filter((f) => ov[f] != null && ov[f] !== "");
    const explicitStatus = ALL_STATUSES.includes(ov.status) ? ov.status : null;
    const status = explicitStatus || (fieldsSet.length ? STATUS.MANUAL_OVERRIDE : STATUS.MANUALLY_REVIEWED);
    const confidence =
      ov.rating_confidence !== "" && ov.rating_confidence != null
        ? num(ov.rating_confidence)
        : status === STATUS.MANUAL_OVERRIDE
        ? 0.95
        : 0.85;

    // Provenance suffix from the audit metadata, appended to the note so it
    // survives into the exported sourceNote.
    const prov = [];
    if ((ov.reviewed_by || "").trim()) prov.push(`by ${ov.reviewed_by.trim()}`);
    if ((ov.last_updated || "").trim()) prov.push(ov.last_updated.trim());
    const note = [ov.reason, prov.length ? `[${prov.join(", ")}]` : ""].filter(Boolean).join(" ");

    const overallOverridden = fieldsSet.includes("overall");
    const group = POSITION_GROUP[(ov.position || "").trim()] || "RB";

    for (const r of matches) {
      // When an override changes `overall` but leaves some attributes blank,
      // re-derive those blanks from the NEW overall using the same position
      // model the engine uses. Without this, an override that sets only
      // `overall` (e.g. an elite stat-less lineman bumped to 92) would keep the
      // attributes computed from its old, wrong overall — a star with depth-tier
      // attributes. Explicitly overridden attributes always win (applied below).
      if (overallOverridden) {
        const seed = `${r.player_id}|${r.season}|${r.team_code}`;
        const derived = projectAttributes(group, num(ov.overall), seed);
        for (const a of ATTRIBUTE_FIELDS) {
          if (!fieldsSet.includes(a)) r[a] = derived[a];
        }
      }
      for (const f of fieldsSet) r[f] = num(ov[f]);
      r.status = status;
      r.rating_source = SOURCE.MANUAL;
      r.rating_confidence = confidence;
      // A human has now signed off, so the player no longer needs manual review.
      r.needs_manual_review = "";
      if (note) r.note = note;
      applied++;
    }
  }

  writeCsv(fromRoot("data", "processed", "ratings.csv"), ratings, RATINGS_COLUMNS);
  log.ok(
    `${applied} rating row(s) overridden from ${overrides.length} override entr(ies)` +
      (unmatched ? `, ${unmatched} unmatched` : "") +
      (skipped ? `, ${skipped} skipped (review_status)` : "")
  );
}

run();
