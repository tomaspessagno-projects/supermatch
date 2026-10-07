import type { GameCommand, GameHandle, VirtualButton } from "@/game/contract";

// El juego activo, para que la UI que vive fuera del canvas (botones táctiles,
// cuenta regresiva) le hable.
let active: GameHandle | null = null;

export function setActiveGame(game: GameHandle | null) {
  active = game;
}

export function pressButton(button: VirtualButton, down: boolean) {
  active?.send({ type: "input", button, down });
}

export function sendToGame(command: GameCommand) {
  active?.send(command);
}
