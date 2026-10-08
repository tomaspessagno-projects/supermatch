import { describe, expect, it } from "vitest";
import { calmTower, hop } from "./autopilot";
import { type Block, buildTower } from "./level";
import { NO_UPGRADES, statsFor } from "./progression";
import { blockOf } from "./sim";
import { TUNING } from "./tuning";

const tower = buildTower();
const calm = calmTower(tower);
const pathBlocks = tower.path.filter((s) => s.kind === "block").map((s) => blockOf(tower, s.id)!);

/** ¿Se puede subir cada paso de estos pisos con este nivel de salto? */
function climbable(floors: number[], jump: number) {
  const stats = statsFor({ ...NO_UPGRADES, jump });
  let ok = 0;
  let total = 0;
  for (let i = 0; i + 1 < calm.path.length; i++) {
    const to = calm.path[i + 1];
    if (!floors.includes(to.floor)) continue;
    total++;
    // Con lo que se mueve o parpadea se puede esperar el momento: alcanza con que salga en alguno.
    if ([0, 0.7, 1.4, 2.1].some((t0) => hop(calm, stats, calm.path[i], to, t0))) ok++;
  }
  return { ok, total };
}

describe("la torre", () => {
  it("8 pisos con su descanso arriba y la Copa en la cima", () => {
    expect(tower.floors.map((f) => f.name)).toEqual([
      "Calentamiento",
      "Jabón y cintas",
      "Camas elásticas",
      "Bolas rojas",
      "Martillos y guantes",
      "Redes y cañones",
      "Géiseres y burbujas",
      "Nubes y calesitas",
    ]);
    expect(tower.rests).toEqual(tower.floors.map((f) => f.top));
    expect(tower.top).toBe(98);
    expect(tower.blocks.some((b) => b.kind === "goal" && b.maxY === tower.top)).toBe(true);
    expect(buildTower()).toEqual(tower); // igual para todos
  });

  it("cada piso pide su mejora de salto: ni antes ni nunca", () => {
    const easy = climbable([0, 1, 2, 3], 0);
    expect(easy.ok).toBe(easy.total);
    const hammers0 = climbable([4], 0);
    const hammers1 = climbable([4], 1);
    expect(hammers0.ok).toBeLessThan(hammers0.total);
    expect(hammers1.ok).toBe(hammers1.total);
    const top1 = climbable([5, 6, 7], 1);
    const top2 = climbable([5, 6, 7], 2);
    expect(top1.ok).toBeLessThan(top1.total);
    expect(top2.ok).toBe(top2.total);
  }, 120_000);

  it("no hay caracol: el camino sube por delante de la fachada, de costado a costado", () => {
    for (const b of pathBlocks) expect(b.minZ).toBeGreaterThanOrEqual(tower.wall.maxZ);
    const xs = pathBlocks.map((b) => (b.minX + b.maxX) / 2);
    expect(Math.min(...xs)).toBeLessThan(-9);
    expect(Math.max(...xs)).toBeGreaterThan(9);
  });

  it("ningún bloque hace de techo sobre el camino (no te golpeás la cabeza)", () => {
    const shrink = 0.2;
    const above = (b: Block, c: Block) =>
      c.minY > b.maxY - 0.01 &&
      c.minY < b.maxY + TUNING.playerHeight + 0.7 &&
      c.minX < b.maxX - shrink && c.maxX > b.minX + shrink && c.minZ < b.maxZ - shrink && c.maxZ > b.minZ + shrink;
    for (const b of pathBlocks) {
      const ceilings = tower.blocks.filter((c) => c !== b && c.kind !== "rail" && above(b, c));
      expect(ceilings, `techo sobre el bloque ${b.id}`).toEqual([]);
    }
  });

  it("los bloques no se pisan entre sí", () => {
    const solid = tower.blocks.filter((b) => b.kind !== "elevator");
    for (let i = 0; i < solid.length; i++) {
      for (let j = i + 1; j < solid.length; j++) {
        const a = solid[i];
        const b = solid[j];
        const hit = a.minX < b.maxX - 0.01 && a.maxX > b.minX + 0.01 && a.minY < b.maxY - 0.01 && a.maxY > b.minY + 0.01 && a.minZ < b.maxZ - 0.01 && a.maxZ > b.minZ + 0.01;
        expect(hit, `${a.kind} ${a.id} con ${b.kind} ${b.id}`).toBe(false);
      }
    }
  });

  it("los premios de las cornisas están arriba de su cornisa", () => {
    const ledges = tower.blocks.filter((b) => b.kind === "ledge");
    expect(ledges.length).toBeGreaterThan(4);
    for (const spot of tower.spots.filter((s) => s.ledge)) {
      expect(ledges.some((l) => spot.x > l.minX && spot.x < l.maxX && spot.z > l.minZ && spot.z < l.maxZ && spot.y > l.maxY)).toBe(true);
    }
  });

  it("cada piso tiene lo suyo", () => {
    const kindsOn = (floor: number) => new Set(tower.blocks.filter((b) => b.floor === floor).map((b) => b.kind));
    const moversOn = (floor: number) => new Set(tower.movers.filter((m) => m.floor === floor).map((m) => m.kind));
    expect([...kindsOn(1)]).toEqual(expect.arrayContaining(["soap", "conveyor"]));
    expect([...kindsOn(2)]).toEqual(expect.arrayContaining(["trampoline", "crumble"]));
    expect([...kindsOn(3)]).toContain("ball");
    expect(tower.winds.some((w) => w.floor === 3)).toBe(true);
    expect([...moversOn(4)]).toEqual(expect.arrayContaining(["hammer", "piston", "sweeper"]));
    expect(tower.nets.filter((n) => n.floor === 5).length).toBeGreaterThanOrEqual(2);
    expect(tower.cannons.filter((c) => c.floor === 5).length).toBeGreaterThanOrEqual(2);
    expect(tower.geysers.filter((g) => g.floor === 6).length).toBeGreaterThanOrEqual(2);
    expect([...kindsOn(6)]).toContain("bubble");
    expect([...kindsOn(7)]).toEqual(expect.arrayContaining(["spinner", "blink"]));
    expect([...moversOn(7)]).toContain("cloud");
  });

  it("cada red está en la cara de adelante de su columna", () => {
    for (const net of tower.nets) {
      const pillar = blockOf(tower, net.pillar)!;
      expect(pillar.kind).toBe("pillar");
      expect(net.minZ).toBeCloseTo(pillar.maxZ - 0.05, 5);
      expect(net.maxY).toBe(pillar.maxY);
    }
  });
});
