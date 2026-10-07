import { describe, expect, it } from "vitest";
import { BOT_SKILLS, createBot, rivalScore, stepBot } from "./bot";
import { LOG_LEVEL } from "./level";
import { createWorld, score } from "./sim";
import { SCORING, SERVER_LIMITS, TUNING } from "./tuning";

function race(skill: keyof typeof BOT_SKILLS, seed: number) {
  const world = createWorld(LOG_LEVEL);
  const bot = createBot(BOT_SKILLS[skill], seed);
  while (world.outcome === null) stepBot(world, bot);
  return world;
}

const SEEDS = Array.from({ length: 12 }, (_, i) => (i + 1) * 31);

describe("El Tronco Loco: rivales", () => {
  it("son deterministas: misma semilla, misma partida", () => {
    const a = race("average", 7);
    const b = race("average", 7);
    expect([a.endedAt, a.falls, score(a)]).toEqual([b.endedAt, b.falls, score(b)]);
  });

  it(
    "dejan lugar para ganarles: el as gana a veces y ninguno es perfecto",
    { timeout: 60_000 },
    () => {
      const mean = (skill: keyof typeof BOT_SKILLS) => {
        const scores = SEEDS.map((seed) => score(race(skill, seed)));
        return { mean: scores.reduce((a, b) => a + b, 0) / scores.length, best: Math.max(...scores) };
      };
      const [ace, average, clumsy] = [mean("ace"), mean("average"), mean("clumsy")];
      console.info(
        `tronco, puntaje medio: as ${ace.mean.toFixed(0)}, promedio ${average.mean.toFixed(0)}, torpe ${clumsy.mean.toFixed(0)}`,
      );
      // Quien aguanta 40 s y agarra 5 burbujas saca 600 + 125 = 725.
      expect(average.mean).toBeLessThan(725);
      expect(clumsy.mean).toBeLessThan(average.mean - 150);
      expect(ace.mean).toBeGreaterThan(average.mean);
      expect(ace.mean).toBeLessThan(900);
      expect(ace.best).toBeLessThanOrEqual(SERVER_LIMITS.maxScore);
    },
  );

  it("el puntaje de la tabla proyecta lo que iba sacando y respeta el tope", () => {
    const world = createWorld(LOG_LEVEL);
    const bot = createBot(BOT_SKILLS.ace, 3);
    for (let i = 0; i < 120 * 10; i++) stepBot(world, bot);
    const projected = rivalScore(world);
    expect(projected).toBeGreaterThanOrEqual(score(world));
    expect(projected).toBeLessThanOrEqual(SERVER_LIMITS.maxScore);
    // A ese ritmo, en 45 s no supera lo que da estar arriba todo el tiempo más todas las burbujas.
    expect(projected).toBeLessThanOrEqual(TUNING.timeLimit * SCORING.pointsPerSecond + 13 * SCORING.pointsPerBubble);
  });
});
