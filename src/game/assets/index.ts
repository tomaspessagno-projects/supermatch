import type { KAPLAYCtx } from "kaplay";
import { SPRITES, type SpriteName } from "./manifest";

export { SPRITES, type SpriteName };

export const FONT = "cartoon";
export const INK = "#1F1147";

/** Registra sprites y fuente. KAPLAY no arranca las escenas hasta que terminan de cargar. */
export function loadAssets(k: KAPLAYCtx) {
  for (const [name, { file }] of Object.entries(SPRITES)) {
    k.loadSprite(name, `/game/sprites/${file}`);
  }
  k.loadFont(FONT, "/game/fonts/LuckiestGuy-Regular.ttf", {
    outline: { width: 6, color: k.rgb(INK) },
    size: 72,
  });
}

/** Algunos assets son opcionales: si no se generaron, la escena dibuja un reemplazo. */
export function hasSprite(name: string): name is SpriteName {
  return name in SPRITES;
}

/** Sprites exportados al doble del tamaño de juego: escala 0.5 = tamaño nominal. */
export const SPRITE_RES = 0.5;
