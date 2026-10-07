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
};

export const MINIGAME_NAMES: Record<MinigameId, string> = Object.fromEntries(
  Object.entries(MINIGAMES).map(([id, info]) => [id, info.name]),
) as Record<MinigameId, string>;
