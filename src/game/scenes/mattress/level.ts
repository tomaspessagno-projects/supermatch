import { mulberry32 } from "../../engine/random";
import { TUNING } from "./tuning";

/**
 * El escenario entra entero en pantalla (cámara fija, como un Game & Watch):
 * a la izquierda la torre de donde se tiran los saltadores, en el medio la
 * pasarela flotante con los dos colchones y a la derecha el pelotero.
 */
export const STAGE = {
  width: 1280,
  height: 720,
  /** Superficie de la pileta. */
  waterY: 622,
  /** Piso de la pasarela (los pies de los portadores). */
  deckY: 578,
  deckLeft: 196,
  deckRight: 1108,
  tower: { left: 26, right: 168, top: 214 },
  /** Desde dónde se tiran (el centro del saltador). */
  spawn: { x: 150, y: 194 },
  /** Cada colchón se mueve en su mitad de la pasarela. */
  zones: [
    { min: 200, max: 652 },
    { min: 652, max: 1104 },
  ],
  /** El pelotero: si un saltador cae adentro, llegó. */
  goal: { left: 1130, right: 1272, top: 508 },
  /** Charcos de jabón sobre la pasarela (solo en la ronda 3). */
  soap: [
    { from: 300, to: 420 },
    { from: 760, to: 880 },
  ],
} as const;

export type Zone = (typeof STAGE.zones)[number];

/** Una ronda: cada prueba del episodio cooperativo es una ronda distinta. */
export type RoundConfig = {
  title: string;
  /** Cada cuánto aparece un saltador nuevo (s). */
  spawnEvery: readonly [number, number];
  /** Probabilidad de que salga otro enseguida (dos en el aire). */
  doubleChance: number;
  goldenChance: number;
  /** Velocidad con la que se tiran de la torre. */
  launchVx: readonly [number, number];
  launchVy: readonly [number, number];
  /** Globos de agua que caen del techo. */
  balloons: { every: readonly [number, number] } | null;
  /** Rodillos de goma que ruedan por la pasarela: hay que saltarlos. */
  rollers: { every: readonly [number, number]; speed: number } | null;
  soap: boolean;
};

export const ROUNDS: Record<1 | 2 | 3, RoundConfig> = {
  1: {
    title: "¡ATAJALOS!",
    spawnEvery: [2.9, 3.6],
    doubleChance: 0,
    goldenChance: 0.1,
    launchVx: [90, 400],
    launchVy: [-230, -120],
    balloons: null,
    rollers: null,
    soap: false,
  },
  2: {
    title: "¡LLUVIA DE GLOBOS!",
    spawnEvery: [2.5, 3.2],
    doubleChance: 0.25,
    goldenChance: 0.15,
    launchVx: [90, 420],
    launchVy: [-260, -110],
    balloons: { every: [1.5, 2.3] },
    rollers: null,
    soap: false,
  },
  3: {
    title: "¡LA BARRERA!",
    spawnEvery: [2.6, 3.3],
    doubleChance: 0.2,
    goldenChance: 0.15,
    launchVx: [90, 420],
    launchVy: [-260, -110],
    balloons: null,
    rollers: { every: [4.2, 5.6], speed: 250 },
    soap: true,
  },
};

export type JumperSpawn = {
  at: number;
  vx: number;
  vy: number;
  golden: boolean;
  /** Color de camiseta (0..3, uno de los equipos). */
  shirt: number;
  /** Corrimiento del punto al que apunta el rebote (px): cada uno cae distinto. */
  aim: number;
};
export type BalloonSpawn = { at: number; x: number };
export type RollerSpawn = { at: number; dir: 1 | -1 };

/** El guion de la ronda: qué sale y cuándo. Misma semilla, mismo guion en todas las compus. */
export type Script = {
  jumpers: readonly JumperSpawn[];
  balloons: readonly BalloonSpawn[];
  rollers: readonly RollerSpawn[];
};

export function makeScript(round: 1 | 2 | 3, seed: number): Script {
  const config = ROUNDS[round];
  const random = mulberry32(seed);
  const between = ([min, max]: readonly [number, number]) => min + (max - min) * random();

  const jumpers: JumperSpawn[] = [];
  const jumper = (at: number): JumperSpawn => ({
    at,
    vx: between(config.launchVx),
    vy: between(config.launchVy),
    golden: random() < config.goldenChance,
    shirt: Math.floor(random() * 4),
    aim: (random() - 0.5) * 260,
  });
  for (let t = 1.2; t < TUNING.spawnStop; t += between(config.spawnEvery)) {
    jumpers.push(jumper(t));
    if (random() < config.doubleChance && t + 0.8 < TUNING.spawnStop) jumpers.push(jumper(t + 0.8));
  }

  const balloons: BalloonSpawn[] = [];
  if (config.balloons) {
    for (let t = 3; t < TUNING.duration - 3; t += between(config.balloons.every)) {
      balloons.push({ at: t, x: between([STAGE.deckLeft + 30, STAGE.deckRight - 20]) });
    }
  }

  const rollers: RollerSpawn[] = [];
  if (config.rollers) {
    let dir: 1 | -1 = -1;
    for (let t = 4; t < TUNING.duration - 3; t += between(config.rollers.every)) {
      rollers.push({ at: t, dir });
      dir = dir === 1 ? -1 : 1;
    }
  }

  return { jumpers, balloons, rollers };
}

export function onSoap(x: number): boolean {
  return STAGE.soap.some((s) => x >= s.from && x <= s.to);
}
