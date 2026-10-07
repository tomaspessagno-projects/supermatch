import { create } from "zustand";
import type {
  MinigameId,
  MinigameResult,
  MinigameStart,
  RivalResult,
  RunSlot,
} from "@/bridge/events";
import { type Participant, type Scores, soloParticipants } from "@/lib/participants";
import * as api from "@/lib/supabase/api";
import type { TeamId } from "@/lib/teams";
import { slotSeed } from "@/online/protocol";

/** Orden de los 3 minijuegos de un run. La tercera será Baldes al Tanque. */
export const RUN_PLAYLIST: readonly MinigameId[] = [
  "slippery_bridge",
  "rolling_log",
  "slippery_bridge",
];

export function nextMinigame(
  results: readonly MinigameResult[],
  seed: number,
): MinigameStart | null {
  const index = results.length;
  if (index >= RUN_PLAYLIST.length) return null;
  const slot = (index + 1) as RunSlot;
  return { slot, minigameId: RUN_PLAYLIST[index], seed: slotSeed(seed, slot) };
}

/** Envío del puntaje al ranking. */
export type Submission =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; total: number }
  /** Se jugó sin conexión con el servidor: el puntaje no suma. */
  | { status: "offline" }
  | { status: "error"; message: string };

/** Momento del episodio que muestra la UI encima del juego. */
export type EpisodePhase = "intro" | "countdown" | "playing" | "between";

/** Solo contra 3 bots, o carrera en vivo en una sala (los huecos los llenan bots). */
export type EpisodeMode = "solo" | "online";

export type Schedule = { slot: RunSlot; at: number };

type SessionState = {
  team: TeamId | null;
  nickname: string | null;
  /** El perfil está guardado en el servidor, así que los runs suman al ranking. */
  online: boolean;
  profileStatus: "unknown" | "loading" | "ready";
  mode: EpisodeMode;
  /** Los 4 del episodio, en el mismo orden en todas las compus de la sala. */
  participants: Participant[];
  /** Semilla del episodio (los bots de cada prueba salen de acá). */
  seed: number;
  /**
   * Online: hora (`Date.now()`) del silbato de una prueba, la manda el
   * anfitrión. Jugando solo, siempre null.
   */
  schedule: Schedule | null;
  /** Tus resultados: son los que se mandan al ranking. */
  results: MinigameResult[];
  /** Puntos de los 4 por prueba (los tuyos, los de los bots y los que llegan por la red). */
  scores: Scores;
  /** Puntaje en vivo del minijuego en curso, para el HUD. */
  liveScore: number;
  phase: EpisodePhase;
  /** Id del run abierto en el servidor; null si no se pudo abrir. */
  run: Promise<string | null> | null;
  submission: Submission;
  /** Sonido apagado (se recuerda en este navegador). */
  muted: boolean;

  loadProfile: () => Promise<void>;
  chooseTeam: (team: TeamId) => Promise<void>;
  playSolo: () => void;
  /** Lo llama la sala al arrancar: el próximo episodio es online con estos 4. */
  prepareOnline: (episode: { seed: number; participants: Participant[]; schedule: Schedule }) => void;
  scheduleSlot: (schedule: Schedule) => void;
  /** Puntos que llegan por la red (personas remotas, y los bots según el árbitro). */
  setScore: (id: string, slot: RunSlot, score: number) => void;
  /** Personas de la sala que se fueron (las demás quedan como están). */
  setLeft: (ids: readonly string[]) => void;
  startRun: () => void;
  startCountdown: () => void;
  go: () => void;
  setLiveScore: (score: number) => void;
  recordResult: (result: MinigameResult, rivals: readonly RivalResult[]) => void;
  continueEpisode: () => void;
  submitRun: () => Promise<void>;
  retrySubmit: () => Promise<void>;
  toggleMuted: () => void;
};

const MUTED_KEY = "supermatch:muted";

function readMuted() {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false; // modo privado o almacenamiento bloqueado
  }
}

const messageOf = (error: unknown) =>
  (error as { message?: string } | null)?.message ?? String(error);

export const useSession = create<SessionState>()((set, get) => ({
  team: null,
  nickname: null,
  online: false,
  profileStatus: "unknown",
  mode: "solo",
  participants: [],
  seed: 0,
  schedule: null,
  results: [],
  scores: {},
  liveScore: 0,
  phase: "intro",
  run: null,
  submission: { status: "idle" },
  muted: readMuted(),

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

  playSolo: () => set({ mode: "solo", schedule: null }),

  prepareOnline: ({ seed, participants, schedule }) => set({ mode: "online", seed, participants, schedule }),

  scheduleSlot: (schedule) => set({ schedule }),

  setScore: (id, slot, score) => set((s) => ({ scores: { ...s.scores, [id]: { ...s.scores[id], [slot]: score } } })),

  setLeft: (ids) =>
    set((s) => ({
      participants: s.participants.map((p) => (p.kind === "remote" ? { ...p, left: ids.includes(p.id) } : p)),
    })),

  startRun() {
    const { mode, team, online } = get();
    // Se abre en paralelo a la carga del juego; el envío lo espera.
    const run = online ? api.startRun().catch(() => null) : Promise.resolve(null);
    const base = { results: [], scores: {}, liveScore: 0, phase: "intro" as const, run, submission: { status: "idle" as const } };
    // Online, la sala ya dejó los participantes, la semilla y la hora de largada.
    if (mode === "online") set(base);
    else set({ ...base, participants: team ? soloParticipants(team) : [], seed: randomSeed(), schedule: null });
  },

  startCountdown: () => set((s) => (s.phase === "intro" ? { phase: "countdown" } : s)),
  go: () => set((s) => (s.phase === "countdown" ? { phase: "playing" } : s)),

  setLiveScore: (liveScore) => set({ liveScore }),

  recordResult: (result, rivals) =>
    set((s) => {
      const scores = { ...s.scores };
      const add = (id: string, score: number) => (scores[id] = { ...scores[id], [result.slot]: score });
      const me = s.participants.find((p) => p.kind === "me");
      if (me) add(me.id, result.score);
      // Los bots, con lo que dio acá, salvo que ya haya llegado lo del árbitro.
      // Los remotos no: su puntaje real llega por la red.
      for (const r of rivals) {
        const p = s.participants.find((p) => p.id === r.id);
        if (p?.kind === "bot" && scores[r.id]?.[result.slot] === undefined) add(r.id, r.score);
      }
      return { results: [...s.results, result], liveScore: 0, scores, phase: "between" };
    }),

  continueEpisode: () => set((s) => (s.phase === "between" && s.results.length < RUN_PLAYLIST.length ? { phase: "intro" } : s)),

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

  toggleMuted() {
    const muted = !get().muted;
    set({ muted });
    try {
      window.localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    } catch {
      // sin almacenamiento: vale solo para esta visita
    }
  },
}));

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32) >>> 0;
}
