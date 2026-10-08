import type { CosmeticId } from "./cosmetics";
import { mulberry32 } from "./random";

/**
 * Objetivos: siempre hay uno claro en pantalla.
 *
 * - La misión del programa: una cadena que te lleva de la orilla a La Copa (y
 *   después a las temporadas). Siempre hay una sola activa; al cumplirla, premio
 *   y aparece la siguiente.
 * - Misiones del día: tres por día, iguales para todos (las elige la fecha).
 * - Estrellas doradas: cada 6 encontradas, un premio.
 */

export type Counter =
  /** Mejor altura (m). */
  | "height"
  /** Descansos alcanzados (el piso más alto + 1). */
  | "rest"
  /** Intentos cobrados. */
  | "runs"
  /** Mejoras compradas. */
  | "upgrades"
  /** Más fichas en un solo intento. */
  | "chipsRun"
  /** Más fama en un solo intento. */
  | "fameRun"
  /** Fichas juntadas. */
  | "chips"
  /** Fama cobrada. */
  | "fame"
  /** Regalos agarrados. */
  | "items"
  /** Regalos dorados o arcoíris. */
  | "mutated"
  | "superBounces"
  /** Redes trepadas hasta arriba. */
  | "nets"
  /** Viajes en géiser. */
  | "geysers"
  /** Veces que te tiró algo. */
  | "knocks"
  /** Veces que te subiste a un bloque colgándote del borde. */
  | "pullUps"
  | "pets"
  /** Veces que llegaste a la cima. */
  | "tops"
  | "seasons"
  | "stars";

export type Counters = Record<Counter, number>;

export const NO_COUNTERS: Counters = {
  height: 0, rest: 0, runs: 0, upgrades: 0, chipsRun: 0, fameRun: 0, chips: 0, fame: 0, items: 0, mutated: 0,
  superBounces: 0, nets: 0, geysers: 0, knocks: 0, pullUps: 0, pets: 0, tops: 0, seasons: 0, stars: 0,
};

/** Los que guardan un máximo (o un valor actual); el resto se van sumando. */
export const MAX_COUNTERS: readonly Counter[] = ["height", "rest", "chipsRun", "fameRun", "pets", "seasons", "stars"];

export type Reward = { fame?: number; cosmetic?: CosmeticId; title?: string };
export type Mission = { id: string; text: string; counter: Counter; goal: number; reward: Reward };

export const DEFAULT_TITLE = "Novato";

/** La misión del programa, en orden. */
export const MAIN_QUEST: readonly Mission[] = [
  { id: "first-step", text: "Subí al primer escalón", counter: "height", goal: 0.5, reward: { fame: 10 } },
  { id: "first-run", text: "Caete a la pileta y cobrá tu primer intento", counter: "runs", goal: 1, reward: { fame: 10 } },
  { id: "first-buy", text: "Comprá una mejora en el kiosco", counter: "upgrades", goal: 1, reward: { fame: 15 } },
  { id: "rest-1", text: "Llegá al descanso del piso 1", counter: "rest", goal: 1, reward: { fame: 40, title: "Aprendiz" } },
  { id: "chips-10", text: "Juntá 10 fichas en un solo intento", counter: "chipsRun", goal: 10, reward: { fame: 40 } },
  { id: "first-gift", text: "Agarrá un regalo de una cornisa", counter: "items", goal: 1, reward: { fame: 50 } },
  { id: "first-star", text: "Encontrá una estrella dorada (hay 3 escondidas por piso)", counter: "stars", goal: 1, reward: { fame: 50, cosmetic: "cap" } },
  { id: "rest-2", text: "Llegá al descanso del piso 2", counter: "rest", goal: 2, reward: { fame: 80 } },
  { id: "super-bounce", text: "Hacé un súper rebote: saltá justo al caer en la cama elástica", counter: "superBounces", goal: 1, reward: { fame: 80, cosmetic: "party" } },
  { id: "rest-3", text: "Llegá al descanso del piso 3", counter: "rest", goal: 3, reward: { fame: 120, title: "Escalador" } },
  { id: "first-pet", text: "Adoptá una mascota en el kiosco", counter: "pets", goal: 1, reward: { fame: 100 } },
  { id: "rest-4", text: "Cruzá las bolas rojas: llegá al descanso del piso 4", counter: "rest", goal: 4, reward: { fame: 200, cosmetic: "bubbles" } },
  { id: "fame-300", text: "Cobrá 300 de fama en un solo intento", counter: "fameRun", goal: 300, reward: { fame: 150 } },
  { id: "rest-5", text: "Pasá los martillos: llegá al descanso del piso 5", counter: "rest", goal: 5, reward: { fame: 300 } },
  { id: "first-net", text: "Trepá una red hasta arriba (apretá hacia la torre)", counter: "nets", goal: 1, reward: { fame: 250, title: "Acróbata" } },
  { id: "stars-6", text: "Encontrá 6 estrellas doradas", counter: "stars", goal: 6, reward: { fame: 300 } },
  { id: "first-geyser", text: "Volá en un géiser", counter: "geysers", goal: 1, reward: { fame: 300 } },
  { id: "rest-7", text: "Llegá al descanso del piso 7", counter: "rest", goal: 7, reward: { fame: 500, cosmetic: "viking" } },
  { id: "mutated", text: "Encontrá un regalo dorado o arcoíris", counter: "mutated", goal: 1, reward: { fame: 400 } },
  { id: "cup", text: "¡Llegá a la cima y ganá La Copa!", counter: "tops", goal: 1, reward: { fame: 1000, title: "Campeón", cosmetic: "crown" } },
  { id: "season-2", text: "Empezá una temporada nueva (en el kiosco)", counter: "seasons", goal: 1, reward: { title: "Leyenda", cosmetic: "rainbow" } },
  { id: "stars-24", text: "Encontrá las 24 estrellas doradas", counter: "stars", goal: 24, reward: { fame: 2000 } },
  { id: "cup-3", text: "Ganá La Copa 3 veces", counter: "tops", goal: 3, reward: { fame: 3000 } },
  { id: "season-3", text: "Llegá a la temporada 3", counter: "seasons", goal: 2, reward: { fame: 5000, title: "Leyenda del Supermatch" } },
];

/** Cumple las misiones que se pueda desde `index`, en orden. */
export function advanceQuest(index: number, counters: Counters): { index: number; done: Mission[] } {
  const done: Mission[] = [];
  let i = index;
  while (i < MAIN_QUEST.length && counters[MAIN_QUEST[i].counter] >= MAIN_QUEST[i].goal) done.push(MAIN_QUEST[i++]);
  return { index: i, done };
}

/** Misiones del día (se cuentan solo las cosas de hoy). */
export const DAILY_POOL: readonly Mission[] = [
  { id: "d-runs", text: "Hacé 5 intentos", counter: "runs", goal: 5, reward: { fame: 60 } },
  { id: "d-chips", text: "Juntá 40 fichas", counter: "chips", goal: 40, reward: { fame: 80 } },
  { id: "d-gifts", text: "Agarrá 3 regalos", counter: "items", goal: 3, reward: { fame: 90 } },
  { id: "d-height", text: "Llegá a 20 m de altura", counter: "height", goal: 20, reward: { fame: 100 } },
  { id: "d-bounce", text: "Hacé 3 súper rebotes", counter: "superBounces", goal: 3, reward: { fame: 120 } },
  { id: "d-nets", text: "Trepá 2 redes", counter: "nets", goal: 2, reward: { fame: 150 } },
  { id: "d-knocks", text: "Que te tiren 3 veces (martillos, guantes, cañones…)", counter: "knocks", goal: 3, reward: { fame: 70 } },
  { id: "d-fame", text: "Cobrá 500 de fama", counter: "fame", goal: 500, reward: { fame: 150 } },
  { id: "d-geysers", text: "Volá en 2 géiseres", counter: "geysers", goal: 2, reward: { fame: 150 } },
  { id: "d-star", text: "Encontrá una estrella dorada", counter: "stars", goal: 1, reward: { fame: 120 } },
  { id: "d-ledges", text: "Subite 5 veces colgándote de un borde", counter: "pullUps", goal: 5, reward: { fame: 100 } },
];

/** El día del programa (Argentina, UTC-3), como "2026-10-08". */
export function dayKey(now: number): string {
  return new Date(now - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Las 3 misiones de ese día: iguales para todos. */
export function dailyMissions(day: string): Mission[] {
  let seed = 0;
  for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const random = mulberry32(seed);
  const pool = [...DAILY_POOL];
  const out: Mission[] = [];
  while (out.length < 3) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return out;
}

/** Cada 6 estrellas encontradas, un premio. */
export const STAR_REWARDS: readonly { stars: number; reward: Reward }[] = [
  { stars: 6, reward: { cosmetic: "stars", fame: 200 } },
  { stars: 12, reward: { cosmetic: "tophat", fame: 400 } },
  { stars: 18, reward: { cosmetic: "confetti", fame: 600 } },
  { stars: 24, reward: { cosmetic: "halo", fame: 1000 } },
];

/** Cómo se muestra el avance ("6,2 / 10 m", "3 / 5"). */
export function progressLabel(m: Mission, value: number): string {
  const v = Math.min(value, m.goal);
  if (m.counter === "height") return `${v.toFixed(1).replace(".", ",")} / ${String(m.goal).replace(".", ",")} m`;
  return `${Math.floor(v).toLocaleString("es-AR")} / ${m.goal.toLocaleString("es-AR")}`;
}
