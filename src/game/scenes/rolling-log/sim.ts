import { approach, circleIntersectsRect, clamp, spring, wrapDegrees } from "../../engine/physics";
import { type LogLevel, spinTarget, surfaceY } from "./level";
import { PLAYER_SIZE, SCORING, TUNING } from "./tuning";

/**
 * Simulación de El Tronco Loco: TypeScript puro, determinista y sin KAPLAY.
 *
 * El concursante está parado sobre un tronco que gira. La corteza lo arrastra
 * (hay que correr en contra) y lejos de la cima la pendiente lo tira para
 * abajo: la cima es un equilibrio inestable. Los cañones disparan pelotas a
 * dos alturas y hay burbujas doradas que solo se alcanzan saltando.
 */

/** "finished": aguantó hasta la campana. "out": se quedó sin vidas. */
export type Outcome = "finished" | "out";

export type Player = {
  /** Centro de los pies. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  grounded: boolean;
  /** Se le fueron los pies o salió despedido del tronco: va al agua sin remedio. */
  sinking: boolean;
  /** Inclinación en grados (positivo = horario). */
  lean: number;
  leanVel: number;
  ragdoll: boolean;
  getUp: number;
  hitCooldown: number;
  jumpBuffer: number;
};

export type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  height: "low" | "high";
  /** Ya golpeó a alguien: rebota y se cae, no golpea de nuevo. */
  spent: boolean;
};

export type Bubble = { x: number; y: number; drift: number; bornAt: number };

export type World = {
  level: LogLevel;
  time: number;
  player: Player;
  /** Velocidad de giro actual (rad/s; positivo = la cima va a la derecha). */
  omega: number;
  /** Rotación acumulada del tronco (para dibujarlo). */
  angle: number;
  lives: number;
  falls: number;
  /** Segundos bajo el agua antes de reaparecer (0 = en juego; Infinity = eliminado). */
  respawnIn: number;
  /** Segundos arriba del tronco (lo que puntúa). */
  upTime: number;
  bubbles: number;
  balls: Ball[];
  activeBubbles: Bubble[];
  /** Próximo elemento de cada lista del guion por avisar o disparar. */
  cursor: { spinWarn: number; shotWarn: number; shot: number; bubble: number };
  outcome: Outcome | null;
  endedAt: number | null;
};

export type SimInput = {
  /** -1 izquierda, 0 nada, 1 derecha. */
  move: number;
  /** Flanco de la tecla de salto en este paso. */
  jumpPressed: boolean;
};

export type SimEvent =
  | { type: "jump" }
  | { type: "land"; impact: number }
  /** Crujido: en `TUNING.spinWarning` segundos el giro cambia a `omega`. */
  | { type: "creak"; omega: number }
  /** El cañón apunta: dispara en `TUNING.shotWarning` segundos. */
  | { type: "aim"; side: -1 | 1; height: "low" | "high" }
  | { type: "fire"; side: -1 | 1; height: "low" | "high" }
  | { type: "hit"; x: number; y: number }
  | { type: "pop"; x: number; y: number }
  | { type: "slip"; x: number }
  | { type: "splash"; x: number }
  | { type: "respawn"; x: number }
  | { type: "finish" }
  | { type: "out" };

const HALF_WIDTH = PLAYER_SIZE.width / 2;

export function createWorld(level: LogLevel): World {
  const omega = spinTarget(level, 0);
  return {
    level,
    time: 0,
    player: standingOnTop(level, omega),
    omega,
    angle: 0,
    lives: TUNING.lives,
    falls: 0,
    respawnIn: 0,
    upTime: 0,
    bubbles: 0,
    balls: [],
    activeBubbles: [],
    cursor: { spinWarn: 0, shotWarn: 0, shot: 0, bubble: 0 },
    outcome: null,
    endedAt: null,
  };
}

/** Copia independiente del mundo (para que los bots prueben jugadas). */
export function cloneWorld(world: World): World {
  return {
    ...world,
    player: { ...world.player },
    balls: world.balls.map((b) => ({ ...b })),
    activeBubbles: world.activeBubbles.map((b) => ({ ...b })),
    cursor: { ...world.cursor },
  };
}

function standingOnTop(level: LogLevel, omega: number): Player {
  return {
    x: level.center.x,
    y: level.center.y - level.radius,
    vx: omega * level.radius,
    vy: 0,
    ax: 0,
    grounded: true,
    sinking: false,
    lean: 0,
    leanVel: 0,
    ragdoll: false,
    getUp: 0,
    hitCooldown: 0,
    jumpBuffer: 0,
  };
}

/** Ángulo desde la cima del punto `x` sobre la corteza (positivo = a la derecha). */
export function angleFromTop(level: LogLevel, x: number): number {
  return Math.asin(clamp((x - level.center.x) / level.radius, -1, 1));
}

/** Velocidad horizontal de la corteza debajo de `x`. */
export function surfaceVx(world: World, x: number): number {
  return world.omega * world.level.radius * Math.cos(angleFromTop(world.level, x));
}

/** Avanza la simulación `dt` segundos. Muta `world` y devuelve lo que pasó. */
export function step(world: World, input: SimInput, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  world.time += dt;

  updateLog(world, dt);
  runScript(world, events);
  updateBalls(world, dt);
  updateBubbles(world, dt);

  if (world.respawnIn > 0) {
    world.respawnIn = Math.max(0, world.respawnIn - dt);
    if (world.respawnIn === 0) {
      world.player = standingOnTop(world.level, world.omega);
      world.player.hitCooldown = TUNING.respawnGrace;
      events.push({ type: "respawn", x: world.player.x });
    }
  } else {
    if (world.outcome === null && !world.player.sinking) world.upTime += dt;
    stepPlayer(world, input, dt, events);
  }

  if (world.outcome === null && world.time >= TUNING.timeLimit) {
    end(world, "finished");
    events.push({ type: "finish" });
  }
  return events;
}

function updateLog(world: World, dt: number) {
  // Terminada la prueba, el tronco frena: nadie se cae después de la campana.
  const target = world.outcome === null ? spinTarget(world.level, world.time) : 0;
  world.omega = approach(world.omega, target, TUNING.spinAccel * dt);
  world.angle += world.omega * dt;
}

function runScript(world: World, events: SimEvent[]) {
  if (world.outcome !== null) return;
  const { level, cursor, time } = world;

  while (cursor.spinWarn < level.spin.length && level.spin[cursor.spinWarn].at - TUNING.spinWarning <= time) {
    const change = level.spin[cursor.spinWarn++];
    if (change.at > 0) events.push({ type: "creak", omega: change.omega });
  }
  while (cursor.shotWarn < level.shots.length && level.shots[cursor.shotWarn].at - TUNING.shotWarning <= time) {
    const { side, height } = level.shots[cursor.shotWarn++];
    events.push({ type: "aim", side, height });
  }
  while (cursor.shot < level.shots.length && level.shots[cursor.shot].at <= time) {
    const { side, height } = level.shots[cursor.shot++];
    world.balls.push({
      x: side < 0 ? level.muzzleX.left : level.muzzleX.right,
      y: level.ballY[height],
      vx: -side * TUNING.ballSpeed,
      vy: 0,
      height,
      spent: false,
    });
    events.push({ type: "fire", side, height });
  }
  while (cursor.bubble < level.bubbles.length && level.bubbles[cursor.bubble].at <= time) {
    const spawn = level.bubbles[cursor.bubble++];
    world.activeBubbles.push({ x: level.center.x + spawn.dx, y: spawn.y, drift: spawn.drift, bornAt: spawn.at });
  }
}

function updateBalls(world: World, dt: number) {
  for (const ball of world.balls) {
    if (ball.spent) ball.vy += TUNING.gravity * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
  }
  world.balls = world.balls.filter((b) => b.x > -60 && b.x < 1340 && b.y < world.level.waterY + 60);
}

function updateBubbles(world: World, dt: number) {
  for (const bubble of world.activeBubbles) bubble.x += bubble.drift * dt;
  world.activeBubbles = world.activeBubbles.filter((b) => world.time - b.bornAt < TUNING.bubbleLife);
}

function stepPlayer(world: World, input: SimInput, dt: number, events: SimEvent[]) {
  const { level } = world;
  const p = world.player;

  p.getUp = Math.max(0, p.getUp - dt);
  p.hitCooldown = Math.max(0, p.hitCooldown - dt);
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

  const inControl = world.outcome === null && !p.sinking && !p.ragdoll && p.getUp === 0;
  const move = inControl ? Math.sign(input.move) : 0;
  if (inControl && input.jumpPressed) p.jumpBuffer = TUNING.jumpBuffer;

  const prevVx = p.vx;
  if (p.grounded) {
    const theta = angleFromTop(level, p.x);
    const carried = surfaceVx(world, p.x);
    // Corre respecto de la corteza; tirado en el piso, solo lo arrastra.
    const target = carried + move * TUNING.runSpeed * Math.cos(theta);
    p.vx = approach(p.vx, target, TUNING.grip * dt);
    p.vx += TUNING.slopeGravity * Math.sin(theta) * dt;
    p.x += p.vx * dt;

    const y = surfaceY(level, p.x);
    if (y === null || Math.abs(angleFromTop(level, p.x)) > TUNING.fallAngle) {
      // Se le fueron los pies: patina por el costado hasta el agua.
      p.grounded = false;
      p.sinking = true;
      p.vy = 0;
      events.push({ type: "slip", x: p.x });
    } else {
      p.y = y;
      if (inControl && p.jumpBuffer > 0) {
        p.vy = -TUNING.jumpSpeed;
        p.grounded = false;
        p.jumpBuffer = 0;
        events.push({ type: "jump" });
      }
    }
  } else {
    if (move !== 0 && move * p.vx < TUNING.runSpeed) p.vx += move * TUNING.airAccel * dt;
    p.vy += TUNING.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    resolveLog(world, events);
  }
  p.ax = (p.vx - prevVx) / dt;

  if (!p.sinking) {
    resolveBalls(world, events);
    resolveBubbles(world, events);
  }
  updateLean(world, dt);

  if (p.y > level.waterY + TUNING.drownDepth) splash(world, events);
}

/** En el aire: aterriza en la corteza, o resbala por el costado del tronco. */
function resolveLog(world: World, events: SimEvent[]) {
  const { level } = world;
  const p = world.player;
  const dx = p.x - level.center.x;
  const dy = p.y - level.center.y;
  const dist = Math.hypot(dx, dy);

  // Fuera del tronco y por debajo de su centro ya no hay de dónde agarrarse.
  if (Math.abs(dx) >= level.radius - HALF_WIDTH && dy > 0) p.sinking = true;
  if (dist >= level.radius) return;

  const theta = Math.atan2(dx, -dy);
  if (!p.sinking && p.vy >= 0 && Math.abs(theta) <= TUNING.fallAngle) {
    const impact = p.vy;
    p.y = surfaceY(level, p.x) ?? p.y;
    events.push({ type: "land", impact });
    if (p.ragdoll && impact > TUNING.minBounceSpeed) {
      p.vy = -impact * TUNING.floorRestitution;
    } else {
      p.vy = 0;
      p.grounded = true;
      if (p.ragdoll) {
        p.ragdoll = false;
        p.getUp = TUNING.getUpTime;
      }
    }
    return;
  }

  // Contra el costado: lo saca por la normal y le quita la velocidad hacia adentro.
  const nx = dx / dist;
  const ny = dy / dist;
  p.x = level.center.x + nx * level.radius;
  p.y = level.center.y + ny * level.radius;
  const inward = p.vx * nx + p.vy * ny;
  if (inward < 0) {
    p.vx -= inward * nx;
    p.vy -= inward * ny;
  }
  if (Math.abs(theta) > TUNING.fallAngle) p.sinking = true;
}

function playerRect(p: Player) {
  return [p.x - HALF_WIDTH, p.y - PLAYER_SIZE.height, p.x + HALF_WIDTH, p.y] as const;
}

function resolveBalls(world: World, events: SimEvent[]) {
  const p = world.player;
  if (p.hitCooldown > 0) return;
  for (const ball of world.balls) {
    if (ball.spent || !circleIntersectsRect(ball.x, ball.y, TUNING.ballRadius, ...playerRect(p))) continue;
    const dir = Math.sign(ball.vx);
    p.vx = dir * TUNING.knockbackSpeed;
    p.vy = -TUNING.knockbackLift;
    p.grounded = false;
    p.ragdoll = true;
    p.getUp = 0;
    p.leanVel = dir * TUNING.knockbackSpin;
    p.hitCooldown = TUNING.hitCooldown;
    // La pelota de goma rebota para atrás y se cae.
    ball.spent = true;
    ball.vx = -ball.vx * 0.3;
    ball.vy = -250;
    events.push({ type: "hit", x: ball.x, y: ball.y });
    return;
  }
}

function resolveBubbles(world: World, events: SimEvent[]) {
  const p = world.player;
  const kept: Bubble[] = [];
  for (const bubble of world.activeBubbles) {
    if (circleIntersectsRect(bubble.x, bubble.y, TUNING.bubbleRadius, ...playerRect(p))) {
      world.bubbles++;
      events.push({ type: "pop", x: bubble.x, y: bubble.y });
    } else {
      kept.push(bubble);
    }
  }
  world.activeBubbles = kept;
}

function splash(world: World, events: SimEvent[]) {
  const p = world.player;
  world.falls++;
  events.push({ type: "splash", x: p.x });
  if (world.outcome !== null) {
    world.respawnIn = TUNING.respawnDelay;
    return;
  }
  world.lives--;
  if (world.lives > 0) {
    world.respawnIn = TUNING.respawnDelay;
  } else {
    world.respawnIn = Infinity;
    end(world, "out");
    events.push({ type: "out" });
  }
}

function updateLean(world: World, dt: number) {
  const p = world.player;
  if (p.ragdoll && !p.grounded) {
    p.lean += p.leanVel * dt;
    p.leanVel *= 1 - TUNING.tumbleDrag * dt;
    return;
  }
  p.lean = wrapDegrees(p.lean);
  // La inclinación sale de cómo corre respecto de la corteza, no del suelo.
  const relative = p.grounded ? p.vx - surfaceVx(world, p.x) : p.vx;
  const target =
    p.getUp > 0
      ? Math.sign(p.lean || -1) * TUNING.lyingLean
      : clamp(relative * TUNING.leanPerSpeed - p.ax * TUNING.leanPerAccel, -TUNING.maxLean, TUNING.maxLean);
  [p.lean, p.leanVel] = spring(p.lean, p.leanVel, target, TUNING.leanStiffness, TUNING.leanDamping, dt);
}

function end(world: World, outcome: Outcome) {
  world.outcome = outcome;
  world.endedAt = world.time;
}

/** Puntaje: segundos arriba + burbujas, con tope. Sirve en vivo y al final. */
export function score(world: World): number {
  return Math.min(
    SCORING.max,
    Math.round(world.upTime * SCORING.pointsPerSecond) + world.bubbles * SCORING.pointsPerBubble,
  );
}
