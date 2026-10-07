import { describe, expect, it } from "vitest";
import { wrapDegrees } from "../../engine/physics";
import { LEVEL, type Level } from "./level";
import {
  createWorld,
  finalScore,
  type SimEvent,
  type SimInput,
  step,
  type World,
} from "./sim";
import { SERVER_LIMITS, TUNING } from "./tuning";

const DT = 1 / 120;
const IDLE: SimInput = { move: 0, jumpPressed: false };
const RIGHT: SimInput = { move: 1, jumpPressed: false };
const FLAT: Level = { ...LEVEL, finishX: 1e6, puddles: [], rollers: [] };

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
  it("correr sin saltar termina en el primer charco", () => {
    const world = createWorld(LEVEL);
    runUntil(world, () => RIGHT, (w) => w.outcome !== null);
    expect(world.outcome).toBe("drowned");
    expect(world.player.x).toBeGreaterThan(LEVEL.puddles[0].x0);
    expect(world.player.x).toBeLessThan(LEVEL.puddles[0].x1);
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
    expect(finalScore(world)).toBeLessThanOrEqual(SERVER_LIMITS.maxScore);
  });

  it.each(LEVEL.rollers.map((r) => [r.x, r] as const))(
    "rodillo en x=%i a toda velocidad: si seguís apretando te salvás, si soltás, al agua",
    (_, roller) => {
      const outcome = (keepPushing: boolean) => {
        // Busca un instante en que el rodillo esté abajo para forzar el choque.
        for (let t0 = 0; t0 < roller.period; t0 += 0.05) {
          const world = createWorld(LEVEL);
          world.time = t0;
          Object.assign(world.player, { x: roller.x - 600, vx: TUNING.maxRunSpeed });
          let bonked = false;
          let frontal = false;
          runUntil(world, () => ({ move: !bonked || keepPushing ? 1 : 0, jumpPressed: false }), (w, events) => {
            if (!bonked && events.some((e) => e.type === "bonk")) {
              bonked = true;
              frontal = w.player.vx < 0; // si le cayó encima, lo despide hacia adelante
            }
            return w.outcome !== null || (bonked && (!frontal || w.player.vx > 0)) || w.time > t0 + 6;
          });
          if (frontal) return world.outcome;
        }
        throw new Error("nunca chocó");
      };
      expect(outcome(true)).toBeNull();
      expect(outcome(false)).toBe("drowned");
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
        expect(bonksWithoutControl).toBeLessThanOrEqual(1);
      }
      const score = finalScore(world);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(SERVER_LIMITS.maxScore);
      expect(world.endedAt! * 1000).toBeGreaterThanOrEqual(SERVER_LIMITS.minDurationMs);
    }
  });
});

/**
 * Bot que prueba acciones en una copia del mundo y elige la primera que no
 * termina en golpe ni en charco dentro de un horizonte corto.
 */
function planner(world: World): SimInput {
  const p = world.player;
  if (!p.grounded || p.ragdoll || p.getUp > 0) return RIGHT;

  const jump: SimInput = { move: 1, jumpPressed: true };
  const runningIsSafe = isSafe(world, RIGHT, 0.6);
  if (!runningIsSafe && isSafe(world, jump, 1)) return jump;
  if (runningIsSafe || isSafe(world, RIGHT, 0.2)) return RIGHT;
  if (isSafe(world, IDLE, 0.6)) return IDLE;
  return { move: -1, jumpPressed: false };
}

function isSafe(world: World, first: SimInput, horizon: number): boolean {
  const sim: World = { ...world, player: { ...world.player } };
  for (let t = 0; t < horizon; t += DT) {
    const input = t < 0.1 ? first : { ...RIGHT };
    const events = step(sim, t === 0 ? first : { ...input, jumpPressed: false }, DT);
    if (events.some((e) => e.type === "bonk" || e.type === "splash")) return false;
    if (sim.player.sinking) return false;
    if (sim.outcome === "finished") return true;
  }
  return true;
}

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
