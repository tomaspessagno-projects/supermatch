import { create } from "zustand";
import type {
  MinigameId,
  MinigameResult,
  MinigameStart,
  RunSlot,
} from "@/bridge/events";
import * as api from "@/lib/supabase/api";
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

/** Envío del puntaje al ranking. */
export type Submission =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; total: number }
  /** Se jugó sin conexión con el servidor: el puntaje no suma. */
  | { status: "offline" }
  | { status: "error"; message: string };

type SessionState = {
  team: TeamId | null;
  nickname: string | null;
  /** El perfil está guardado en el servidor, así que los runs suman al ranking. */
  online: boolean;
  profileStatus: "unknown" | "loading" | "ready";
  results: MinigameResult[];
  /** Puntaje en vivo del minijuego en curso, para el HUD. */
  liveScore: number;
  /** Id del run abierto en el servidor; null si no se pudo abrir. */
  run: Promise<string | null> | null;
  submission: Submission;

  loadProfile: () => Promise<void>;
  chooseTeam: (team: TeamId) => Promise<void>;
  startRun: () => void;
  setLiveScore: (score: number) => void;
  recordResult: (result: MinigameResult) => void;
  submitRun: () => Promise<void>;
  retrySubmit: () => Promise<void>;
};

const messageOf = (error: unknown) =>
  (error as { message?: string } | null)?.message ?? String(error);

export const useSession = create<SessionState>()((set, get) => ({
  team: null,
  nickname: null,
  online: false,
  profileStatus: "unknown",
  results: [],
  liveScore: 0,
  run: null,
  submission: { status: "idle" },

  async loadProfile() {
    if (get().profileStatus !== "unknown") return;
    set({ profileStatus: "loading" });
    try {
      const profile = await api.loadProfile();
      if (profile) set({ team: profile.team, nickname: profile.nickname, online: true });
    } catch {
      // Sin conexión se puede jugar igual; solo no suma al ranking.
    }
    set({ profileStatus: "ready" });
  },

  async chooseTeam(team) {
    // La facción queda bloqueada una vez elegida (también en la base).
    if (get().team) return;
    try {
      const profile = await api.joinTeam(team);
      set({ team: profile.team, nickname: profile.nickname, online: true });
    } catch {
      set({ team, online: false });
    }
  },

  startRun() {
    // Se abre en paralelo a la carga del juego; el envío lo espera.
    const run = get().online ? api.startRun().catch(() => null) : Promise.resolve(null);
    set({ results: [], liveScore: 0, run, submission: { status: "idle" } });
  },

  setLiveScore: (liveScore) => set({ liveScore }),

  recordResult: (result) =>
    set((s) => ({ results: [...s.results, result], liveScore: 0 })),

  async submitRun() {
    const { submission, run, results } = get();
    // Una sola vez por run, aunque la pantalla de resultados se vuelva a mostrar.
    if (submission.status !== "idle" || results.length < RUN_PLAYLIST.length) return;
    set({ submission: { status: "sending" } });
    const runId = await run;
    if (!runId) {
      set({ submission: { status: "offline" } });
      return;
    }
    try {
      const total = await api.finishRun(runId, results);
      set({ submission: { status: "sent", total } });
    } catch (error) {
      set({ submission: { status: "error", message: messageOf(error) } });
    }
  },

  async retrySubmit() {
    if (get().submission.status !== "error") return;
    set({ submission: { status: "idle" } });
    await get().submitRun();
  },
}));
