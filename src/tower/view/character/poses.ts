import { blend, clamp, mixPose, type Pose, pose, smooth } from "./rig";
import type { AnimCtx, Clip, CharacterDriver } from "./state";

/**
 * Las poses del muñeco, una por animación. Cada una es una función del
 * momento (reloj, velocidad, fases): los ciclos (correr, trepar, patalear)
 * salen de ahí, y la mezcla entre animaciones la hace el driver con pesos.
 */

const { sin, cos, abs, max, PI } = Math;

function idle(c: AnimCtx): Pose {
  const breathe = sin(c.t * 2.4);
  const sway = sin(c.t * 0.8);
  // Mira para los costados de a ratos (suma de senos lentos: parece al azar).
  const around = smooth(c.idleTime / 2) * (sin(c.t * 0.43) * 0.6 + sin(c.t * 0.17 + 1) * 0.4);
  return pose({
    hipY: -0.01, roll: sway * 0.025, hipYaw: sway * 0.04,
    chestPitch: -0.02 + breathe * 0.015, chestRoll: -sway * 0.02, breath: breathe,
    headYaw: around * 0.4, headPitch: sin(c.t * 0.31) * 0.05, headRoll: -sway * 0.05,
    kneeL: 0.1 + max(0, sway) * 0.12, kneeR: 0.1 + max(0, -sway) * 0.12,
    armL: 0.06 + breathe * 0.02, armR: 0.06 + breathe * 0.02, armOutL: 0.14 + breathe * 0.02, armOutR: 0.14 + breathe * 0.02,
    elbowL: 0.3, elbowR: 0.3,
    mouth: 0.12, smile: 0.75, lookX: around * 0.7,
  });
}

function run(c: AnimCtx): Pose {
  const s = c.stride;
  const ph = c.phase;
  const sn = sin(ph);
  const cs = cos(ph);
  const swing = 0.3 + 0.6 * s;
  const thighL = sn * swing;
  const thighR = -sn * swing;
  // Más arriba al pasar una pierna al lado de la otra, más abajo con las piernas abiertas.
  const bounce = cos(2 * ph);
  const lean = 0.06 + 0.14 * s + clamp(c.accel * 0.012, -0.12, 0.18);
  const hipYaw = 0.14 * s * sn;
  const chestYaw = -0.3 * s * sn;
  return pose({
    hipY: s * (-0.03 + 0.035 * bounce), lean,
    roll: clamp(-c.turn * c.speed * 0.018, -0.3, 0.3) + 0.03 * s * sn, hipYaw,
    chestYaw, chestPitch: 0.04 * s,
    headPitch: -lean * 0.6 + 0.03 * s * bounce, headYaw: -(hipYaw + chestYaw) * 0.8,
    thighL, thighR,
    // La rodilla se dobla cuando la pierna viene para adelante.
    kneeL: 0.15 + 0.2 * s + max(0, cs) * (0.5 + 1.1 * s),
    kneeR: 0.15 + 0.2 * s + max(0, -cs) * (0.5 + 1.1 * s),
    ankleL: s * (0.4 * max(0, -sn) - 0.2 * max(0, sn)),
    ankleR: s * (0.4 * max(0, sn) - 0.2 * max(0, -sn)),
    armL: -thighL * 0.95 + 0.12 * s, armR: -thighR * 0.95 + 0.12 * s,
    armOutL: 0.12 + 0.06 * s, armOutR: 0.12 + 0.06 * s,
    elbowL: 0.45 + 0.85 * s + 0.3 * s * max(0, -sn), elbowR: 0.45 + 0.85 * s + 0.3 * s * max(0, sn),
    mouth: 0.15 + 0.3 * s, smile: 0.6, brow: 0.35 * s, lookX: clamp(c.turn * 0.3, -1, 1),
  });
}

/** Patinando en el jabón: piernas abiertas y brazos que revolean. */
function skate(c: AnimCtx): Pose {
  const f = sin(c.t * 14);
  return pose({
    hipY: -0.06, lean: -0.12, roll: sin(c.t * 5) * 0.15,
    thighL: 0.25, thighR: -0.2, kneeL: 0.45, kneeR: 0.35, legOutL: 0.3, legOutR: 0.3,
    armL: 1.3 + f * 0.6, armR: 1.3 - f * 0.6, armOutL: 1.1, armOutR: 1.1, elbowL: 0.3, elbowR: 0.3,
    headPitch: 0.1, mouth: 0.8, smile: 0.2, brow: -0.7, lookY: -0.4,
  });
}

/** En el aire: de subir (rodillas recogidas, un brazo arriba) a caer (piernas que buscan el piso). */
function air(c: AnimCtx): Pose {
  const up = smooth((clamp(c.vy / 9, -1, 1) + 1) / 2);
  const flap = sin(c.t * 16) * 0.3;
  const rise = pose({
    lean: 0.12, chestPitch: 0.05, headPitch: -0.15,
    thighL: 1.25, kneeL: 1.8, ankleL: 0.4, thighR: 0.25, kneeR: 1.0, ankleR: 0.5,
    armL: 2.7, armOutL: 0.3, elbowL: 0.3, armR: -0.6, armOutR: 0.35, elbowR: 0.8,
    mouth: 0.45, smile: 0.7, brow: 0.6, lookY: 0.5,
  });
  const fall = pose({
    lean: 0.05, headPitch: 0.2,
    thighL: 0.45, kneeL: 0.5, ankleL: 0.25, thighR: -0.05, kneeR: 0.35, ankleR: 0.3, legOutL: 0.12, legOutR: 0.12,
    armL: 1.9 + flap, armR: 1.7 - flap, armOutL: 0.8, armOutR: 0.8, elbowL: 0.4, elbowR: 0.4,
    mouth: 0.5, smile: 0.3, brow: -0.2, lookY: -0.7,
  });
  const out = mixPose(fall, rise, up);
  // Cayendo de muy alto: patalea, revolea los brazos y grita.
  const panic = clamp((-c.vy - 13) / 8, 0, 1);
  if (panic <= 0) return out;
  const k = c.t * 13;
  const flail = pose({
    lean: -0.1, headPitch: 0.25,
    thighL: 0.6 + sin(k) * 0.7, thighR: 0.6 - sin(k) * 0.7, kneeL: 1 + cos(k) * 0.6, kneeR: 1 - cos(k) * 0.6,
    legOutL: 0.25, legOutR: 0.25,
    armL: 2.4 + sin(k * 1.1) * 0.9, armR: 2.4 + cos(k * 1.1) * 0.9, armOutL: 1, armOutR: 1, elbowL: 0.3, elbowR: 0.3,
    mouth: 1, smile: 0, brow: -1, eyes: 1.25, lookY: -1,
  });
  return mixPose(out, flail, panic);
}

/** El mortal del doble salto: hecho bolita (la vuelta la pone el driver). */
function flip(): Pose {
  return pose({
    thighL: 1.7, thighR: 1.6, kneeL: 2.2, kneeR: 2.1, ankleL: 0.5, ankleR: 0.5,
    armL: 1.2, armR: 1.2, armOutL: 0.35, armOutR: 0.35, elbowL: 1.5, elbowR: 1.5,
    headPitch: 0.35, chestPitch: 0.2, mouth: 0.3, smile: 1, eyes: 0.4,
  });
}

/** Con el flotador: brazos abiertos, piernas colgando. */
function glide(c: AnimCtx): Pose {
  const s = sin(c.t * 4);
  return pose({
    lean: 0.05, roll: sin(c.t * 2) * 0.08,
    thighL: 0.25 + s * 0.15, thighR: 0.05 - s * 0.15, kneeL: 0.5, kneeR: 0.4, ankleL: 0.4, ankleR: 0.4,
    armL: 0.5, armR: 0.5, armOutL: 1.3, armOutR: 1.3, elbowL: 0.6, elbowR: 0.6,
    mouth: 0.3, smile: 1, lookY: -0.4,
  });
}

/**
 * Colgado del borde: brazos estirados con las manos arriba del bloque, cuerpo
 * pegado a la pared, piernas que se balancean. En el último segundo, tiembla.
 */
export const HANG_ARM = 2.62;
/** Abiertos: desde atrás (como lo ve la cámara) se ven las dos manos al lado de la cabeza. */
const HANG_OUT = 0.42;
function hang(c: AnimCtx): Pose {
  const tired = c.strain;
  const shake = tired * sin(c.t * 38) * 0.06;
  const dangle = sin(c.t * 1.7) * 0.08;
  const kick = tired * sin(c.t * 9) * 0.4;
  return pose({
    hipZ: 0.12, lean: 0.04 + c.swing, roll: c.swing * 0.3,
    chestPitch: -0.04, headPitch: -0.4, lookY: 0.9,
    armL: HANG_ARM + shake, armR: HANG_ARM - shake, armOutL: HANG_OUT, armOutR: HANG_OUT,
    elbowL: 0.08 + tired * 0.25, elbowR: 0.08 + tired * 0.25,
    thighL: 0.22 + dangle + kick, thighR: 0.08 - dangle - kick, kneeL: 0.55 + max(0, kick), kneeR: 0.4 + max(0, -kick),
    ankleL: 0.5, ankleR: 0.5,
    mouth: 0.15 + tired * 0.75, smile: 0.4 - tired * 0.4, brow: 0.5 - tired * 1.5, eyes: 1 - tired * 0.35,
  });
}

/** Avanzando por el borde: una mano va adelante, la otra la sigue. */
function shimmy(c: AnimCtx): Pose {
  const base = hang(c);
  const ph = c.shimmyPhase;
  const lead = max(0, sin(ph));
  const follow = max(0, -sin(ph));
  // x local +: hacia el brazo R.
  const toR = c.shimmy > 0;
  const reachR = toR ? lead : follow;
  const reachL = toR ? follow : lead;
  return {
    ...base,
    roll: base.roll + (toR ? -1 : 1) * 0.06 * sin(ph),
    armOutL: HANG_OUT - 0.15 + reachL * 0.45, armOutR: HANG_OUT - 0.15 + reachR * 0.45,
    armL: HANG_ARM - reachL * 0.1, armR: HANG_ARM - reachR * 0.1,
    legOutL: 0.05 + reachL * 0.3, legOutR: 0.05 + reachR * 0.3,
    thighL: 0.2 + reachL * 0.25, thighR: 0.2 + reachR * 0.25,
  };
}

/** Pasos de una animación por tiempo (0 a 1), con transiciones suaves. */
function keyframes(t: number, keys: readonly (readonly [number, Pose])[]): Pose {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i + 1 < keys.length; i++) {
    const [t0, a] = keys[i];
    const [t1, b] = keys[i + 1];
    if (t <= t1) return mixPose(a, b, smooth((t - t0) / (t1 - t0)));
  }
  return keys[keys.length - 1][1];
}

/** Subirse al borde: dominada, apoyar la rodilla arriba, pararse. */
const PULL_KEYS: readonly (readonly [number, Pose])[] = [
  [0, pose({ hipZ: 0.12, headPitch: -0.4, armL: HANG_ARM, armR: HANG_ARM, armOutL: HANG_OUT, armOutR: HANG_OUT, elbowL: 0.08, elbowR: 0.08, thighL: 0.2, kneeL: 0.35, ankleL: 0.5, ankleR: 0.5, kneeR: 0.25, mouth: 0.4, smile: 0.2, brow: 0.8, lookY: 0.9 })],
  // Dominada: los codos se doblan y el pecho llega al borde.
  [0.3, pose({ hipY: -0.2, hipZ: 0.14, lean: 0.15, headPitch: -0.2, armL: 1.5, armR: 1.5, armOutL: 0.3, armOutR: 0.3, elbowL: 2.2, elbowR: 2.2, thighL: 0.6, kneeL: 1.0, thighR: 0.1, kneeR: 0.4, ankleL: 0.4, ankleR: 0.5, mouth: 0.9, smile: 0, brow: 1, eyes: 0.6, lookY: 0.4 })],
  // Empuja para abajo y sube una rodilla arriba del bloque.
  [0.6, pose({ hipY: -0.3, hipZ: 0.05, lean: 0.55, headPitch: -0.35, armL: -0.1, armR: -0.1, armOutL: 0.35, armOutR: 0.35, elbowL: 0.5, elbowR: 0.5, thighL: 1.8, kneeL: 2.3, thighR: 0.3, kneeR: 0.9, ankleL: -0.2, ankleR: 0.6, mouth: 0.6, smile: 0.2, brow: 1, lookY: 0 })],
  // Agachado arriba…
  [0.85, pose({ hipY: -0.18, lean: 0.3, headPitch: -0.2, armL: 0.5, armR: 0.5, armOutL: 0.3, armOutR: 0.3, elbowL: 0.6, elbowR: 0.6, thighL: 1.0, kneeL: 1.6, thighR: 0.7, kneeR: 1.3, ankleL: -0.6, ankleR: -0.6, mouth: 0.3, smile: 0.7, brow: 0.5 })],
  // …y parado.
  [1, pose({ hipY: -0.04, lean: 0.08, thighL: 0.2, kneeL: 0.4, thighR: 0.15, kneeR: 0.35, ankleL: -0.2, ankleR: -0.2, mouth: 0.2, smile: 1 })],
];
function pullUp(c: AnimCtx): Pose {
  return keyframes(c.pull, PULL_KEYS);
}

/** Trepando la red: mano, mano, pie, pie. */
function climb(c: AnimCtx): Pose {
  const s = sin(c.climbPhase);
  return pose({
    hipZ: 0.05, lean: 0.05, roll: s * 0.06, headPitch: -0.25, lookY: 0.7,
    armL: 2.75 + s * 0.35, armR: 2.75 - s * 0.35, elbowL: 0.6 - s * 0.35, elbowR: 0.6 + s * 0.35, armOutL: 0.35, armOutR: 0.35,
    thighL: 0.8 - s * 0.45, thighR: 0.8 + s * 0.45, kneeL: 1.3 - s * 0.3, kneeR: 1.3 + s * 0.3, legOutL: 0.2, legOutR: 0.2,
    mouth: 0.35, smile: 0.4, brow: 0.6,
  });
}

/** En el chorro del géiser: brazos arriba, patalea y grita contento. */
function lifted(c: AnimCtx): Pose {
  const k = sin(c.t * 14);
  return pose({
    roll: sin(c.t * 3) * 0.08, headPitch: -0.2,
    armL: 2.9, armR: 2.9, armOutL: 0.55, armOutR: 0.55, elbowL: 0.15, elbowR: 0.15,
    thighL: 0.35 + k * 0.4, thighR: 0.35 - k * 0.4, kneeL: 0.6 + k * 0.3, kneeR: 0.6 - k * 0.3,
    mouth: 1, smile: 1, brow: 0.2, eyes: 0.6,
  });
}

/** Sin energía: piernas de gelatina y brazos en molino. */
function slip(c: AnimCtx): Pose {
  const sh = sin(c.t * 30) * 0.2;
  const mill = c.t * 9;
  return pose({
    hipY: -0.12, lean: -0.15, roll: sin(c.t * 7) * 0.25,
    thighL: 0.2 + sh, thighR: -0.2 - sh, kneeL: 0.9 + sh, kneeR: 0.9 - sh, legOutL: 0.25, legOutR: 0.25,
    armL: 1.5 + sin(mill) * 1.6, armR: 1.5 + sin(mill + PI) * 1.6, armOutL: 0.6, armOutR: 0.6, elbowL: 0.3, elbowR: 0.3,
    mouth: 1, smile: 0, brow: -1, eyes: 0.8,
  });
}

/** Lo tiraron: brazos y piernas para cualquier lado (las vueltas las pone el driver). */
function hit(c: AnimCtx): Pose {
  return pose({
    armL: 2 + sin(c.t * 20), armR: 2 + cos(c.t * 17), armOutL: 1, armOutR: 1,
    thighL: sin(c.t * 18) * 0.8, thighR: -sin(c.t * 18) * 0.8, kneeL: 0.8, kneeR: 0.8,
    mouth: 1, smile: 0, brow: -1, eyes: 0.25,
  });
}

/** El chapuzón: se hunde con los brazos arriba. */
function swim(c: AnimCtx): Pose {
  return pose({
    armL: 2.9 + sin(c.t * 18) * 0.25, armR: 2.9 - sin(c.t * 18) * 0.25, armOutL: 0.4, armOutR: 0.4, elbowL: 0.2, elbowR: 0.2,
    thighL: -0.4, thighR: 0.3, kneeL: 0.6, kneeR: 0.6,
    mouth: 1, smile: 0.5, brow: -0.6, eyes: 1.2, lookY: 1,
  });
}

/** Festejo: brazos arriba con saltitos. */
function cheer(c: AnimCtx): Pose {
  const pump = sin(c.t * 12);
  const hop = abs(sin(c.t * 8));
  return pose({
    hipY: hop * 0.06 - 0.02, headPitch: -0.2,
    kneeL: 0.25 - hop * 0.15, kneeR: 0.25 - hop * 0.15, thighL: 0.1, thighR: 0.1, ankleL: hop * 0.3, ankleR: hop * 0.3,
    armL: 2.85 + pump * 0.2, armR: 2.85 - pump * 0.2, armOutL: 0.45, armOutR: 0.45,
    elbowL: 0.3 + max(0, pump) * 0.6, elbowR: 0.3 + max(0, -pump) * 0.6,
    mouth: 0.8, smile: 1, brow: 0.5, eyes: 0.35, lookY: 0.3,
  });
}

/** En la punta del bloque: se inclina para el vacío y revolea los brazos para no caerse. */
function teeter(c: AnimCtx): Pose {
  const wob = sin(c.t * 7);
  const k = 0.22 + wob * 0.1;
  return pose({
    hipY: -0.03, lean: c.teeterZ * k, roll: -c.teeterX * k, headPitch: 0.35 * max(0, c.teeterZ),
    thighL: 0.05, kneeL: 0.2, thighR: 0.35, kneeR: 0.7, ankleR: 0.3,
    armL: 1.6 + sin(c.t * 11) * 1.3, armR: 1.6 + sin(c.t * 11 + 1.8) * 1.3, armOutL: 0.9, armOutR: 0.9, elbowL: 0.3, elbowR: 0.3,
    mouth: 0.7, smile: 0, brow: -1, eyes: 1.15, lookY: -0.8,
  });
}

export function poseFor(clip: Clip, c: AnimCtx): Pose {
  switch (clip) {
    case "idle": return idle(c);
    case "run": return run(c);
    case "skate": return skate(c);
    case "jump":
    case "fall": return air(c);
    case "flip": return flip();
    case "glide": return glide(c);
    case "hang": return hang(c);
    case "shimmy": return shimmy(c);
    case "pullUp": return pullUp(c);
    case "climb": return climb(c);
    case "lifted": return lifted(c);
    case "slip": return slip(c);
    case "hit": return hit(c);
    case "swim": return swim(c);
    case "cheer": return cheer(c);
    case "teeter": return teeter(c);
  }
}

/**
 * La pose final del cuadro: la mezcla de las animaciones activas, más lo que
 * se suma encima (agacharse al caer, parpadear).
 */
export function currentPose(d: CharacterDriver, grounded: boolean): Pose {
  const parts: { pose: Pose; weight: number }[] = [];
  for (const [clip, weight] of d.weights) parts.push({ pose: poseFor(clip, d.ctx), weight });
  const out = blend(parts);
  // Aplastado al caer: se agacha con los pies en el piso (las piernas se doblan de verdad).
  const crouch = max(0, 1 - d.squash);
  if (crouch > 0 && grounded) {
    const half = crouch * 2.6;
    out.hipY -= 0.72 * (1 - cos(half));
    out.thighL += half;
    out.thighR += half;
    out.kneeL += half * 2;
    out.kneeR += half * 2;
    out.ankleL -= half;
    out.ankleR -= half;
    out.lean += crouch * 0.5;
    out.headPitch -= crouch * 0.4;
    out.armOutL += crouch * 0.8;
    out.armOutR += crouch * 0.8;
  }
  if (d.blink > 0) out.eyes *= 0.08;
  return out;
}
