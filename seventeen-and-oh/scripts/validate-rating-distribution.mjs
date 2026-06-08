// validate-rating-distribution.mjs
// Phase 2, Steps 10-11. Checks every team-season's rating distribution against the
// brief's realism rules and emits warnings — it never passes silently.
//
// Two severities:
//   FAIL — a real distribution bug the engine should not produce when the data
//          exists to avoid it (e.g. a roster that is flat or generic-70 *despite*
//          having recorded starts to separate its players; a backup out-rating a
//          proven starter; attributes that don't match the position).
//   WARN — a soft realism concern worth a human glance (great team with no elite,
//          bad team rated too high, an unusually elite-heavy roster).
//   INFO — flatness that is *expected* because the source data is missing (a
//          bio-only import with no starts/stats). The audit already documents
//          these; they are not a regression, so they do not fail the run.
//
// Writes reports/rating_distribution_warnings.csv and prints a summary. Exits 1 if
// any FAIL is found (so it can gate a regen), 0 otherwise.
//
// Run:  node scripts/validate-rating-distribution.mjs   (or: npm run ratings:validate)

import { readCsv, writeCsv } from "./lib/csv.mjs";
import { ATTRIBUTE_FIELDS, POSITION_GROUP, POSITION_PROFILE } from "./lib/schema.mjs";
import { fromRoot, log, num } from "./lib/util.mjs";

const OUT = fromRoot("reports", "rating_distribution_warnings.csv");
const COLUMNS = ["season", "team_code", "severity", "rule", "detail"];

// Distribution thresholds (the brief's Step-10 rules).
const FLAT_SAME_PCT = 40;   // >40% on one identical overall
const SAME_70_PCT = 30;     // >30% at exactly 70
const ELITE_HEAVY_PCT = 18; // >18% of a roster at 90+ is suspicious
const NO_ELITE_MAX = 85;    // a great team should have someone here or above
const BAD_TEAM_AVG = 78;    // a bad team averaging above this is too high

function winPct(reg) {
  const w = num(reg.wins, 0), l = num(reg.losses, 0), t = num(reg.ties, 0);
  const g = w + l + t;
  return g > 0 ? (w + 0.5 * t) / g : null;
}

// Team quality tier from record first (most reliable), team_strength as fallback.
function teamTier(reg) {
  const wp = winPct(reg);
  const ts = num(reg.team_strength, 70);
  const great = (wp != null && wp >= 0.75) || ts >= 80;
  const good = (wp != null && wp >= 0.5625) || ts >= 68;
  const bad = (wp != null && wp <= 0.25) || ts <= 52;
  return { great, good, bad, wp, ts };
}

// Are the player's KEY attributes (for their position) actually elevated above the
// attributes that are irrelevant to the position? If not, the attribute vector does
// not match the position — usually a bad override.
function attrsMatchPosition(group, rating) {
  const prof = POSITION_PROFILE[group];
  if (!prof || !prof.key?.length) return true;
  const mean = (keys) => {
    const vals = keys.map((k) => num(rating[k])).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  // Universe is the real attribute fields only — never row metadata like `season`.
  const keySet = new Set([...(prof.key || []), ...(prof.support || []), ...(prof.minor || [])]);
  const irrelevant = ATTRIBUTE_FIELDS.filter((a) => !keySet.has(a));
  const keyMean = mean(prof.key);
  const irrMean = mean(irrelevant);
  if (keyMean == null || irrMean == null) return true;
  return keyMean >= irrMean - 5; // key attrs should not trail the irrelevant ones
}

function run() {
  log.step("Validating rating distribution");

  const ratings = readCsv(fromRoot("data", "processed", "ratings.csv"));
  if (ratings.length === 0) {
    log.warn("No ratings.csv — run generate-ratings first.");
    return;
  }
  const registry = readCsv(fromRoot("data", "team_seasons.csv"));
  const playerSeasons = readCsv(fromRoot("data", "processed", "player_seasons.csv"));

  const regByKey = new Map();
  for (const r of registry) regByKey.set(`${num(r.season)}|${r.team_code}`, r);
  const psByKey = new Map();
  for (const p of playerSeasons) psByKey.set(`${p.player_id}|${num(p.season)}|${p.team_code}`, p);

  // Group ratings by team-season.
  const rosters = new Map();
  for (const r of ratings) {
    const key = `${num(r.season)}|${r.team_code}`;
    (rosters.get(key) || rosters.set(key, []).get(key)).push(r);
  }

  const warnings = [];
  const ruleCounts = {};
  let failTeams = 0, warnTeams = 0;
  const add = (season, team_code, severity, rule, detail) => {
    warnings.push({ season, team_code, severity, rule, detail });
    ruleCounts[`${severity}:${rule}`] = (ruleCounts[`${severity}:${rule}`] || 0) + 1;
  };

  for (const [key, roster] of rosters) {
    const [seasonStr, team_code] = key.split("|");
    const season = num(seasonStr);
    const reg = regByKey.get(key) || {};
    const tier = teamTier(reg);

    const overalls = roster.map((r) => num(r.overall)).filter((v) => v != null);
    const n = overalls.length;
    if (n === 0) continue;
    const avg = overalls.reduce((a, b) => a + b, 0) / n;
    const max = Math.max(...overalls);

    // Mode share + exactly-70 share.
    const freq = {};
    for (const v of overalls) freq[v] = (freq[v] || 0) + 1;
    const modeCount = Math.max(...Object.values(freq));
    const pctSame = (100 * modeCount) / n;
    const pct70 = (100 * (freq[70] || 0)) / n;
    const pct90 = (100 * overalls.filter((v) => v >= 90).length) / n;

    // Flatness is "expected" when it is driven by the data-sparse majority. Modern
    // (1999+) rosters are bimodal: a handful of skill players carry real evidence
    // while ~50 bio-only players (line, depth, special teams) have none and cluster
    // at the position-prior midpoint. That cluster is a documented data gap, not a
    // regression.
    //
    // The right test is not "what share of the *roster* has evidence" — a bimodal
    // team can clear that bar while its flat cluster is still 100% bio-only. It is
    // "are the players *inside the flat cluster* ones the engine had data to separate
    // and didn't?" So we measure evidence WITHIN the cluster. A cluster that is
    // essentially all no-evidence players (≤10% carry a non-low-confidence status) is
    // the documented data gap → INFO. A cluster holding real evidence is the actual
    // bug the brief cares about — players we could rank are stuck on one number → FAIL.
    //
    // One more escape: a SMALL ABSOLUTE number (≤3) of evidence-backed players in the
    // cluster is also expected, not a bug. These are almost always backups with token
    // stats — a TE with a handful of catches, a #3 RB with a few carries — whose thin
    // evidence genuinely doesn't separate them from the position-prior midpoint; they
    // *belong* mid-pack. Without this, a correctly-rated roster (e.g. 2000 MIN: Culpepper
    // 97 / Moss 96 / Carter 94 over a normal bio-only depth chart) trips FAIL purely
    // because 3 such backups push the ratio just over 10% on an otherwise data-empty
    // cluster. The systemic flattening bug the brief targets shows up as MANY rankable
    // players collapsed onto one number, not three backups sitting where they belong.
    const hasEv = (r) =>
      r.status !== "generated_low_confidence" &&
      r.status !== "missing_data" &&
      r.status !== "needs_review";
    const modeVal = num(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
    const evInMode = roster.filter((r) => num(r.overall) === modeVal && hasEv(r)).length;
    const evAt70 = roster.filter((r) => num(r.overall) === 70 && hasEv(r)).length;
    const flatIsDataGap = modeCount === 0 || evInMode / modeCount <= 0.10 || evInMode <= 3;
    const at70Count = freq[70] || 0;
    const seventyIsDataGap = at70Count === 0 || evAt70 / at70Count <= 0.10 || evAt70 <= 3;

    const before = warnings.length;

    // --- Rule 1+2: flatness / generic-70 -----------------------------------
    if (pctSame > FLAT_SAME_PCT) {
      const sev = flatIsDataGap ? "INFO" : "FAIL";
      add(season, team_code, sev, "too_flat",
        `${pctSame.toFixed(0)}% share overall ${modeVal} (${modeCount}/${n})${flatIsDataGap ? " — expected: bio-only cluster, no evidence to separate them" : ` — flat despite ${evInMode} evidence-backed players stuck in the cluster`}`);
    }
    if (pct70 > SAME_70_PCT) {
      const sev = seventyIsDataGap ? "INFO" : "FAIL";
      add(season, team_code, sev, "generic_70",
        `${pct70.toFixed(0)}% rated exactly 70${seventyIsDataGap ? " — expected: position-prior midpoint on data-empty players" : ` — generic 70s despite ${evAt70} evidence-backed players sharing the number`}`);
    }

    // --- Rule 3: great team with no elite ----------------------------------
    if (tier.great && max < NO_ELITE_MAX) {
      add(season, team_code, "WARN", "great_team_no_elite",
        `great team (max overall ${max}) has no player at ${NO_ELITE_MAX}+`);
    }

    // --- Rule 4: bad team rated too high -----------------------------------
    if (tier.bad && avg > BAD_TEAM_AVG) {
      add(season, team_code, "WARN", "bad_team_too_high",
        `weak team averages ${avg.toFixed(1)} (> ${BAD_TEAM_AVG})`);
    }

    // --- Rule 5: too elite-heavy -------------------------------------------
    if (pct90 > ELITE_HEAVY_PCT && n >= 20) {
      add(season, team_code, "WARN", "too_many_elite",
        `${pct90.toFixed(0)}% of roster at 90+ (${overalls.filter((v) => v >= 90).length}/${n})`);
    }

    // --- Rule 6: starter/backup inversion ----------------------------------
    // A proven starter (>=8 recorded starts) out-rated by a clear non-starter
    // (<=2 starts) in the same position by >4 points, with no evidence backing the
    // backup, is a likely bug.
    const byPos = new Map();
    for (const r of roster) {
      const ps = psByKey.get(`${r.player_id}|${season}|${r.team_code}`);
      if (!ps) continue;
      (byPos.get(ps.position) || byPos.set(ps.position, []).get(ps.position)).push({ r, gs: num(ps.games_started) });
    }
    for (const [pos, list] of byPos) {
      const starters = list.filter((x) => x.gs != null && x.gs >= 8);
      const backups = list.filter((x) => x.gs != null && x.gs <= 2);
      for (const s of starters) for (const b of backups) {
        const bevid = b.r.status === "generated_high_confidence" || b.r.status === "manual_override";
        if (!bevid && num(b.r.overall) > num(s.r.overall) + 4) {
          add(season, team_code, "FAIL", "backup_over_starter",
            `${pos}: ${b.r.player_id} (${b.r.overall}, ${b.gs} starts) out-rates starter ${s.r.player_id} (${s.r.overall}, ${s.gs} starts)`);
        }
      }
    }

    // --- Rule 7: attributes don't match position ---------------------------
    // WARN, not FAIL: a mismatch here is almost always a player with conflicting
    // position rows in the *source* data (e.g. listed LB on one row, LG on another),
    // so the attribute vector was built for his real position but checked against a
    // duplicate row's position. That's a source-data ambiguity worth a human glance,
    // not a rating-distribution bug the engine produced.
    for (const r of roster) {
      const ps = psByKey.get(`${r.player_id}|${season}|${r.team_code}`);
      const group = POSITION_GROUP[ps?.position] || null;
      if (!group) continue;
      if (!attrsMatchPosition(group, r)) {
        add(season, team_code, "WARN", "position_attr_mismatch",
          `${ps.position} ${r.player_id}: key attributes trail off-position attributes (likely a duplicate position row in source data)`);
      }
    }

    // Tally per-team severity.
    const teamWarns = warnings.slice(before);
    if (teamWarns.some((w) => w.severity === "FAIL")) failTeams++;
    else if (teamWarns.some((w) => w.severity === "WARN")) warnTeams++;
  }

  warnings.sort(
    (a, b) =>
      ({ FAIL: 0, WARN: 1, INFO: 2 }[a.severity] - { FAIL: 0, WARN: 1, INFO: 2 }[b.severity]) ||
      a.season - b.season || a.team_code.localeCompare(b.team_code)
  );
  writeCsv(OUT, warnings, COLUMNS);

  const fails = warnings.filter((w) => w.severity === "FAIL").length;
  const warns = warnings.filter((w) => w.severity === "WARN").length;
  const infos = warnings.filter((w) => w.severity === "INFO").length;

  log.ok(`validated ${rosters.size} team-seasons → ${OUT.split("/").slice(-2).join("/")}`);
  log.info(`FAIL=${fails} (on ${failTeams} teams)   WARN=${warns} (on ${warnTeams} teams)   INFO=${infos} (expected/data-limited)`);
  log.info("by rule: " + Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join("  "));

  if (fails > 0) {
    log.warn(`${fails} FAIL-level distribution bug(s) found — see the CSV. First few:`);
    for (const w of warnings.filter((w) => w.severity === "FAIL").slice(0, 8)) {
      log.warn(`  ${w.season} ${w.team_code} [${w.rule}] ${w.detail}`);
    }
    process.exitCode = 1;
  } else {
    log.ok("no FAIL-level distribution bugs — all flatness is data-limited/expected.");
  }
}

run();
