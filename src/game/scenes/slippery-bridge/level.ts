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

/** Colchoneta inflable en el tablón: pisarla te lanza por el aire. */
export type Trampoline = { x0: number; x1: number };

/** Cinta de goma: agarra (no resbala) pero te arrastra para atrás. */
export type Conveyor = { x0: number; x1: number; speed: number };

/** Martillo de espuma colgado de una soga: barre el tablón como un péndulo. */
export type Hammer = {
  x: number;
  /** Largo de la soga hasta el centro de la cabeza. */
  length: number;
  radius: number;
  /** Apertura máxima del péndulo, en radianes. */
  amplitude: number;
  period: number; // s
  phase: number; // 0..1
};

/** Cañón de espuma detrás del tablón: dispara pelotas hacia atrás, a la altura de los pies. */
export type Cannon = { x: number; interval: number; phase: number; range: number };

/** Pompa dorada: puntos extra, siempre en el camino arriesgado. */
export type Pompa = { x: number; y: number };

export type Level = {
  floorY: number;
  wallX: number;
  startX: number;
  finishX: number;
  puddles: readonly Puddle[];
  rollers: readonly Roller[];
  trampolines: readonly Trampoline[];
  conveyors: readonly Conveyor[];
  hammers: readonly Hammer[];
  cannons: readonly Cannon[];
  pompas: readonly Pompa[];
  /** Banderas de reaparición, de menor a mayor. La primera es la largada. */
  checkpoints: readonly number[];
};

const FLOOR = 520;

/**
 * El Puente v2, armado por bloques (enseñar → combinar → vuelta de tuerca →
 * sprint). Layout fijo: en un ranking asíncrono todos juegan el mismo puente.
 *
 * Reglas de diseño que cuidan los tests:
 * - Cada obstáculo aparece primero solo; después, combinado.
 * - Después de cada charco hay una bandera antes del próximo golpe: si un
 *   golpe te tira para atrás al agua, no perdés todo lo andado.
 * - Las pompas están en el camino arriesgado (arriba de un rodillo, en el
 *   vuelo del trampolín, debajo del martillo).
 */
export const LEVEL: Level = {
  floorY: FLOOR,
  wallX: 40,
  startX: 140,
  finishX: 8450,
  puddles: [
    { x0: 600, x1: 720 }, // 1. el primer charco, chiquito
    { x0: 1830, x1: 2150 }, // 2. ancho: saltándolo hay que ir a fondo; el trampolín lo cruza
    { x0: 3650, x1: 3800 }, // 3. entre martillos
    { x0: 6370, x1: 6700 }, // 4-5. cadena de trampolines
    { x0: 6900, x1: 7170 },
    { x0: 8100, x1: 8250 }, // 6. el último, con la meta a la vista
  ],
  // Un golpe de rodillo te despide hasta ~860 px: detrás de cada uno no hay
  // otro obstáculo que empuje a menos de eso (si no, se arma un pinball).
  rollers: [
    { x: 1350, radius: 42, clearance: 0, bob: 0, period: 1, phase: 0 },
    { x: 5450, radius: 50, clearance: 4, bob: 120, period: 2.4, phase: 0 },
  ],
  // Un trampolín vuela entre ~480 y ~600 px: cada uno aterriza en piso
  // firme o en el siguiente trampolín, nunca en el agua.
  trampolines: [
    { x0: 1700, x1: 1790 },
    { x0: 6250, x1: 6330 },
    { x0: 6720, x1: 6870 },
  ],
  conveyors: [
    { x0: 2550, x1: 2850, speed: -250 },
    { x0: 7400, x1: 7650, speed: -300 },
  ],
  hammers: [
    { x: 3250, length: 230, radius: 40, amplitude: 0.85, period: 2.4, phase: 0 },
    { x: 4150, length: 230, radius: 40, amplitude: 0.85, period: 2.0, phase: 0.3 },
    // Después de la cinta hay hielo para tomar envión antes del martillo.
    { x: 7920, length: 230, radius: 40, amplitude: 0.9, period: 1.8, phase: 0.6 },
  ],
  // Sus pelotas cruzan la zona del rodillo: saltar una, esperar al otro.
  cannons: [{ x: 6000, interval: 2.2, phase: 0.4, range: 700 }],
  // Las del trampolín están en la cima del arco (≈ 270 px después del despegue).
  pompas: [
    { x: 660, y: FLOOR - 130 },
    { x: 1350, y: FLOOR - 150 },
    { x: 1830, y: FLOOR - 320 },
    { x: 1975, y: FLOOR - 470 },
    { x: 2700, y: FLOOR - 120 },
    { x: 4150, y: FLOOR - 40 },
    { x: 5450, y: FLOOR - 210 },
    { x: 6520, y: FLOOR - 470 },
    { x: 7070, y: FLOOR - 470 },
    { x: 8175, y: FLOOR - 130 },
  ],
  checkpoints: [140, 900, 2400, 3520, 4600, 6150, 7300],
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

export function trampolineAt(level: Level, x: number): Trampoline | undefined {
  return level.trampolines.find((t) => x >= t.x0 && x <= t.x1);
}

export function conveyorAt(level: Level, x: number): Conveyor | undefined {
  return level.conveyors.find((c) => x >= c.x0 && x <= c.x1);
}

/** Punto de cuelgue: la cabeza pasa 8 px por encima del tablón. */
export function hammerPivotY(level: Level, hammer: Hammer): number {
  return level.floorY - 8 - hammer.radius - hammer.length;
}

/** Ángulo del martillo (0 = colgando derecho) y su velocidad angular. */
export function hammerAngle(hammer: Hammer, time: number): { angle: number; speed: number } {
  const w = (2 * Math.PI) / hammer.period;
  const a = w * time + 2 * Math.PI * hammer.phase;
  return { angle: hammer.amplitude * Math.sin(a), speed: hammer.amplitude * w * Math.cos(a) };
}

/** Centro de la cabeza del martillo. */
export function hammerHead(level: Level, hammer: Hammer, time: number) {
  const { angle, speed } = hammerAngle(hammer, time);
  return {
    x: hammer.x + hammer.length * Math.sin(angle),
    y: hammerPivotY(level, hammer) + hammer.length * Math.cos(angle),
    /** Velocidad horizontal de la cabeza (para saber para dónde empuja). */
    vx: hammer.length * Math.cos(angle) * speed,
    angle,
  };
}

/** Altura de las pelotas del cañón: a la altura de los pies. */
export const BALL_HEIGHT = 22;
export const BALL_RADIUS = 18;
export const BALL_SPEED = 380;
/** El cañón tiembla esto antes de disparar. */
export const CANNON_WARNING = 0.6;

/** Pelotas en vuelo de un cañón en `time`: índice de disparo y posición. */
export function cannonBalls(level: Level, cannon: Cannon, time: number) {
  const balls: { shot: number; x: number; y: number }[] = [];
  const last = Math.floor((time - cannon.phase) / cannon.interval);
  for (let shot = Math.max(0, last - 3); shot <= last; shot++) {
    const flight = time - (cannon.phase + shot * cannon.interval);
    const travelled = flight * BALL_SPEED;
    if (flight < 0 || travelled > cannon.range) continue;
    balls.push({ shot, x: cannon.x - 40 - travelled, y: level.floorY - BALL_HEIGHT });
  }
  return balls;
}
