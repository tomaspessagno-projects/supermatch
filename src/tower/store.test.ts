import { beforeEach, describe, expect, it } from "vitest";
import { makeItem } from "./sim/items";
import { TOWER_TOP } from "./sim/level";
import { ENERGY_BASE, NO_UPGRADES } from "./sim/progression";
import type { RunSummary } from "./sim/sim";
import { useTower } from "./store";

const summary = (total: number, height: number, items = [makeItem("duck", "gold", 0)]): RunSummary => ({
  height,
  climbed: height,
  record: true,
  heightFame: 0,
  recordFame: 0,
  chips: 0,
  items,
  itemsFame: 0,
  bonusFame: 0,
  total,
});

describe("progreso de La Torre", () => {
  beforeEach(() => {
    useTower.setState({ fame: 0, totalFame: 0, levels: NO_UPGRADES, record: 0, highestRest: -1, runs: 0, collection: {}, pets: [], pet: null, season: 0 });
  });

  it("cada intento suma fama, récord y colección", () => {
    const s = useTower.getState;
    s().finishRun(summary(40, 9.5));
    s().finishRun(summary(10, 4, [makeItem("duck", "gold", 0), makeItem("mic", "none", 1)]));
    expect(s().fame).toBe(50);
    expect(s().record).toBe(9.5);
    expect(s().runs).toBe(2);
    expect(s().collection).toEqual({ duck: { gold: 2 }, mic: { none: 1 } });
  });

  it("comprar descuenta y sube el nivel; sin fama no se puede", () => {
    const s = useTower.getState;
    expect(s().buy("energy")).toBe(false);
    s().finishRun(summary(20, 3, []));
    expect(s().buy("energy")).toBe(true);
    expect(s().fame).toBe(5);
    expect(s().levels.energy).toBe(1);
    expect(s().stats().energy).toBeGreaterThan(ENERGY_BASE);
  });

  it("las mascotas se compran una vez y se elige cuál te acompaña", () => {
    const s = useTower.getState;
    expect(s().buyPet("duck")).toBe(false);
    s().finishRun(summary(1000, 3, []));
    expect(s().buyPet("duck")).toBe(true);
    expect(s().fame).toBe(600);
    expect(s().pet).toBe("duck");
    expect(s().stats().chipMult).toBe(1.5);
    expect(s().buyPet("duck")).toBe(false);
    s().equipPet(null);
    expect(s().stats().chipMult).toBe(1);
    s().equipPet("dragon"); // no la tiene
    expect(s().pet).toBe(null);
  });

  it("nueva temporada: solo después de la cima; vuelve a empezar con más fama para siempre", () => {
    const s = useTower.getState;
    s().finishRun(summary(5000, 60));
    s().buy("jump");
    expect(s().rebirth()).toBe(false);
    s().finishRun(summary(800, TOWER_TOP, []));
    s().buyPet("duck");
    expect(s().rebirth()).toBe(true);
    expect(s()).toMatchObject({ season: 1, fame: 0, record: 0, highestRest: -1, levels: NO_UPGRADES, pets: ["duck"] });
    expect(s().stats().fameMult).toBe(1.5);
    expect(Object.keys(s().collection)).toContain("duck");
  });
});
