import { beforeEach, describe, expect, it } from "vitest";
import { makeItem } from "./sim/items";
import { NO_UPGRADES } from "./sim/progression";
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
  total,
});

describe("progreso de La Torre", () => {
  beforeEach(() => {
    useTower.setState({ fame: 0, totalFame: 0, levels: NO_UPGRADES, record: 0, highestRest: -1, runs: 0, collection: {} });
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
    expect(s().stats().energy).toBeGreaterThan(30);
  });
});
