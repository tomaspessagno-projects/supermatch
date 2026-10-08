/**
 * Lo que se junta en la torre. En las cornisas aparecen objetos del programa
 * con rareza (más arriba, más raros) y, a veces, una mutación que multiplica
 * su valor. Las fichas del camino son fama chica y no ocupan la mochila.
 */

export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";
export type Mutation = "none" | "wet" | "gold" | "rainbow";

export type ItemDef = { id: string; name: string; rarity: Rarity; emoji: string };

export const ITEMS: readonly ItemDef[] = [
  { id: "duck", name: "Patito de goma", rarity: "common", emoji: "🦆" },
  { id: "whistle", name: "Silbato del árbitro", rarity: "common", emoji: "📯" },
  { id: "sneaker", name: "Zapatilla perdida", rarity: "common", emoji: "👟" },
  { id: "foamball", name: "Pelota de espuma", rarity: "common", emoji: "🟡" },
  { id: "cap", name: "Gorra de la tribuna", rarity: "common", emoji: "🧢" },
  { id: "redball", name: "Bola roja de bolsillo", rarity: "common", emoji: "🔴" },
  { id: "mic", name: "Micrófono del presentador", rarity: "rare", emoji: "🎤" },
  { id: "jersey", name: "Camiseta firmada", rarity: "rare", emoji: "👕" },
  { id: "flag", name: "Bandera a cuadros", rarity: "rare", emoji: "🏁" },
  { id: "glove", name: "Guante de box inflable", rarity: "rare", emoji: "🥊" },
  { id: "ring", name: "Salvavidas a rayas", rarity: "rare", emoji: "🛟" },
  { id: "bronze", name: "Trofeo de bronce", rarity: "epic", emoji: "🥉" },
  { id: "redcard", name: "Tarjeta roja dorada", rarity: "epic", emoji: "🟥" },
  { id: "hammer", name: "Martillito de goma", rarity: "epic", emoji: "🔨" },
  { id: "megaphone", name: "Megáfono del estudio", rarity: "epic", emoji: "📣" },
  { id: "goldduck", name: "Patito de oro", rarity: "legendary", emoji: "🐥" },
  { id: "wig", name: "Peluca del presentador", rarity: "legendary", emoji: "💇" },
  { id: "cottoncloud", name: "Nube de algodón", rarity: "legendary", emoji: "☁️" },
  { id: "cup", name: "La Copa Supermatch", rarity: "mythic", emoji: "🏆" },
];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Común",
  rare: "Raro",
  epic: "Épico",
  legendary: "Legendario",
  mythic: "Mítico",
};

export const RARITY_VALUE: Record<Rarity, number> = { common: 6, rare: 25, epic: 90, legendary: 350, mythic: 1500 };

export const MUTATION: Record<Mutation, { label: string; multiplier: number; chance: number }> = {
  none: { label: "", multiplier: 1, chance: 0 },
  wet: { label: "Mojado", multiplier: 1.5, chance: 0.2 },
  gold: { label: "Dorado", multiplier: 5, chance: 0.03 },
  rainbow: { label: "Arcoíris", multiplier: 20, chance: 0.004 },
};

export type Item = { def: string; mutation: Mutation; value: number };

/** Probabilidad de cada rareza según el piso (0 = abajo, 7 = el último). */
function rarityWeights(floor: number): Record<Exclude<Rarity, "mythic">, number> {
  const f = Math.max(0, Math.min(7, floor));
  return { common: 85 - f * 7, rare: 13 + f * 3, epic: 2 + f * 2.6, legendary: f >= 2 ? (f - 1) * 1.2 : 0 };
}

/** `luck` multiplica la chance de mutación (la lluvia de regalos la triplica). */
export function rollItem(random: () => number, floor: number, luck = 1): Item {
  const weights = rarityWeights(floor);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = random() * total;
  let rarity: Rarity = "common";
  for (const [r, w] of Object.entries(weights) as [Exclude<Rarity, "mythic">, number][]) {
    if (roll < w) {
      rarity = r;
      break;
    }
    roll -= w;
  }
  const pool = ITEMS.filter((i) => i.rarity === rarity);
  const def = pool[Math.floor(random() * pool.length)];
  return makeItem(def.id, rollMutation(random, luck), floor);
}

function rollMutation(random: () => number, luck: number): Mutation {
  const r = random() / luck;
  if (r < MUTATION.rainbow.chance) return "rainbow";
  if (r < MUTATION.rainbow.chance + MUTATION.gold.chance) return "gold";
  if (r < MUTATION.rainbow.chance + MUTATION.gold.chance + MUTATION.wet.chance) return "wet";
  return "none";
}

export function makeItem(def: string, mutation: Mutation, floor: number): Item {
  const item = ITEMS.find((i) => i.id === def)!;
  const value = Math.round(RARITY_VALUE[item.rarity] * MUTATION[mutation].multiplier * (1 + 0.2 * Math.max(0, floor)));
  return { def, mutation, value };
}

export const itemDef = (id: string) => ITEMS.find((i) => i.id === id)!;
