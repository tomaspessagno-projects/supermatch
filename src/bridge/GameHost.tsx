"use client";

import { useEffect, useRef } from "react";
import type { GameEvent, GameHandle } from "@/game/contract";
import { TEAMS, type TeamId } from "@/lib/teams";
import { nextMinigame, useSession } from "@/store/session";
import { setActiveGame } from "./input";

// KAPLAY es un singleton a nivel de módulo y su quit() termina recién al final
// del frame siguiente: cada instancia nueva espera a que la anterior se cierre.
let pendingTeardown: Promise<void> = Promise.resolve();

type GameHostProps = {
  team: TeamId;
};

/**
 * Monta KAPLAY y traduce entre eventos del juego y el store. Sigue la fase del
 * episodio (presentación → cuenta → juego → tabla) para mandar el silbato y
 * cargar la prueba siguiente.
 *
 * El efecto corre en cada montaje y también cada vez que Next vuelve a mostrar
 * la ruta (cacheComponents la oculta con <Activity> en vez de desmontarla):
 * cada vez arranca un episodio nuevo.
 */
export function GameHost({ team }: GameHostProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const session = useSession.getState;
    let game: GameHandle | null = null;
    let unsubscribe = () => {};
    let disposed = false;

    function onGameEvent(event: GameEvent) {
      switch (event.type) {
        case "minigame:score":
          session().setLiveScore(event.score);
          break;
        case "minigame:finished":
          session().recordResult(event.result, event.rivals);
          break;
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
      const info = (id: string) => ({ id, color: TEAMS.find((t) => t.id === id)!.color });
      const current = createGame({
        root,
        team: info(team),
        rivals: TEAMS.filter((t) => t.id !== team).map((t) => info(t.id)),
        emit: onGameEvent,
        muted: session().muted,
      });
      game = current;
      setActiveGame(current);

      const first = nextMinigame([]);
      if (first) current.send({ type: "minigame:start", ...first });

      unsubscribe = useSession.subscribe((state, prev) => {
        if (state.phase === "playing" && prev.phase !== "playing") {
          current.send({ type: "minigame:go" });
          current.focus();
        }
        if (state.phase === "intro" && prev.phase === "between") {
          const next = nextMinigame(state.results);
          if (next) current.send({ type: "minigame:start", ...next });
        }
        if (state.muted !== prev.muted) current.send({ type: "mute", muted: state.muted });
      });
    });

    return () => {
      disposed = true;
      unsubscribe();
      setActiveGame(null);
      if (game) pendingTeardown = game.destroy();
    };
  }, [team]);

  return <div ref={rootRef} className="absolute inset-0" />;
}
