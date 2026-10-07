import { clamp } from "../../engine/physics";
import { mulberry32 } from "../../engine/random";
import { angleFromTop, cloneWorld, type SimEvent, type SimInput, score, step, surfaceVx, type World } from "./sim";
import { PLAYER_SIZE, TUNING } from "./tuning";

/**
 * Rivales de El Tronco Loco. Un control de equilibrio los mantiene cerca de
 * la cima; antes de cada decisión prueban saltar o no en una copia del mundo.
 * La habilidad agrega demora, pánico y pasos en falso.
 */

const DT = 1 / 120;
const PLAN_DT = 1 / 60; // al planificar alcanza con menos precisión
const HORIZON = 1.3; // una pelota cruza en ~1 s, más lo que dura un salto
const HOLD = 0.15; // cuánto sostiene la jugada probada antes de volver a equilibrar

/** Dirección que mejor lo lleva hacia la cima, dado cómo lo arrastra la corteza. */
export function balanceMove(world: World): number {
  const p = world.player;
  const dx = p.x - world.level.center.x;
  const want = clamp(-dx * 3, -160, 160);
  const carried = surfaceVx(world, p.x);
  const run = TUNING.runSpeed * Math.cos(angleFromTop(world.level, p.x));
  let best = 0;
  let bestError = Infinity;
  for (const move of [0, -1, 1]) {
    const error = Math.abs(carried + move * run - want);
    if (error < bestError - 1) {
      best = move;
      bestError = error;
    }
  }
  return best;
}

/** Reflejo: saltar si una pelota baja está por llegar (y ninguna alta). */
export function reflexJump(world: World): boolean {
  const p = world.player;
  if (!p.grounded) return false;
  let low = false;
  for (const ball of world.balls) {
    if (ball.spent || Math.sign(p.x - ball.x) !== Math.sign(ball.vx)) continue;
    const gap = Math.abs(p.x - ball.x) - PLAYER_SIZE.width / 2 - TUNING.ballRadius;
    const arrival = gap / Math.abs(ball.vx);
    if (ball.height === "high" && arrival < 0.9) return false;
    if (ball.height === "low" && arrival > 0.15 && arrival < 0.35) low = true;
  }
  return low;
}

type Candidate = { move: number; jump: boolean };
const CANDIDATES: Candidate[] = [
  { move: 0, jump: false },
  { move: -1, jump: false },
  { move: 1, jump: false },
  { move: 0, jump: true },
  { move: -1, jump: true },
  { move: 1, jump: true },
];

function evaluate(world: World, candidate: Candidate, bubbleValue: number): number {
  const sim = cloneWorld(world);
  const lives = sim.lives;
  const bubbles = sim.bubbles;
  let value = candidate.jump ? -25 : 0;
  for (let t = 0; t < HORIZON; t += PLAN_DT) {
    const holding = t < HOLD;
    const move = holding ? candidate.move : balanceMove(sim);
    const jumpPressed = t === 0 ? candidate.jump : !holding && reflexJump(sim);
    const events: SimEvent[] = step(sim, { move, jumpPressed }, PLAN_DT);
    if (events.some((e) => e.type === "hit")) value -= 400;
    if (sim.player.sinking || sim.lives < lives || sim.respawnIn > 0) return value - 2000 + t * 100;
    if (sim.outcome !== null) break;
    // Mejor cerca de la cima durante todo el trayecto, no solo al final.
    value -= Math.abs(sim.player.x - sim.level.center.x) * 0.02;
  }
  return value + (sim.bubbles - bubbles) * bubbleValue;
}

/** Mejor jugada para este instante (sin errores humanos). */
export function plan(world: World, { wantsBubbles = true } = {}): SimInput {
  const p = world.player;
  if (world.respawnIn > 0 || p.sinking || p.ragdoll || p.getUp > 0) return { move: 0, jumpPressed: false };
  let best = CANDIDATES[0];
  let bestValue = -Infinity;
  for (const candidate of CANDIDATES) {
    if (candidate.jump && !p.grounded) continue;
    const value = evaluate(world, candidate, wantsBubbles ? 60 : 0);
    if (value > bestValue) {
      best = candidate;
      bestValue = value;
    }
  }
  return { move: best.move, jumpPressed: best.jump };
}

export type BotSkill = {
  /** Segundos entre decidir saltar y saltar. */
  reaction: number;
  /** Probabilidad de no saltar cuando hacía falta. */
  panic: number;
  /** Distracciones por segundo: deja de corregir un ratito y el tronco lo lleva. */
  stumbleRate: number;
  /** Probabilidad de ir a buscar cada burbuja. */
  greed: number;
};

// Calibrados en bot.test.ts para que se les pueda ganar.
export const BOT_SKILLS = {
  ace: { reaction: 0.05, panic: 0.15, stumbleRate: 0.22, greed: 0.4 },
  average: { reaction: 0.1, panic: 0.25, stumbleRate: 0.3, greed: 0.3 },
  clumsy: { reaction: 0.16, panic: 0.45, stumbleRate: 0.55, greed: 0.1 },
} as const satisfies Record<string, BotSkill>;

export function createBot(skill: BotSkill, seed: number) {
  const random = mulberry32(seed);
  const DECIDE_EVERY = 1 / 15;
  let decideIn = 0;
  let planMove = 0;
  let planMoveUntil = 0;
  let stumbleUntil = 0;
  let bubblesSeen = 0;
  let wantsBubbles = false;
  let jumpAt: number | null = null;

  return {
    input(world: World): SimInput {
      decideIn -= DT;
      let jumpPressed = false;
      if (jumpAt !== null && world.time >= jumpAt) {
        jumpPressed = true;
        jumpAt = null;
      }
      // Las decisiones (saltar, ir a buscar una burbuja) son de a ratos...
      if (decideIn <= 0) {
        decideIn = DECIDE_EVERY;
        if (world.time >= stumbleUntil && random() < skill.stumbleRate * DECIDE_EVERY) {
          stumbleUntil = world.time + 0.3 + random() * 0.3;
        }
        // Con cada burbuja nueva decide si va a ir a buscarla.
        if (world.cursor.bubble !== bubblesSeen) {
          bubblesSeen = world.cursor.bubble;
          wantsBubbles = random() < skill.greed;
        }
        const action = plan(world, { wantsBubbles });
        if (action.jumpPressed) {
          planMove = action.move;
          planMoveUntil = world.time + HOLD;
          if (jumpAt === null && random() >= skill.panic) {
            jumpAt = world.time + skill.reaction * (0.5 + random());
          }
        }
      }
      // ...pero el equilibrio se corrige todo el tiempo, como hacen los pies.
      const move =
        world.time < stumbleUntil ? 0 : world.time < planMoveUntil ? planMove : balanceMove(world);
      return { move, jumpPressed };
    },
  };
}

/** Avanza un rival un paso (para la escena y los tests). */
export function stepBot(world: World, bot: ReturnType<typeof createBot>) {
  return step(world, bot.input(world), DT);
}

/** Puntaje que se muestra en la tabla para un rival (es cosmético). */
export function rivalScore(world: World): number {
  // Si el jugador terminó antes, se le proyecta lo que iba sacando por segundo.
  if (world.outcome !== null || world.time <= 0) return score(world);
  const rate = score(world) / world.time;
  const remaining = world.lives > 0 ? TUNING.timeLimit - world.time : 0;
  return Math.min(1000, Math.round(score(world) + rate * remaining));
}
