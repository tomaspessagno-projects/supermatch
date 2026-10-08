/**
 * Cosméticos: no cambian el juego, se lucen. Se ganan con misiones y
 * estrellas (no se compran).
 */

export type HatId = "cap" | "party" | "viking" | "tophat" | "crown" | "halo";
export type TrailId = "bubbles" | "stars" | "confetti" | "rainbow";
export type CosmeticId = HatId | TrailId;

export type CosmeticDef = { id: CosmeticId; kind: "hat" | "trail"; name: string; emoji: string };

export const COSMETICS: readonly CosmeticDef[] = [
  { id: "cap", kind: "hat", name: "Gorra del programa", emoji: "🧢" },
  { id: "party", kind: "hat", name: "Gorrito de fiesta", emoji: "🥳" },
  { id: "viking", kind: "hat", name: "Casco vikingo", emoji: "⛑️" },
  { id: "tophat", kind: "hat", name: "Galera", emoji: "🎩" },
  { id: "crown", kind: "hat", name: "Corona de campeón", emoji: "👑" },
  { id: "halo", kind: "hat", name: "Aureola dorada", emoji: "😇" },
  { id: "bubbles", kind: "trail", name: "Estela de burbujas", emoji: "🫧" },
  { id: "stars", kind: "trail", name: "Estela de estrellas", emoji: "✨" },
  { id: "confetti", kind: "trail", name: "Estela de confeti", emoji: "🎊" },
  { id: "rainbow", kind: "trail", name: "Estela arcoíris", emoji: "🌈" },
];

export const cosmeticDef = (id: CosmeticId) => COSMETICS.find((c) => c.id === id)!;
export const isHat = (id: CosmeticId): id is HatId => cosmeticDef(id).kind === "hat";
