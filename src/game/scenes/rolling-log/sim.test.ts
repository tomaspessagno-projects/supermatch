import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../engine/random";
import { balanceMove, plan } from "./bot";
import { LOG_LEVEL, type LogLevel, type Shot } from "./level";
import { createWorld, type SimEvent, type SimInput, score, step, type World } from "./sim";
import { SCORING, SERVER_LIMITS, TUNING } from "./tuning";

const DT = 1 / 120;
const IDLE: SimInput = { move: 0, jumpPressed: false };

/** Nivel sin pelotas ni burbujas, con el tronco a velocidad fija. */
const quiet = (omega: number, extra: Partial<LogLevel> = {}): LogLevel => ({
  ...LOG_LEVEL,
  shots: [],
  bubbles: [],
  spin: [{ at: 0, omega }],
  ...extra,
});

function run(world: World, seconds: number, control: (w: World) => SimInput = () => IDLE) {
  const events: SimEvent[] = [];
  const end = world.time + seconds;
  while (world.time < end - 1e-9) events.push(...step(world, control(world), DT));
  return events;
}

const balancing = (w: World): SimInput => ({ move: balanceMove(w), jumpPressed: false });
const types = (events: SimEvent[]) => events.map((e) => e.type);

describe("El Tronco Loco: el tronco", () => {
  it("con el tronco quieto, parado en la cima no pasa nada", () => {
    const world = createWorld(quiet(0));
    run(world, 10);
    expect(world.falls).toBe(0);
    expect(world.player.x).toBeCloseTo(LOG_LEVEL.center.x, 3);
  });

  it("si gira y no hacés nada, la corteza te lleva al agua en un par de segundos", () => {
    for (const omega of [0.5, -0.9, 1.5]) {
      const world = createWorld(quiet(omega));
      const events = run(world, 3);
      expect(types(events)).toContain("slip");
      expect(world.falls).toBe(1);
      // Te caés para el lado al que gira la cima.
      const slip = events.find((e) => e.type === "slip") as { x: number };
      expect(Math.sign(slip.x - LOG_LEVEL.center.x)).toBe(Math.sign(omega));
    }
  });

  it("corriendo en contra te mantenés arriba, aun al giro más rápido del nivel", () => {
    const fastest = Math.max(...LOG_LEVEL.spin.map((s) => Math.abs(s.omega)));
    for (const omega of [0.5, -1.2, fastest, -fastest]) {
      const world = createWorld(quiet(omega));
      run(world, 20, balancing);
      expect(world.falls).toBe(0);
    }
  });

  it("la cima es un equilibrio: un poco corrido aguantás, muy corrido resbalás", () => {
    const near = createWorld(quiet(0));
    near.player.x += LOG_LEVEL.radius * Math.sin(0.35); // 20°
    run(near, 5);
    expect(near.falls).toBe(0);

    const far = createWorld(quiet(0));
    far.player.x += LOG_LEVEL.radius * Math.sin(0.8); // 46°
    const events = run(far, 3);
    expect(types(events)).toContain("slip");
  });

  it("cada cambio de giro se anuncia con un crujido un segundo antes", () => {
    const world = createWorld(LOG_LEVEL);
    const creaks: number[] = [];
    while (world.time < TUNING.timeLimit) {
      if (step(world, plan(world), DT).some((e) => e.type === "creak")) creaks.push(world.time);
    }
    const changes = LOG_LEVEL.spin.filter((s) => s.at > 0).map((s) => s.at - TUNING.spinWarning);
    expect(creaks).toHaveLength(changes.length);
    creaks.forEach((t, i) => expect(t).toBeCloseTo(changes[i], 1));
  });

  it("el giro cambia de a poco: nadie se cae solo porque el tronco se dio vuelta", () => {
    const world = createWorld(quiet(1.4, { spin: [{ at: 0, omega: 1.4 }, { at: 3, omega: -1.4 }] }));
    run(world, 8, balancing);
    expect(world.falls).toBe(0);
  });
});

describe("El Tronco Loco: pelotas", () => {
  const withShot = (shot: Shot) => quiet(0, { shots: [shot] });

  it("cada disparo se anuncia antes (el cañón apunta)", () => {
    const world = createWorld(withShot({ at: 2, side: -1, height: "low" }));
    const events = run(world, 2.5);
    const aim = events.findIndex((e) => e.type === "aim");
    const fire = events.findIndex((e) => e.type === "fire");
    expect(aim).toBeGreaterThanOrEqual(0);
    expect(fire).toBeGreaterThan(aim);
  });

  it("una pelota baja te voltea si te quedás parado", () => {
    const world = createWorld(withShot({ at: 1, side: -1, height: "low" }));
    const events = run(world, 3);
    expect(types(events)).toContain("hit");
    expect(world.player.ragdoll || world.player.getUp > 0 || world.falls > 0).toBe(true);
  });

  it("saltando a tiempo, la pelota baja te pasa por abajo", () => {
    const world = createWorld(withShot({ at: 1, side: -1, height: "low" }));
    let jumped = false;
    const events = run(world, 3, (w) => {
      const ball = w.balls[0];
      // Salta cuando a la pelota le faltan ~0,3 s.
      const jump = !jumped && ball !== undefined && Math.abs(w.player.x - ball.x) < TUNING.ballSpeed * 0.35;
      if (jump) jumped = true;
      return { move: 0, jumpPressed: jump };
    });
    expect(jumped).toBe(true);
    expect(types(events)).not.toContain("hit");
  });

  it("una pelota alta te pasa por arriba si no saltás, y te pega si saltás tarde", () => {
    const still = createWorld(withShot({ at: 1, side: 1, height: "high" }));
    expect(types(run(still, 3))).not.toContain("hit");

    const jumper = createWorld(withShot({ at: 1, side: 1, height: "high" }));
    let jumped = false;
    const events = run(jumper, 3, (w) => {
      const ball = w.balls[0];
      // Saltar con la pelota encima: te la comés de lleno.
      const jump = !jumped && ball !== undefined && Math.abs(w.player.x - ball.x) < TUNING.ballSpeed * 0.12;
      if (jump) jumped = true;
      return { move: 0, jumpPressed: jump };
    });
    expect(types(events)).toContain("hit");
  });
});

describe("El Tronco Loco: burbujas y puntaje", () => {
  const withBubble = quiet(0, { bubbles: [{ at: 0.5, dx: 0, y: 215, drift: 0 }] });

  it("las burbujas doradas solo se alcanzan saltando", () => {
    const still = createWorld(withBubble);
    run(still, 3);
    expect(still.bubbles).toBe(0);

    const jumper = createWorld(withBubble);
    const events = run(jumper, 3, (w) => ({ move: 0, jumpPressed: w.time > 1 && w.time < 1.01 }));
    expect(types(events)).toContain("pop");
    expect(jumper.bubbles).toBe(1);
  });

  it("las burbujas se van si no las agarrás", () => {
    const world = createWorld(withBubble);
    run(world, 0.6);
    expect(world.activeBubbles).toHaveLength(1);
    run(world, TUNING.bubbleLife);
    expect(world.activeBubbles).toHaveLength(0);
  });

  it("puntúan los segundos arriba y las burbujas", () => {
    const world = createWorld(quiet(0));
    run(world, 10);
    world.bubbles = 2;
    expect(score(world)).toBe(10 * SCORING.pointsPerSecond + 2 * SCORING.pointsPerBubble);
  });

  it("aguantar hasta la campana termina la prueba con todo el tiempo sumado", () => {
    const world = createWorld(quiet(1));
    const events = run(world, TUNING.timeLimit + 1, balancing);
    expect(types(events)).toContain("finish");
    expect(world.outcome).toBe("finished");
    expect(score(world)).toBe(TUNING.timeLimit * SCORING.pointsPerSecond);
  });

  it("con el guion completo, un jugador perfecto llega cerca del máximo", () => {
    const world = createWorld(LOG_LEVEL);
    while (world.outcome === null) step(world, plan(world), DT);
    expect(world.outcome).toBe("finished");
    expect(world.bubbles).toBeGreaterThanOrEqual(LOG_LEVEL.bubbles.length - 1);
    expect(score(world)).toBeGreaterThan(900);
  });
});

describe("El Tronco Loco: vidas", () => {
  /** Avanza hasta que pasa `type` (o se acaba el tiempo). */
  function until(world: World, type: SimEvent["type"], limit = 10) {
    const end = world.time + limit;
    while (world.time < end) if (step(world, IDLE, DT).some((e) => e.type === type)) return true;
    return false;
  }

  it("caer al agua cuesta una vida y volvés a la cima con un respiro", () => {
    const world = createWorld(quiet(1.2));
    expect(until(world, "splash")).toBe(true);
    expect(world.lives).toBe(TUNING.lives - 1);
    const splashedAt = world.time;
    expect(until(world, "respawn")).toBe(true);
    expect(world.time - splashedAt).toBeCloseTo(TUNING.respawnDelay, 1);
    expect(world.player.x).toBe(LOG_LEVEL.center.x);
    expect(world.player.grounded).toBe(true);
    expect(world.player.hitCooldown).toBeGreaterThan(0);
  });

  it("bajo el agua no corre el tiempo que puntúa", () => {
    const world = createWorld(quiet(1.5));
    expect(until(world, "splash")).toBe(true);
    const before = world.upTime;
    run(world, TUNING.respawnDelay - 0.1);
    expect(world.upTime).toBe(before);
  });

  it("tres caídas y afuera: la prueba termina antes", () => {
    const world = createWorld(quiet(1.5));
    const events = run(world, 15);
    expect(world.falls).toBe(TUNING.lives);
    expect(world.outcome).toBe("out");
    expect(types(events)).toContain("out");
    expect(world.endedAt).toBeLessThan(TUNING.timeLimit);
    expect(world.respawnIn).toBe(Infinity);
  });

  it("después de la campana el tronco frena y nadie se cae", () => {
    const world = createWorld(quiet(1.2));
    run(world, TUNING.timeLimit + 0.01, balancing);
    expect(world.outcome).toBe("finished");
    const falls = world.falls;
    run(world, 5);
    expect(world.falls).toBe(falls);
    expect(world.omega).toBe(0);
  });
});

describe("El Tronco Loco: reglas del servidor", () => {
  it("es determinista: mismo input, mismo resultado", () => {
    const play = () => {
      const world = createWorld(LOG_LEVEL);
      const random = mulberry32(99);
      while (world.outcome === null) step(world, { move: Math.floor(random() * 3) - 1, jumpPressed: random() < 0.05 }, DT);
      return [world.endedAt, world.falls, score(world)];
    };
    expect(play()).toEqual(play());
  });

  it("ningún input da más puntos que el tope ni termina más rápido que el mínimo", () => {
    const random = mulberry32(1234);
    for (let i = 0; i < 25; i++) {
      const world = createWorld(LOG_LEVEL);
      let move = 0;
      while (world.outcome === null) {
        if (random() < 0.05) move = Math.floor(random() * 3) - 1;
        step(world, { move, jumpPressed: random() < 0.03 }, DT);
      }
      expect(score(world)).toBeLessThanOrEqual(SERVER_LIMITS.maxScore);
      expect(score(world)).toBeGreaterThanOrEqual(0);
      expect(world.endedAt! * 1000).toBeGreaterThanOrEqual(SERVER_LIMITS.minDurationMs);
    }
  });
});
