import { describe, expect, it } from "vitest";
import { calmTower, hop } from "./autopilot";
import { type Block, buildTower } from "./level";
import { NO_UPGRADES, statsFor } from "./progression";
import { TUNING } from "./tuning";

const tower = buildTower();
const calm = calmTower(tower);

/** ¿Se puede subir cada escalón de estos pisos con este nivel de salto? */
function climbable(floors: number[], jump: number) {
  const stats = statsFor({ ...NO_UPGRADES, jump });
  let ok = 0;
  let total = 0;
  for (let i = 0; i + 1 < calm.path.length; i++) {
    const to = calm.path[i + 1];
    if (!floors.includes(to.floor)) continue;
    total++;
    // Con nubes se puede esperar el momento: alcanza con que salga en alguno.
    if ([0, 0.7, 1.4, 2.1].some((t0) => hop(calm, stats, calm.path[i], to, t0))) ok++;
  }
  return { ok, total };
}

describe("la torre", () => {
  it("6 pisos de 12 m con su descanso arriba y la Copa en la cima", () => {
    expect(tower.floors.map((f) => f.name)).toEqual(["Calentamiento", "Jabón", "Viento", "Barredoras", "Burbujas", "Nubes"]);
    expect(tower.rests).toEqual([12, 24, 36, 48, 60, 72]);
    expect(tower.top).toBe(72);
    expect(tower.blocks.some((b) => b.kind === "goal" && b.maxY === 72)).toBe(true);
    expect(buildTower()).toEqual(tower); // igual para todos
  });

  it("cada piso pide su mejora de salto: ni antes ni nunca", () => {
    const easy = climbable([0, 1], 0);
    expect(easy.ok).toBe(easy.total);
    const wind0 = climbable([2], 0);
    const wind1 = climbable([2], 1);
    expect(wind0.ok).toBeLessThan(wind0.total);
    expect(wind1.ok).toBe(wind1.total);
    const top1 = climbable([3, 4, 5], 1);
    const top2 = climbable([3, 4, 5], 2);
    expect(top1.ok).toBeLessThan(top1.total);
    expect(top2.ok).toBe(top2.total);
  }, 60_000);

  it("ningún bloque hace de techo sobre el camino (no te golpeás la cabeza)", () => {
    const pathBlocks = tower.path.filter((s) => s.kind === "block").map((s) => tower.blocks.find((b) => b.id === s.id)!);
    const shrink = 0.2;
    const above = (b: Block, c: Block) =>
      c.minY > b.maxY &&
      c.minY < b.maxY + TUNING.playerHeight + 0.7 &&
      c.minX < b.maxX - shrink && c.maxX > b.minX + shrink && c.minZ < b.maxZ - shrink && c.maxZ > b.minZ + shrink;
    for (const b of pathBlocks) {
      const ceilings = tower.blocks.filter((c) => c !== b && above(b, c));
      expect(ceilings, `techo sobre el bloque ${b.id}`).toEqual([]);
    }
  });

  it("los premios de las cornisas están arriba de su cornisa", () => {
    const ledges = tower.blocks.filter((b) => b.kind === "ledge");
    expect(ledges.length).toBeGreaterThan(4);
    for (const spot of tower.spots.filter((s) => s.ledge)) {
      expect(ledges.some((l) => spot.x > l.minX && spot.x < l.maxX && spot.z > l.minZ && spot.z < l.maxZ && spot.y > l.maxY)).toBe(true);
    }
  });

  it("tiene sus obstáculos: jabón, viento, barredoras, burbujas y nubes", () => {
    expect(tower.blocks.filter((b) => b.kind === "soap").length).toBeGreaterThan(4);
    expect(tower.winds.length).toBeGreaterThan(2);
    expect(tower.movers.filter((m) => m.kind === "sweeper").length).toBeGreaterThan(2);
    expect(tower.blocks.filter((b) => b.kind === "bubble").length).toBeGreaterThan(1);
    expect(tower.movers.filter((m) => m.kind === "cloud").length).toBeGreaterThan(2);
  });
});
