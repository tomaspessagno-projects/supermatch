import { describe, expect, it } from "vitest";
import { COSMETICS } from "./cosmetics";
import { advanceQuest, DAILY_POOL, dailyMissions, dayKey, MAIN_QUEST, NO_COUNTERS, progressLabel, STAR_REWARDS } from "./goals";

describe("la misión del programa", () => {
  it("se cumple en orden y frena en la primera que falta", () => {
    expect(advanceQuest(0, NO_COUNTERS)).toEqual({ index: 0, done: [] });
    const r = advanceQuest(0, { ...NO_COUNTERS, height: 3, runs: 1, rest: 4 });
    expect(r.done.map((m) => m.id)).toEqual(["first-step", "first-run"]);
    expect(MAIN_QUEST[r.index].id).toBe("first-buy");
  });

  it("lleva hasta La Copa y después a las temporadas", () => {
    const ids = MAIN_QUEST.map((m) => m.id);
    expect(ids.indexOf("cup")).toBeGreaterThan(ids.indexOf("rest-7"));
    expect(ids.indexOf("season-2")).toBe(ids.indexOf("cup") + 1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada cosmético se gana en algún lado", () => {
    const won = new Set([...MAIN_QUEST.map((m) => m.reward.cosmetic), ...STAR_REWARDS.map((s) => s.reward.cosmetic)]);
    for (const c of COSMETICS) expect(won.has(c.id), c.id).toBe(true);
  });
});

describe("misiones del día", () => {
  it("tres distintas, iguales para todos ese día, y cambian otro día", () => {
    const a = dailyMissions("2026-10-08");
    expect(a).toHaveLength(3);
    expect(new Set(a.map((m) => m.id)).size).toBe(3);
    expect(dailyMissions("2026-10-08")).toEqual(a);
    const week = new Set(["2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12"].flatMap((d) => dailyMissions(d).map((m) => m.id)));
    expect(week.size).toBeGreaterThan(3);
    for (const m of a) expect(DAILY_POOL).toContain(m);
  });

  it("el día cambia a la medianoche de Argentina", () => {
    expect(dayKey(Date.UTC(2026, 9, 8, 2, 59))).toBe("2026-10-07");
    expect(dayKey(Date.UTC(2026, 9, 8, 3, 0))).toBe("2026-10-08");
  });
});

it("el avance se muestra lindo", () => {
  expect(progressLabel(MAIN_QUEST[0], 0.3)).toBe("0,3 / 0,5 m");
  expect(progressLabel(MAIN_QUEST.find((m) => m.id === "chips-10")!, 12)).toBe("10 / 10");
});
