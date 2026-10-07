import kaplay from "kaplay";
import type {
  GameCommand,
  GameEvent,
  GameHandle,
  MinigameId,
} from "../contract";
import {
  PLACEHOLDER_SCENE,
  registerPlaceholderScene,
} from "../scenes/placeholder";

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

// Hasta que exista cada minijuego, todos caen en el placeholder.
const SCENE_BY_MINIGAME: Record<MinigameId, string> = {
  slippery_bridge: PLACEHOLDER_SCENE,
};

export type CreateGameOptions = {
  root: HTMLElement;
  teamColor: string;
  emit: (event: GameEvent) => void;
};

export function createGame({
  root,
  teamColor,
  emit,
}: CreateGameOptions): GameHandle {
  // Canvas nuevo por instancia: quit() hace loseContext() sobre el anterior.
  const canvas = document.createElement("canvas");
  root.appendChild(canvas);

  const k = kaplay({
    canvas,
    root, // sin root, KAPLAY pisa los estilos de <body>
    global: false, // sin esto expone add(), pos()… en window
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    letterbox: true,
    background: "#1a1033",
  });

  registerPlaceholderScene(k, { teamColor, emit });

  return {
    send(command: GameCommand) {
      switch (command.type) {
        case "minigame:start":
          k.go(SCENE_BY_MINIGAME[command.minigameId], {
            slot: command.slot,
            minigameId: command.minigameId,
          });
          break;
      }
    },

    destroy() {
      canvas.remove();
      return new Promise((resolve) => {
        k.onCleanup(() => {
          // KAPLAY no cierra su AudioContext al salir.
          void k.audioCtx.close();
          resolve();
        });
        k.quit();
      });
    },
  };
}
