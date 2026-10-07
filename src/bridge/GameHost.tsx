"use client";

import { useEffect, useRef } from "react";
import type { CrewMember, GameEvent, GameHandle, RivalSpec } from "@/game/contract";
import { shortTeamName } from "@/lib/participants";
import { getTeam, type TeamId } from "@/lib/teams";
import { netLink, reportResult } from "@/online/room";
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
 * cada vez arranca un episodio nuevo. Online, los participantes y la semilla
 * ya los dejó la sala.
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
          if (session().mode === "online") reportResult(event.result, event.rivals);
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
      const { mode, participants, seed, kind } = session();
      const info = (id: TeamId) => ({ id, color: getTeam(id).color, name: shortTeamName(id) });
      // Los bots se nombran por su color; las personas, por su apodo.
      const rivals: RivalSpec[] = participants
        .filter((p) => p.kind !== "me")
        .map((p) => ({
          id: p.id,
          team: info(p.team),
          name: p.kind === "bot" ? shortTeamName(p.team) : p.name,
          control: p.kind === "bot" ? "bot" : "remote",
        }));
      // En equipo, los 4 en el orden de la sala (igual en todas las compus).
      const crew: CrewMember[] = participants.map((p) => ({
        id: p.id,
        team: info(p.team),
        name: p.kind === "bot" ? shortTeamName(p.team) : p.name,
        control: p.kind === "me" ? "me" : p.kind,
      }));
      const current = createGame({
        root,
        team: info(team),
        rivals,
        crew,
        net: mode === "online" ? netLink : undefined,
        emit: onGameEvent,
        muted: session().muted,
      });
      game = current;
      setActiveGame(current);

      const first = nextMinigame([], seed, kind);
      if (first) current.send({ type: "minigame:start", ...first });
      // Online la cuenta corre con el reloj de la sala: si el juego tardó en
      // cargar, puede que el silbato ya haya sonado.
      if (session().phase === "playing") current.send({ type: "minigame:go" });

      unsubscribe = useSession.subscribe((state, prev) => {
        if (state.phase === "playing" && prev.phase !== "playing") {
          current.send({ type: "minigame:go" });
          current.focus();
        }
        if (state.phase === "intro" && prev.phase === "between") {
          const next = nextMinigame(state.results, state.seed, state.kind);
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
