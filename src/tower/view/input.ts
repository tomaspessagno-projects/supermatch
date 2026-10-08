/**
 * Teclas y botones táctiles en un solo lugar. El juego lee esto en cada
 * frame: `x`/`y` es la dirección en pantalla (y = para adelante) y el salto
 * queda "apretado" hasta que el juego lo usa.
 */
export const input = {
  x: 0,
  y: 0,
  jumpPressed: false,
  jumpHeld: false,
  /** Arrastre de cámara acumulado (radianes). */
  yaw: 0,
  pitch: 0,
  /** Tecla de acción (kiosco). */
  action: false,
};

const keys = new Set<string>();
let stick = { x: 0, y: 0 };

function update() {
  const kx = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
  const ky = (keys.has("ArrowUp") || keys.has("KeyW") ? 1 : 0) - (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0);
  input.x = Math.max(-1, Math.min(1, kx + stick.x));
  input.y = Math.max(-1, Math.min(1, ky + stick.y));
}

export function pressJump(down: boolean) {
  if (down && !input.jumpHeld) input.jumpPressed = true;
  input.jumpHeld = down;
}

export function setStick(x: number, y: number) {
  stick = { x, y };
  update();
}

/** Escucha el teclado mientras el juego está montado. */
export function listenKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === "Space") {
      e.preventDefault();
      pressJump(true);
    }
    if (e.code === "KeyE" || e.code === "Enter") input.action = true;
    if (e.code.startsWith("Arrow")) e.preventDefault();
    keys.add(e.code);
    update();
  };
  const up = (e: KeyboardEvent) => {
    if (e.code === "Space") pressJump(false);
    keys.delete(e.code);
    update();
  };
  const blur = () => {
    keys.clear();
    pressJump(false);
    update();
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    blur();
  };
}
