/**
 * El esqueleto del concursante dibujado por código: medidas y "pose" (el
 * ángulo de cada articulación). Las poses se calculan en poses.ts y se mezclan
 * entre sí (crossfade), así nunca salta de una postura a otra.
 *
 * Convenciones (mirando para +z):
 * - hombro y muslo: + lleva la mano o la rodilla para adelante (π = brazo para arriba);
 * - codo y rodilla: + dobla; tobillo: + baja la punta del pie;
 * - apertura (armOut/legOut): + separa del cuerpo;
 * - lean: + inclina todo el cuerpo para adelante (desde la cadera);
 * - roll: + inclina hacia la izquierda del personaje (-x).
 */

/** Medidas en metros, desde los pies. */
export const RIG = {
  hipY: 0.74,
  hipX: 0.12,
  thigh: 0.36,
  shin: 0.3,
  /** Del centro de la cadera a la base de la columna. */
  spineY: 0.06,
  /** Hombros, desde la base de la columna. */
  shoulderY: 0.32,
  shoulderX: 0.3,
  upperArm: 0.24,
  /** Del codo al centro de la mano. */
  forearm: 0.24,
  /** Cabeza, desde la base de la columna. */
  neckY: 0.4,
} as const;

export const CHANNELS = [
  // Cadera (todo el cuerpo)
  "hipY", "hipZ", "lean", "roll", "hipYaw",
  // Torso respecto de la cadera
  "chestPitch", "chestYaw", "chestRoll", "breath",
  // Cabeza
  "headPitch", "headYaw", "headRoll",
  // Piernas
  "thighL", "thighR", "kneeL", "kneeR", "ankleL", "ankleR", "legOutL", "legOutR",
  // Brazos
  "armL", "armR", "armOutL", "armOutR", "elbowL", "elbowR",
  // Cara: boca abierta y sonrisa (0 a 1), cejas (-1 preocupado … 1 decidido), ojos (0 cerrados … 1), mirada
  "mouth", "smile", "brow", "eyes", "lookX", "lookY",
] as const;

export type Channel = (typeof CHANNELS)[number];
export type Pose = Record<Channel, number>;

/** Parado, relajado. */
export const REST: Pose = {
  hipY: 0, hipZ: 0, lean: 0, roll: 0, hipYaw: 0,
  chestPitch: 0, chestYaw: 0, chestRoll: 0, breath: 0,
  headPitch: 0, headYaw: 0, headRoll: 0,
  thighL: 0, thighR: 0, kneeL: 0.1, kneeR: 0.1, ankleL: 0, ankleR: 0, legOutL: 0.04, legOutR: 0.04,
  armL: 0.1, armR: 0.1, armOutL: 0.15, armOutR: 0.15, elbowL: 0.35, elbowR: 0.35,
  mouth: 0.15, smile: 0.6, brow: 0, eyes: 1, lookX: 0, lookY: 0,
};

export const pose = (over: Partial<Pose>): Pose => ({ ...REST, ...over });

/** Mezcla poses con pesos (no hace falta que sumen 1). */
export function blend(parts: readonly { pose: Pose; weight: number }[]): Pose {
  const out = { ...REST };
  let total = 0;
  for (const p of parts) total += p.weight;
  if (total <= 0) return out;
  for (const c of CHANNELS) {
    let v = 0;
    for (const p of parts) v += p.pose[c] * p.weight;
    out[c] = v / total;
  }
  return out;
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const mix = (a: number, b: number, k: number) => a + (b - a) * k;
export const smooth = (k: number) => {
  const x = clamp(k, 0, 1);
  return x * x * (3 - 2 * x);
};
/** Mezcla dos poses enteras. */
export function mixPose(a: Pose, b: Pose, k: number): Pose {
  const out = { ...a };
  for (const c of CHANNELS) out[c] = mix(a[c], b[c], k);
  return out;
}
