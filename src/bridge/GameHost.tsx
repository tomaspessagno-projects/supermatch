"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import type { GameEvent, GameHandle } from "@/game/contract";
import { nextMinigame, useSession } from "@/store/session";

// KAPLAY es un singleton a nivel de módulo y su quit() termina recién al final
// del frame siguiente: cada instancia nueva espera a que la anterior se cierre.
let pendingTeardown: Promise<void> = Promise.resolve();

type GameHostProps = {
  teamColor: string;
  onRunFinished: () => void;
};

/**
 * Monta KAPLAY y traduce entre eventos del juego y el store.
 * El efecto corre en cada montaje y también cada vez que Next vuelve a mostrar
 * la ruta (cacheComponents la oculta con <Activity> en vez de desmontarla):
 * cada vez arranca un run nuevo.
 */
export function GameHost({ teamColor, onRunFinished }: GameHostProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const runFinished = useEffectEvent(onRunFinished);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const session = useSession.getState;
    let game: GameHandle | null = null;
    let disposed = false;

    function onGameEvent(event: GameEvent) {
      switch (event.type) {
        case "minigame:score":
          session().setLiveScore(event.score);
          break;
        case "minigame:finished": {
          session().recordResult(event.result);
          const next = nextMinigame(session().results);
          if (next) game?.send({ type: "minigame:start", ...next });
          else runFinished();
          break;
        }
      }
    }

    // Import dinámico: KAPLAY nunca entra al render del servidor, y el arranque
    // asíncrono hace que el doble montaje de StrictMode se cancele antes de
    // crear una segunda instancia.
    Promise.all([
      import("@/game/engine/createGame"),
      pendingTeardown,
    ]).then(([{ createGame }]) => {
      if (disposed) return;
      session().startRun();
      game = createGame({ root, teamColor, emit: onGameEvent });
      const first = nextMinigame([]);
      if (first) game.send({ type: "minigame:start", ...first });
    });

    return () => {
      disposed = true;
      if (game) pendingTeardown = game.destroy();
    };
  }, [teamColor]);

  return <div ref={rootRef} className="absolute inset-0" />;
}
