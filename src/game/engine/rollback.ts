import type { NetLink, PlayerInput, RunSlot } from "../contract";

/**
 * Un mundo compartido (prueba cooperativa): todas las compus simulan el mismo
 * mundo con las teclas de todos.
 *
 * Las teclas de los demás llegan tarde (lo que tarda la red), así que cada
 * compu lleva dos mundos:
 * - el **confirmado**, hasta el último tick del que ya tiene las teclas de
 *   todos: es igual en todas las compus;
 * - el **presente**, que sigue desde el confirmado adivinando que los demás
 *   siguen apretando lo último que apretaron. Es el que se dibuja: lo tuyo
 *   responde al instante.
 * Cuando llegan teclas nuevas se rehace el presente desde el confirmado
 * (rollback). La simulación tiene que ser determinista y barata de clonar.
 */

export type Seat = { id: string; control: "me" | "bot" | "remote" };

/** Si alguien se atrasa más que esto (≈2 s), se confirma igual con su última tecla. */
export const MAX_ROLLBACK_TICKS = 240;

const IDLE: PlayerInput = { move: 0, jumpPressed: false };

export function createShared<W, E>(options: {
  seats: readonly Seat[];
  slot: RunSlot;
  net?: NetLink;
  world: W;
  clone: (world: W) => W;
  step: (world: W, inputs: readonly PlayerInput[]) => readonly E[];
}) {
  const { seats, slot, net, clone, step } = options;
  const remotes = seats.flatMap((s, i) => (s.control === "remote" ? [i] : []));
  const local: PlayerInput[] = [];
  const confirmed = options.world;
  let confirmedTick = 0;
  let present = confirmed;
  let presentTick = 0;

  /** Lo último que se sabe que apretó (sin repetir el salto, que es un flanco). */
  function guess(id: string): PlayerInput {
    const known = net?.remoteTicks(id, slot) ?? 0;
    const last = known > 0 ? net?.remoteInput(id, slot, known - 1) : undefined;
    return last ? { move: last.move, jumpPressed: false } : IDLE;
  }

  function inputsAt(tick: number): PlayerInput[] {
    return seats.map((s) => {
      if (s.control === "me") return local[tick] ?? IDLE;
      if (s.control === "bot") return IDLE; // los bots los decide la simulación
      return net?.remoteInput(s.id, slot, tick) ?? guess(s.id);
    });
  }

  return {
    /** Mi tecla del tick siguiente (en orden, uno por paso fijo). */
    push(input: PlayerInput) {
      local.push(input);
    },

    /**
     * Pone el presente al día con mis teclas y lo que llegó de los demás.
     * Devuelve solo los eventos de ticks nuevos (los ya mostrados no se repiten).
     */
    sync(): E[] {
      const target = local.length;
      let ready = target;
      for (const i of remotes) ready = Math.min(ready, net?.remoteTicks(seats[i].id, slot) ?? 0);
      const upTo = Math.max(ready, target - MAX_ROLLBACK_TICKS);

      const events: E[] = [];
      const freshFrom = presentTick;
      while (confirmedTick < upTo) {
        const happened = step(confirmed, inputsAt(confirmedTick));
        if (confirmedTick >= freshFrom) events.push(...happened);
        confirmedTick++;
      }
      if (confirmedTick === target) {
        present = confirmed;
      } else {
        present = clone(confirmed);
        for (let t = confirmedTick; t < target; t++) {
          const happened = step(present, inputsAt(t));
          if (t >= freshFrom) events.push(...happened);
        }
      }
      presentTick = target;
      return events;
    },

    /** Hasta qué tick llegaron las teclas del más atrasado (Infinity si no hay remotos). */
    remoteTicks(): number {
      let min = Infinity;
      for (const i of remotes) min = Math.min(min, net?.remoteTicks(seats[i].id, slot) ?? 0);
      return min;
    },

    /** El mundo para dibujar (con lo de los demás adivinado). */
    get world() {
      return present;
    },
    /** El mundo igual en todas las compus. */
    get confirmed() {
      return confirmed;
    },
    get confirmedTick() {
      return confirmedTick;
    },
    get tick() {
      return local.length;
    },
  };
}
