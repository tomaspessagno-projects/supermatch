import kaplay from "kaplay";
import { loadAssets } from "../assets";
import type {
  GameCommand,
  GameEvent,
  GameHandle,
  MinigameId,
  NetLink,
  RivalSpec,
  TeamInfo,
} from "../contract";
import { registerRollingLog, ROLLING_LOG_SCENE } from "../scenes/rolling-log";
import {
  registerSlipperyBridge,
  SLIPPERY_BRIDGE_SCENE,
} from "../scenes/slippery-bridge";
import { createAudio, loadSounds } from "./audio";
import type { SceneContext } from "./scene";

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

const SCENE_BY_MINIGAME: Record<MinigameId, string> = {
  slippery_bridge: SLIPPERY_BRIDGE_SCENE,
  rolling_log: ROLLING_LOG_SCENE,
};

export type CreateGameOptions = {
  root: HTMLElement;
  team: TeamInfo;
  rivals: readonly RivalSpec[];
  net?: NetLink;
  emit: (event: GameEvent) => void;
  muted: boolean;
};

export function createGame({
  root,
  team,
  rivals,
  net,
  emit,
  muted,
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

  const audio = createAudio(k);
  audio.setMuted(muted);

  // Cada escena registra sus acciones; al cambiar de escena se reemplazan.
  let goAction: (() => void) | null = null;
  let jumpAction: (() => void) | null = null;
  const ctx: SceneContext = {
    team,
    rivals,
    net,
    emit,
    audio,
    onGo: (action) => {
      goAction = action;
    },
    buttons: { left: false, right: false },
    onJumpButton: (action) => {
      jumpAction = action;
    },
  };

  loadAssets(k);
  loadSounds(k);
  registerSlipperyBridge(k, ctx);
  registerRollingLog(k, ctx);

  return {
    send(command: GameCommand) {
      switch (command.type) {
        case "minigame:start":
          goAction = null;
          audio.duckMusic(true);
          k.go(SCENE_BY_MINIGAME[command.minigameId], {
            slot: command.slot,
            minigameId: command.minigameId,
            seed: command.seed,
          });
          break;
        case "minigame:count":
          audio.startMusic();
          audio.play("count");
          break;
        case "minigame:go":
          audio.play("whistle");
          audio.duckMusic(false);
          goAction?.();
          break;
        case "mute":
          audio.setMuted(command.muted);
          break;
        case "input":
          if (command.button === "jump") {
            if (command.down) jumpAction?.();
          } else {
            ctx.buttons[command.button] = command.down;
          }
          break;
      }
    },

    focus() {
      canvas.focus();
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
