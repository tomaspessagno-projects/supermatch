import type { CrewMember, GameEvent, NetLink, RivalSpec, TeamInfo } from "../contract";
import type { Audio } from "./audio";

/** Lo que cada escena de minijuego recibe de createGame. */
export type SceneContext = {
  team: TeamInfo;
  rivals: readonly RivalSpec[];
  /** Los 4 en orden (para las pruebas compartidas). */
  crew: readonly CrewMember[];
  /** Solo en salas online: teclas propias hacia la red y las de los demás. */
  net?: NetLink;
  emit: (event: GameEvent) => void;
  audio: Audio;
  /** La escena registra qué hacer cuando suena el silbato de largada. */
  onGo: (action: () => void) => void;
  /** Estado de los botones táctiles (se suman al teclado). */
  buttons: { left: boolean; right: boolean };
  /** La escena registra qué hacer al tocar el botón de salto. */
  onJumpButton: (action: () => void) => void;
};
