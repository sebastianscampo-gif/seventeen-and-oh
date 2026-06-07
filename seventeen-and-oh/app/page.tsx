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
import { loadIndex, loadTeamSeason } from "@/lib/data";
import StartScreen from "./components/StartScreen";
import DraftScreen from "./components/DraftScreen";
import ScoreScreen from "./components/ScoreScreen";
import SimulationScreen from "./components/SimulationScreen";

type Phase = "start" | "draft" | "score" | "sim";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("start");
  const [mode, setMode] = useState<GameMode>("classic");
  const [roster, setRoster] = useState<RosterSlot[]>(() => createEmptyRoster());
  const [teamSeason, setTeamSeason] = useState<TeamSeason | null>(null);
  const [draftedIds, setDraftedIds] = useState<string[]>([]);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [sim, setSim] = useState<SimulationResult | null>(null);

  // Warm the lightweight catalog on mount. loadIndex() memoizes the fetch, so
  // this just pre-fills the cache; drawTeamSeason() re-reads it directly.
  useEffect(() => {
    loadIndex().catch((err) =>
      console.error("Failed to load team-season index", err)
    );
  }, []);

  // Pick a random team-season (avoiding an immediate repeat) and fetch its full
  // roster on demand. Awaits the memoized catalog directly so a draw works even
  // before the warm-up resolves — no dependence on render-time state.
  async function drawTeamSeason(avoidId: string | undefined): Promise<TeamSeason | null> {
    const idx = await loadIndex();
    if (idx.length === 0) return null;
    const choices =
      avoidId && idx.length > 1 ? idx.filter((s) => s.id !== avoidId) : idx;
    const pick = choices[Math.floor(Math.random() * choices.length)];
    return loadTeamSeason(pick.id);
  }

  async function start(m: GameMode) {
    setMode(m);
    setRoster(createEmptyRoster());
    setDraftedIds([]);
    setScore(null);
    setSim(null);
    const ts = await drawTeamSeason(undefined);
    if (!ts) return;
    setTeamSeason(ts);
    setPhase("draft");
  }

  async function draftPlayer(player: Player, slotId: string) {
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
      const ts = await drawTeamSeason(teamSeason?.id);
      if (ts) setTeamSeason(ts);
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
    setScore(null);
    setSim(null);
  }

  return (
    <main className="flex flex-1 flex-col">
      {phase === "start" && <StartScreen onStart={start} />}
      {phase === "draft" && teamSeason && (
        <DraftScreen
          mode={mode}
          roster={roster}
          teamSeason={teamSeason}
          draftedIds={draftedIds}
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
