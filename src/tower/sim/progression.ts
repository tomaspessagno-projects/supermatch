import { TUNING } from "./tuning";

/**
 * Mejoras del kiosco. Cada nivel cuesta más que el anterior (crecimiento
 * exponencial, como en todo juego progresivo); algunas se compran una vez.
 */

export type UpgradeId = "energy" | "jump" | "grip" | "bag" | "magnet" | "double" | "elevator" | "float";

export type UpgradeDef = {
  id: UpgradeId;
  name: string;
  detail: string;
  emoji: string;
  base: number;
  growth: number;
  max: number;
};

export const UPGRADES: readonly UpgradeDef[] = [
  { id: "energy", name: "Energía", detail: "Más saltos antes de quedarte sin nafta", emoji: "⚡", base: 15, growth: 1.55, max: 15 },
  { id: "jump", name: "Salto", detail: "Saltás más alto (los pisos de arriba lo piden)", emoji: "🦘", base: 25, growth: 1.7, max: 8 },
  { id: "bag", name: "Mochila", detail: "Llevás más objetos por intento", emoji: "🎒", base: 20, growth: 1.6, max: 8 },
  { id: "grip", name: "Agarre", detail: "Menos resbalón en el jabón y en el viento", emoji: "🧤", base: 40, growth: 1.9, max: 3 },
  { id: "magnet", name: "Imán", detail: "Agarrás fichas y objetos desde más lejos", emoji: "🧲", base: 60, growth: 2, max: 4 },
  { id: "elevator", name: "Ascensor", detail: "Arrancás desde el último descanso al que llegaste", emoji: "🛗", base: 250, growth: 1, max: 1 },
  { id: "double", name: "Doble salto", detail: "Un segundo salto en el aire", emoji: "💨", base: 400, growth: 1, max: 1 },
  { id: "float", name: "Flotador", detail: "Manteniendo el salto, caés despacito", emoji: "🛟", base: 300, growth: 1, max: 1 },
];

export type Levels = Record<UpgradeId, number>;

export const NO_UPGRADES: Levels = { energy: 0, jump: 0, grip: 0, bag: 0, magnet: 0, double: 0, elevator: 0, float: 0 };

export function upgradeCost(id: UpgradeId, level: number): number | null {
  const def = UPGRADES.find((u) => u.id === id)!;
  if (level >= def.max) return null;
  return Math.round(def.base * def.growth ** level);
}

/** Mascotas: te siguen y te dan un bonus. Se compran una vez; se lleva una sola. */
export type PetId = "duck" | "dog" | "cloud" | "octopus" | "dragon";

export type PetDef = { id: PetId; name: string; detail: string; emoji: string; price: number };

export const PETS: readonly PetDef[] = [
  { id: "duck", name: "Patito", detail: "Las fichas valen 50 % más", emoji: "🐥", price: 400 },
  { id: "dog", name: "Perrito", detail: "Te trae fichas y regalos desde lejos", emoji: "🐶", price: 900 },
  { id: "cloud", name: "Nubecita", detail: "Gastás 25 % menos energía", emoji: "☁️", price: 1500 },
  { id: "octopus", name: "Pulpito", detail: "3 lugares más en la mochila", emoji: "🐙", price: 2500 },
  { id: "dragon", name: "Dragoncito", detail: "Toda la fama ×1,5", emoji: "🐲", price: 6000 },
];

export const petDef = (id: PetId) => PETS.find((p) => p.id === id)!;

/** Cada temporada nueva suma 50 % de fama para siempre. */
export const SEASON_BONUS = 0.5;
export const seasonMultiplier = (season: number) => 1 + SEASON_BONUS * season;

/** Lo que la simulación necesita saber de las mejoras, la mascota y la temporada. */
export type Stats = {
  jumpSpeed: number;
  energy: number;
  grip: number;
  bag: number;
  pickRadius: number;
  doubleJump: boolean;
  float: boolean;
  elevator: boolean;
  /** Multiplica el valor de las fichas. */
  chipMult: number;
  /** Multiplica la fama total del intento. */
  fameMult: number;
  /** Multiplica el gasto de energía. */
  drainMult: number;
};

export const ENERGY_BASE = 40;
export const ENERGY_PER_LEVEL = 10;
export const JUMP_PER_LEVEL = 0.45;

export function statsFor(levels: Levels, pet: PetId | null = null, season = 0): Stats {
  return {
    jumpSpeed: TUNING.jumpSpeed + JUMP_PER_LEVEL * levels.jump,
    energy: ENERGY_BASE + ENERGY_PER_LEVEL * levels.energy,
    grip: levels.grip,
    bag: 3 + 2 * levels.bag + (pet === "octopus" ? 3 : 0),
    pickRadius: TUNING.pickRadius + 0.6 * levels.magnet + (pet === "dog" ? 1.2 : 0),
    doubleJump: levels.double > 0,
    float: levels.float > 0,
    elevator: levels.elevator > 0,
    chipMult: pet === "duck" ? 1.5 : 1,
    fameMult: seasonMultiplier(season) * (pet === "dragon" ? 1.5 : 1),
    drainMult: pet === "cloud" ? 0.75 : 1,
  };
}

/** Altura máxima de un salto con esta velocidad (m). */
export const jumpHeight = (speed: number) => (speed * speed) / (2 * TUNING.gravity);
