import type { NetLink, PlayerInput, RivalSpec, RunSlot } from "../contract";
import { mulberry32 } from "./random";

/**
 * Los 3 rivales de una prueba, para cualquier minijuego:
 * - bots: corren a la par del jugador; su habilidad y su azar salen de la
 *   semilla de la prueba, así en una sala online son iguales en todas las compus;
 * - remotos: se re-simulan con las teclas que llegan por la red, un poco
 *   atrasados (lo que tarda un paquete), así se ven fluidos.
 */

/** Atraso con el que se ven los rivales remotos (ticks de 1/120 s ≈ 0,6 s). */
export const REMOTE_DELAY_TICKS = 72;
/** Si un remoto se atrasó (lag), se pone al día de a lo sumo esto por frame. */
const MAX_CATCH_UP = 240;

/** Cómo se ve cada rival: su color, su nombre para los avisos y, si es una persona, su apodo arriba. */
export function rivalLooks(specs: readonly RivalSpec[]) {
  return specs.map((r) => ({ color: r.team.color, name: r.name, tag: r.control === "remote" ? r.name : undefined }));
}

export type RivalRunner<W> = {
  spec: RivalSpec;
  world: W;
  /** Ticks simulados de este rival. */
  tick: number;
};

export function createRivals<W, E>(options: {
  specs: readonly RivalSpec[];
  seed: number;
  slot: RunSlot;
  net?: NetLink;
  createWorld: () => W;
  /** `level`: 0 = el mejor, 1 = promedio, 2 = torpe. */
  createBot: (level: number, seed: number) => { input(world: W): PlayerInput };
  step: (world: W, input: PlayerInput) => E;
}) {
  const { specs, seed, slot, net } = options;
  const random = mulberry32(seed);
  // Fisher-Yates con la semilla: el mismo reparto de habilidades en todas las compus.
  const levels = [0, 1, 2];
  for (let i = levels.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [levels[i], levels[j]] = [levels[j], levels[i]];
  }

  let bots = 0;
  const runners = specs.map((spec, i) => ({
    spec,
    world: options.createWorld(),
    tick: 0,
    bot: spec.control === "bot" ? options.createBot(levels[bots++ % levels.length], seed + 7919 * (i + 1)) : null,
  }));

  return {
    runners: runners as readonly RivalRunner<W>[],

    /** Un paso de los bots: van a la par del jugador. */
    stepBots(onStep: (index: number, result: E, world: W) => void) {
      runners.forEach((r, i) => {
        if (!r.bot) return;
        onStep(i, options.step(r.world, r.bot.input(r.world)), r.world);
        r.tick++;
      });
    },

    /** Los remotos avanzan hasta donde llegaron sus teclas, un poco atrás del jugador. */
    stepRemotes(localTick: number, onStep: (index: number, result: E, world: W) => void) {
      if (!net) return;
      runners.forEach((r, i) => {
        if (r.spec.control !== "remote") return;
        const target = Math.min(net.remoteTicks(r.spec.id, slot), localTick - REMOTE_DELAY_TICKS);
        for (let n = 0; r.tick < target && n < MAX_CATCH_UP; n++) {
          const input = net.remoteInput(r.spec.id, slot, r.tick);
          if (!input) break;
          onStep(i, options.step(r.world, input), r.world);
          r.tick++;
        }
      });
    },
  };
}
