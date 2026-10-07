import { create } from "zustand";
import type {
  MinigameId,
  MinigameResult,
  MinigameStart,
  RunSlot,
} from "@/bridge/events";
import type { TeamId } from "@/lib/teams";

/** Orden de los 3 minijuegos de un run. Por ahora existe uno solo. */
export const RUN_PLAYLIST: readonly MinigameId[] = [
  "slippery_bridge",
  "slippery_bridge",
  "slippery_bridge",
];

export function nextMinigame(
  results: readonly MinigameResult[],
): MinigameStart | null {
  const index = results.length;
  if (index >= RUN_PLAYLIST.length) return null;
  return { slot: (index + 1) as RunSlot, minigameId: RUN_PLAYLIST[index] };
}

type SessionState = {
  team: TeamId | null;
  results: MinigameResult[];
  /** Puntaje en vivo del minijuego en curso, para el HUD. */
  liveScore: number;

  chooseTeam: (team: TeamId) => void;
  startRun: () => void;
  setLiveScore: (score: number) => void;
  recordResult: (result: MinigameResult) => void;
};

export const useSession = create<SessionState>()((set) => ({
  team: null,
  results: [],
  liveScore: 0,

  // La facción queda bloqueada una vez elegida.
  chooseTeam: (team) => set((s) => (s.team ? s : { team })),
  startRun: () => set({ results: [], liveScore: 0 }),
  setLiveScore: (liveScore) => set({ liveScore }),
  recordResult: (result) =>
    set((s) => ({ results: [...s.results, result], liveScore: 0 })),
}));
