import { describe, expect, it } from "vitest";
import { makeItem } from "./items";
import { type Block, buildTower, moverBox, type Tower, windBlowing } from "./level";
import { jumpHeight, NO_UPGRADES, statsFor, type Stats } from "./progression";
import { createWorld, IDLE_INPUT, type PlayerInput, RECORD_FAME_PER_M, REST_REFILL, type SimEvent, step, TOP_BONUS, type World } from "./sim";
import { TUNING } from "./tuning";

const DT = 1 / 120;
const tower = buildTower();
const base = statsFor(NO_UPGRADES);

function world(stats: Stats = base, t: Tower = tower, record = 0, highestRest = -1): World {
  return createWorld(t, stats, { record, highestRest });
}

/** Lo pone parado sobre un bloque. */
function standOn(w: World, b: Block, kind = b.kind) {
  Object.assign(w.player, { x: (b.minX + b.maxX) / 2, y: b.maxY, z: (b.minZ + b.maxZ) / 2, vx: 0, vy: 0, vz: 0, grounded: true, ground: kind });
}

function run(w: World, seconds: number, input: (w: World) => PlayerInput = () => IDLE_INPUT, until?: (e: SimEvent[]) => boolean) {
  const all: SimEvent[] = [];
  for (let i = 0; i < seconds / DT; i++) {
    const e = step(w, input(w), DT);
    all.push(...e);
    if (until?.(e)) break;
  }
  return all;
}

const pathBlock = (i: number) => tower.blocks.find((b) => b.id === tower.path[i].id)!;
const press = (jump = true): PlayerInput => ({ ...IDLE_INPUT, jumpPressed: jump });

describe("La Torre: movimiento", () => {
  it("el salto llega a v²/2g (y en la orilla no gasta energía)", () => {
    const w = world();
    let top = 0;
    run(w, 1.2, (x) => press(x.time < DT * 1.5), () => {
      top = Math.max(top, w.player.y);
      return false;
    });
    expect(top).toBeCloseTo(jumpHeight(base.jumpSpeed), 1);
    expect(w.energy).toBe(base.energy);
  });

  it("la columna no se atraviesa", () => {
    const w = world();
    standOn(w, pathBlock(3));
    run(w, 2, (x) => ({ ...IDLE_INPUT, moveX: -x.player.x, moveZ: -x.player.z }));
    expect(Math.hypot(w.player.x, w.player.z)).toBeGreaterThanOrEqual(tower.columnRadius + TUNING.playerRadius - 0.01);
  });

  it("en el jabón cuesta mucho más frenar", () => {
    const soap = tower.blocks.find((b) => b.kind === "soap")!;
    const normal = pathBlock(2);
    const slide = (b: Block) => {
      const w = world();
      standOn(w, b);
      w.player.x = b.minX + 0.4;
      w.player.vx = TUNING.moveSpeed;
      const x0 = w.player.x;
      run(w, 0.3);
      return w.player.x - x0;
    };
    expect(slide(soap)).toBeGreaterThan(slide(normal) * 2);
  });

  it("la burbuja te tira para arriba", () => {
    const bubble = tower.blocks.find((b) => b.kind === "bubble")!;
    const w = world();
    standOn(w, bubble, "normal");
    w.player.y += 1;
    w.player.grounded = false;
    const events = run(w, 1, undefined, (e) => e.some((x) => x.type === "bounce"));
    expect(events.some((e) => e.type === "bounce")).toBe(true);
    expect(w.player.vy).toBeCloseTo(TUNING.bounceSpeed, 0);
  });

  it("la barredora te tira y te deja un rato sin control", () => {
    const sweeper = tower.movers.find((m) => m.kind === "sweeper")!;
    const w = world();
    // Parado justo donde va a pasar.
    const at = moverBox(sweeper, 0);
    Object.assign(w.player, { x: (at.minX + at.maxX) / 2, y: at.minY - 0.15, z: (at.minZ + at.maxZ) / 2, grounded: true, ground: "normal" });
    const events = run(w, 0.1);
    expect(events.some((e) => e.type === "knock")).toBe(true);
    expect(w.player.stun).toBeGreaterThan(0);
  });

  it("la nube te lleva", () => {
    const cloud = tower.movers.find((m) => m.kind === "cloud")!;
    const w = world();
    const b = moverBox(cloud, 0);
    Object.assign(w.player, { x: (b.minX + b.maxX) / 2, y: b.maxY, z: (b.minZ + b.maxZ) / 2, grounded: true, ground: "cloud", riding: cloud.id });
    w.energy = 999;
    const start = { x: w.player.x, z: w.player.z };
    run(w, cloud.period / 4);
    const moved = Math.hypot(w.player.x - start.x, w.player.z - start.z);
    expect(moved).toBeGreaterThan(0.3);
    expect(w.player.grounded).toBe(true);
  });

  it("el viento empuja para afuera cuando sopla", () => {
    const wind = tower.winds[0];
    const w = world();
    // Buscar un momento en que sopla.
    let t = 0;
    while (Math.sin((t / wind.period) * Math.PI * 2 + wind.phase) <= 0.5) t += 0.05;
    w.time = t;
    Object.assign(w.player, { x: (wind.minX + wind.maxX) / 2, y: wind.minY + 0.2, z: (wind.minZ + wind.maxZ) / 2, grounded: false });
    w.energy = 999;
    run(w, 0.1);
    const outward = w.player.vx * wind.dirX + w.player.vz * wind.dirZ;
    expect(outward).toBeGreaterThan(0.5);
  });

  it("parado, el viento da tiempo a reaccionar; caminando para adentro no te tira", () => {
    const wind = tower.winds[0];
    const cx = (wind.minX + wind.maxX) / 2;
    const cz = (wind.minZ + wind.maxZ) / 2;
    const step0 = tower.blocks.find((b) => b.maxY > wind.minY && b.maxY < wind.maxY && cx > b.minX && cx < b.maxX && cz > b.minZ && cz < b.maxZ)!;
    expect(step0).toBeDefined();
    let t = 0;
    while (Math.sin((t / wind.period) * Math.PI * 2 + wind.phase) <= 0.15) t += 0.01;
    // Quieto medio segundo con viento: sigue arriba.
    const still = world();
    still.time = t;
    still.energy = 999;
    standOn(still, step0);
    run(still, 0.5);
    expect(still.player.grounded && still.player.y).toBe(step0.maxY);
    // Toda una ráfaga caminando contra el viento (solo mientras sopla): sigue arriba.
    const brave = world();
    brave.time = t;
    brave.energy = 999;
    standOn(brave, step0);
    const lean = TUNING.windGroundFactor * TUNING.windDrift / TUNING.moveSpeed;
    run(brave, wind.period, (x) => (windBlowing(wind, x.time) ? { ...IDLE_INPUT, moveX: -wind.dirX * lean, moveZ: -wind.dirZ * lean } : IDLE_INPUT));
    expect(brave.player.y).toBe(step0.maxY);
  });
});

describe("La Torre: un intento", () => {
  it("la energía se gasta arriba; sin energía te resbalás, caés y se cobra", () => {
    const w = world();
    standOn(w, pathBlock(6));
    const events = run(w, 60, undefined, (e) => e.some((x) => x.type === "splash"));
    const types = events.map((e) => e.type);
    expect(types).toContain("exhausted");
    expect(types).toContain("slip");
    const splash = events.find((e) => e.type === "splash") as Extract<SimEvent, { type: "splash" }>;
    expect(splash.summary.height).toBeCloseTo(pathBlock(6).maxY, 0);
    expect(splash.summary.record).toBe(true);
    expect(splash.summary.recordFame).toBe(Math.round(splash.summary.height * RECORD_FAME_PER_M));
    expect(w.phase).toBe("splash");
    // Al rato vuelve a la orilla con energía llena y otro intento.
    const back = run(w, TUNING.splashTime + 0.1);
    expect(back.some((e) => e.type === "respawn")).toBe(true);
    expect(w.player.x).toBe(tower.start.x);
    expect(w.energy).toBe(base.energy);
    expect(w.run.number).toBe(1);
  });

  it("sin récord nuevo no hay premio por récord", () => {
    const w = world(base, tower, 50);
    standOn(w, pathBlock(4));
    const events = run(w, 60, undefined, (e) => e.some((x) => x.type === "splash"));
    const splash = events.find((e) => e.type === "splash") as Extract<SimEvent, { type: "splash" }>;
    expect(splash.summary.record).toBe(false);
    expect(splash.summary.recordFame).toBe(0);
  });

  it("fichas y objetos; la mochila tiene lugar limitado", () => {
    const w = world();
    const ledgeSpots = tower.spots.filter((s) => s.ledge);
    // Llenar la mochila y poner un objeto más al alcance.
    for (let i = 0; i < base.bag; i++) w.run.bag.push(makeItem("duck", "none", 0));
    const spot = ledgeSpots[0];
    w.run.contents[spot.id] = { kind: "item", item: makeItem("mic", "gold", 1) };
    Object.assign(w.player, { x: spot.x, y: spot.y - 0.8, z: spot.z, grounded: true, ground: "ledge" });
    w.energy = 999;
    const full = run(w, 0.05);
    expect(full.some((e) => e.type === "bagFull")).toBe(true);
    w.run.bag.pop();
    const picked = run(w, 0.05);
    expect(picked.find((e) => e.type === "item")).toMatchObject({ item: { def: "mic", mutation: "gold" } });

    const chipSpot = tower.spots.find((s) => !s.ledge)!;
    w.run.contents[chipSpot.id] = { kind: "chip", value: 3 };
    Object.assign(w.player, { x: chipSpot.x, y: chipSpot.y - 0.8, z: chipSpot.z });
    run(w, 0.05);
    expect(w.run.chips).toBe(3);
  });

  it("el imán agarra desde más lejos", () => {
    const chipSpot = tower.spots.find((s) => !s.ledge)!;
    const reach = (stats: Stats) => {
      const w = world(stats);
      w.run.contents = { [chipSpot.id]: { kind: "chip", value: 1 } };
      Object.assign(w.player, { x: chipSpot.x + 1.8, y: chipSpot.y - 0.8, z: chipSpot.z, grounded: true, ground: "normal" });
      w.energy = 999;
      run(w, 0.05);
      return w.run.chips;
    };
    expect(reach(base)).toBe(0);
    expect(reach(statsFor({ ...NO_UPGRADES, magnet: 2 }))).toBe(1);
  });

  it("el descanso recarga una vez y desbloquea el ascensor", () => {
    const ring = tower.blocks.find((b) => b.kind === "rest" && b.maxY === 12)!;
    const w = world();
    standOn(w, ring, "normal");
    w.player.y += 0.3;
    w.player.grounded = false;
    w.energy = 5;
    const events = run(w, 0.5);
    expect(events.filter((e) => e.type === "refill")).toHaveLength(1);
    expect(w.energy).toBeGreaterThan(5 + REST_REFILL - 0.5);
    expect(events.find((e) => e.type === "rest")).toMatchObject({ floor: 0, first: true });
    expect(w.progress.highestRest).toBe(0);
  });

  it("el ascensor te sube al último descanso (si lo compraste)", () => {
    const pad = tower.elevator;
    const ride = (stats: Stats) => {
      const w = world(stats, tower, 30, 1);
      Object.assign(w.player, { x: (pad.minX + pad.maxX) / 2, z: (pad.minZ + pad.maxZ) / 2 });
      return run(w, 0.1);
    };
    expect(ride(base).some((e) => e.type === "elevator")).toBe(false);
    const events = ride(statsFor({ ...NO_UPGRADES, elevator: 1 }));
    expect(events.find((e) => e.type === "elevator")).toMatchObject({ floor: 1 });
  });

  it("llegar a la cima da la Copa", () => {
    const goal = tower.blocks.find((b) => b.kind === "goal")!;
    const w = world(base, tower, 70, 4);
    standOn(w, goal, "normal");
    w.player.y += 0.2;
    w.player.grounded = false;
    w.run.startY = 60;
    const events = run(w, 0.3);
    expect(events.some((e) => e.type === "top")).toBe(true);
    expect(w.run.bag.map((i) => i.def)).toContain("cup");
    // Se cobra con el bonus.
    w.player.y = -5;
    const splash = run(w, DT).find((e) => e.type === "splash") as Extract<SimEvent, { type: "splash" }>;
    expect(splash.summary.itemsFame).toBeGreaterThanOrEqual(TOP_BONUS);
  });

  it("es determinista: mismas teclas, mismo intento", () => {
    const a = world();
    const b = world();
    const input = (w: World): PlayerInput => ({ moveX: Math.sign(Math.sin(w.time)), moveZ: 1, jumpPressed: Math.floor(w.time * 3) % 2 === 0, jumpHeld: false });
    run(a, 6, input);
    run(b, 6, input);
    expect(JSON.stringify(a.player)).toBe(JSON.stringify(b.player));
    expect(a.run.contents).toEqual(b.run.contents);
  });
});
