import type { KAPLAYCtx } from "kaplay";
import type { GameEvent, MinigameStart } from "../contract";

export const PLACEHOLDER_SCENE = "placeholder";

type PlaceholderDeps = {
  teamColor: string;
  emit: (event: GameEvent) => void;
};

/**
 * Escena temporal para probar el contrato de punta a punta sin jugabilidad:
 * el puntaje sube con el tiempo y ESPACIO termina el minijuego.
 * Se borra cuando exista el primer minijuego real.
 */
export function registerPlaceholderScene(
  k: KAPLAYCtx,
  { teamColor, emit }: PlaceholderDeps,
) {
  k.scene(PLACEHOLDER_SCENE, ({ slot, minigameId }: MinigameStart) => {
    const startedAt = k.time();
    let score = 0;
    let finished = false;

    k.add([
      k.text(`Minijuego ${slot}/3 · ${minigameId}`, { size: 36 }),
      k.pos(k.center().x, 140),
      k.anchor("center"),
    ]);
    k.add([
      k.text("ESPACIO para terminar", { size: 24 }),
      k.pos(k.center().x, k.height() - 120),
      k.anchor("center"),
      k.opacity(0.7),
    ]);

    const player = k.add([
      k.rect(80, 120, { radius: 12 }),
      k.pos(k.center()),
      k.anchor("center"),
      k.rotate(0),
      k.color(teamColor),
    ]);

    player.onUpdate(() => {
      player.angle = Math.sin(k.time() * 6) * 12;
    });

    k.onUpdate(() => {
      if (finished) return;
      const next = Math.floor((k.time() - startedAt) * 10);
      if (next !== score) {
        score = next;
        emit({ type: "minigame:score", slot, score });
      }
    });

    k.onKeyPress("space", () => {
      if (finished) return;
      finished = true;
      emit({
        type: "minigame:finished",
        result: {
          slot,
          minigameId,
          score,
          durationMs: Math.round((k.time() - startedAt) * 1000),
        },
      });
    });
  });
}
