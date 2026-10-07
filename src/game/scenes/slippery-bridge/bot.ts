import { clamp } from "../../engine/physics";
import { finalScore, type SimInput, step, type World } from "./sim";
import { SCORING, TUNING } from "./tuning";

/**
 * Rivales manejados por la computadora. Prueban acciones en una copia del
 * mundo y eligen la primera que no termina en golpe ni en charco; la habilidad
 * agrega demora y pánico para que fallen como personas.
 */

const RIGHT: SimInput = { move: 1, jumpPressed: false };
const IDLE: SimInput = { move: 0, jumpPressed: false };
const LEFT: SimInput = { move: -1, jumpPressed: false };
const JUMP: SimInput = { move: 1, jumpPressed: true };
const DT = 1 / 120;

export type BotSkill = {
  /** Segundos entre ver el peligro y saltar. */
  reaction: number;
  /** Probabilidad de no reaccionar ante un peligro. */
  panic: number;
  /** Velocidad a la que se anima en el jabón: más rápido, suelta y se deja llevar. */
  cruise: number;
};

// Calibrados para que una persona que cruza con una o dos caídas pueda ganarles
// (ver bot.test.ts): el as casi no falla, el torpe a veces no llega a la meta.
export const BOT_SKILLS = {
  ace: { reaction: 0.03, panic: 0.05, cruise: 380 },
  average: { reaction: 0.1, panic: 0.3, cruise: 270 },
  clumsy: { reaction: 0.18, panic: 0.45, cruise: 240 },
} as const satisfies Record<string, BotSkill>;

/** Acción perfecta para este instante (sin errores humanos). */
export function plan(world: World): SimInput {
  const p = world.player;
  if (world.respawnIn > 0 || !p.grounded || p.ragdoll || p.getUp > 0) return RIGHT;
  const runningIsSafe = isSafe(world, RIGHT, 0.6);
  if (!runningIsSafe && isSafe(world, JUMP, 1)) return JUMP;
  if (runningIsSafe || isSafe(world, RIGHT, 0.2)) return RIGHT;
  if (isSafe(world, IDLE, 0.6)) return IDLE;
  return LEFT;
}

function isSafe(world: World, first: SimInput, horizon: number): boolean {
  const sim: World = { ...world, player: { ...world.player } };
  for (let t = 0; t < horizon; t += DT) {
    const input = t === 0 ? first : t < 0.1 ? { ...first, jumpPressed: false } : RIGHT;
    const events = step(sim, input, DT);
    if (sim.player.sinking || events.some((e) => e.type === "bonk")) return false;
    if (sim.outcome !== null) return true;
  }
  return true;
}

export function createBot(skill: BotSkill, seed: number) {
  const random = mulberry32(seed);
  const DECIDE_EVERY = 1 / 20;
  let decideIn = 0;
  let move: SimInput = RIGHT;
  let jumpAt: number | null = null;
  let panicUntil = 0;

  return {
    /** Input para el próximo paso de simulación. */
    input(world: World): SimInput {
      decideIn -= DT;
      let jumpPressed = false;
      if (jumpAt !== null && world.time >= jumpAt) {
        jumpPressed = true;
        jumpAt = null;
      }
      if (decideIn <= 0) {
        decideIn = DECIDE_EVERY;
        const action = plan(world);
        if (action.jumpPressed) {
          if (jumpAt === null && world.time >= panicUntil) {
            if (random() < skill.panic) {
              panicUntil = world.time + 0.6; // se congela y sigue de largo
            } else {
              jumpAt = world.time + skill.reaction * (0.5 + random());
            }
          }
          move = RIGHT;
        } else {
          move = action;
        }
      }
      // Miedo al jabón: pasada su velocidad de crucero, suelta y se deja patinar.
      const coasting = move === RIGHT && world.player.grounded && world.player.vx > skill.cruise;
      return { move: coasting ? 0 : move.move, jumpPressed };
    },
  };
}

/**
 * Puntaje estimado de un rival cuando el jugador termina antes: si iba en
 * camino a la meta a su ritmo, se le cuenta como llegada. Es solo cosmético.
 */
export function projectedScore(world: World): number {
  if (world.outcome !== null) return finalScore(world);
  const { startX, finishX } = world.level;
  const covered = world.player.maxX - startX;
  const pace = covered / Math.max(world.time, 1);
  const eta = world.time + (finishX - world.player.maxX) / Math.max(pace, 1);
  if (eta >= TUNING.timeLimit) {
    const progress = clamp((covered + pace * (TUNING.timeLimit - world.time)) / (finishX - startX), 0, 1);
    return Math.round(SCORING.distancePoints * progress);
  }
  const timeLeft = clamp(1 - eta / TUNING.timeLimit, 0, 1);
  return SCORING.distancePoints + SCORING.finishPoints + Math.round(SCORING.timeBonusPoints * timeLeft);
}

export function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Avanza un rival un paso (para la escena y los tests). */
export function stepBot(world: World, bot: ReturnType<typeof createBot>) {
  return step(world, bot.input(world), DT);
}
