import { beforeEach, describe, expect, it } from "vitest";
import { makeItem } from "./sim/items";
import { dailyMissions, dayKey, MAIN_QUEST, NO_COUNTERS } from "./sim/goals";
import { TOWER_TOP } from "./sim/level";
import { ENERGY_BASE, NO_UPGRADES } from "./sim/progression";
import type { RunSummary } from "./sim/sim";
import { useTower } from "./store";

const RESET = {
  fame: 0, totalFame: 0, levels: NO_UPGRADES, record: 0, highestRest: -1, runs: 0, collection: {}, pets: [], pet: null, season: 0,
  counters: NO_COUNTERS, quest: 0, daily: { day: "", counts: {}, done: [] }, stars: [], starRewards: 0, cosmetics: [], hat: null, trail: null, title: "Novato", celebrations: [],
};

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
    useTower.setState(RESET);
  });

  it("cada intento suma fama, récord y colección", () => {
    const s = useTower.getState;
    s().finishRun(summary(40, 9.5));
    s().finishRun(summary(10, 4, [makeItem("duck", "gold", 0), makeItem("mic", "none", 1)]));
    // 50 de los intentos + 10 por la misión "cobrá tu primer intento" (y 10 por "subí al primer escalón").
    expect(s().fame).toBe(70);
    expect(s().record).toBe(9.5);
    expect(s().runs).toBe(2);
    expect(s().collection).toEqual({ duck: { gold: 2 }, mic: { none: 1 } });
  });

  it("comprar descuenta y sube el nivel; sin fama no se puede", () => {
    const s = useTower.getState;
    expect(s().buy("energy")).toBe(false);
    s().finishRun(summary(20, 3, []));
    const before = s().fame;
    expect(s().buy("energy")).toBe(true);
    // 15 de la mejora, y la misión "comprá una mejora" paga 15.
    expect(s().fame).toBe(before - 15 + 15);
    expect(s().levels.energy).toBe(1);
    expect(s().stats().energy).toBeGreaterThan(ENERGY_BASE);
  });

  it("las mascotas se compran una vez y se elige cuál te acompaña", () => {
    const s = useTower.getState;
    expect(s().buyPet("duck")).toBe(false);
    s().finishRun(summary(1000, 3, []));
    const before = s().fame;
    expect(s().buyPet("duck")).toBe(true);
    expect(s().fame).toBe(before - 400);
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
    expect(s()).toMatchObject({ season: 1, record: 0, highestRest: -1, levels: NO_UPGRADES, pets: ["duck"] });
    expect(s().counters.seasons).toBe(1);
    expect(s().stats().fameMult).toBe(1.5);
    expect(Object.keys(s().collection)).toContain("duck");
  });

  it("la misión del programa va en cadena: premio, título y cosmético", () => {
    const s = useTower.getState;
    expect(MAIN_QUEST[s().quest].id).toBe("first-step");
    s().onSimEvent({ type: "land", impact: 5, kind: "normal" }, { height: 0.8, chips: 0, stars: [] });
    expect(MAIN_QUEST[s().quest].id).toBe("first-run");
    expect(s().fame).toBe(10);
    expect(s().celebrations.map((c) => c.text)).toEqual(["Subí al primer escalón"]);
    s().finishRun(summary(5, 1, []));
    s().reachRest(0);
    // "comprá una mejora" frena la cadena aunque ya llegaste al descanso.
    expect(MAIN_QUEST[s().quest].id).toBe("first-buy");
    s().buy("energy");
    expect(MAIN_QUEST[s().quest].id).toBe("chips-10");
    expect(s().title).toBe("Aprendiz");
    s().track({ chipsRun: 10, items: 1, stars: 1 });
    expect(s().cosmetics).toContain("cap");
    expect(s().hat).toBe("cap");
    s().wear("cap");
    expect(s().hat).toBe(null);
  });

  it("las misiones del día se cumplen con lo de hoy, una vez", () => {
    const s = useTower.getState;
    const m = dailyMissions(dayKey(Date.now()))[0];
    s().track({ [m.counter]: m.goal });
    expect(s().daily.done).toContain(m.id);
    const fame = s().fame;
    s().track({ [m.counter]: m.goal });
    expect(s().celebrations.filter((c) => c.kind === "daily" && c.text === m.text)).toHaveLength(1);
    expect(s().fame).toBeGreaterThanOrEqual(fame);
  });

  it("cada 6 estrellas, un premio", () => {
    const s = useTower.getState;
    s().onSimEvent({ type: "star", id: 1, floor: 0, x: 0, y: 0, z: 0 }, { height: 3, chips: 0, stars: [1, 2, 3, 4, 5, 6] });
    expect(s().stars).toHaveLength(6);
    expect(s().starRewards).toBe(1);
    expect(s().cosmetics).toContain("stars");
    expect(s().trail).toBe("stars");
    expect(s().celebrations.some((c) => c.kind === "stars")).toBe(true);
  });
});
