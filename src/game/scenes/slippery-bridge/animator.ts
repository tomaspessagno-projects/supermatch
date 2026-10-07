import type { ContestantPose, Expression } from "../../engine/contestant";
import { clamp, spring } from "../../engine/physics";
import type { SimEvent, World } from "./sim";

/**
 * Estado de animación de un concursante (fase de carrera, estirar/aplastar,
 * grito). Lo usa tanto el jugador como cada rival.
 */
export function createAnimator() {
  let runPhase = 0;
  let squash = 1;
  let squashVel = 0;
  let screamFor = 0;

  return {
    react(events: readonly SimEvent[]) {
      for (const e of events) {
        if (e.type === "jump") squash = 1.2;
        else if (e.type === "land") squash = clamp(1 - e.impact / 2200, 0.68, 0.94);
        else if (e.type === "bonk") screamFor = 0.3;
        else if (e.type === "respawn") squash = 0.75;
      }
    },

    /** `move`: dirección que aprieta (o la que lleva, para los rivales). */
    update(dt: number, world: World, move: number) {
      const p = world.player;
      // Piernas: si aprieta, pedalean rápido aunque no avance (hielo).
      runPhase += dt * (move !== 0 && p.grounded ? 14 : Math.abs(p.vx) / 40);
      [squash, squashVel] = spring(squash, squashVel, 1, 320, 12, dt);
      screamFor = Math.max(0, screamFor - dt);
    },

    pose(world: World, yOffset = 0, opacity = 1): ContestantPose {
      const p = world.player;
      const t = world.time;
      const lying = p.getUp > 0;
      const tumbling = p.ragdoll && !p.grounded;
      const airborne = !p.grounded && !p.ragdoll;

      let legs: [number, number];
      let arms: [number, number];
      if (tumbling) {
        legs = [Math.sin(t * 18) * 45, -Math.sin(t * 18 + 1) * 45];
        arms = [Math.sin(t * 20) * 130, Math.cos(t * 17) * 130];
      } else if (lying) {
        legs = [15 + Math.sin(t * 22) * 15, -10 + Math.cos(t * 22) * 15];
        arms = [160, -160];
      } else if (airborne || p.sinking) {
        legs = [-25 + Math.sin(t * 16) * 10, 35 + Math.sin(t * 15) * 10];
        arms = [-150 + Math.sin(t * 16) * 30, 150 + Math.sin(t * 14) * 30];
      } else {
        const swing = Math.sin(runPhase) * 38;
        legs = [-swing, swing];
        arms = [swing * 1.1, -swing * 1.1];
      }

      let expression: Expression = "normal";
      if (p.ragdoll || lying) expression = "dizzy";
      else if (p.sinking || screamFor > 0 || (airborne && p.vy > 250)) expression = "scream";

      return {
        x: p.x,
        y: p.y + yOffset,
        lean: p.lean,
        squash,
        legs,
        arms,
        headTilt: clamp(-p.leanVel * 0.03, -20, 20),
        expression,
        dizzy: p.ragdoll || lying,
        time: t,
        opacity,
      };
    },
  };
}
