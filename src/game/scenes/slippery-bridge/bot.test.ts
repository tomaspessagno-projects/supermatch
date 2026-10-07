import { describe, expect, it } from "vitest";
import { BOT_SKILLS, createBot, projectedScore, stepBot } from "./bot";
import { LEVEL } from "./level";
import { createWorld, finalScore } from "./sim";
import { SERVER_LIMITS } from "./tuning";

function race(skill: keyof typeof BOT_SKILLS, seed: number) {
  const world = createWorld(LEVEL);
  const bot = createBot(BOT_SKILLS[skill], seed);
  while (world.outcome === null) stepBot(world, bot);
  return world;
}

const SEEDS = [1, 2, 3, 4, 5, 6];

describe("rivales", () => {
  it("son deterministas: misma semilla, misma carrera", () => {
    const a = race("average", 42);
    const b = race("average", 42);
    expect(a.endedAt).toBe(b.endedAt);
    expect(a.falls).toBe(b.falls);
    expect(finalScore(a)).toBe(finalScore(b));
  });

  it("el as casi siempre llega a la meta, pero no es perfecto", () => {
    const runs = SEEDS.map((seed) => race("ace", seed));
    const finished = runs.filter((w) => w.outcome === "finished").length;
    console.info(`as: llega ${finished}/${SEEDS.length}, caídas ${runs.map((w) => w.falls).join(",")}`);
    expect(finished).toBeGreaterThanOrEqual(SEEDS.length - 1);
  });

  it("el torpe se cae bastante más que el as", () => {
    const falls = (skill: keyof typeof BOT_SKILLS) =>
      SEEDS.map((seed) => race(skill, seed).falls).reduce((a, b) => a + b, 0);
    const ace = falls("ace");
    const clumsy = falls("clumsy");
    console.info(`caídas totales: as ${ace}, torpe ${clumsy}`);
    expect(clumsy).toBeGreaterThan(ace + SEEDS.length);
  });

  it("dejan lugar para ganarles: el promedio y el torpe sacan menos que alguien que cruza con una caída", () => {
    const seeds = Array.from({ length: 12 }, (_, i) => i + 1);
    const mean = (skill: keyof typeof BOT_SKILLS) =>
      seeds.map((seed) => finalScore(race(skill, seed))).reduce((a, b) => a + b, 0) / seeds.length;
    const [ace, average, clumsy] = [mean("ace"), mean("average"), mean("clumsy")];
    console.info(`puntaje medio: as ${ace.toFixed(0)}, promedio ${average.toFixed(0)}, torpe ${clumsy.toFixed(0)}`);
    // Persona que llega en 30 s: 600 + 150 + 250·(1 − 30/45) ≈ 833.
    expect(average).toBeLessThan(833);
    expect(clumsy).toBeLessThan(average - 150);
    expect(ace).toBeGreaterThan(average);
  });

  it("el puntaje proyectado respeta el tope y crece con el avance", () => {
    const world = createWorld(LEVEL);
    const bot = createBot(BOT_SKILLS.average, 7);
    let last = 0;
    for (let i = 0; i < 120 * 10; i++) {
      stepBot(world, bot);
      if (i % 120 === 0) {
        const score = projectedScore(world);
        expect(score).toBeLessThanOrEqual(SERVER_LIMITS.maxScore);
        expect(score).toBeGreaterThanOrEqual(0);
        last = score;
      }
    }
    expect(last).toBeGreaterThan(0);
  });
});
