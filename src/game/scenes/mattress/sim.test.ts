import { describe, expect, it } from "vitest";
import type { PlayerInput } from "../../contract";
import { makeScript, STAGE } from "./level";
import { cloneWorld, createWorld, type Jumper, landing, liveScore, mattressOf, type SimEvent, step, type World } from "./sim";
import { SCORING, TUNING } from "./tuning";

const DT = 1 / 120;
const IDLE: PlayerInput = { move: 0, jumpPressed: false };
const HUMANS = [false, false, false, false];
const BOTS = [true, true, true, true];

/** Mundo sin saltadores del guion (para armar situaciones a mano). */
function emptyWorld(round: 1 | 2 | 3 = 1): World {
  const w = createWorld(round, 1, HUMANS);
  w.script = { jumpers: [], balloons: [], rollers: [] };
  return w;
}

function addJumper(w: World, x: number, y: number, vx: number, vy: number): Jumper {
  const j: Jumper = {
    id: w.nextId++, x, y, vx, vy, state: "flying", since: w.time, launchAt: 0,
    golden: false, shirt: 0, aim: 0, bounces: 0, lastPair: -1, spin: 0, spinRate: 0,
  };
  w.jumpers.push(j);
  return j;
}

function runUntil(w: World, done: (events: SimEvent[]) => boolean, inputs: (w: World) => PlayerInput[] = () => [], maxSteps = 120 * 10) {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const events = step(w, inputs(w), DT);
    all.push(...events);
    if (done(events)) break;
  }
  return all;
}

function playRound(round: 1 | 2 | 3, seed: number, bots: readonly boolean[]) {
  const w = createWorld(round, seed, bots);
  while (w.endedAt === null) step(w, [IDLE, IDLE, IDLE, IDLE], DT);
  return w;
}

describe("El Colchón", () => {
  it("es determinista y el clon no comparte nada", () => {
    const a = createWorld(2, 99, [false, true, true, true]);
    const b = createWorld(2, 99, [false, true, true, true]);
    const press = (t: number): PlayerInput[] => [{ move: t % 300 < 150 ? 1 : -1, jumpPressed: t % 97 === 0 }];
    for (let t = 0; t < 120 * 12; t++) {
      step(a, press(t), DT);
      step(b, press(t), DT);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    const copy = cloneWorld(a);
    for (let t = 0; t < 240; t++) step(copy, [{ move: 1, jumpPressed: true }], DT);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // el original no se movió
    expect(copy.time).toBeGreaterThan(a.time);
  });

  it("el guion depende solo de la ronda y la semilla", () => {
    expect(makeScript(1, 5)).toEqual(makeScript(1, 5));
    expect(makeScript(1, 5)).not.toEqual(makeScript(1, 6));
    const [r1, r2, r3] = [makeScript(1, 5), makeScript(2, 5), makeScript(3, 5)];
    expect(r1.balloons).toHaveLength(0);
    expect(r1.rollers).toHaveLength(0);
    expect(r2.balloons.length).toBeGreaterThan(8);
    expect(r3.rollers.length).toBeGreaterThan(4);
    expect(r1.jumpers.every((j) => j.at < TUNING.spawnStop)).toBe(true);
  });

  it("los dos de un colchón se arrastran: no se alejan de más ni salen de su mitad", () => {
    const w = emptyWorld();
    for (let t = 0; t < 120 * 3; t++) step(w, [{ move: 1, jumpPressed: false }], DT);
    const [left, right] = w.holders;
    expect(left.x).toBeGreaterThan(450); // fue para la derecha
    expect(right.x - left.x).toBeLessThanOrEqual(TUNING.maxSpread + 0.01);
    expect(right.x).toBeLessThanOrEqual(STAGE.zones[0].max + 0.01);
    // Uno tira para cada lado: quedan donde están (tironeo).
    const before = (left.x + right.x) / 2;
    for (let t = 0; t < 120; t++) step(w, [{ move: -1, jumpPressed: false }, { move: 1, jumpPressed: false }], DT);
    expect(Math.abs((w.holders[0].x + w.holders[1].x) / 2 - before)).toBeLessThan(40);
  });

  it("un rebote en el medio del primer colchón lo manda al segundo", () => {
    const w = emptyWorld();
    const m = mattressOf(w, 0);
    const j = addJumper(w, (m.lx + m.rx) / 2, 300, 0, 200);
    const events = runUntil(w, (e) => e.some((x) => x.type === "bounce"));
    expect(events.find((e) => e.type === "bounce")).toMatchObject({ pair: 0, super: false });
    const at = landing(j, mattressOf(w, 1).ly)!;
    const center = (STAGE.zones[1].min + STAGE.zones[1].max) / 2;
    expect(Math.abs(at.x - center)).toBeLessThan(25);
    expect(liveScore(w)).toBe(SCORING.bounce);
  });

  it("del segundo colchón va al pelotero y suma la llegada", () => {
    const w = emptyWorld();
    const m = mattressOf(w, 1);
    addJumper(w, (m.lx + m.rx) / 2, 300, 0, 200);
    const events = runUntil(w, (e) => e.some((x) => x.type === "deliver" || x.type === "splash"));
    expect(events.some((e) => e.type === "deliver")).toBe(true);
    expect(w.stats.delivered).toBe(1);
    expect(liveScore(w)).toBe(SCORING.bounce + SCORING.deliver);
  });

  it("si los dos saltan juntos justo antes, súper rebote directo al pelotero", () => {
    const w = emptyWorld();
    const m = mattressOf(w, 0);
    addJumper(w, (m.lx + m.rx) / 2, 330, 0, 300);
    let jumped = false;
    const events = runUntil(
      w,
      (e) => e.some((x) => x.type === "deliver" || x.type === "splash"),
      (world) => {
        const j = world.jumpers[0];
        // Saltan los dos cuando falta poco para que caiga.
        const soon = j.state === "flying" && j.lastPair === -1 && (landing(j, mattressOf(world, 0).ly)?.t ?? 1) < 0.12;
        const press = soon && !jumped;
        if (press) jumped = true;
        return [{ move: 0, jumpPressed: press }, { move: 0, jumpPressed: press }];
      },
    );
    expect(events.some((e) => e.type === "pump")).toBe(true);
    expect(events.find((e) => e.type === "bounce")).toMatchObject({ pair: 0, super: true });
    expect(events.find((e) => e.type === "deliver")).toMatchObject({ direct: true });
  });

  it("si salta uno solo, no hay súper rebote", () => {
    const w = emptyWorld();
    const m = mattressOf(w, 0);
    addJumper(w, (m.lx + m.rx) / 2, 330, 0, 300);
    const events = runUntil(
      w,
      (e) => e.some((x) => x.type === "bounce"),
      (world) => [{ move: 0, jumpPressed: (landing(world.jumpers[0], mattressOf(world, 0).ly)?.t ?? 1) < 0.12 }],
    );
    expect(events.some((e) => e.type === "pump")).toBe(false);
    expect(events.find((e) => e.type === "bounce")).toMatchObject({ super: false });
  });

  it("si nadie lo ataja, cae al agua y corta la racha", () => {
    const w = emptyWorld();
    w.stats.streak = 3;
    addJumper(w, 250, 300, 0, 0); // a la izquierda del primer colchón
    const events = runUntil(w, (e) => e.some((x) => x.type === "splash"));
    expect(events.some((e) => e.type === "splash")).toBe(true);
    expect(w.stats).toMatchObject({ missed: 1, streak: 0 });
  });

  it("el rodillo voltea al que no salta, y el que salta a tiempo se salva", () => {
    const w = emptyWorld(3);
    w.rollers.push({ id: 99, x: 700, vx: -250, hit: [] });
    const reach = (w.holders[1].x - 700) / -250; // hasta el portador 1
    const events = runUntil(
      w,
      () => w.rollers.length === 0 || w.rollers[0].x < 250,
      (world) => [IDLE, { move: 0, jumpPressed: Math.abs(world.time - (reach - 0.28)) < DT / 2 }],
    );
    const trips = events.filter((e) => e.type === "trip").map((e) => (e as { holder: number }).holder);
    expect(trips).toContain(0);
    expect(trips).not.toContain(1);
    expect(w.holders[0].stun).toBeGreaterThan(0);
  });

  it("un globo sobre el colchón empapa a los dos (más lentos)", () => {
    const w = emptyWorld(2);
    const m = mattressOf(w, 1);
    w.balloons.push({ id: 50, x: (m.lx + m.rx) / 2, y: 300, vy: 100, burstAt: null });
    const events = runUntil(w, (e) => e.some((x) => x.type === "burst"));
    expect(events.find((e) => e.type === "burst")).toMatchObject({ pair: 1 });
    expect(w.holders[2].soak).toBeGreaterThan(1);
    expect(w.holders[3].soak).toBeGreaterThan(1);
    const x = w.holders[2].x;
    for (let t = 0; t < 60; t++) step(w, [IDLE, IDLE, { move: -1, jumpPressed: false }, { move: -1, jumpPressed: false }], DT);
    expect(x - w.holders[2].x).toBeLessThan(TUNING.walkSpeed * 0.5 * TUNING.soakSpeed + 10);
  });

  it("un equipo de bots ataja mucho más que nadie moviéndose", () => {
    for (const round of [1, 2, 3] as const) {
      for (const seed of [11, 22, 33]) {
        const bots = playRound(round, seed, BOTS);
        const idle = playRound(round, seed, HUMANS);
        expect(liveScore(bots)).toBeGreaterThan(liveScore(idle) + 150);
        expect(liveScore(bots)).toBeLessThanOrEqual(SCORING.max);
        expect(bots.stats.delivered).toBeGreaterThan(bots.stats.missed);
      }
    }
  });

  it("la ronda termina a los 40 s", () => {
    const w = playRound(1, 3, BOTS);
    expect(w.endedAt).toBeCloseTo(TUNING.duration, 1);
  });
});
