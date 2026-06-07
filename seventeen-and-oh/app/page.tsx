"use client";
import { useEffect, useState } from "react";
import {
  GameMode,
  Player,
  RosterSlot,
  ScoreBreakdown,
  SimulationResult,
  TeamSeason,
} from "@/lib/types";
import { createEmptyRoster, positionFit } from "@/lib/positions";
import { computeScore, effectiveRating } from "@/lib/scoring";
import { computeTeamProfile } from "@/lib/team-profile";
import { simulateSeason } from "@/lib/simulation";
import { loadIndex, type TeamSeasonSummary } from "@/lib/data";
import { getRosterForTeamSeason } from "@/lib/draft-select";
import StartScreen from "./components/StartScreen";
import DraftScreen from "./components/DraftScreen";
import ScoreScreen from "./components/ScoreScreen";
import SimulationScreen from "./components/SimulationScreen";

type Phase = "start" | "draft" | "score" | "sim";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("start");
  const [mode, setMode] = useState<GameMode>("classic");
  const [roster, setRoster] = useState<RosterSlot[]>(() => createEmptyRoster());
  // The full catalog of valid team-seasons (lightweight summaries). The spin
  // wheel cycles through these; the landed entry's full roster is fetched on
  // demand. teamSeason is the locked, roster-revealed pick for THIS round —
  // null while the wheel is idle/spinning.
  const [catalog, setCatalog] = useState<TeamSeasonSummary[]>([]);
  const [teamSeason, setTeamSeason] = useState<TeamSeason | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [lastTeamSeasonId, setLastTeamSeasonId] = useState<string | null>(null);
  const [draftedIds, setDraftedIds] = useState<string[]>([]);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [sim, setSim] = useState<SimulationResult | null>(null);
  // Dev/debug switches, read once from the URL (?debug, ?seed=123). Lazy
  // initializers (SSR-guarded) so they're set before first paint without a
  // cascading effect setState. They never change after mount.
  const [debug] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("debug")
  );
  const [seed] = useState<number | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const s = new URLSearchParams(window.location.search).get("seed");
    return s != null && s !== "" && Number.isFinite(Number(s))
      ? Number(s) >>> 0
      : undefined;
  });

  // Load the catalog once on mount.
  useEffect(() => {
    loadIndex()
      .then(setCatalog)
      .catch((err) => console.error("Failed to load team-season index", err));
  }, []);

  function start(m: GameMode) {
    setMode(m);
    setRoster(createEmptyRoster());
    setDraftedIds([]);
    setScore(null);
    setSim(null);
    // Begin the first round on the spin wheel — no team-season locked yet.
    setTeamSeason(null);
    setLastTeamSeasonId(null);
    setLoadingRoster(false);
    setPhase("draft");
  }

  // The wheel landed on a valid team-season: fetch its full roster, then reveal
  // it for picking. The pick is fixed here and never changes until the user
  // drafts a player (which starts the next round's spin).
  async function handleSpinComplete(pick: TeamSeasonSummary) {
    setLoadingRoster(true);
    try {
      const ts = await getRosterForTeamSeason(pick);
      setTeamSeason(ts);
      setLastTeamSeasonId(pick.id);
    } catch (err) {
      console.error("Failed to load roster for", pick.id, err);
    } finally {
      setLoadingRoster(false);
    }
  }

  function draftPlayer(player: Player, slotId: string) {
    const slot = roster.find((s) => s.id === slotId)!;
    const fit = positionFit(player.position, player.secondaryPositions, slot.position);
    const nextRoster = roster.map((s) =>
      s.id === slotId
        ? {
            ...s,
            player,
            fit,
            effectiveRating: effectiveRating(player, s.position),
          }
        : s
    );
    const nextDrafted = [...draftedIds, player.id];
    setRoster(nextRoster);
    setDraftedIds(nextDrafted);

    if (nextRoster.every((s) => s.player)) {
      setScore(computeScore(nextRoster));
      setPhase("score");
    } else {
      // Back to the spin wheel for the next round.
      setTeamSeason(null);
    }
  }

  function runSim() {
    if (!score) return;
    setSim(simulateSeason(computeTeamProfile(roster)));
    setPhase("sim");
  }

  function reset() {
    setPhase("start");
    setRoster(createEmptyRoster());
    setDraftedIds([]);
    setTeamSeason(null);
    setLastTeamSeasonId(null);
    setLoadingRoster(false);
    setScore(null);
    setSim(null);
  }

  return (
    <main className="flex flex-1 flex-col">
      {phase === "start" && <StartScreen onStart={start} />}
      {phase === "draft" && (
        <DraftScreen
          mode={mode}
          roster={roster}
          catalog={catalog}
          teamSeason={teamSeason}
          draftedIds={draftedIds}
          loadingRoster={loadingRoster}
          avoidId={lastTeamSeasonId}
          seed={seed}
          debug={debug}
          onSpinComplete={handleSpinComplete}
          onDraft={draftPlayer}
        />
      )}
      {phase === "score" && score && (
        <ScoreScreen
          score={score}
          roster={roster}
          onSimulate={runSim}
          onRestart={reset}
        />
      )}
      {phase === "sim" && sim && (
        <SimulationScreen sim={sim} onRestart={reset} />
      )}
    </main>
  );
}
