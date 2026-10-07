/**
 * Contrato entre el juego (KAPLAY) y la UI (React).
 *
 * Vive en game/ porque el juego lo implementa y no puede depender de nada
 * externo. La UI lo consume re-exportado desde bridge/events.ts.
 */

/** Debe coincidir con public.minigames.id */
export type MinigameId = "slippery_bridge";

export type RunSlot = 1 | 2 | 3;

export type MinigameStart = {
  slot: RunSlot;
  minigameId: MinigameId;
};

export type MinigameResult = MinigameStart & {
  score: number;
  durationMs: number;
};

/** Un equipo en cancha: id (de public.teams) y color de camiseta. */
export type TeamInfo = { id: string; color: string };

/** Puntaje de un rival manejado por la computadora (cosmético, no se envía). */
export type RivalResult = { teamId: string; score: number };

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
