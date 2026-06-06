"use client";
import { useMemo, useState } from "react";
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
import { simulateSeason } from "@/lib/simulation";
import { getTeamSeasons } from "@/lib/data";
import { randomTeamSeason } from "@/lib/draft";
import StartScreen from "./components/StartScreen";
import DraftScreen from "./components/DraftScreen";
import ScoreScreen from "./components/ScoreScreen";
import SimulationScreen from "./components/SimulationScreen";

type Phase = "start" | "draft" | "score" | "sim";

export default function Home() {
  const pool = useMemo(() => getTeamSeasons(), []);
  const [phase, setPhase] = useState<Phase>("start");
  const [mode, setMode] = useState<GameMode>("classic");
  const [roster, setRoster] = useState<RosterSlot[]>(() => createEmptyRoster());
  const [teamSeason, setTeamSeason] = useState<TeamSeason | null>(null);
  const [draftedIds, setDraftedIds] = useState<string[]>([]);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [sim, setSim] = useState<SimulationResult | null>(null);

  // Pick the next team-season, preferring those with undrafted players left.
  function drawTeamSeason(avoidId: string | undefined, drafted: string[]): TeamSeason {
    const usable = pool.filter((ts) =>
      ts.players.some((p) => !drafted.includes(p.id))
    );
    return randomTeamSeason(usable.length ? usable : pool, avoidId);
  }

  function start(m: GameMode) {
    setMode(m);
    setRoster(createEmptyRoster());
    setDraftedIds([]);
    setScore(null);
    setSim(null);
    setTeamSeason(drawTeamSeason(undefined, []));
    setPhase("draft");
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
      setTeamSeason(drawTeamSeason(teamSeason?.id, nextDrafted));
    }
  }

  function runSim() {
    if (!score) return;
    setSim(simulateSeason(score));
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
