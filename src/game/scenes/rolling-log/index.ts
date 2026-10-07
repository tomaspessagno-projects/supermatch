import type { KAPLAYCtx } from "kaplay";
import type { MinigameStart } from "../../contract";
import type { SceneContext } from "../../engine/scene";
import { createTimeFx, type TimeFx } from "../../engine/timefx";
import { BOT_SKILLS, createBot, rivalScore, stepBot } from "./bot";
import { LOG_LEVEL } from "./level";
import { createRenderer } from "./render";
import { createWorld, score, type SimEvent, step } from "./sim";
import { TUNING } from "./tuning";

export const ROLLING_LOG_SCENE = "rolling_log";

// Paso fijo: la física da igual a 60 Hz que a 144 Hz.
const STEP = 1 / 120;
const MAX_FRAME = 0.1;
const SCORE_EMIT_INTERVAL = 0.1;

const KEYS = {
  left: ["left", "a"],
  right: ["right", "d"],
  jump: ["space", "up", "w"],
} as const;

export function registerRollingLog(k: KAPLAYCtx, ctx: SceneContext) {
  const { audio } = ctx;

  /** Sonidos y ritmo (congelado, cámara lenta) de lo que le pasa al jugador. */
  function feel(events: readonly SimEvent[], time: TimeFx) {
    for (const e of events) {
      switch (e.type) {
        case "jump":
          audio.play("jump", { vary: 1.5 });
          break;
        case "land":
          if (e.impact > 300) audio.play("land", { volume: Math.min(1, e.impact / 1400), vary: 2 });
          break;
        case "creak":
          audio.play("creak", { vary: 1 });
          break;
        case "fire":
          audio.play("cannon", { vary: 2 });
          break;
        case "hit":
          audio.play("bonk", { vary: 1 });
          time.hitStop(0.08);
          break;
        case "pop":
          audio.play("pop", { vary: 2 });
          break;
        case "slip":
          audio.play("laugh", { volume: 0.7, vary: 1 });
          break;
        case "splash":
          audio.play("splash", { vary: 1 });
          audio.play("whistle", { volume: 0.5 });
          time.slowMo(0.3, 0.55);
          break;
        case "finish":
          audio.play("whistle");
          audio.play("finish");
          audio.play("cheer");
          audio.duckMusic(true);
          time.slowMo(0.4, 0.8);
          break;
        case "out":
          audio.play("fail");
          audio.duckMusic(true);
          break;
      }
    }
  }

  k.scene(ROLLING_LOG_SCENE, ({ slot, minigameId }: MinigameStart) => {
    const world = createWorld(LOG_LEVEL);

    const skills = [BOT_SKILLS.ace, BOT_SKILLS.average, BOT_SKILLS.clumsy].sort(() => Math.random() - 0.5);
    const seed = Math.floor(Math.random() * 2 ** 31);
    const rivals = ctx.rivals.map((team, i) => ({
      team,
      world: createWorld(LOG_LEVEL),
      bot: createBot(skills[i % skills.length], seed + i),
    }));

    const renderer = createRenderer(k, ctx.team.color, rivals.map((r) => r.team));
    const time = createTimeFx();
    let started = false;
    let accumulator = 0;
    let jumpQueued = false;
    let lastScore = 0;
    let lastScoreAt = -Infinity;
    let reported = false;

    ctx.onGo(() => {
      started = true;
    });
    ctx.onJumpButton(() => {
      jumpQueued = true;
    });
    k.onKeyPress([...KEYS.jump], () => {
      jumpQueued = true;
    });

    k.onUpdate(() => {
      const right = k.isKeyDown([...KEYS.right]) || ctx.buttons.right;
      const left = k.isKeyDown([...KEYS.left]) || ctx.buttons.left;
      const move = (right ? 1 : 0) - (left ? 1 : 0);

      // Congelado de impacto y cámara lenta: cambian el ritmo, no la simulación.
      const dt = Math.min(k.dt(), MAX_FRAME) * (started ? time.scale(k.dt()) : 1);
      if (started) {
        accumulator += dt;
        while (accumulator >= STEP) {
          accumulator -= STEP;
          const events = step(world, { move, jumpPressed: jumpQueued }, STEP);
          renderer.react(events, world);
          feel(events, time);
          jumpQueued = false;
          rivals.forEach((r, i) => renderer.reactRival(i, stepBot(r.world, r.bot), r.world));
        }
      } else {
        jumpQueued = false;
      }
      renderer.update(started ? dt : k.dt(), world, rivals.map((r) => r.world), started ? move : 0);

      const current = score(world);
      if (current !== lastScore && world.time - lastScoreAt >= SCORE_EMIT_INTERVAL) {
        lastScore = current;
        lastScoreAt = world.time;
        ctx.emit({ type: "minigame:score", slot, score: current });
      }

      if (!reported && world.endedAt !== null && world.time - world.endedAt >= TUNING.endDelay) {
        reported = true;
        ctx.emit({
          type: "minigame:finished",
          result: { slot, minigameId, score: score(world), durationMs: Math.round(world.endedAt * 1000) },
          rivals: rivals.map((r) => ({ teamId: r.team.id, score: rivalScore(r.world) })),
        });
      }
    });

    k.add([{ id: "rolling-log-view", draw: () => renderer.draw(world, rivals.map((r) => r.world)) }]);
  });
}
