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

/** juego → UI */
export type GameEvent =
  | { type: "minigame:score"; slot: RunSlot; score: number }
  | { type: "minigame:finished"; result: MinigameResult };

/** UI → juego */
export type GameCommand = { type: "minigame:start" } & MinigameStart;

export type GameHandle = {
  send: (command: GameCommand) => void;
  /** Resuelve cuando KAPLAY terminó de cerrarse (su quit() es diferido). */
  destroy: () => Promise<void>;
};
