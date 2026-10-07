import { autoKnee, type ContestantPose, type Expression } from "./contestant";
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
  /** Qué tan "corriendo" está (0 quieto, 1 a full): la zancada crece y se apaga suave. */
  let stride = 0;
  let strideVel = 0;
  let breath = 0;
  let squash = 1;
  let squashVel = 0;
  let screamFor = 0;
  let facing: 1 | -1 = 1;
  let lastMove = 0;

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
      const pedaling = move !== 0 && body.grounded;
      runPhase += dt * (pedaling ? 14 : Math.min(14, Math.abs(groundSpeed) / 40));
      const targetStride = pedaling ? 1 : clamp(Math.abs(groundSpeed) / 300, 0, 1);
      [stride, strideVel] = spring(stride, strideVel, targetStride, 90, 16, dt);
      breath += dt;
      [squash, squashVel] = spring(squash, squashVel, 1, 320, 12, dt);
      screamFor = Math.max(0, screamFor - dt);
      if (move !== 0 && !body.ragdoll) facing = move > 0 ? 1 : -1;
      lastMove = move;
    },

    /** `celebrate`: ganó, festeja saltando con los brazos arriba. */
    pose(body: AnimatedBody, time: number, { yOffset = 0, opacity = 1, celebrate = false } = {}): ContestantPose {
      const t = time;
      const lying = body.getUp > 0;
      const tumbling = body.ragdoll && !body.grounded;
      const airborne = !body.grounded && !body.ragdoll;

      // Patina sin control (o frenando de golpe): revolea los brazos como molino.
      const sliding =
        body.grounded && !body.ragdoll && !lying && Math.abs(body.vx) > 420 && (lastMove === 0 || lastMove * body.vx < 0);

      let legs: [number, number];
      let arms: [number, number];
      let knees: [number, number] | undefined;
      let hop = 0;
      if (celebrate && body.grounded && !body.ragdoll) {
        hop = Math.abs(Math.sin(t * 7)) * 18;
        legs = [-10 - Math.sin(t * 14) * 12, 10 + Math.sin(t * 14) * 12];
        arms = [170 + Math.sin(t * 12) * 25, 190 + Math.cos(t * 12) * 25];
      } else if (tumbling) {
        legs = [Math.sin(t * 18) * 45, -Math.sin(t * 18 + 1) * 45];
        arms = [Math.sin(t * 20) * 130, Math.cos(t * 17) * 130];
      } else if (lying) {
        legs = [15 + Math.sin(t * 22) * 15, -10 + Math.cos(t * 22) * 15];
        arms = [160, -160];
      } else if (airborne && body.vy < 0) {
        // Subiendo: rodillas recogidas y brazos arriba.
        legs = [-10 + Math.sin(t * 16) * 6, 40 + Math.sin(t * 15) * 6];
        knees = [70, 85];
        arms = [-160 + Math.sin(t * 16) * 15, 165 + Math.sin(t * 14) * 15];
      } else if (airborne || body.sinking) {
        // Bajando: piernas que se estiran buscando el piso y brazos que revolean.
        legs = [-25 + Math.sin(t * 16) * 10, 35 + Math.sin(t * 15) * 10];
        knees = [25, 15];
        arms = [-150 + Math.sin(t * 16) * 30, 150 + Math.sin(t * 14) * 30];
      } else if (sliding) {
        const spin = (t * 900) % 360;
        legs = [-12, 18];
        arms = [spin, (spin + 180) % 360];
      } else {
        // Caminar/correr: la zancada crece con la velocidad; quieto, respira.
        const swing = Math.sin(runPhase) * 40 * stride;
        legs = [-swing, swing];
        arms = [swing * 1.1, -swing * 1.1];
        hop = Math.abs(Math.cos(runPhase)) * 6 * stride + Math.sin(breath * 2.4) * 0.8 * (1 - stride);
      }
      // Aterrizaje: el aplastamiento dobla las rodillas (amortigua).
      const crouch = Math.max(0, 1 - squash) * 150;
      if (crouch > 0 && body.grounded) {
        const base = knees ?? [autoKnee(legs[0]), autoKnee(legs[1])];
        knees = [base[0] + crouch, base[1] + crouch];
      }

      let expression: Expression = "normal";
      if (body.ragdoll || lying) expression = "dizzy";
      else if (body.sinking || screamFor > 0 || sliding || (airborne && body.vy > 250)) expression = "scream";

      return {
        x: body.x,
        y: body.y + yOffset - hop,
        lean: body.lean,
        facing,
        squash,
        legs,
        arms,
        knees,
        headTilt: clamp(-body.leanVel * 0.03, -20, 20) + Math.sin(runPhase * 2) * 3 * stride,
        expression,
        dizzy: body.ragdoll || lying,
        time: t,
        opacity,
      };
    },
  };
}
