/**
 * Contrato entre el juego (KAPLAY) y la UI (React).
 *
 * Vive en game/ porque el juego lo implementa y no puede depender de nada
 * externo. La UI lo consume re-exportado desde bridge/events.ts.
 */

/** Debe coincidir con public.minigames.id */
export type MinigameId = "slippery_bridge" | "rolling_log";

export type RunSlot = 1 | 2 | 3;

export type MinigameStart = {
  slot: RunSlot;
  minigameId: MinigameId;
  /** Semilla de los bots: en una sala online es la misma para todos. */
  seed: number;
};

export type MinigameResult = Pick<MinigameStart, "slot" | "minigameId"> & {
  score: number;
  durationMs: number;
};

/** Un equipo en cancha: id (de public.teams), color de camiseta y nombre corto ("Azul"). */
export type TeamInfo = { id: string; color: string; name: string };

/** Teclas de un tick: igual para todas las pruebas. */
export type PlayerInput = { move: number; jumpPressed: boolean };

/**
 * Un rival en la prueba: un bot (lo maneja la computadora, igual en todas las
 * compus de la sala) o un jugador remoto (se re-simula con sus teclas).
 */
export type RivalSpec = {
  id: string;
  team: TeamInfo;
  /** Para los avisos: el apodo si es una persona, el color si es un bot. */
  name: string;
  control: "bot" | "remote";
};

/** Puntaje de un rival al terminar la prueba (para los bots, cosmético). */
export type RivalResult = { id: string; score: number };

/**
 * Lo que el juego necesita de la red en una sala online. El juego no sabe de
 * Supabase: le pasa sus teclas tick a tick y pide las de los demás.
 */
export type NetLink = {
  sendInput: (slot: RunSlot, tick: number, input: PlayerInput) => void;
  /** Teclas de un jugador remoto en un tick, si ya llegaron. */
  remoteInput: (id: string, slot: RunSlot, tick: number) => PlayerInput | undefined;
  /** Cuántos ticks de ese jugador llegaron. */
  remoteTicks: (id: string, slot: RunSlot) => number;
};

export type VirtualButton = "left" | "right" | "jump";

/** juego → UI */
export type GameEvent =
  | { type: "minigame:score"; slot: RunSlot; score: number }
  | { type: "minigame:finished"; result: MinigameResult; rivals: RivalResult[] };

/** UI → juego */
export type GameCommand =
  /** Carga la prueba y la deja esperando el silbato. */
  | ({ type: "minigame:start" } & MinigameStart)
  /** Un número de la cuenta regresiva (suena un pip). */
  | { type: "minigame:count" }
  /** Silbato: arranca la prueba cargada. */
  | { type: "minigame:go" }
  | { type: "mute"; muted: boolean }
  /** Botones táctiles; se suman al teclado. */
  | { type: "input"; button: VirtualButton; down: boolean };

export type GameHandle = {
  send: (command: GameCommand) => void;
  /** Devuelve el foco del teclado al canvas. */
  focus: () => void;
  /** Resuelve cuando KAPLAY terminó de cerrarse (su quit() es diferido). */
  destroy: () => Promise<void>;
};
