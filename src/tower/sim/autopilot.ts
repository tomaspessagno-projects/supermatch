import { type Box, moverBox, type PathStep, type Tower } from "./level";
import type { Stats } from "./progression";
import { createWorld, type PlayerInput, step, type World } from "./sim";

/**
 * Piloto automático para los tests: salta de un escalón al siguiente como lo
 * haría una persona prolija. Sirve para comprobar que cada piso se puede
 * subir con las mejoras pensadas (y no antes).
 */

const DT = 1 / 120;

export function stepBox(tower: Tower, s: PathStep, t: number): Box {
  if (s.kind === "block") return tower.blocks.find((b) => b.id === s.id)!;
  return moverBox(tower.movers.find((m) => m.id === s.id)!, t);
}

const center = (b: Box) => ({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 });

/** ¿Llega de `from` a `to`? Arranca parado en el centro de `from` (en el tiempo `t0`). */
export function hop(tower: Tower, stats: Stats, from: PathStep, to: PathStep, t0 = 0): boolean {
  const toKind = to.kind === "block" ? tower.blocks.find((b) => b.id === to.id)!.kind : "cloud";
  const w: World = createWorld(tower, stats, { record: 0, highestRest: -1 });
  w.time = t0;
  const a = stepBox(tower, from, w.time);
  const c = center(a);
  Object.assign(w.player, { x: c.x, y: a.maxY, z: c.z, grounded: true, ground: "normal", vx: 0, vy: 0, vz: 0 });
  w.energy = 999;
  let jumped = false;
  let doubled = false;
  for (let i = 0; i < 4 / DT; i++) {
    const p = w.player;
    const target = stepBox(tower, to, w.time);
    const tc = center(target);
    const here = stepBox(tower, from, w.time);
    let dx = tc.x - p.x;
    let dz = tc.z - p.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    dx /= d;
    dz /= d;
    // Salta cuando está por salirse de su escalón (o ya muy cerca del otro).
    const margin = 0.3;
    const leaving =
      p.x < here.minX + margin || p.x > here.maxX - margin || p.z < here.minZ + margin || p.z > here.maxZ - margin;
    // …o cuando ya tiene el otro escalón al lado (si no, se choca contra su costado).
    const gx = Math.max(0, target.minX - p.x, p.x - target.maxX);
    const gz = Math.max(0, target.minZ - p.z, p.z - target.maxZ);
    const close = Math.sqrt(gx * gx + gz * gz) < 0.9;
    const input: PlayerInput = { moveX: dx, moveZ: dz, jumpPressed: false, jumpHeld: false };
    if (!jumped && p.grounded && (leaving || close)) {
      input.jumpPressed = true;
      jumped = true;
    } else if (jumped && !doubled && stats.doubleJump && !p.grounded && p.vy < 0 && p.y < target.maxY + 0.2) {
      input.jumpPressed = true;
      doubled = true;
    }
    if (stats.float && jumped && p.vy < 0 && p.y > target.maxY) input.jumpHeld = true;
    const events = step(w, input, DT);
    if (w.phase === "splash") return false;
    // A una burbuja alcanza con tocarla (rebota sola).
    if (toKind === "bubble" && events.some((e) => e.type === "bounce")) return true;
    const on = w.player.grounded && Math.abs(w.player.y - target.maxY) < 0.05 &&
      w.player.x > target.minX - 0.4 && w.player.x < target.maxX + 0.4 && w.player.z > target.minZ - 0.4 && w.player.z < target.maxZ + 0.4;
    if (on) return true;
  }
  return false;
}

/** La misma torre sin lo que empuja (barredoras y viento): para medir solo los saltos. */
export function calmTower(tower: Tower): Tower {
  return { ...tower, movers: tower.movers.filter((m) => m.kind === "cloud"), winds: [] };
}
