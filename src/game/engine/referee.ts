import type { KAPLAYCtx } from "kaplay";
import { hasSprite } from "../assets";

export type RefereePose = "whistle" | "card" | "flag";

const SPRITE: Record<RefereePose, string> = {
  whistle: "ref-whistle",
  card: "ref-card",
  flag: "ref-flag",
};

const CARD_TIME = 1.4; // cuánto muestra la tarjeta después de una caída
const INSET_W = 120;

/**
 * El árbitro del programa: silbato en la largada, tarjeta roja en cada caída
 * y bandera a cuadros al final. Cada prueba decide dónde pararlo; la tarjeta
 * también puede entrar desde la esquina de la pantalla.
 */
export function createReferee(k: KAPLAYCtx) {
  let cardFor = 0;
  let ended = false;
  let time = 0;

  const pose = (): RefereePose => (ended ? "flag" : cardFor > 0 ? "card" : "whistle");

  return {
    /** Una caída: saca la tarjeta. */
    card() {
      cardFor = CARD_TIME;
    },
    /** Terminó la prueba: bandera a cuadros. */
    end() {
      ended = true;
    },
    update(dt: number) {
      time += dt;
      cardFor = Math.max(0, cardFor - dt);
    },

    /** Parado en el escenario, con los pies en (x, y). */
    draw(x: number, y: number, width: number, { flip = false, fixed = false } = {}) {
      const current = pose();
      const sprite = SPRITE[current];
      if (!hasSprite(sprite)) return;
      // Agita la bandera o la tarjeta; con el silbato, respira.
      const wave = current === "whistle" ? 0 : Math.sin(time * 14) * 4;
      const breathe = current === "whistle" ? Math.sin(time * 3) * 1.5 : 0;
      k.drawSprite({
        sprite,
        pos: k.vec2(x, y + breathe),
        anchor: "bot",
        width,
        flipX: flip,
        angle: wave,
        fixed,
      });
    },

    /** La tarjeta roja entra desde la esquina inferior izquierda (para pruebas con cámara que se mueve). */
    drawCardInset(viewHeight: number) {
      if (cardFor <= 0 || !hasSprite(SPRITE.card)) return;
      const shown = CARD_TIME - cardFor;
      const t = Math.min(1, shown / 0.18, cardFor / 0.2);
      k.drawSprite({
        sprite: SPRITE.card,
        pos: k.vec2(70, viewHeight + 10 + (1 - t) * 220),
        anchor: "bot",
        width: INSET_W,
        angle: Math.sin(time * 14) * 3,
        fixed: true,
      });
    },
  };
}
