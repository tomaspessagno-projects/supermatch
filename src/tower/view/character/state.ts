import { blockOf, type SimEvent, type World } from "../../sim/sim";
import { TUNING } from "../../sim/tuning";
import { clamp } from "./rig";

/**
 * Qué está haciendo el concursante (para elegir la animación) y todo lo que
 * hace falta para dibujarla: velocidades, fases de los ciclos, tiempos.
 * Lo usan las dos formas de dibujarlo: el muñeco por código y el modelo 3D
 * con animaciones (GLB). No toca la simulación.
 */

export const CLIPS = [
  "idle", "run", "skate", "jump", "fall", "flip", "glide",
  "hang", "shimmy", "pullUp", "climb", "lifted",
  "slip", "hit", "swim", "cheer", "teeter",
] as const;
export type Clip = (typeof CLIPS)[number];

/** Cuánto tarda en pasar a cada animación (s). */
const FADE: Partial<Record<Clip, number>> = { hit: 0.05, hang: 0.06, pullUp: 0.05, flip: 0.05, jump: 0.07, swim: 0.08, run: 0.1, idle: 0.14, teeter: 0.2, cheer: 0.12 };

export type AnimCtx = {
  /** Reloj real (s). */
  t: number;
  /** Velocidad horizontal (m/s) y cuánto de "correr" hay (0 parado … 1 a fondo). */
  speed: number;
  stride: number;
  /** Ciclo de la carrera (rad). */
  phase: number;
  vy: number;
  /** Qué tan rápido está girando (rad/s, + a la izquierda) y acelerando (m/s²). */
  turn: number;
  accel: number;
  /** Segundos parado. */
  idleTime: number;
  /** Colgado: cuánto lleva, cuánto aguanta y hacia dónde avanza por el borde (x local). */
  hangTime: number;
  hangLimit: number;
  shimmy: number;
  shimmyPhase: number;
  /** Péndulo al agarrarse (rad). */
  swing: number;
  /** Subiéndose al borde (0 a 1). */
  pull: number;
  /** Trepando la red. */
  climbPhase: number;
  /** Borde cerca de los pies (dirección local, 0 si no hay). */
  teeterX: number;
  teeterZ: number;
  /** Mortal del doble salto (0 a 1). */
  flip: number;
  /** Festejo: cuánto le queda (s). */
  cheer: number;
  /** Chapuzón: segundos desde que cayó. */
  splashTime: number;
  /** Sin energía (o en el último segundo colgado): cara de esfuerzo. */
  strain: number;
};

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** El borde más cercano debajo de los pies (si está parado casi en la punta de un bloque). */
export function edgeNear(w: World): { x: number; z: number } | null {
  const p = w.player;
  if (!p.grounded || p.on === null) return null;
  const b = blockOf(w.tower, p.on);
  if (!b) return null;
  const wall = w.tower.wall;
  const edges = [
    { d: p.x - b.minX, x: -1, z: 0 },
    { d: b.maxX - p.x, x: 1, z: 0 },
    // Del lado de la fachada no hay vacío.
    { d: b.minZ - wall.maxZ < 0.5 ? Infinity : p.z - b.minZ, x: 0, z: -1 },
    { d: b.maxZ - p.z, x: 0, z: 1 },
  ];
  let best: { d: number; x: number; z: number } | null = null;
  for (const e of edges) if (e.d < 0.08 && (!best || e.d < best.d)) best = e;
  return best ? { x: best.x, z: best.z } : null;
}

/** Elige la animación según lo que pasa en la simulación. */
export function pickClip(w: World, c: AnimCtx): Clip {
  const p = w.player;
  if (w.phase === "splash") return "swim";
  if (p.stun > 0) return "hit";
  if (p.pullUp) return "pullUp";
  if (p.hang) return Math.abs(c.shimmy) > 0.3 ? "shimmy" : "hang";
  if (p.climbing) return "climb";
  if (p.lifted) return "lifted";
  if (p.slipping || (p.exhausted > 0 && p.grounded)) return "slip";
  if (!p.grounded) {
    if (c.flip > 0 && c.flip < 1) return "flip";
    if (p.gliding) return "glide";
    return p.vy > 0 ? "jump" : "fall";
  }
  if (p.ground === "soap" && c.speed > 3) return "skate";
  if (c.speed > 0.5) return "run";
  if (c.cheer > 0) return "cheer";
  if (c.teeterX !== 0 || c.teeterZ !== 0) return "teeter";
  return "idle";
}

/**
 * El "director" de las animaciones: sigue a la simulación cuadro a cuadro,
 * elige la animación, la mezcla con la anterior y lleva los resortes
 * (aplastarse al caer, estirarse al saltar, el péndulo al colgarse).
 */
export class CharacterDriver {
  clip: Clip = "idle";
  /** Peso de cada animación en la mezcla (la actual sube a 1, las otras bajan a 0). */
  weights = new Map<Clip, number>([["idle", 1]]);
  ctx: AnimCtx = {
    t: 0, speed: 0, stride: 0, phase: 0, vy: 0, turn: 0, accel: 0, idleTime: 0,
    hangTime: 0, hangLimit: 1, shimmy: 0, shimmyPhase: 0, swing: 0, pull: 0, climbPhase: 0,
    teeterX: 0, teeterZ: 0, flip: 0, cheer: 0, splashTime: 0, strain: 0,
  };
  /** Hacia dónde mira lo dibujado (sigue a la simulación, suave). */
  facing = Math.PI / 2;
  /** Aplastado (menos de 1) o estirado (más de 1). */
  squash = 1;
  private squashVel = 0;
  private swingVel = 0;
  /** Vueltas del golpe (se acomodan al terminar). */
  tumble = 0;
  /** Cintas de la vincha: cuánto flamean. */
  tails = 0;
  private tailsVel = 0;
  /** Parpadeo. */
  blink = 0;
  private nextBlink = 2;
  private lastClock = -1;
  private lastSpeed = 0;
  private teeterFor = 0;

  /** Los eventos de la simulación que se notan en el cuerpo. */
  onEvents(events: readonly SimEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case "jump":
          if (e.double) this.ctx.flip = 0.001;
          this.kick(1.16);
          break;
        case "bounce":
          this.kick(e.big ? 1.3 : 1.2);
          break;
        case "land":
          // Cuanto más fuerte cae, más se aplasta.
          if (e.impact > 2) this.kick(1 - clamp(e.impact * 0.014, 0.08, 0.3));
          break;
        case "grab":
          this.swingVel += 2.6;
          this.kick(1.08);
          break;
        case "pullUp":
          this.kick(0.88);
          break;
        case "star":
        case "top":
        case "item":
        case "floor":
          this.ctx.cheer = 1.6;
          break;
        case "rest":
          if (e.first) this.ctx.cheer = 2;
          break;
      }
    }
  }

  private kick(squash: number) {
    this.squash = squash;
    this.squashVel = 0;
  }

  /** Un cuadro. Se puede llamar más de una vez por cuadro (solo cuenta la primera). */
  update(w: World, clock: number, delta: number) {
    if (clock === this.lastClock) return;
    this.lastClock = clock;
    const dt = Math.min(delta, 0.1);
    const p = w.player;
    const c = this.ctx;
    c.t = clock;

    // Para dónde mira y qué tan rápido gira (para inclinarse en las curvas).
    const before = this.facing;
    const diff = angleDiff(p.facing, this.facing);
    this.facing += diff * (1 - Math.exp(-dt * 14));
    const turn = dt > 0 ? angleDiff(this.facing, before) / dt : 0;
    c.turn += (turn - c.turn) * (1 - Math.exp(-dt * 10));

    const speed = Math.hypot(p.vx, p.vz);
    const accel = dt > 0 ? (speed - this.lastSpeed) / dt : 0;
    this.lastSpeed = speed;
    c.accel += (clamp(accel, -40, 40) - c.accel) * (1 - Math.exp(-dt * 8));
    c.speed = speed;
    const runTarget = p.grounded ? clamp(speed / TUNING.moveSpeed, 0, 1) : 0;
    c.stride += (runTarget - c.stride) * (1 - Math.exp(-dt * 10));
    // Un ciclo de carrera cada ~0,9 m: los pies no patinan.
    c.phase += dt * (3 + speed * 1.75);
    c.vy = p.vy;
    c.idleTime = p.grounded && speed < 0.5 ? c.idleTime + dt : 0;

    // Colgado: cuánto aguanta y el avance de costado (en el eje del personaje).
    if (p.hang) {
      c.hangTime = p.hang.time;
      c.hangLimit = TUNING.hangTime + TUNING.hangPerGrip * w.stats.grip;
      const along = p.vx * Math.cos(this.facing) - p.vz * Math.sin(this.facing);
      c.shimmy = along;
      c.shimmyPhase += dt * Math.abs(along) * 5;
    } else {
      c.shimmy = 0;
    }
    c.pull = p.pullUp ? p.pullUp.t : 0;
    if (p.climbing) c.climbPhase += dt * (Math.abs(p.vy) * 2.6 + Math.abs(speed) * 2);
    c.strain = p.hang ? clamp((c.hangTime - (c.hangLimit - 1.2)) / 1.2, 0, 1) : p.exhausted > 0 ? 1 : 0;

    // Al borde de un bloque (parado un ratito): se tambalea.
    const edge = c.idleTime > 0.25 ? edgeNear(w) : null;
    this.teeterFor = edge ? this.teeterFor + dt : 0;
    if (edge && this.teeterFor > 0.15) {
      c.teeterX = edge.x * Math.cos(this.facing) - edge.z * Math.sin(this.facing);
      c.teeterZ = edge.x * Math.sin(this.facing) + edge.z * Math.cos(this.facing);
    } else {
      c.teeterX = 0;
      c.teeterZ = 0;
    }

    if (c.flip > 0) c.flip = p.grounded || p.hang || p.climbing ? 0 : c.flip + dt / 0.42;
    if (c.flip >= 1) c.flip = 0;
    c.cheer = Math.max(0, c.cheer - dt);
    c.splashTime = w.phase === "splash" ? w.phaseTime : 0;

    // Golpe: da vueltas; al terminar se acomoda a la vuelta entera más cercana.
    if (p.stun > 0) this.tumble += dt * 13;
    else {
      const rest = Math.round(this.tumble / (Math.PI * 2)) * Math.PI * 2;
      this.tumble += (rest - this.tumble) * (1 - Math.exp(-dt * 12));
      if (Math.abs(this.tumble - rest) < 0.01) this.tumble = 0;
    }

    // Resortes en pasos chicos (con pocos fps no se disparan).
    const swingTarget = p.hang ? clamp(-c.shimmy * 0.05, -0.2, 0.2) : 0;
    const tailsTarget = clamp(speed * 0.13 + Math.max(0, -p.vy) * 0.05 + (p.lifted ? 0.8 : 0), 0, 1.3);
    for (let left = dt; left > 1e-6; left -= 1 / 120) {
      const h = Math.min(left, 1 / 120);
      this.squashVel += (-(this.squash - 1) * 320 - this.squashVel * 15) * h;
      this.squash += this.squashVel * h;
      this.swingVel += (-(c.swing - swingTarget) * 30 - this.swingVel * 2.2) * h;
      c.swing += this.swingVel * h;
      this.tailsVel += (-(this.tails - tailsTarget) * 60 - this.tailsVel * 6) * h;
      this.tails += this.tailsVel * h;
    }
    if (!Number.isFinite(this.squash)) this.squash = 1;
    if (!Number.isFinite(c.swing)) c.swing = 0;
    if (!Number.isFinite(this.tails)) this.tails = 0;
    this.squash = clamp(this.squash, 0.7, 1.3);
    c.swing = clamp(c.swing, -0.6, 0.6);

    // Parpadeo cada tanto (más seguido si está asustado).
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 0.13;
      this.nextBlink = 1.5 + Math.random() * 3.5;
    }
    this.blink = Math.max(0, this.blink - dt);

    // Elegir y mezclar.
    this.clip = pickClip(w, c);
    const k = 1 - Math.exp(-dt / (FADE[this.clip] ?? 0.11));
    if (!this.weights.has(this.clip)) this.weights.set(this.clip, 0);
    for (const [clip, weight] of this.weights) {
      const next = weight + ((clip === this.clip ? 1 : 0) - weight) * k;
      if (clip !== this.clip && next < 0.004) this.weights.delete(clip);
      else this.weights.set(clip, next);
    }
  }
}
