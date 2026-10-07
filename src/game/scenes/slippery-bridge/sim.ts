import {
  approach,
  circleIntersectsRect,
  clamp,
  spring,
  wrapDegrees,
} from "../../engine/physics";
import { type Level, puddleAt, rollerCenterY } from "./level";
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
  | { type: "bonk"; x: number; y: number }
  | { type: "splash"; x: number }
  | { type: "checkpoint"; x: number }
  | { type: "respawn"; x: number }
  | { type: "finish" }
  | { type: "timeout" };

const HALF_WIDTH = PLAYER_SIZE.width / 2;

export function createWorld(level: Level): World {
  return {
    level,
    time: 0,
    checkpoint: level.startX,
    falls: 0,
    respawnIn: 0,
    outcome: null,
    endedAt: null,
    player: standingAt(level, level.startX, level.startX),
  };
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
  };
}

/** Avanza la simulación `dt` segundos. Muta `world` y devuelve lo que pasó. */
export function step(world: World, input: SimInput, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  const { level } = world;
  const p = world.player;

  world.time += dt;

  // Bajo el agua: el reloj sigue corriendo (esa es la penalización).
  if (world.respawnIn > 0) {
    world.respawnIn = Math.max(0, world.respawnIn - dt);
    if (world.respawnIn === 0 && world.outcome === null) {
      world.player = standingAt(level, world.checkpoint, p.maxX);
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
  const prevVx = p.vx;
  if (move !== 0 && move * p.vx < TUNING.maxRunSpeed) {
    const accel = p.grounded ? TUNING.groundAccel : TUNING.airAccel;
    p.vx += move * accel * dt;
  }
  if (p.grounded) {
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
  if (world.outcome === null && !p.sinking) resolveRollers(world, events);
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
    const hit = circleIntersectsRect(
      roller.x,
      cy,
      roller.radius,
      p.x - HALF_WIDTH,
      p.y - PLAYER_SIZE.height,
      p.x + HALF_WIDTH,
      p.y,
    );
    if (!hit) continue;

    // Lo despide para el lado opuesto al rodillo: casi siempre, hacia atrás.
    const dir = p.x >= roller.x ? 1 : -1;
    p.vx = dir * (TUNING.knockbackBase + Math.abs(p.vx) * TUNING.knockbackCarry);
    p.vy = -TUNING.knockbackLift;
    p.x = roller.x + dir * (roller.radius + HALF_WIDTH + 1);
    p.grounded = false;
    p.leanVel = dir * TUNING.knockbackSpin;
    p.ragdoll = true;
    p.getUp = 0;
    p.hitCooldown = TUNING.hitCooldown;
    events.push({ type: "bonk", x: roller.x, y: cy });
    return;
  }
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
  return Math.round(SCORING.distancePoints * progress);
}

/** Puntaje final: distancia + meta + bonus por tiempo sobrante. */
export function finalScore(world: World): number {
  let score = liveScore(world);
  if (world.outcome === "finished" && world.endedAt !== null) {
    const timeLeft = clamp(1 - world.endedAt / TUNING.timeLimit, 0, 1);
    score +=
      SCORING.finishPoints + Math.round(SCORING.timeBonusPoints * timeLeft);
  }
  return score;
}
