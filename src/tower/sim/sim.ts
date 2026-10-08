import { makeItem, type Item, rollItem } from "./items";
import { type Block, type BlockKind, type Box, floorAt, moverBox, type Tower, windBlowing } from "./level";
import type { Stats } from "./progression";
import { mulberry32 } from "./random";
import { TUNING } from "./tuning";

/**
 * Simulación de La Torre: TypeScript puro, sin three.js.
 *
 * Un intento: salís de la orilla, trepás el caracol de la torre gastando
 * energía (por salto y por segundo), juntás fichas y objetos (la mochila tiene
 * lugar limitado) y en algún momento te caés a la pileta. Ahí se cobra: los
 * metros que subiste, el récord, las fichas y lo que traías en la mochila.
 * Después volvés a la orilla para el próximo intento.
 */

export type PlayerInput = {
  /** Dirección en el piso (mundo), largo ≤ 1. La vista la calcula según la cámara. */
  moveX: number;
  moveZ: number;
  /** Flanco: se apretó el salto en este paso. */
  jumpPressed: boolean;
  /** Mantiene apretado el salto (flotador). */
  jumpHeld: boolean;
};

export type Player = {
  /** Centro de los pies. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  ground: BlockKind | "cloud" | null;
  /** Nube sobre la que está parado (lo lleva). */
  riding: number | null;
  coyote: number;
  jumpBuffer: number;
  usedDouble: boolean;
  stun: number;
  /** Hacia dónde mira (radianes, solo para dibujar). */
  facing: number;
  /** Segundos sin energía; pasado el límite se resbala. */
  exhausted: number;
  slipping: boolean;
  gliding: boolean;
  /** Lo último que pisó fue la orilla o un descanso (ahí no se gasta energía). */
  safe: boolean;
};

export type Content = { kind: "chip"; value: number } | { kind: "item"; item: Item };

export type Run = {
  number: number;
  startY: number;
  maxY: number;
  chips: number;
  bag: Item[];
  /** Descansos que ya te recargaron energía en este intento. */
  refilled: number[];
  floor: number;
  /** Qué hay en cada lugar (se sortea al empezar cada intento). */
  contents: Record<number, Content>;
  reachedTop: boolean;
};

export type RunSummary = {
  height: number;
  climbed: number;
  record: boolean;
  heightFame: number;
  recordFame: number;
  chips: number;
  items: Item[];
  itemsFame: number;
  total: number;
};

export type Progress = {
  /** Mejor altura de la historia (m). */
  record: number;
  /** Último descanso al que llegaste (índice de piso, -1 = ninguno). */
  highestRest: number;
};

export type World = {
  tower: Tower;
  stats: Stats;
  progress: Progress;
  seed: number;
  time: number;
  phase: "playing" | "splash";
  phaseTime: number;
  player: Player;
  energy: number;
  run: Run;
  summary: RunSummary | null;
};

export type SimEvent =
  | { type: "jump"; double: boolean }
  | { type: "land"; impact: number; kind: BlockKind | "cloud" }
  | { type: "bounce" }
  | { type: "knock"; x: number; y: number; z: number }
  | { type: "chip"; value: number; x: number; y: number; z: number }
  | { type: "item"; item: Item; x: number; y: number; z: number }
  | { type: "bagFull"; x: number; y: number; z: number }
  | { type: "exhausted" }
  | { type: "slip" }
  | { type: "refill"; floor: number }
  | { type: "rest"; floor: number; first: boolean }
  | { type: "floor"; floor: number }
  | { type: "top" }
  | { type: "elevator"; floor: number }
  | { type: "splash"; summary: RunSummary; x: number; z: number }
  | { type: "respawn" };

const IDLE: PlayerInput = { moveX: 0, moveZ: 0, jumpPressed: false, jumpHeld: false };

/** Dónde aparecés al subir en ascensor (sobre el anillo, del lado de la orilla). */
const RING_SPAWN = 3.6;

/** Recarga de un anillo de descanso (una vez por intento). */
export const REST_REFILL = 12;
/** Premio por llegar a la cima. */
export const TOP_BONUS = 500;
/** Fama por metro por encima del récord. */
export const RECORD_FAME_PER_M = 3;

export function createWorld(tower: Tower, stats: Stats, progress: Progress, seed = 1): World {
  const world: World = {
    tower,
    stats,
    progress: { ...progress },
    seed,
    time: 0,
    phase: "playing",
    phaseTime: 0,
    player: newPlayer(tower.start.x, tower.start.y, tower.start.z),
    energy: stats.energy,
    run: newRun(tower, seed, 0, tower.start.y),
    summary: null,
  };
  return world;
}

function newPlayer(x: number, y: number, z: number): Player {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    ground: "deck",
    riding: null,
    coyote: 0,
    jumpBuffer: 0,
    usedDouble: false,
    stun: 0,
    facing: Math.PI / 2, // mirando a la torre (+x)
    exhausted: 0,
    slipping: false,
    gliding: false,
    safe: true,
  };
}

/** Sortea qué hay en cada lugar: fichas en el camino, objetos en las cornisas. */
function newRun(tower: Tower, seed: number, number: number, startY: number): Run {
  const random = mulberry32(seed * 7919 + number * 104729);
  const contents: Record<number, Content> = {};
  for (const spot of tower.spots) {
    if (spot.ledge) {
      if (random() < 0.7) contents[spot.id] = { kind: "item", item: rollItem(random, spot.floor) };
    } else if (random() < 0.65) {
      contents[spot.id] = { kind: "chip", value: spot.floor + 1 };
    }
  }
  return { number, startY, maxY: startY, chips: 0, bag: [], refilled: [], floor: floorAt(tower, startY), contents, reachedTop: false };
}

export function step(w: World, rawInput: PlayerInput, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  w.time += dt;
  w.phaseTime += dt;

  if (w.phase === "splash") {
    if (w.phaseTime >= TUNING.splashTime) respawn(w, events);
    return events;
  }

  const p = w.player;
  const input = p.stun > 0 || p.slipping ? IDLE : rawInput;
  p.stun = Math.max(0, p.stun - dt);
  stepEnergy(w, input, dt, events);
  moveHorizontal(w, input, dt);
  jumpAndGravity(w, input, dt, events);
  integrate(w, dt, events);
  hitSweepers(w, events);
  pickUp(w, events);
  checkPlaces(w, events);

  if (Math.abs(p.vx) + Math.abs(p.vz) > 0.5) p.facing = Math.atan2(p.vx, p.vz);
  if (p.y < TUNING.waterY) splash(w, events);
  return events;
}

const SAFE: readonly (BlockKind | "cloud" | null)[] = ["deck", "rest", "elevator"];
const onSafeGround = (p: Player) => p.safe;

function stepEnergy(w: World, input: PlayerInput, dt: number, events: SimEvent[]) {
  const p = w.player;
  // En la orilla y en los descansos no se gasta.
  if (!onSafeGround(p) && w.energy > 0) {
    w.energy = Math.max(0, w.energy - TUNING.drainPerSecond * dt);
    if (w.energy === 0) events.push({ type: "exhausted" });
  }
  if (w.energy > 0) {
    p.exhausted = 0;
    return;
  }
  if (onSafeGround(p)) return;
  p.exhausted += dt;
  if (!p.slipping && p.exhausted >= TUNING.exhaustedFor) {
    p.slipping = true;
    events.push({ type: "slip" });
  }
  void input;
}

function moveHorizontal(w: World, input: PlayerInput, dt: number) {
  const p = w.player;
  if (p.slipping) {
    // Sin piernas: se va resbalando para afuera de la torre.
    const d = Math.sqrt(p.x * p.x + p.z * p.z) || 1;
    p.vx = (p.x / d) * TUNING.slipSpeed;
    p.vz = (p.z / d) * TUNING.slipSpeed;
    return;
  }
  const len = Math.sqrt(input.moveX * input.moveX + input.moveZ * input.moveZ);
  const scale = len > 1 ? 1 / len : 1;
  const grip = w.stats.grip;
  // Viento: cuando sopla, te arrastra para afuera (el agarre lo aguanta mejor).
  let driftX = 0;
  let driftZ = 0;
  for (const wind of w.tower.winds) {
    if (!inside(wind, p.x, p.y + 0.8, p.z) || !windBlowing(wind, w.time)) continue;
    const force = TUNING.windDrift * (1 - 0.25 * grip) * (p.grounded ? TUNING.windGroundFactor : 1);
    driftX += wind.dirX * force;
    driftZ += wind.dirZ * force;
  }
  const tx = input.moveX * scale * TUNING.moveSpeed + driftX;
  const tz = input.moveZ * scale * TUNING.moveSpeed + driftZ;
  const soapy = p.grounded && p.ground === "soap";
  let rate: number;
  if (len > 0.01 || driftX !== 0 || driftZ !== 0) rate = !p.grounded ? TUNING.airAccel : soapy ? TUNING.soapAccel + grip * 4 : TUNING.groundAccel;
  else rate = !p.grounded ? TUNING.airDecel : soapy ? TUNING.soapDecel + grip * 2 : TUNING.groundDecel;
  const dx = tx - p.vx;
  const dz = tz - p.vz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const max = rate * dt;
  if (dist <= max) {
    p.vx = tx;
    p.vz = tz;
  } else {
    p.vx += (dx / dist) * max;
    p.vz += (dz / dist) * max;
  }

}

function jumpAndGravity(w: World, input: PlayerInput, dt: number, events: SimEvent[]) {
  const p = w.player;
  p.coyote = p.grounded ? TUNING.coyoteTime : Math.max(0, p.coyote - dt);
  p.jumpBuffer = input.jumpPressed ? TUNING.jumpBuffer : Math.max(0, p.jumpBuffer - dt);
  const canJump = w.energy > 0 && !p.slipping;
  if (p.jumpBuffer > 0 && canJump) {
    if (p.coyote > 0) {
      p.vy = w.stats.jumpSpeed;
      p.grounded = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      p.riding = null;
      spend(w, events);
      events.push({ type: "jump", double: false });
    } else if (w.stats.doubleJump && !p.usedDouble) {
      p.vy = w.stats.jumpSpeed * TUNING.doubleJumpFactor;
      p.usedDouble = true;
      p.jumpBuffer = 0;
      spend(w, events);
      events.push({ type: "jump", double: true });
    }
  }
  p.vy = Math.max(-TUNING.maxFallSpeed, p.vy - TUNING.gravity * dt);
  p.gliding = w.stats.float && !p.grounded && input.jumpHeld && p.vy < -TUNING.glideFallSpeed;
  if (p.gliding) p.vy = -TUNING.glideFallSpeed;
}

function spend(w: World, events: SimEvent[]) {
  if (onSafeGround(w.player)) return;
  const before = w.energy;
  w.energy = Math.max(0, w.energy - TUNING.jumpCost);
  if (before > 0 && w.energy === 0) events.push({ type: "exhausted" });
}

const inside = (b: Box, x: number, y: number, z: number) =>
  x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ;

type Solid = { box: Box; kind: BlockKind | "cloud"; mover: number | null };

/** Lo sólido cerca del jugador: bloques fijos y nubes donde están ahora. */
function solidsNear(w: World): Solid[] {
  const p = w.player;
  const out: Solid[] = [];
  for (const b of w.tower.blocks) {
    if (b.maxY < p.y - 3 || b.minY > p.y + 4) continue;
    if (b.kind === "elevator") continue; // es un dibujo en el piso del muelle
    out.push({ box: b, kind: b.kind, mover: null });
  }
  for (const m of w.tower.movers) {
    if (m.kind !== "cloud") continue;
    const box = moverBox(m, w.time);
    if (box.maxY < p.y - 3 || box.minY > p.y + 4) continue;
    out.push({ box, kind: "cloud", mover: m.id });
  }
  return out;
}

function integrate(w: World, dt: number, events: SimEvent[]) {
  const p = w.player;
  const r = TUNING.playerRadius;
  const h = TUNING.playerHeight;

  // Parado sobre una nube: se mueve con ella.
  if (p.grounded && p.riding !== null) {
    const m = w.tower.movers.find((x) => x.id === p.riding);
    if (m) {
      const now = moverBox(m, w.time);
      const before = moverBox(m, w.time - dt);
      p.x += now.minX - before.minX;
      p.z += now.minZ - before.minZ;
    }
  }

  const solids = solidsNear(w);
  const overlaps = (s: Solid) =>
    p.x + r > s.box.minX && p.x - r < s.box.maxX && p.y + h > s.box.minY && p.y < s.box.maxY && p.z + r > s.box.minZ && p.z - r < s.box.maxZ;

  // Vertical: solo es piso (o techo) si antes del paso estaba arriba (o abajo)
  // del bloque; si no, se lo chocó de costado y lo resuelve el paso horizontal.
  const vyBefore = p.vy;
  const prevY = p.y;
  p.y += p.vy * dt;
  let landed: Solid | null = null;
  for (const s of solids) {
    if (!overlaps(s)) continue;
    if (p.vy <= 0 && prevY >= s.box.maxY - 0.02) {
      p.y = s.box.maxY;
      landed = s;
      p.vy = 0;
    } else if (p.vy > 0 && prevY + h <= s.box.minY + 0.02) {
      p.y = s.box.minY - h;
      p.vy = 0;
    }
  }
  const wasGrounded = p.grounded;
  p.grounded = landed !== null;
  p.ground = landed?.kind ?? null;
  p.riding = landed?.mover ?? null;
  if (landed) {
    p.usedDouble = false;
    p.safe = SAFE.includes(landed.kind);
    if (!wasGrounded) events.push({ type: "land", impact: -vyBefore, kind: landed.kind });
    if (landed.kind === "bubble") {
      p.vy = TUNING.bounceSpeed;
      p.grounded = false;
      events.push({ type: "bounce" });
    }
    if (!p.slipping) w.run.maxY = Math.max(w.run.maxY, p.y);
  }

  // Horizontal, de a un eje (contra los costados).
  const prevX = p.x;
  p.x += p.vx * dt;
  for (const s of solids) {
    if (!overlaps(s)) continue;
    if (prevX + r <= s.box.minX + 0.02) p.x = s.box.minX - r;
    else if (prevX - r >= s.box.maxX - 0.02) p.x = s.box.maxX + r;
    else continue;
    p.vx = 0;
  }
  const prevZ = p.z;
  p.z += p.vz * dt;
  for (const s of solids) {
    if (!overlaps(s)) continue;
    if (prevZ + r <= s.box.minZ + 0.02) p.z = s.box.minZ - r;
    else if (prevZ - r >= s.box.maxZ - 0.02) p.z = s.box.maxZ + r;
    else continue;
    p.vz = 0;
  }

  // La columna del medio (cilindro).
  const d = Math.sqrt(p.x * p.x + p.z * p.z);
  const min = w.tower.columnRadius + r;
  if (d < min && p.y < w.tower.top + 2 && d > 0) {
    p.x = (p.x / d) * min;
    p.z = (p.z / d) * min;
    const inward = (p.vx * p.x + p.vz * p.z) / min;
    if (inward < 0) {
      p.vx -= (inward * p.x) / min;
      p.vz -= (inward * p.z) / min;
    }
  }
}

function hitSweepers(w: World, events: SimEvent[]) {
  const p = w.player;
  if (p.stun > 0) return;
  const r = TUNING.playerRadius;
  for (const m of w.tower.movers) {
    if (m.kind !== "sweeper") continue;
    const b = moverBox(m, w.time);
    const hit = p.x + r > b.minX && p.x - r < b.maxX && p.y + TUNING.playerHeight > b.minY && p.y < b.maxY && p.z + r > b.minZ && p.z - r < b.maxZ;
    if (!hit) continue;
    // Te tira para donde va la barredora.
    const dir = Math.cos((w.time / m.period) * Math.PI * 2 + m.phase) >= 0 ? 1 : -1;
    p.vx = m.axis === "x" ? dir * TUNING.knockSpeed : p.vx * 0.3;
    p.vz = m.axis === "z" ? dir * TUNING.knockSpeed : p.vz * 0.3;
    p.vy = TUNING.knockLift;
    p.grounded = false;
    p.stun = TUNING.stunTime;
    events.push({ type: "knock", x: p.x, y: p.y + 1, z: p.z });
    return;
  }
}

function pickUp(w: World, events: SimEvent[]) {
  const p = w.player;
  const radius = w.stats.pickRadius;
  const cy = p.y + 0.8;
  for (const spot of w.tower.spots) {
    const content = w.run.contents[spot.id];
    if (!content) continue;
    const dx = spot.x - p.x;
    const dy = spot.y - cy;
    const dz = spot.z - p.z;
    if (dx * dx + dy * dy + dz * dz > (radius + 0.4) * (radius + 0.4)) continue;
    if (content.kind === "chip") {
      w.run.chips += content.value;
      delete w.run.contents[spot.id];
      events.push({ type: "chip", value: content.value, x: spot.x, y: spot.y, z: spot.z });
    } else if (w.run.bag.length < w.stats.bag) {
      w.run.bag.push(content.item);
      delete w.run.contents[spot.id];
      events.push({ type: "item", item: content.item, x: spot.x, y: spot.y, z: spot.z });
    } else {
      events.push({ type: "bagFull", x: spot.x, y: spot.y, z: spot.z });
    }
  }
}

/** Pisos nuevos, descansos (recargan y desbloquean el ascensor), la cima y el ascensor. */
function checkPlaces(w: World, events: SimEvent[]) {
  const p = w.player;
  const { tower, run } = w;
  const floor = floorAt(tower, p.y);
  if (p.grounded && floor > run.floor) {
    run.floor = floor;
    events.push({ type: "floor", floor });
  }
  if (!p.grounded) return;
  if (p.ground === "rest") {
    const f = tower.rests.findIndex((y) => Math.abs(y - p.y) < 0.01);
    if (f >= 0 && !run.refilled.includes(f)) {
      run.refilled.push(f);
      w.energy = Math.min(w.stats.energy, w.energy + REST_REFILL);
      p.exhausted = 0;
      events.push({ type: "refill", floor: f });
      const first = f > w.progress.highestRest;
      if (first) w.progress.highestRest = f;
      events.push({ type: "rest", floor: f, first });
    }
  }
  if (p.ground === "goal" && !run.reachedTop) {
    run.reachedTop = true;
    run.bag.push(makeItem("cup", "none", tower.floors.length));
    events.push({ type: "top" });
    w.progress.highestRest = Math.max(w.progress.highestRest, tower.rests.length - 1);
  }
  // El ascensor del muelle: al último descanso al que llegaste.
  const el = tower.elevator;
  if (
    p.ground === "deck" &&
    w.stats.elevator &&
    w.progress.highestRest >= 0 &&
    p.x > el.minX && p.x < el.maxX && p.z > el.minZ && p.z < el.maxZ
  ) {
    const f = Math.min(w.progress.highestRest, tower.rests.length - 2);
    const y = tower.rests[f];
    Object.assign(p, newPlayer(-RING_SPAWN, y, 0));
    run.startY = y;
    run.maxY = y;
    run.floor = f + 1;
    run.refilled.push(f); // ya está descansado
    events.push({ type: "elevator", floor: f });
  }
}

export function summarize(w: World): RunSummary {
  const { run, progress } = w;
  const height = Math.max(0, run.maxY);
  const climbed = Math.max(0, run.maxY - run.startY);
  const record = height > progress.record + 0.05;
  const recordFame = record ? Math.round((height - progress.record) * RECORD_FAME_PER_M) : 0;
  const heightFame = Math.round(climbed);
  const itemsFame = run.bag.reduce((sum, item) => sum + item.value, 0) + (run.reachedTop ? TOP_BONUS : 0);
  return {
    height: Math.round(height * 10) / 10,
    climbed: Math.round(climbed * 10) / 10,
    record,
    heightFame,
    recordFame,
    chips: run.chips,
    items: [...run.bag],
    itemsFame,
    total: heightFame + recordFame + run.chips + itemsFame,
  };
}

function splash(w: World, events: SimEvent[]) {
  const summary = summarize(w);
  w.summary = summary;
  if (summary.record) w.progress.record = summary.height;
  w.phase = "splash";
  w.phaseTime = 0;
  w.player.vx *= 0.2;
  w.player.vz *= 0.2;
  events.push({ type: "splash", summary, x: w.player.x, z: w.player.z });
}

function respawn(w: World, events: SimEvent[]) {
  const { start } = w.tower;
  w.player = newPlayer(start.x, start.y, start.z);
  w.energy = w.stats.energy;
  w.run = newRun(w.tower, w.seed, w.run.number + 1, start.y);
  w.phase = "playing";
  w.phaseTime = 0;
  events.push({ type: "respawn" });
}

/** Cambiar mejoras entre intentos (o en la orilla): la energía se llena. */
export function applyStats(w: World, stats: Stats) {
  w.stats = stats;
  if (onSafeGround(w.player)) w.energy = stats.energy;
}

export const IDLE_INPUT = IDLE;
export type { Block };

/** Altura del piso más alto debajo de un punto (para la sombra del personaje). */
export function groundBelow(w: World, x: number, z: number, y: number): number {
  let best: number = TUNING.waterY;
  const r = TUNING.playerRadius * 0.5;
  for (const b of w.tower.blocks) {
    if (b.maxY > y + 0.05 || b.maxY <= best) continue;
    if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) best = b.maxY;
  }
  for (const m of w.tower.movers) {
    if (m.kind !== "cloud") continue;
    const b = moverBox(m, w.time);
    if (b.maxY > y + 0.05 || b.maxY <= best) continue;
    if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) best = b.maxY;
  }
  return best;
}
