import type { ContestantPose, Expression } from "./contestant";
import { clamp, spring } from "./physics";

/** Lo que el animador necesita saber del cuerpo de un concursante. */
export type AnimatedBody = {
  /** Centro de los pies. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  /** Viene de un golpe: gira sin control. */
  ragdoll: boolean;
  /** Tirado en el piso, levantándose. */
  getUp: number;
  /** Cayendo al agua sin vuelta atrás. */
  sinking: boolean;
  /** Inclinación en grados (positivo = horario, hacia la derecha). */
  lean: number;
  leanVel: number;
};

export type AnimEvent = { type: string; impact?: number };

/**
 * Estado de animación de un concursante (fase de carrera, estirar/aplastar,
 * grito). Lo usan el jugador y cada rival, en cualquier prueba.
 */
export function createAnimator() {
  let runPhase = 0;
  let squash = 1;
  let squashVel = 0;
  let screamFor = 0;
  let facing: 1 | -1 = 1;

  return {
    react(events: readonly AnimEvent[]) {
      for (const e of events) {
        if (e.type === "jump") squash = 1.2;
        else if (e.type === "land") squash = clamp(1 - (e.impact ?? 0) / 2200, 0.68, 0.94);
        else if (e.type === "bonk" || e.type === "hit") screamFor = 0.3;
        else if (e.type === "respawn") squash = 0.75;
      }
    },

    /**
     * `move`: dirección que aprieta (o la que lleva, para los rivales).
     * `groundSpeed`: velocidad respecto del piso (en el tronco, el piso se mueve).
     */
    update(dt: number, body: AnimatedBody, move: number, groundSpeed = body.vx) {
      // Piernas: si aprieta, pedalean rápido aunque no avance (hielo, tronco).
      runPhase += dt * (move !== 0 && body.grounded ? 14 : Math.abs(groundSpeed) / 40);
      [squash, squashVel] = spring(squash, squashVel, 1, 320, 12, dt);
      screamFor = Math.max(0, screamFor - dt);
      if (move !== 0 && !body.ragdoll) facing = move > 0 ? 1 : -1;
    },

    pose(body: AnimatedBody, time: number, { yOffset = 0, opacity = 1 } = {}): ContestantPose {
      const t = time;
      const lying = body.getUp > 0;
      const tumbling = body.ragdoll && !body.grounded;
      const airborne = !body.grounded && !body.ragdoll;

      let legs: [number, number];
      let arms: [number, number];
      if (tumbling) {
        legs = [Math.sin(t * 18) * 45, -Math.sin(t * 18 + 1) * 45];
        arms = [Math.sin(t * 20) * 130, Math.cos(t * 17) * 130];
      } else if (lying) {
        legs = [15 + Math.sin(t * 22) * 15, -10 + Math.cos(t * 22) * 15];
        arms = [160, -160];
      } else if (airborne || body.sinking) {
        legs = [-25 + Math.sin(t * 16) * 10, 35 + Math.sin(t * 15) * 10];
        arms = [-150 + Math.sin(t * 16) * 30, 150 + Math.sin(t * 14) * 30];
      } else {
        const swing = Math.sin(runPhase) * 38;
        legs = [-swing, swing];
        arms = [swing * 1.1, -swing * 1.1];
      }

      let expression: Expression = "normal";
      if (body.ragdoll || lying) expression = "dizzy";
      else if (body.sinking || screamFor > 0 || (airborne && body.vy > 250)) expression = "scream";

      return {
        x: body.x,
        y: body.y + yOffset,
        lean: body.lean,
        facing,
        squash,
        legs,
        arms,
        headTilt: clamp(-body.leanVel * 0.03, -20, 20),
        expression,
        dizzy: body.ragdoll || lying,
        time: t,
        opacity,
      };
    },
  };
}
