import type { KAPLAYCtx } from "kaplay";
import type { MinigameStart } from "../../contract";
import { createShared, MAX_ROLLBACK_TICKS } from "../../engine/rollback";
import type { SceneContext } from "../../engine/scene";
import { createRenderer } from "./render";
import { cloneWorld, createWorld, finalScore, liveScore, type SimEvent, step } from "./sim";
import { TUNING } from "./tuning";

export const MATTRESS_SCENE = "mattress";

const STEP = 1 / 120;
const MAX_FRAME = 0.1;
const SCORE_EMIT_INTERVAL = 0.1;
/** Tick en que termina la ronda (igual en todas las compus). */
const END_TICK = Math.round(TUNING.duration / STEP);
/**
 * Si esta compu va más de esto adelante del más atrasado (≈0,6 s, más que lo
 * que tarda la red), lo espera: así nadie juega con teclas adivinadas de más
 * (pasa si una compu va lenta o arrancó tarde).
 */
const MAX_LEAD = 72;
/** …salvo que el otro no mande nada hace rato (se colgó o se fue). */
const STALL_MS = 1500;

const KEYS = {
  left: ["left", "a"],
  right: ["right", "d"],
  jump: ["space", "up", "w"],
} as const;

/**
 * El Colchón: prueba cooperativa. Los 4 comparten el mismo mundo; en una
 * sala online se simula con las teclas de todos (con rollback), y jugando
 * solo los otros tres son bots. Acá no hay cámara lenta ni congelado: todas
 * las compus tienen que avanzar al mismo ritmo.
 */
export function registerMattress(k: KAPLAYCtx, ctx: SceneContext) {
  const { audio } = ctx;

  function feel(events: readonly SimEvent[], me: number) {
    for (const e of events) {
      switch (e.type) {
        case "ready":
          audio.play("count", { volume: 0.5, vary: 2 });
          break;
        case "launch":
          audio.play("jump", { volume: 0.6, vary: 2 });
          break;
        case "bounce":
          audio.play("spring", { vary: 2, volume: e.super ? 1 : 0.8 });
          if (e.super) audio.play("cheer", { volume: 0.6 });
          break;
        case "pump":
          audio.play("pop", { vary: 1 });
          break;
        case "deliver":
          audio.play("checkpoint", { vary: 1 });
          if (e.golden || e.direct) audio.play("cheer");
          break;
        case "splash":
          audio.play("splash", { vary: 1 });
          audio.play("laugh", { vary: 1, volume: 0.7 });
          break;
        case "out":
          audio.play("fail", { volume: 0.6 });
          break;
        case "jump":
          if (e.holder === me) audio.play("jump", { vary: 1.5, volume: 0.7 });
          break;
        case "burst":
          audio.play("pop", { vary: 2 });
          audio.play("splash", { volume: 0.4, vary: 2 });
          break;
        case "roller":
          audio.play("creak", { volume: 0.6 });
          break;
        case "trip":
          audio.play("bonk", { vary: 1 });
          break;
        case "end":
          audio.play("whistle");
          audio.play("finish");
          audio.duckMusic(true);
          break;
      }
    }
  }

  k.scene(MATTRESS_SCENE, ({ slot, minigameId, seed }: MinigameStart) => {
    const round = (slot >= 1 && slot <= 3 ? slot : 1) as 1 | 2 | 3;
    const crew = ctx.crew;
    const me = crew.findIndex((m) => m.control === "me");
    const shared = createShared({
      seats: crew.map((m) => ({ id: m.id, control: m.control })),
      slot,
      net: ctx.net,
      world: createWorld(round, seed, crew.map((m) => m.control === "bot")),
      clone: cloneWorld,
      step: (w, inputs) => step(w, inputs, STEP),
    });
    const renderer = createRenderer(k, crew, me);
    let started = false;
    let accumulator = 0;
    let jumpQueued = false;
    let lastScore = 0;
    let lastScoreAt = -Infinity;
    let reported = false;
    let behind = 0;
    let behindMovedAt = performance.now();

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
      const dt = Math.min(k.dt(), MAX_FRAME);

      if (started) {
        const remote = shared.remoteTicks();
        const now = performance.now();
        if (remote > behind) {
          behind = remote;
          behindMovedAt = now;
        }
        const waiting = shared.tick < END_TICK && shared.tick - remote > MAX_LEAD && now - behindMovedAt < STALL_MS;
        accumulator = waiting ? 0 : accumulator + dt;
        while (accumulator >= STEP) {
          accumulator -= STEP;
          const input = { move, jumpPressed: jumpQueued };
          ctx.net?.sendInput(slot, shared.tick, input);
          shared.push(input);
          jumpQueued = false;
        }
        const events = shared.sync();
        renderer.react(events, shared.world);
        feel(events, me);
      } else {
        jumpQueued = false; // nada de saltos antes del silbato
      }
      const world = shared.world;
      renderer.update(dt, world);

      const score = liveScore(world);
      if (score !== lastScore && world.time - lastScoreAt >= SCORE_EMIT_INTERVAL) {
        lastScore = score;
        lastScoreAt = world.time;
        ctx.emit({ type: "minigame:score", slot, score });
      }

      // Se cierra con el mundo confirmado (las teclas de todos hasta el final):
      // así el puntaje es el mismo en todas las compus.
      const settled = shared.confirmedTick >= END_TICK || shared.tick >= END_TICK + MAX_ROLLBACK_TICKS;
      if (!reported && shared.tick >= END_TICK + TUNING.endDelay / STEP && settled) {
        reported = true;
        const final = shared.confirmed.endedAt !== null ? shared.confirmed : world;
        ctx.emit({
          type: "minigame:finished",
          result: { slot, minigameId, score: finalScore(final), durationMs: Math.round(TUNING.duration * 1000) },
          // En equipo todos sacan lo mismo.
          rivals: crew.filter((m) => m.control !== "me").map((m) => ({ id: m.id, score: finalScore(final) })),
        });
      }
    });

    k.add([{ id: "mattress-view", draw: () => renderer.draw(shared.world) }]);
  });
}
