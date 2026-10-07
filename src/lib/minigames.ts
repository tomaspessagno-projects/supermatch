import type { MinigameId } from "@/bridge/events";

export type MinigameInfo = {
  name: string;
  /** La regla en una línea, para la presentación de la prueba. */
  rule: string;
  /** `keys`: teclado; `touch`: botones en pantalla. */
  controls: readonly { keys: string; touch: string; action: string }[];
};

export const MINIGAMES: Record<MinigameId, MinigameInfo> = {
  slippery_bridge: {
    name: "El Puente Resbaladizo",
    rule: "Cruzá el puente enjabonado: saltá los charcos y esquivá los rodillos de goma. Si caés al agua, volvés a la última bandera.",
    controls: [
      { keys: "← →", touch: "◀ ▶", action: "patinar" },
      { keys: "ESPACIO", touch: "⤒", action: "saltar" },
    ],
  },
  rolling_log: {
    name: "El Tronco Loco",
    rule: "Quedate arriba del tronco que gira: corré en contra, saltá las pelotas bajas (las altas, no) y reventá las burbujas doradas. Tenés 3 vidas.",
    controls: [
      { keys: "← →", touch: "◀ ▶", action: "correr" },
      { keys: "ESPACIO", touch: "⤒", action: "saltar" },
    ],
  },
  mattress: {
    name: "El Colchón",
    rule: "Llevá el colchón con tu compañero y atajá a los que se tiran de la torre: que reboten de colchón en colchón hasta el pelotero.",
    controls: [
      { keys: "← →", touch: "◀ ▶", action: "mover el colchón" },
      { keys: "ESPACIO", touch: "⤒", action: "saltar (¡juntos!)" },
    ],
  },
};

/** El Colchón se juega en 3 rondas, una por prueba, cada una con su vuelta de tuerca. */
const MATTRESS_ROUNDS: Record<number, { title: string; rule: string }> = {
  1: {
    title: "¡Atajalos!",
    rule: "Atajá a los que se tiran de la torre y hacelos rebotar hasta el pelotero. Si saltan juntos justo cuando cae (el anillo se pone verde), sale con súper rebote.",
  },
  2: {
    title: "Lluvia de globos",
    rule: "Caen globos de agua: si pegan en el colchón se empapan y van más lento; en la cabeza, te tiran. Los dorados valen el doble.",
  },
  3: {
    title: "La barrera",
    rule: "Por la pasarela vienen rodillos: ¡salten sin soltar el colchón! Y ojo con los charcos de jabón: cuesta frenar.",
  },
};

/** Nombre, regla y controles de una prueba del episodio (El Colchón cambia por ronda). */
export function minigameInfo(id: MinigameId, slot: number): MinigameInfo & { round?: string } {
  const info = MINIGAMES[id];
  if (id !== "mattress") return info;
  const round = MATTRESS_ROUNDS[slot] ?? MATTRESS_ROUNDS[1];
  return { ...info, rule: round.rule, round: `Ronda ${slot}: ${round.title}` };
}

/** Para listas cortas ("El Colchón · Ronda 2"). */
export function minigameTitle(id: MinigameId, slot: number): string {
  return id === "mattress" ? `${MINIGAMES[id].name} · Ronda ${slot}` : MINIGAMES[id].name;
}
