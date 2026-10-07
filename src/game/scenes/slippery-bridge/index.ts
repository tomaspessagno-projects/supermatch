import type { KAPLAYCtx } from "kaplay";
import type { GameEvent, MinigameStart } from "../../contract";
import { LEVEL } from "./level";
import { createRenderer } from "./render";
import { createWorld, finalScore, liveScore, step } from "./sim";
import { TUNING } from "./tuning";

export const SLIPPERY_BRIDGE_SCENE = "slippery_bridge";

// Paso fijo: la física da igual a 60 Hz que a 144 Hz.
const STEP = 1 / 120;
const MAX_FRAME = 0.1; // si la pestaña se congela, no intentar recuperar todo
const SCORE_EMIT_INTERVAL = 0.1; // s: el HUD no necesita 120 updates por segundo

const KEYS = {
  left: ["left", "a"],
  right: ["right", "d"],
  jump: ["space", "up", "w"],
} as const;

type SceneDeps = {
  teamColor: string;
  emit: (event: GameEvent) => void;
};

export function registerSlipperyBridge(k: KAPLAYCtx, { teamColor, emit }: SceneDeps) {
  k.scene(SLIPPERY_BRIDGE_SCENE, ({ slot, minigameId }: MinigameStart) => {
    const world = createWorld(LEVEL);
    const renderer = createRenderer(k, teamColor);
    let accumulator = 0;
    let jumpQueued = false;
    let lastScore = 0;
    let lastScoreAt = -Infinity;
    let reported = false;

    k.onKeyPress([...KEYS.jump], () => {
      jumpQueued = true;
    });

    k.onUpdate(() => {
      const move =
        (k.isKeyDown([...KEYS.right]) ? 1 : 0) - (k.isKeyDown([...KEYS.left]) ? 1 : 0);

      accumulator += Math.min(k.dt(), MAX_FRAME);
      while (accumulator >= STEP) {
        accumulator -= STEP;
        renderer.react(step(world, { move, jumpPressed: jumpQueued }, STEP), world);
        jumpQueued = false;
      }
      renderer.update(k.dt(), world, move);

      const score = liveScore(world);
      if (score !== lastScore && world.time - lastScoreAt >= SCORE_EMIT_INTERVAL) {
        lastScore = score;
        lastScoreAt = world.time;
        emit({ type: "minigame:score", slot, score });
      }

      if (
        !reported &&
        world.endedAt !== null &&
        world.time - world.endedAt >= TUNING.endDelay
      ) {
        reported = true;
        emit({
          type: "minigame:finished",
          result: {
            slot,
            minigameId,
            score: finalScore(world),
            durationMs: Math.round(world.endedAt * 1000),
          },
        });
      }
    });

    k.add([{ id: "slippery-bridge-view", draw: () => renderer.draw(world) }]);
  });
}
