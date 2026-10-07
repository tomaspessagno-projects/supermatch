import {
  approach,
  circleIntersectsRect,
  clamp,
  spring,
  wrapDegrees,
} from "../../engine/physics";
import {
  BALL_RADIUS,
  CANNON_WARNING,
  cannonBalls,
  conveyorAt,
  hammerHead,
  type Level,
  puddleAt,
  rollerCenterY,
  trampolineAt,
} from "./level";
import { PLAYER_SIZE, SCORING, TUNING } from "./tuning";

/**
 * Simulación del Puente Resbaladizo: TypeScript puro, determinista y sin
 * KAPLAY. La escena solo le pasa input y dibuja el estado.
 */

export type Outcome = "finished" | "timeout";

export type Player = {
  /** Centro de los pies. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Aceleración horizontal aplicada en el último paso (para la inclinación). */
  ax: number;
  grounded: boolean;
  /** Ya cayó dentro de un charco: se hunde hasta el chapuzón. */
  sinking: boolean;
  /** Inclinación del torso en grados (positivo = hacia adelante). */
  lean: number;
  leanVel: number;
  /** Viene de un golpe: sin control, gira en el aire y rebota en el piso. */
  ragdoll: boolean;
  /** Segundos que le faltan para levantarse después de asentarse. */
  getUp: number;
  hitCooldown: number;
  jumpBuffer: number;
  maxX: number;
  /** Vuela por un trampolín: en el aire no acelera más que el tope del trampolín. */
  launched: boolean;
};

export type World = {
  level: Level;
  time: number;
  player: Player;
  /** Bandera donde reaparece después de caer al agua. */
  checkpoint: number;
  falls: number;
  /** Segundos bajo el agua antes de reaparecer (0 = en juego). */
  respawnIn: number;
  /** Pompas doradas ya agarradas (por índice del nivel). */
  pompas: boolean[];
  /** Pelotas de cañón que ya golpearon ("cañón:disparo"): no golpean de nuevo. */
  spentBalls: string[];
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
  | { type: "wall"; impact: number }
  /** Un golpe que lo despide: rodillo, martillo o pelota. */
  | { type: "bonk"; x: number; y: number; by: "roller" | "hammer" | "ball" }
  | { type: "launch"; x: number }
  | { type: "pompa"; x: number; y: number }
  /** El cañón en `x` tiembla: dispara en `CANNON_WARNING` s. */
  | { type: "aim"; x: number }
  | { type: "fire"; x: number }
  | { type: "splash"; x: number }
  | { type: "checkpoint"; x: number }
  | { type: "respawn"; x: number }
  | { type: "finish" }
  | { type: "timeout" };

const HALF_WIDTH = PLAYER_SIZE.width / 2;
const POMPA_RADIUS = 30; // generosa: agarrarla tiene que sentirse fácil una vez que te animás

export function createWorld(level: Level): World {
  return {
    level,
    time: 0,
    checkpoint: level.startX,
    falls: 0,
    respawnIn: 0,
    pompas: level.pompas.map(() => false),
    spentBalls: [],
    outcome: null,
    endedAt: null,
    player: standingAt(level, level.startX, level.startX),
  };
}

/** Copia independiente del mundo (para que los bots prueben jugadas). */
export function cloneWorld(world: World): World {
  return {
    ...world,
    player: { ...world.player },
    pompas: [...world.pompas],
    spentBalls: [...world.spentBalls],
  };
}

/** Pompas agarradas. */
export function pompaCount(world: World): number {
  return world.pompas.filter(Boolean).length;
}

/** Reaparece cayendo sobre la bandera: se ve venir y aterriza con un "¡PUF!". */
function droppingAt(level: Level, x: number, maxX: number): Player {
  return { ...standingAt(level, x, maxX), y: level.floorY - TUNING.respawnDrop, grounded: false };
}

function standingAt(level: Level, x: number, maxX: number): Player {
  return {
    x,
    y: level.floorY,
    vx: 0,
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
    maxX,
    launched: false,
  };
}

/** Avanza la simulación `dt` segundos. Muta `world` y devuelve lo que pasó. */
export function step(world: World, input: SimInput, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  const { level } = world;
  const p = world.player;

  world.time += dt;
  cannonEvents(world, dt, events);

  // Bajo el agua: el reloj sigue corriendo (esa es la penalización).
  if (world.respawnIn > 0) {
    world.respawnIn = Math.max(0, world.respawnIn - dt);
    if (world.respawnIn === 0 && world.outcome === null) {
      world.player = droppingAt(level, world.checkpoint, p.maxX);
      world.player.hitCooldown = TUNING.respawnGrace;
      events.push({ type: "respawn", x: world.checkpoint });
    }
    checkEnd(world, events);
    return events;
  }

  p.getUp = Math.max(0, p.getUp - dt);
  p.hitCooldown = Math.max(0, p.hitCooldown - dt);
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

  const inControl =
    world.outcome === null && !p.sinking && !p.ragdoll && p.getUp === 0;
  const move = inControl ? Math.sign(input.move) : 0;
  if (inControl && input.jumpPressed) p.jumpBuffer = TUNING.jumpBuffer;

  // Horizontal: en el piso casi no hay fricción; en el aire casi no hay control.
  // Sobre la cinta de goma es al revés: agarra, pero te lleva para atrás.
  const prevVx = p.vx;
  const belt = p.grounded ? conveyorAt(level, p.x) : undefined;
  if (belt) {
    const run = p.getUp > 0 ? 0 : move * TUNING.beltRunSpeed;
    p.vx = approach(p.vx, belt.speed + run, TUNING.beltGrip * dt);
  } else if (move !== 0 && move * p.vx < (p.launched ? TUNING.trampolineMaxVx : TUNING.maxRunSpeed)) {
    const accel = p.grounded ? TUNING.groundAccel : TUNING.airAccel;
    p.vx += move * accel * dt;
  }
  if (p.grounded && !belt) {
    if (p.getUp > 0) {
      // Tirado de espaldas: ahí sí hay fricción.
      p.vx = approach(p.vx, 0, TUNING.skidFriction * dt);
    } else if (Math.abs(p.vx) > TUNING.maxRunSpeed) {
      const cap = Math.sign(p.vx) * TUNING.maxRunSpeed;
      p.vx = approach(p.vx, cap, TUNING.skidFriction * dt);
    } else if (move === 0) {
      p.vx = approach(p.vx, 0, TUNING.groundFriction * dt);
    }
  }
  p.ax = (p.vx - prevVx) / dt;

  if (inControl && p.grounded && p.jumpBuffer > 0) {
    p.vy = -TUNING.jumpSpeed;
    p.grounded = false;
    p.jumpBuffer = 0;
    events.push({ type: "jump" });
  }

  if (!p.grounded) p.vy += TUNING.gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // Pared de largada: bumper.
  if (p.x < level.wallX + HALF_WIDTH) {
    p.x = level.wallX + HALF_WIDTH;
    events.push({ type: "wall", impact: -p.vx });
    p.vx = -p.vx * TUNING.wallRestitution;
  }

  resolveFloor(world, events);
  if (world.outcome === null && !p.sinking) {
    resolveRollers(world, events);
    resolveHammers(world, events);
    resolveBalls(world, events);
    resolvePompas(world, events);
  }
  updateLean(p, dt);

  if (!p.sinking) {
    p.maxX = Math.max(p.maxX, p.x);
    const next = level.checkpoints.find((x) => x > world.checkpoint);
    if (next !== undefined && p.x >= next && world.outcome === null) {
      world.checkpoint = next;
      events.push({ type: "checkpoint", x: next });
    }
  }

  checkEnd(world, events);
  return events;
}

function checkEnd(world: World, events: SimEvent[]) {
  if (world.outcome !== null) return;
  if (world.player.x >= world.level.finishX && world.respawnIn === 0) {
    end(world, "finished");
    events.push({ type: "finish" });
  } else if (world.time >= TUNING.timeLimit) {
    end(world, "timeout");
    events.push({ type: "timeout" });
  }
}

function resolveFloor(world: World, events: SimEvent[]) {
  const { level } = world;
  const p = world.player;
  const floor = level.floorY;

  if (p.sinking) {
    // Adentro del charco: las paredes del hueco lo contienen.
    const puddle = puddleAt(level, p.x) ?? nearestPuddle(level, p.x);
    const left = puddle.x0 + HALF_WIDTH;
    const right = puddle.x1 - HALF_WIDTH;
    const clamped =
      left <= right ? clamp(p.x, left, right) : (puddle.x0 + puddle.x1) / 2;
    if (clamped !== p.x) {
      p.x = clamped;
      p.vx = 0;
    }
    if (world.outcome === null && world.respawnIn === 0 && p.y > floor + TUNING.drownDepth) {
      world.falls++;
      world.respawnIn = TUNING.respawnDelay;
      events.push({ type: "splash", x: p.x });
    }
    return;
  }

  const overPuddle = puddleAt(level, p.x) !== undefined;

  if (p.grounded) {
    if (overPuddle) p.grounded = false; // se le acabó el piso
    else p.y = floor;
    if (p.grounded && trampolineAt(level, p.x)) launch(p, level, events);
    return;
  }

  if (p.y < floor) return;

  if (overPuddle) {
    if (p.y > floor + TUNING.fallCommitDepth) p.sinking = true;
    return;
  }

  // Aterrizaje (o salvada en el borde del charco). De pie, las piernas
  // absorben el golpe; en ragdoll, el cuerpo rebota como goma.
  const impact = p.vy;
  p.y = floor;
  p.launched = false;
  if (trampolineAt(level, p.x)) {
    launch(p, level, events);
    return;
  }
  p.leanVel += Math.sign(p.vx || 1) * impact * TUNING.landingWobble;
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
}

function resolveRollers(world: World, events: SimEvent[]) {
  const p = world.player;
  if (p.hitCooldown > 0) return;

  for (const roller of world.level.rollers) {
    const cy = rollerCenterY(world.level, roller, world.time);
    if (!circleIntersectsRect(roller.x, cy, roller.radius, ...playerRect(p))) continue;

    // Lo despide para el lado opuesto al rodillo: casi siempre, hacia atrás.
    const dir = p.x >= roller.x ? 1 : -1;
    knock(p, dir * (TUNING.knockbackBase + Math.abs(p.vx) * TUNING.knockbackCarry), -TUNING.knockbackLift);
    p.x = roller.x + dir * (roller.radius + HALF_WIDTH + 1);
    events.push({ type: "bonk", x: roller.x, y: cy, by: "roller" });
    return;
  }
}

function launch(p: Player, level: Level, events: SimEvent[]) {
  const pad = trampolineAt(level, p.x)!;
  p.vy = -TUNING.trampolineSpeed;
  // Hacia adelante y a una velocidad acotada: el vuelo siempre se parece.
  p.vx = clamp(Math.abs(p.vx), TUNING.trampolineMinVx, TUNING.trampolineMaxVx);
  p.grounded = false;
  p.launched = true;
  p.jumpBuffer = 0;
  events.push({ type: "launch", x: (pad.x0 + pad.x1) / 2 });
}

/** Lo despide: sin control, girando, como en cualquier golpe. */
function knock(p: Player, vx: number, vy: number) {
  p.vx = vx;
  p.vy = vy;
  p.grounded = false;
  p.leanVel = Math.sign(vx || 1) * TUNING.knockbackSpin;
  p.ragdoll = true;
  p.getUp = 0;
  p.hitCooldown = TUNING.hitCooldown;
}

function resolveHammers(world: World, events: SimEvent[]) {
  const p = world.player;
  if (p.hitCooldown > 0) return;
  for (const hammer of world.level.hammers) {
    const head = hammerHead(world.level, hammer, world.time);
    if (!circleIntersectsRect(head.x, head.y, hammer.radius, ...playerRect(p))) continue;
    // Empuja para el lado al que va la cabeza: a veces te ayuda.
    const dir = Math.abs(head.vx) > 60 ? Math.sign(head.vx) : Math.sign(p.x - head.x) || 1;
    knock(p, dir * TUNING.hammerKnock, -TUNING.hammerLift);
    events.push({ type: "bonk", x: head.x, y: head.y, by: "hammer" });
    return;
  }
}

function resolveBalls(world: World, events: SimEvent[]) {
  const p = world.player;
  if (p.hitCooldown > 0) return;
  world.level.cannons.forEach((cannon, c) => {
    if (p.hitCooldown > 0) return;
    for (const ball of cannonBalls(world.level, cannon, world.time)) {
      const key = `${c}:${ball.shot}`;
      if (world.spentBalls.includes(key)) continue;
      if (!circleIntersectsRect(ball.x, ball.y, BALL_RADIUS, ...playerRect(p))) continue;
      world.spentBalls.push(key);
      knock(p, -TUNING.ballKnock, -TUNING.ballLift);
      events.push({ type: "bonk", x: ball.x, y: ball.y, by: "ball" });
      return;
    }
  });
}

function resolvePompas(world: World, events: SimEvent[]) {
  const p = world.player;
  world.level.pompas.forEach((pompa, i) => {
    if (world.pompas[i] || !circleIntersectsRect(pompa.x, pompa.y, POMPA_RADIUS, ...playerRect(p))) return;
    world.pompas[i] = true;
    events.push({ type: "pompa", x: pompa.x, y: pompa.y });
  });
}

/** Avisos y disparos de los cañones (aunque estén lejos: el nivel es igual para todos). */
function cannonEvents(world: World, dt: number, events: SimEvent[]) {
  const prev = world.time - dt;
  for (const cannon of world.level.cannons) {
    const crossed = (t: number) => t > prev && t <= world.time;
    const next = Math.floor((world.time + CANNON_WARNING - cannon.phase) / cannon.interval);
    for (const shot of [next - 1, next]) {
      if (shot < 0) continue;
      const at = cannon.phase + shot * cannon.interval;
      if (crossed(at - CANNON_WARNING)) events.push({ type: "aim", x: cannon.x });
      if (crossed(at)) events.push({ type: "fire", x: cannon.x });
    }
  }
}

function playerRect(p: Player) {
  return [p.x - HALF_WIDTH, p.y - PLAYER_SIZE.height, p.x + HALF_WIDTH, p.y] as const;
}

function updateLean(p: Player, dt: number) {
  if (p.ragdoll && !p.grounded) {
    p.lean += p.leanVel * dt;
    p.leanVel *= 1 - TUNING.tumbleDrag * dt;
    return;
  }
  // Al recuperarse vuelve al "derecho" más cercano, no desenrolla las vueltas.
  p.lean = wrapDegrees(p.lean);
  const target =
    p.getUp > 0
      ? Math.sign(p.lean || -1) * TUNING.lyingLean
      : clamp(
          p.vx * TUNING.leanPerSpeed - p.ax * TUNING.leanPerAccel,
          -TUNING.maxLean,
          TUNING.maxLean,
        );
  [p.lean, p.leanVel] = spring(
    p.lean,
    p.leanVel,
    target,
    TUNING.leanStiffness,
    TUNING.leanDamping,
    dt,
  );
}

function nearestPuddle(level: Level, x: number) {
  return level.puddles.reduce((best, p) =>
    Math.abs((p.x0 + p.x1) / 2 - x) < Math.abs((best.x0 + best.x1) / 2 - x)
      ? p
      : best,
  );
}

function end(world: World, outcome: Outcome) {
  world.outcome = outcome;
  world.endedAt = world.time;
}

/** Puntaje parcial durante la partida (solo distancia). */
export function liveScore(world: World): number {
  const { startX, finishX } = world.level;
  const progress = clamp((world.player.maxX - startX) / (finishX - startX), 0, 1);
  return Math.round(SCORING.distancePoints * progress) + pompaCount(world) * SCORING.pompaPoints;
}

/** Puntaje final: distancia + pompas + meta + bonus por tiempo sobrante. */
export function finalScore(world: World): number {
  let score = liveScore(world);
  if (world.outcome === "finished" && world.endedAt !== null) {
    const timeLeft = clamp(1 - world.endedAt / TUNING.timeLimit, 0, 1);
    score +=
      SCORING.finishPoints + Math.round(SCORING.timeBonusPoints * timeLeft);
  }
  return score;
}
