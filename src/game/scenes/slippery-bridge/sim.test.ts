import { describe, expect, it } from "vitest";
import { wrapDegrees } from "../../engine/physics";
import { plan as planner } from "./bot";
import { CANNON_WARNING, hammerHead, LEVEL, type Level, puddleAt, trampolineAt } from "./level";
import {
  createWorld,
  finalScore,
  liveScore,
  type SimEvent,
  type SimInput,
  step,
  type World,
} from "./sim";
import { SCORING, SERVER_LIMITS, TUNING } from "./tuning";

const DT = 1 / 120;
const IDLE: SimInput = { move: 0, jumpPressed: false };
const RIGHT: SimInput = { move: 1, jumpPressed: false };
const FLAT: Level = {
  ...LEVEL,
  finishX: 1e6,
  puddles: [],
  rollers: [],
  trampolines: [],
  conveyors: [],
  hammers: [],
  cannons: [],
  pompas: [],
};
const has = (events: SimEvent[], type: SimEvent["type"]) => events.some((e) => e.type === type);

function runFor(world: World, input: SimInput, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let t = 0; t < seconds; t += DT) events.push(...step(world, input, DT));
  return events;
}

function runUntil(
  world: World,
  policy: (w: World) => SimInput,
  done: (w: World, events: SimEvent[]) => boolean,
  maxSeconds = 60,
) {
  for (let t = 0; t < maxSeconds; t += DT) {
    const events = step(world, policy(world), DT);
    if (done(world, events)) return events;
  }
  throw new Error("la condición nunca se cumplió");
}

function reachTopSpeed(world: World) {
  runUntil(world, () => RIGHT, (w) => w.player.vx >= TUNING.maxRunSpeed - 1);
}

describe("Puente Resbaladizo · feel", () => {
  it("resbala: al soltar a tope conserva más del 90 % de la velocidad 1 s después", () => {
    const world = createWorld(FLAT);
    reachTopSpeed(world);
    runFor(world, IDLE, 1);
    expect(world.player.vx).toBeGreaterThan(0.9 * TUNING.maxRunSpeed);
  });

  it("frena mal: desde velocidad máxima tarda más de 0,8 s en frenar", () => {
    const world = createWorld(FLAT);
    reachTopSpeed(world);
    const start = world.time;
    runUntil(world, () => ({ move: -1, jumpPressed: false }), (w) => w.player.vx <= 0);
    expect(world.time - start).toBeGreaterThan(0.8);
  });

  it("salto: el pico supera a los rodillos apoyados en el piso", () => {
    const world = createWorld(FLAT);
    step(world, { move: 0, jumpPressed: true }, DT);
    let apex = 0;
    runUntil(world, () => IDLE, (w) => {
      apex = Math.max(apex, FLAT.floorY - w.player.y);
      return w.player.grounded;
    });
    const tallest = Math.max(
      ...LEVEL.rollers.filter((r) => r.bob === 0).map((r) => 2 * r.radius + r.clearance),
    );
    expect(apex).toBeGreaterThan(tallest + 40);
  });

  it("cae de pie: un salto normal aterriza sin rebote y puede volver a saltar", () => {
    const world = createWorld(FLAT);
    step(world, { move: 0, jumpPressed: true }, DT);
    runUntil(world, () => IDLE, (_, events) => events.some((e) => e.type === "land"));
    expect(world.player.grounded).toBe(true);
    expect(step(world, { move: 0, jumpPressed: true }, DT)).toContainEqual({ type: "jump" });
  });

  it("goma: en ragdoll el cuerpo rebota contra el piso", () => {
    const world = createWorld(FLAT);
    Object.assign(world.player, { y: FLAT.floorY - 400, grounded: false, ragdoll: true });
    runUntil(world, () => IDLE, (_, events) => events.some((e) => e.type === "land"));
    expect(world.player.vy).toBeLessThan(0);
    expect(world.player.grounded).toBe(false);
  });

  it("rodillo: despide hacia atrás con fuerza desmedida y deja sin control", () => {
    const roller = { x: 1500, radius: 42, clearance: 0, bob: 0, period: 1, phase: 0 };
    const world = createWorld({ ...FLAT, rollers: [roller] });
    runUntil(world, () => RIGHT, (_, events) => events.some((e) => e.type === "bonk"));

    const bonkX = world.player.x;
    expect(world.player.vx).toBeLessThanOrEqual(-TUNING.knockbackBase);
    expect(world.player.ragdoll).toBe(true);

    // Aunque siga apretando para adelante, sale volando para atrás y da vueltas.
    let maxSpin = 0;
    runUntil(world, () => RIGHT, (w) => {
      maxSpin = Math.max(maxSpin, Math.abs(w.player.lean));
      return w.player.grounded;
    });
    expect(world.player.x).toBeLessThan(bonkX - 250);
    expect(maxSpin).toBeGreaterThan(180);
  });

  it("ragdoll falso: después de dar vueltas se endereza", () => {
    const roller = { x: 1500, radius: 42, clearance: 0, bob: 0, period: 1, phase: 0 };
    const world = createWorld({ ...FLAT, wallX: -1e6, rollers: [roller] });
    runUntil(world, () => RIGHT, (_, events) => events.some((e) => e.type === "bonk"));
    runFor(world, IDLE, 3);
    expect(Math.abs(wrapDegrees(world.player.lean))).toBeLessThan(TUNING.maxLean);
    expect(Math.abs(world.player.leanVel)).toBeLessThan(30);
  });
});

describe("Puente Resbaladizo · reglas", () => {
  it("caer al agua no termina la prueba: vuelve a la última bandera", () => {
    const world = createWorld(LEVEL);
    runUntil(world, () => RIGHT, (_, events) => events.some((e) => e.type === "splash"));
    expect(world.outcome).toBeNull();
    expect(world.falls).toBe(1);
    expect(world.player.x).toBeGreaterThan(LEVEL.puddles[0].x0);
    expect(world.player.x).toBeLessThan(LEVEL.puddles[0].x1);

    const splashAt = world.time;
    runUntil(world, () => IDLE, (_, events) => events.some((e) => e.type === "respawn"));
    expect(world.time - splashAt).toBeCloseTo(TUNING.respawnDelay, 1);
    expect(world.player.x).toBe(LEVEL.checkpoints[0]);
    // Reaparece cayendo sobre la bandera, y aterriza parado.
    expect(world.player.grounded).toBe(false);
    runUntil(world, () => IDLE, (_, events) => has(events, "land"), 1);
    expect(world.player.x).toBe(LEVEL.checkpoints[0]);
    expect(world.player.ragdoll).toBe(false);
  });

  it("pasar una bandera la vuelve el punto de reaparición", () => {
    const world = createWorld({ ...FLAT, finishX: LEVEL.finishX, puddles: [{ x0: 1500, x1: 1650 }] });
    runUntil(world, () => RIGHT, (_, events) => events.some((e) => e.type === "splash"));
    expect(world.checkpoint).toBe(LEVEL.checkpoints[1]);
    runUntil(world, () => IDLE, (_, events) => events.some((e) => e.type === "respawn"));
    expect(world.player.x).toBe(LEVEL.checkpoints[1]);
  });

  it("corriendo sin saltar se cae una y otra vez hasta que se acaba el tiempo", () => {
    const world = createWorld(LEVEL);
    runUntil(world, () => RIGHT, (w) => w.outcome !== null);
    expect(world.outcome).toBe("timeout");
    expect(world.falls).toBeGreaterThan(5);
    expect(finalScore(world)).toBeGreaterThan(0);
  });

  it("sin input se acaba el tiempo y no suma nada", () => {
    const world = createWorld(LEVEL);
    runUntil(world, () => IDLE, (w) => w.outcome !== null);
    expect(world.outcome).toBe("timeout");
    expect(world.endedAt).toBeCloseTo(TUNING.timeLimit, 1);
    expect(finalScore(world)).toBe(0);
  });

  it("el puntaje perfecto teórico no supera el tope del servidor", () => {
    const world = createWorld(LEVEL);
    Object.assign(world, { outcome: "finished", endedAt: 0 });
    world.player.maxX = LEVEL.finishX;
    world.pompas.fill(true);
    expect(finalScore(world)).toBeLessThanOrEqual(SERVER_LIMITS.maxScore);
  });

  it.each([
    ["quieto", { x: 1600, radius: 42, clearance: 0, bob: 0, period: 1, phase: 0 }],
    ["que sube y baja", { x: 1600, radius: 50, clearance: 4, bob: 120, period: 2.4, phase: 0 }],
  ] as const)(
    "rodillo %s a toda velocidad: si seguís apretando te salvás, si soltás, al agua",
    (_, roller) => {
      // El charco está ~1150 px detrás del rodillo.
      const level: Level = { ...FLAT, finishX: 1e6, rollers: [roller], puddles: [{ x0: roller.x - 1350, x1: roller.x - 1150 }] };
      const splashes = (keepPushing: boolean) => {
        // Busca un instante en que el rodillo esté abajo para forzar el choque.
        for (let t0 = 0; t0 < roller.period; t0 += 0.05) {
          const world = createWorld(level);
          world.time = t0;
          Object.assign(world.player, { x: roller.x - 600, vx: TUNING.maxRunSpeed });
          let bonked = false;
          let frontal = false;
          let splashed = false;
          runUntil(world, () => ({ move: !bonked || keepPushing ? 1 : 0, jumpPressed: false }), (w, events) => {
            if (!bonked && events.some((e) => e.type === "bonk")) {
              bonked = true;
              frontal = w.player.vx < 0; // si le cayó encima, lo despide hacia adelante
            }
            splashed ||= events.some((e) => e.type === "splash");
            return splashed || (bonked && (!frontal || w.player.vx > 0)) || w.time > t0 + 6;
          });
          if (frontal) return splashed;
        }
        throw new Error("nunca chocó");
      };
      expect(splashes(true)).toBe(false);
      expect(splashes(false)).toBe(true);
    },
  );

  it("un jugador que planifica cruza el puente", () => {
    const world = createWorld(LEVEL);
    const bonks: number[] = [];
    runUntil(world, planner, (w, events) => {
      if (events.some((e) => e.type === "bonk")) bonks.push(w.time);
      return w.outcome !== null;
    });

    console.info(
      `planner: ${world.outcome} en ${world.endedAt?.toFixed(2)} s, ` +
        `puntaje ${finalScore(world)}, golpes ${bonks.length}`,
    );
    expect(world.outcome).toBe("finished");
    expect(finalScore(world)).toBeGreaterThan(750);
    expect(finalScore(world)).toBeLessThanOrEqual(SERVER_LIMITS.maxScore);
  });

  it("con input aleatorio la física no explota y respeta los límites del servidor", () => {
    const random = mulberry32(1234);
    for (let episode = 0; episode < 40; episode++) {
      const world = createWorld(LEVEL);
      let input: SimInput = RIGHT;
      let bonksWithoutControl = 0;
      while (world.outcome === null) {
        if (random() < 0.05) input = { move: random() < 0.7 ? 1 : random() < 0.5 ? 0 : -1, jumpPressed: false };
        const events = step(world, { ...input, jumpPressed: random() < 0.03 }, DT);
        const p = world.player;
        expect(Number.isFinite(p.x + p.y + p.vx + p.vy + p.lean + p.leanVel)).toBe(true);
        // Sin pinball infinito: siempre se recupera el control entre golpes.
        if (events.some((e) => e.type === "bonk")) bonksWithoutControl++;
        if (!p.ragdoll && p.getUp === 0) bonksWithoutControl = 0;
        // Un golpe en el aire puede encadenar otro (martillo + pelota), pero nunca un pinball.
        expect(bonksWithoutControl).toBeLessThanOrEqual(3);
      }
      const score = finalScore(world);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(SERVER_LIMITS.maxScore);
      expect(world.endedAt! * 1000).toBeGreaterThanOrEqual(SERVER_LIMITS.minDurationMs);
    }
  });
});

describe("Puente v2 · obstáculos", () => {
  it("trampolín: lanza alto y el vuelo siempre se parece, vengas como vengas", () => {
    const pad = { x0: 1000, x1: 1090 };
    const flights = [150, 400, 620].map((speed) => {
      const world = createWorld({ ...FLAT, trampolines: [pad] });
      Object.assign(world.player, { x: 900, vx: speed });
      runUntil(world, () => RIGHT, (_, events) => has(events, "launch"));
      const from = world.player.x;
      let apex = 0;
      runUntil(world, () => RIGHT, (w) => {
        apex = Math.max(apex, FLAT.floorY - w.player.y);
        return w.player.grounded;
      });
      return { apex, distance: world.player.x - from };
    });
    for (const f of flights) {
      expect(f.apex).toBeGreaterThan(400);
      expect(f.distance).toBeGreaterThan(450);
      expect(f.distance).toBeLessThan(650);
    }
  });

  it("los trampolines del nivel aterrizan en piso firme o en otro trampolín (apretando o soltando)", () => {
    for (const pad of LEVEL.trampolines) {
      for (const input of [RIGHT, IDLE]) {
        for (const speed of [250, 450, 620]) {
          const world = createWorld({ ...LEVEL, rollers: [], hammers: [], cannons: [] });
          world.checkpoint = pad.x0 - 100;
          Object.assign(world.player, { x: pad.x0 - 15, vx: speed });
          runUntil(world, () => input, (_, events) => has(events, "launch"));
          const events = runFor(world, input, 3);
          expect(has(events, "splash"), `trampolín en ${pad.x0} a ${speed} px/s`).toBe(false);
        }
      }
    }
  });

  it("cinta de goma: parado te lleva para atrás; corriendo avanzás, pero despacio", () => {
    const belt = { x0: 1000, x1: 3000, speed: -250 };
    const still = createWorld({ ...FLAT, conveyors: [belt] });
    Object.assign(still.player, { x: 1500, vx: 0 });
    runFor(still, IDLE, 0.5);
    expect(still.player.vx).toBeCloseTo(belt.speed, 0);

    const runner = createWorld({ ...FLAT, conveyors: [belt] });
    Object.assign(runner.player, { x: 1500, vx: TUNING.maxRunSpeed });
    runFor(runner, RIGHT, 0.5);
    expect(runner.player.vx).toBeGreaterThan(0);
    expect(runner.player.vx).toBeLessThan(TUNING.maxRunSpeed / 3);
  });

  it("martillo: abajo te barre para el lado al que va; arriba te pasa por encima", () => {
    const hammer = { x: 1500, length: 230, radius: 40, amplitude: 0.85, period: 2.4, phase: 0 };
    // phase 0: en t = 0 pasa por abajo yendo hacia la derecha.
    const hit = createWorld({ ...FLAT, hammers: [hammer] });
    Object.assign(hit.player, { x: hammer.x });
    const events = runFor(hit, IDLE, 0.05);
    expect(events).toContainEqual(expect.objectContaining({ type: "bonk", by: "hammer" }));
    expect(hit.player.vx).toBeGreaterThan(0);

    // Un cuarto de período después está en el extremo, alto: no toca a nadie abajo del eje.
    const safe = createWorld({ ...FLAT, hammers: [hammer] });
    safe.time = hammer.period / 4;
    Object.assign(safe.player, { x: hammer.x });
    expect(has(runFor(safe, IDLE, 0.1), "bonk")).toBe(false);
    // En el extremo la cabeza sube: barre el tablón solo cerca del medio.
    expect(hammerHead(FLAT, hammer, safe.time).y).toBeLessThan(hammerHead(FLAT, hammer, 0).y - 60);
  });

  it("cañón: avisa antes de cada disparo; la pelota te voltea, saltándola pasa por abajo", () => {
    const cannon = { x: 2000, interval: 2.2, phase: 1, range: 800 };
    const world = createWorld({ ...FLAT, cannons: [cannon] });
    Object.assign(world.player, { x: 1600 });
    const at: Partial<Record<SimEvent["type"], number>> = {};
    const events: SimEvent[] = [];
    runUntil(world, () => IDLE, (w, step) => {
      for (const e of step) at[e.type] ??= w.time;
      events.push(...step);
      return w.time > 2.4;
    });
    expect(at.fire! - at.aim!).toBeCloseTo(CANNON_WARNING, 1);
    expect(events).toContainEqual(expect.objectContaining({ type: "bonk", by: "ball" }));

    const jumper = createWorld({ ...FLAT, cannons: [cannon] });
    Object.assign(jumper.player, { x: 1600 });
    // La pelota sale en t = 1 y tarda ~0,85 s en llegar: saltar a los 1,6 s.
    const dodged = runUntil(jumper, (w) => ({ move: 0, jumpPressed: w.time > 1.6 && w.time < 1.61 }), (w) => w.time > 2.4);
    expect(has(dodged, "bonk")).toBe(false);
  });

  it("pompa: suma puntos una sola vez", () => {
    const world = createWorld({ ...FLAT, pompas: [{ x: 1000, y: FLAT.floorY - 40 }] });
    Object.assign(world.player, { x: 900, vx: 300 });
    const events = runFor(world, RIGHT, 1);
    expect(events.filter((e) => e.type === "pompa")).toHaveLength(1);
    world.player.maxX = world.level.startX;
    expect(liveScore(world)).toBe(SCORING.pompaPoints);
  });
});

describe("Puente v2 · diseño del nivel", () => {
  it("las pompas valen 150 en total y todas se pueden alcanzar", () => {
    expect(LEVEL.pompas.length * SCORING.pompaPoints).toBe(150);
    for (const pompa of LEVEL.pompas) {
      const height = LEVEL.floorY - pompa.y;
      // Saltando el cuerpo llega a ~256 px; con un trampolín, a ~520.
      const nearPad = LEVEL.trampolines.some((t) => pompa.x > t.x0 && pompa.x - t.x0 < 700);
      expect(height, `pompa en x=${pompa.x}`).toBeLessThan(nearPad ? 520 : 250);
    }
  });

  it("nunca hay más de 1600 px entre una bandera y la siguiente (o la meta)", () => {
    const flags = [...LEVEL.checkpoints, LEVEL.finishX];
    for (let i = 1; i < flags.length; i++) expect(flags[i] - flags[i - 1]).toBeLessThanOrEqual(1600);
  });

  it("las banderas están en piso firme, lejos de cintas, trampolines, martillos y pelotas", () => {
    for (const x of LEVEL.checkpoints) {
      expect(puddleAt(LEVEL, x), `bandera ${x}`).toBeUndefined();
      expect(trampolineAt(LEVEL, x), `bandera ${x}`).toBeUndefined();
      expect(LEVEL.conveyors.some((c) => x >= c.x0 - 50 && x <= c.x1 + 50), `bandera ${x}`).toBe(false);
      expect(LEVEL.hammers.some((h) => Math.abs(x - h.x) < h.length * Math.sin(h.amplitude) + h.radius + 40)).toBe(false);
      expect(LEVEL.cannons.some((c) => x < c.x && x > c.x - c.range - 40), `bandera ${x}`).toBe(false);
      expect(LEVEL.rollers.some((r) => Math.abs(x - r.x) < 200), `bandera ${x}`).toBe(false);
    }
  });
});

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
