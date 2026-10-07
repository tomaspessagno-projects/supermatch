import { PLAYER_SIZE, TUNING } from "./tuning";

/**
 * Guion de El Tronco Loco: cámara fija, así que el "nivel" es una línea de
 * tiempo. Arco: aprender el giro → primeras pelotas → cambios de sentido →
 * combinaciones → sprint final con el tronco a toda velocidad.
 */

/** A partir de `at`, el tronco va hacia `omega` (rad/s; positivo = la cima va a la derecha). */
export type SpinChange = { at: number; omega: number };
/** `side`: cañón que dispara (-1 izquierda, 1 derecha). Baja = saltala; alta = no saltes. */
export type Shot = { at: number; side: -1 | 1; height: "low" | "high" };
/** Burbuja dorada: aparece en `at`, a `dx` de la cima, y deriva `drift` px/s. */
export type BubbleSpawn = { at: number; dx: number; y: number; drift: number };

export type LogLevel = {
  center: { x: number; y: number };
  radius: number;
  /** Nivel del agua de la pileta. */
  waterY: number;
  /** Boca de cada cañón. */
  muzzleX: { left: number; right: number };
  ballY: { low: number; high: number };
  spin: readonly SpinChange[];
  shots: readonly Shot[];
  bubbles: readonly BubbleSpawn[];
};

const CENTER = { x: 640, y: 500 };
const RADIUS = 140;
const TOP = CENTER.y - RADIUS;

export const LOG_LEVEL: LogLevel = {
  center: CENTER,
  radius: RADIUS,
  waterY: 615,
  muzzleX: { left: 120, right: 1160 },
  ballY: {
    // A la altura de las piernas de quien está parado en la cima.
    low: TOP - 22,
    // Le pasa por arriba de la cabeza... salvo que salte.
    high: TOP - PLAYER_SIZE.height - TUNING.ballRadius - 8,
  },
  spin: [
    // Arranca quieto: el primer crujido enseña que avisa antes de girar.
    { at: 0, omega: 0 },
    { at: 2.5, omega: 0.45 },
    { at: 7, omega: 0.9 },
    { at: 12, omega: -0.7 },
    { at: 17, omega: -1.2 },
    { at: 22, omega: 0.3 },
    { at: 25, omega: 1.4 },
    { at: 30, omega: -1.4 },
    { at: 34, omega: 0.8 },
    { at: 37, omega: -1.7 },
    { at: 41, omega: 1.8 },
  ],
  shots: [
    { at: 5, side: -1, height: "low" },
    { at: 9.5, side: 1, height: "low" },
    { at: 14, side: -1, height: "high" },
    { at: 18.5, side: 1, height: "low" },
    { at: 20, side: -1, height: "low" },
    { at: 24, side: 1, height: "high" },
    { at: 27, side: -1, height: "low" },
    { at: 28.4, side: 1, height: "low" },
    { at: 32, side: -1, height: "high" },
    { at: 33.2, side: 1, height: "low" },
    { at: 36, side: 1, height: "low" },
    { at: 39, side: -1, height: "low" },
    { at: 40.2, side: 1, height: "high" },
    { at: 42.5, side: -1, height: "low" },
    { at: 43.7, side: 1, height: "low" },
  ],
  bubbles: [
    { at: 3, dx: -30, y: 225, drift: 15 },
    { at: 8, dx: 60, y: 215, drift: -20 },
    { at: 11, dx: -70, y: 230, drift: 10 },
    { at: 15, dx: 0, y: 205, drift: 0 },
    { at: 19, dx: 90, y: 238, drift: -15 },
    { at: 23, dx: -50, y: 215, drift: 25 },
    { at: 26, dx: 40, y: 220, drift: -25 },
    { at: 29, dx: -95, y: 238, drift: 20 },
    { at: 31.5, dx: 20, y: 210, drift: 0 },
    { at: 35, dx: -40, y: 220, drift: 15 },
    { at: 38, dx: 70, y: 225, drift: -20 },
    { at: 40.5, dx: -20, y: 215, drift: 10 },
    { at: 43, dx: 0, y: 210, drift: 0 },
  ],
};

/** Velocidad de giro objetivo en el instante `time`. */
export function spinTarget(level: LogLevel, time: number): number {
  let omega = level.spin[0]?.omega ?? 0;
  for (const change of level.spin) {
    if (change.at <= time) omega = change.omega;
    else break;
  }
  return omega;
}

/** Altura de la corteza en `x` (o null si `x` queda fuera del tronco). */
export function surfaceY(level: LogLevel, x: number): number | null {
  const dx = x - level.center.x;
  if (Math.abs(dx) >= level.radius) return null;
  return level.center.y - Math.sqrt(level.radius ** 2 - dx ** 2);
}
