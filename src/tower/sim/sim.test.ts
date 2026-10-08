import { describe, expect, it } from "vitest";
import { makeItem } from "./items";
import { type Block, type BlockKind, blinkOn, buildTower, cannonBall, centerOf, geyserOn, type Mover, moverBox, type Tower, windBlowing } from "./level";
import { jumpHeight, NO_UPGRADES, statsFor, type Stats } from "./progression";
import {
  blockOf,
  createWorld,
  IDLE_INPUT,
  type Modifier,
  type PlayerInput,
  RECORD_FAME_PER_M,
  REST_REFILL,
  type SimEvent,
  solidNow,
  step,
  TOP_BONUS,
  type World,
} from "./sim";
import { TUNING } from "./tuning";

const DT = 1 / 120;
const tower = buildTower();
const base = statsFor(NO_UPGRADES);

function world(stats: Stats = base, t: Tower = tower, record = 0, highestRest = -1, modifier: Modifier | null = null): World {
  return createWorld(t, stats, { record, highestRest }, 1, modifier);
}

/** Lo pone parado sobre un bloque (en el centro, o corrido). */
function standOn(w: World, b: Block, dx = 0, dz = 0) {
  const c = centerOf(b);
  Object.assign(w.player, { x: c.x + dx, y: b.maxY, z: c.z + dz, vx: 0, vy: 0, vz: 0, grounded: true, ground: b.kind, on: b.id, riding: null, safe: false });
  w.energy = 999;
}

/** Lo deja caer sobre un bloque desde un poco más arriba. */
function dropOn(w: World, b: Block, height = 1) {
  standOn(w, b);
  Object.assign(w.player, { y: b.maxY + height, grounded: false, on: null });
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

const pathBlock = (i: number) => blockOf(tower, tower.path[i].id)!;
const firstOf = (kind: BlockKind) => tower.blocks.find((b) => b.kind === kind)!;
const moverOf = (kind: Mover["kind"]) => tower.movers.find((m) => m.kind === kind)!;
const press = (jump = true): PlayerInput => ({ ...IDLE_INPUT, jumpPressed: jump });
const hold = (moveX: number, moveZ: number, jumpPressed = false): PlayerInput => ({ moveX, moveZ, jumpPressed, jumpHeld: false });

describe("La Torre: moverse", () => {
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

  it("la fachada no se atraviesa", () => {
    const near = tower.path.map((s) => blockOf(tower, s.id)).find((b) => b && b.kind === "normal" && b.minZ < 0.6)!;
    const w = world();
    standOn(w, near);
    run(w, 1, () => hold(0, -1));
    expect(w.player.z - TUNING.playerRadius).toBeGreaterThanOrEqual(tower.wall.maxZ - 0.01);
  });

  it("en el jabón cuesta mucho más frenar", () => {
    const slide = (b: Block) => {
      const w = world();
      standOn(w, b);
      w.player.x = b.minX + 0.4;
      w.player.vx = TUNING.moveSpeed;
      const x0 = w.player.x;
      run(w, 0.3);
      return w.player.x - x0;
    };
    expect(slide(firstOf("soap"))).toBeGreaterThan(slide(pathBlock(2)) * 2);
  });

  it("la cinta te lleva", () => {
    const belt = firstOf("conveyor");
    const w = world();
    standOn(w, belt);
    const x0 = w.player.x;
    run(w, 0.3);
    expect(w.player.x - x0).toBeCloseTo((belt.belt ?? 0) * 0.3, 1);
    expect(w.player.grounded).toBe(true);
  });

  it("la calesita te hace girar", () => {
    const spinner = firstOf("spinner");
    const c = centerOf(spinner);
    const w = world();
    standOn(w, spinner, 0.6, 0);
    run(w, 0.5);
    const angle = Math.atan2(-(w.player.z - c.z), w.player.x - c.x);
    expect(angle).toBeCloseTo((spinner.spin ?? 0) * 0.5, 1);
  });

  it("en la bola roja, si no estás en el medio, te vas para el costado", () => {
    const ball = firstOf("ball");
    const c = centerOf(ball);
    const w = world();
    standOn(w, ball, 0.3, 0);
    run(w, 0.4);
    expect(Math.abs(w.player.x - c.x)).toBeGreaterThan(0.45);
    // En el medio justo se queda.
    const still = world();
    standOn(still, ball);
    run(still, 0.4);
    expect(Math.abs(still.player.x - c.x)).toBeLessThan(0.01);
  });

  it("la burbuja te tira para arriba", () => {
    const w = world();
    dropOn(w, firstOf("bubble"));
    const events = run(w, 1, undefined, (e) => e.some((x) => x.type === "bounce"));
    expect(events.find((e) => e.type === "bounce")).toMatchObject({ kind: "bubble", big: false });
    expect(w.player.vy).toBeCloseTo(TUNING.bounceSpeed, 0);
  });

  it("la cama elástica rebota, y más si saltás justo al caer", () => {
    const tramp = firstOf("trampoline");
    const plain = world();
    dropOn(plain, tramp);
    run(plain, 1, undefined, (e) => e.some((x) => x.type === "bounce"));
    expect(plain.player.vy).toBeCloseTo(TUNING.trampolineSpeed, 0);
    const timed = world();
    dropOn(timed, tramp, 0.3);
    const events = run(timed, 1, (x) => press(x.player.vy < 0), (e) => e.some((x) => x.type === "bounce"));
    expect(events.find((e) => e.type === "bounce")).toMatchObject({ kind: "trampoline", big: true });
    expect(timed.player.vy).toBeCloseTo(TUNING.trampolineSpeed * TUNING.superBounce, 0);
  });

  it("la que se desinfla aguanta un ratito, te deja caer y vuelve a inflarse", () => {
    const soft = firstOf("crumble");
    const w = world();
    standOn(w, soft);
    const events = run(w, TUNING.crumbleDelay + 0.3);
    expect(events.some((e) => e.type === "deflate")).toBe(true);
    expect(solidNow(w, soft)).toBe(false);
    expect(w.player.y).toBeLessThan(soft.maxY - 0.1);
    w.time += TUNING.crumbleDown;
    expect(solidNow(w, soft)).toBe(true);
  });

  it("la parpadeante, cuando se apaga, no te sostiene", () => {
    const blink = firstOf("blink");
    const w = world();
    let t = 0;
    while (blinkOn(blink, t)) t += 0.01;
    w.time = t;
    standOn(w, blink);
    run(w, 0.1);
    expect(w.player.grounded).toBe(false);
    expect(w.player.y).toBeLessThan(blink.maxY);
  });

  it("la nube te lleva", () => {
    const cloud = moverOf("cloud");
    const w = world();
    const b = moverBox(cloud, 0);
    Object.assign(w.player, { x: (b.minX + b.maxX) / 2, y: b.maxY, z: (b.minZ + b.maxZ) / 2, grounded: true, ground: "cloud", riding: cloud.id, safe: false });
    w.energy = 999;
    const start = { x: w.player.x, z: w.player.z };
    run(w, cloud.period / 4);
    expect(Math.hypot(w.player.x - start.x, w.player.z - start.z)).toBeGreaterThan(0.3);
    expect(w.player.grounded).toBe(true);
  });

  it("el ventilador empuja cuando sopla; parado da tiempo a reaccionar", () => {
    const wind = tower.winds[0];
    let t = 0;
    while (!windBlowing(wind, t) || Math.sin((t / wind.period) * Math.PI * 2 + wind.phase) <= 0.5) t += 0.01;
    const air = world();
    air.time = t;
    Object.assign(air.player, { x: (wind.minX + wind.maxX) / 2, y: wind.minY + 0.5, z: (wind.minZ + wind.maxZ) / 2, grounded: false, safe: false });
    air.energy = 999;
    run(air, 0.1);
    expect(air.player.vx * wind.dirX + air.player.vz * wind.dirZ).toBeGreaterThan(0.5);
    const cx = (wind.minX + wind.maxX) / 2;
    const cz = (wind.minZ + wind.maxZ) / 2;
    const under = tower.blocks.find((b) => b.maxY > wind.minY && b.maxY < wind.maxY && cx > b.minX && cx < b.maxX && cz > b.minZ && cz < b.maxZ)!;
    const still = world();
    still.time = t;
    standOn(still, under);
    run(still, 0.5);
    expect(still.player.grounded && still.player.y).toBe(under.maxY);
  });

  it("el géiser te sube", () => {
    const g = tower.geysers[0];
    const pad = tower.blocks.find((b) => Math.abs(b.maxY - g.minY) < 0.01 && (g.minX + g.maxX) / 2 > b.minX && (g.minX + g.maxX) / 2 < b.maxX)!;
    let t = 0;
    while (!geyserOn(g, t)) t += 0.01;
    const w = world();
    w.time = t;
    standOn(w, pad);
    const events = run(w, 0.4);
    expect(events.some((e) => e.type === "lift")).toBe(true);
    expect(w.player.y).toBeGreaterThan(pad.maxY + 2.5);
  });

  it("la red se trepa apretando hacia la pared, y arriba te subís solo", () => {
    const net = tower.nets[0];
    const pillar = blockOf(tower, net.pillar)!;
    const w = world();
    Object.assign(w.player, { x: (net.minX + net.maxX) / 2, y: net.minY + 0.1, z: pillar.maxZ + TUNING.playerRadius + 0.05, grounded: true, ground: "normal", safe: false });
    w.energy = 999;
    const events = run(w, 4, () => hold(0, -1), () => w.player.grounded && w.player.y === pillar.maxY);
    expect(events.some((e) => e.type === "climb")).toBe(true);
    expect(events.some((e) => e.type === "mantle")).toBe(true);
    expect(w.player.ground).toBe("pillar");
    expect(w.player.y).toBe(pillar.maxY);
  });

  it("de la red te soltás saltando para atrás (y trepar cansa más)", () => {
    const net = tower.nets[0];
    const pillar = blockOf(tower, net.pillar)!;
    const w = world();
    Object.assign(w.player, { x: (net.minX + net.maxX) / 2, y: net.minY + 1, z: pillar.maxZ + TUNING.playerRadius + 0.05, grounded: false, safe: false });
    w.energy = 50;
    run(w, 0.5, () => hold(0, -1));
    expect(w.player.climbing).toBe(true);
    expect(50 - w.energy).toBeCloseTo((TUNING.drainPerSecond + TUNING.climbDrain) * 0.5, 1);
    run(w, DT, () => hold(0, -1, true));
    expect(w.player.climbing).toBe(false);
    expect(w.player.vz).toBeGreaterThan(3);
    run(w, 0.2, () => hold(0, -1));
    expect(w.player.climbing).toBe(false);
  });
});

describe("La Torre: lo que te tira", () => {
  /** Lo pone justo donde está el obstáculo ahora. */
  function inside(m: Mover) {
    const w = world();
    const b = moverBox(m, 0);
    Object.assign(w.player, { x: (b.minX + b.maxX) / 2, y: b.minY - 0.15, z: (b.minZ + b.maxZ) / 2, grounded: true, ground: "normal", safe: false });
    w.energy = 999;
    return w;
  }

  for (const kind of ["sweeper", "hammer"] as const) {
    it(`${kind === "sweeper" ? "la barredora" : "el martillo"} te tira y te deja un rato sin control`, () => {
      const w = inside(moverOf(kind));
      const events = run(w, DT * 2);
      expect(events.find((e) => e.type === "knock")).toMatchObject({ by: kind });
      expect(w.player.stun).toBeGreaterThan(0);
    });
  }

  it("el guante de box te manda para afuera (a la pileta)", () => {
    const piston = moverOf("piston");
    const w = world();
    // El momento en que sale del todo.
    const t = (0.2 - piston.phase + 1) % 1 * piston.period;
    w.time = t;
    const b = moverBox(piston, t);
    Object.assign(w.player, { x: (b.minX + b.maxX) / 2, y: b.minY - 0.1, z: (b.minZ + b.maxZ) / 2, grounded: true, ground: "normal", safe: false });
    w.energy = 999;
    const events = run(w, DT * 2);
    expect(events.find((e) => e.type === "knock")).toMatchObject({ by: "piston" });
    expect(w.player.vz).toBeGreaterThan(TUNING.pistonKnock * 0.9);
  });

  it("la pelota del cañón te tira para donde va", () => {
    const c = tower.cannons[0];
    let t = 0;
    let ball = cannonBall(c, t);
    while (!ball || Math.hypot(ball.x - c.x, ball.z - c.z) < 2) {
      t += 0.01;
      ball = cannonBall(c, t);
    }
    const w = world();
    w.time = t - DT;
    Object.assign(w.player, { x: ball.x, y: ball.y - 0.8, z: ball.z, grounded: false, safe: false });
    w.energy = 999;
    const events = run(w, DT * 2);
    expect(events.find((e) => e.type === "knock")).toMatchObject({ by: "cannon" });
    expect(w.player.vz).toBeGreaterThan(TUNING.knockSpeed * 0.9);
  });
});

describe("La Torre: un intento", () => {
  it("la energía se gasta arriba; sin energía te resbalás a la pileta y se cobra", () => {
    const w = world();
    standOn(w, pathBlock(6));
    w.energy = base.energy;
    const z0 = w.player.z;
    const events = run(w, 90, undefined, (e) => e.some((x) => x.type === "splash"));
    const types = events.map((e) => e.type);
    expect(types).toContain("exhausted");
    expect(types).toContain("slip");
    expect(w.player.z).toBeGreaterThan(z0);
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
    w.energy = 1;
    const events = run(w, 60, undefined, (e) => e.some((x) => x.type === "splash"));
    const splash = events.find((e) => e.type === "splash") as Extract<SimEvent, { type: "splash" }>;
    expect(splash.summary.record).toBe(false);
    expect(splash.summary.recordFame).toBe(0);
  });

  it("fichas y objetos; la mochila tiene lugar limitado", () => {
    const w = world();
    const spot = tower.spots.find((s) => s.ledge)!;
    for (let i = 0; i < base.bag; i++) w.run.bag.push(makeItem("duck", "none", 0));
    w.run.contents[spot.id] = { kind: "item", item: makeItem("mic", "gold", 1) };
    Object.assign(w.player, { x: spot.x, y: spot.y - 0.8, z: spot.z, grounded: true, ground: "ledge", safe: false });
    w.energy = 999;
    expect(run(w, 0.05).some((e) => e.type === "bagFull")).toBe(true);
    w.run.bag.pop();
    expect(run(w, 0.05).find((e) => e.type === "item")).toMatchObject({ item: { def: "mic", mutation: "gold" } });

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
      Object.assign(w.player, { x: chipSpot.x + 1.8, y: chipSpot.y - 0.8, z: chipSpot.z, grounded: true, ground: "normal", safe: false });
      w.energy = 999;
      run(w, 0.05);
      return w.run.chips;
    };
    expect(reach(base)).toBe(0);
    expect(reach(statsFor({ ...NO_UPGRADES, magnet: 2 }))).toBe(1);
  });

  it("el descanso recarga una vez y desbloquea el ascensor", () => {
    const rest = tower.blocks.find((b) => b.kind === "rest" && b.maxY === tower.rests[0])!;
    const w = world();
    dropOn(w, rest, 0.3);
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
      return { events: run(w, 0.1), w };
    };
    expect(ride(base).events.some((e) => e.type === "elevator")).toBe(false);
    const { events, w } = ride(statsFor({ ...NO_UPGRADES, elevator: 1 }));
    expect(events.find((e) => e.type === "elevator")).toMatchObject({ floor: 1 });
    expect(w.player.y).toBeCloseTo(tower.rests[1], 1);
  });

  it("llegar a la cima da la Copa", () => {
    const goal = firstOf("goal");
    const w = world(base, tower, 70, 4);
    dropOn(w, goal, 0.2);
    w.run.startY = 60;
    const events = run(w, 0.3);
    expect(events.some((e) => e.type === "top")).toBe(true);
    expect(w.run.bag.map((i) => i.def)).toContain("cup");
    w.player.y = -5;
    const splash = run(w, DT).find((e) => e.type === "splash") as Extract<SimEvent, { type: "splash" }>;
    expect(splash.summary.itemsFame).toBeGreaterThanOrEqual(TOP_BONUS);
  });

  it("es determinista: mismas teclas, mismo intento", () => {
    const a = world();
    const b = world();
    const input = (w: World): PlayerInput => ({ moveX: Math.sign(Math.sin(w.time)) || 1, moveZ: Math.cos(w.time * 0.7), jumpPressed: Math.floor(w.time * 3) % 2 === 0, jumpHeld: false });
    run(a, 8, input);
    run(b, 8, input);
    expect(JSON.stringify(a.player)).toBe(JSON.stringify(b.player));
    expect(a.run.contents).toEqual(b.run.contents);
  });
});

describe("La Torre: eventos, mascotas y temporadas", () => {
  /** Cobra un intento armado a mano: 10 m subidos y 4 fichas, sin récord. */
  function cash(stats: Stats, modifier: Modifier | null = null) {
    const w = world(stats, tower, 99, -1, modifier);
    w.run.maxY = 10;
    w.run.chips = 4;
    w.player.y = -5;
    const splash = run(w, DT).find((e) => e.type === "splash") as Extract<SimEvent, { type: "splash" }>;
    return splash.summary;
  }

  it("fama doble y temporadas multiplican lo que se cobra", () => {
    expect(cash(base).total).toBe(14);
    expect(cash(base, "fame2")).toMatchObject({ bonusFame: 14, total: 28 });
    expect(cash(statsFor(NO_UPGRADES, null, 1)).total).toBe(21);
    expect(cash(statsFor(NO_UPGRADES, "dragon", 0)).total).toBe(21);
  });

  it("fichas dobles y el patito hacen valer más las fichas", () => {
    const chipSpot = tower.spots.find((s) => !s.ledge)!;
    const grab = (stats: Stats, modifier: Modifier | null) => {
      const w = world(stats, tower, 0, -1, modifier);
      w.run.contents = { [chipSpot.id]: { kind: "chip", value: 2 } };
      Object.assign(w.player, { x: chipSpot.x, y: chipSpot.y - 0.8, z: chipSpot.z, grounded: true, ground: "normal", safe: false });
      w.energy = 999;
      run(w, 0.05);
      return w.run.chips;
    };
    expect(grab(base, null)).toBe(2);
    expect(grab(base, "chips2")).toBe(4);
    expect(grab(statsFor(NO_UPGRADES, "duck"), null)).toBe(3);
  });

  it("con gravedad lunar se salta más alto", () => {
    const w = world(base, tower, 0, -1, "lowgrav");
    let top = 0;
    run(w, 1.5, (x) => press(x.time < DT * 1.5), () => {
      top = Math.max(top, w.player.y);
      return false;
    });
    expect(top).toBeGreaterThan(jumpHeight(base.jumpSpeed) * 1.3);
  });

  it("con lluvia de regalos todas las cornisas tienen premio", () => {
    const w = world(base, tower, 0, -1, "gifts");
    for (const spot of tower.spots.filter((s) => s.ledge)) expect(w.run.contents[spot.id]?.kind).toBe("item");
  });

  it("la nubecita hace gastar menos energía", () => {
    const drain = (stats: Stats) => {
      const w = world(stats);
      standOn(w, pathBlock(5));
      w.energy = 20;
      run(w, 2);
      return 20 - w.energy;
    };
    expect(drain(statsFor(NO_UPGRADES, "cloud"))).toBeCloseTo(drain(base) * 0.75, 2);
  });
});
