/** Charco: hueco en el puente lleno de agua jabonosa. */
export type Puddle = { x0: number; x1: number };

/**
 * Rodillo de goma colgado sobre el puente. Su borde inferior sube y baja
 * entre `clearance` y `clearance + bob` px sobre el piso.
 */
export type Roller = {
  x: number;
  radius: number;
  clearance: number;
  bob: number;
  period: number; // s
  phase: number; // 0..1
};

export type Level = {
  floorY: number;
  wallX: number;
  startX: number;
  finishX: number;
  puddles: readonly Puddle[];
  rollers: readonly Roller[];
  /** Banderas de reaparición, de menor a mayor. La primera es la largada. */
  checkpoints: readonly number[];
};

// Layout fijo: en un leaderboard asíncrono todos tienen que jugar el mismo puente.
// Detrás de cada rodillo hay ~1150 px libres: un golpe a toda velocidad te
// despide ~860 px aunque sigas apretando para adelante, así que si no soltás
// te salvás y si soltás, al agua. Nunca dos rodillos a menos de un vuelo de
// distancia: armarían un pinball sin salida.
export const LEVEL: Level = {
  floorY: 520,
  wallX: 40,
  startX: 140,
  finishX: 6600,
  puddles: [
    { x0: 700, x1: 850 },
    { x0: 2600, x1: 2780 },
    { x0: 4700, x1: 4900 },
  ],
  rollers: [
    { x: 2000, radius: 42, clearance: 0, bob: 0, period: 1, phase: 0 },
    { x: 3950, radius: 50, clearance: 4, bob: 120, period: 2.4, phase: 0 },
    { x: 6050, radius: 54, clearance: 4, bob: 125, period: 2, phase: 0.5 },
  ],
  // Siempre en piso firme, después de un desafío y antes del siguiente.
  checkpoints: [140, 1200, 2950, 5050],
};

/** Altura del centro del rodillo en el instante `time`. */
export function rollerCenterY(level: Level, roller: Roller, time: number): number {
  const lift =
    roller.bob *
    (0.5 - 0.5 * Math.cos(2 * Math.PI * (time / roller.period + roller.phase)));
  return level.floorY - roller.radius - roller.clearance - lift;
}

export function puddleAt(level: Level, x: number): Puddle | undefined {
  return level.puddles.find((p) => x > p.x0 && x < p.x1);
}
