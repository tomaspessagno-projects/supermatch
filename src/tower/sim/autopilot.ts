import { type Box, moverBox, type PathStep, type Tower } from "./level";
import type { Stats } from "./progression";
import { blockOf, createWorld, type PlayerInput, step, type World } from "./sim";
import { TUNING } from "./tuning";

/**
 * Piloto automático para los tests: va de un paso del camino al siguiente
 * como lo haría una persona prolija. Sirve para comprobar que cada piso se
 * puede subir con las mejoras pensadas (y no antes).
 */

const DT = 1 / 120;

export function stepBox(tower: Tower, s: PathStep, t: number): Box {
  if (s.kind === "block") return blockOf(tower, s.id)!;
  return moverBox(tower.movers.find((m) => m.id === s.id)!, t);
}

const center = (b: Box) => ({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 });

/** ¿Llega de `from` a `to`? Arranca parado en el centro de `from` (en el tiempo `t0`). */
export function hop(tower: Tower, stats: Stats, from: PathStep, to: PathStep, t0 = 0): boolean {
  const fromKind = from.kind === "block" ? blockOf(tower, from.id)!.kind : "cloud";
  const toKind = to.kind === "block" ? blockOf(tower, to.id)!.kind : "cloud";
  const w: World = createWorld(tower, stats, { record: 0, highestRest: -1 });
  w.time = t0;
  const a = stepBox(tower, from, w.time);
  const c = center(a);
  Object.assign(w.player, { x: c.x, y: a.maxY, z: c.z, grounded: true, ground: fromKind, on: from.kind === "block" ? from.id : null, riding: from.kind === "mover" ? from.id : null, safe: false, vx: 0, vy: 0, vz: 0 });
  w.energy = 999;
  // Lo que te lanza (cama elástica, burbuja, géiser): primero subir, después ir.
  const geyser = tower.geysers.find((g) => c.x > g.minX && c.x < g.maxX && c.z > g.minZ && c.z < g.maxZ && Math.abs(g.minY - a.maxY) < 0.05);
  const launcher = fromKind === "trampoline" || fromKind === "bubble" || geyser !== undefined;
  let jumped = launcher;
  let doubled = false;
  for (let i = 0; i < 5 / DT; i++) {
    const p = w.player;
    const target = stepBox(tower, to, w.time);
    const tc = center(target);
    const here = stepBox(tower, from, w.time);
    let dx = tc.x - p.x;
    let dz = tc.z - p.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    dx /= d;
    dz /= d;
    const input: PlayerInput = { moveX: dx, moveZ: dz, jumpPressed: false, jumpHeld: false };
    // En el aire y ya por arriba del destino: frena para caer en el medio (no pasarse de largo).
    if (!p.grounded && !p.climbing && p.y > target.maxY + 0.1) {
      const vx = Math.max(-6, Math.min(6, (tc.x - p.x) * 4 - p.vx * 0.3));
      const vz = Math.max(-6, Math.min(6, (tc.z - p.z) * 4 - p.vz * 0.3));
      input.moveX = vx / TUNING.moveSpeed;
      input.moveZ = vz / TUNING.moveSpeed;
    }
    // Lanzado: espera a tener la cabeza por arriba de la plataforma de destino
    // (en el géiser, a que el chorro lo suba por arriba de todo).
    if ((launcher && p.y + TUNING.playerHeight < target.minY + 0.1) || (geyser && (p.grounded || p.lifted) && p.y < target.maxY + 0.6)) {
      input.moveX = 0;
      input.moveZ = 0;
    }
    // Salta cuando está por salirse de su plataforma (o ya muy cerca de la otra).
    const margin = 0.3;
    const leaving = p.x < here.minX + margin || p.x > here.maxX - margin || p.z < here.minZ + margin || p.z > here.maxZ - margin;
    const gx = Math.max(0, target.minX - p.x, p.x - target.maxX);
    const gz = Math.max(0, target.minZ - p.z, p.z - target.maxZ);
    const close = Math.sqrt(gx * gx + gz * gz) < 0.9;
    if (!jumped && p.grounded && (leaving || close)) {
      input.jumpPressed = true;
      jumped = true;
    } else if (jumped && !doubled && stats.doubleJump && !p.grounded && !p.climbing && p.vy < 0 && p.y < target.maxY + 0.2) {
      input.jumpPressed = true;
      doubled = true;
    }
    if (stats.float && jumped && p.vy < 0 && p.y > target.maxY) input.jumpHeld = true;
    step(w, input, DT);
    if (w.phase === "splash") return false;
    const on =
      w.player.grounded && Math.abs(w.player.y - target.maxY) < 0.05 &&
      w.player.x > target.minX - 0.4 && w.player.x < target.maxX + 0.4 && w.player.z > target.minZ - 0.4 && w.player.z < target.maxZ + 0.4;
    if (on) return true;
    // A una burbuja o una cama elástica alcanza con tocarla (rebota sola).
    if ((toKind === "bubble" || toKind === "trampoline") && w.player.vy > 5 && Math.abs(w.player.y - target.maxY) < 0.3) return true;
  }
  return false;
}

/** La misma torre sin lo que empuja (barredoras, martillos, guantes, cañones, ventiladores): para medir solo los saltos. */
export function calmTower(tower: Tower): Tower {
  return { ...tower, movers: tower.movers.filter((m) => m.kind === "cloud"), winds: [], cannons: [] };
}
