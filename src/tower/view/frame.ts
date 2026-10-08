import type { World } from "../sim/sim";

/**
 * Lo que comparten el bucle del juego y lo que se dibuja: el mundo, la
 * posición del jugador en el paso anterior y cuánto falta para el próximo
 * (para dibujar en el medio y que se vea fluido a cualquier tasa de refresco).
 */
export type Frame = {
  world: World;
  prev: { x: number; y: number; z: number };
  alpha: number;
  /** Tiempo real (para animaciones que no dependen de la simulación). */
  clock: number;
};

export function playerPosition(f: Frame) {
  const p = f.world.player;
  const a = f.alpha;
  const jump = Math.abs(p.x - f.prev.x) + Math.abs(p.y - f.prev.y) + Math.abs(p.z - f.prev.z) > 1.5;
  if (jump) return { x: p.x, y: p.y, z: p.z };
  return { x: f.prev.x + (p.x - f.prev.x) * a, y: f.prev.y + (p.y - f.prev.y) * a, z: f.prev.z + (p.z - f.prev.z) * a };
}
