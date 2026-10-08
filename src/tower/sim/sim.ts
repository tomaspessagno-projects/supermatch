import { makeItem, type Item, rollItem } from "./items";
import {
  type Block,
  type BlockKind,
  blinkOn,
  type Box,
  CANNON_BALL,
  cannonBall,
  centerOf,
  floorAt,
  geyserOn,
  type MoverKind,
  moverBox,
  moverVelocity,
  type Net,
  type Tower,
  windBlowing,
} from "./level";
import type { Stats } from "./progression";
import { mulberry32 } from "./random";
import { TUNING } from "./tuning";

/**
 * Simulación de La Torre: TypeScript puro, sin three.js.
 *
 * Un intento: salís de la orilla, subís la fachada de la torre gastando
 * energía (por salto y por segundo), juntás fichas y objetos (la mochila tiene
 * lugar limitado) y en algún momento te caés a la pileta. Ahí se cobra: los
 * metros que subiste, el récord, las fichas y lo que traías en la mochila.
 * Después volvés a la orilla para el próximo intento.
 */

/** Eventos en vivo: cambian las reglas un rato (los elige el reloj, igual para todos). */
export type Modifier = "chips2" | "lowgrav" | "gifts" | "fame2";

export type PlayerInput = {
  /** Dirección en el piso (mundo), largo ≤ 1. La vista la calcula según la cámara. */
  moveX: number;
  moveZ: number;
  /** Flanco: se apretó el salto en este paso. */
  jumpPressed: boolean;
  /** Mantiene apretado el salto (flotador). */
  jumpHeld: boolean;
};

export type Ground = BlockKind | "cloud";

export type Player = {
  /** Centro de los pies. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  ground: Ground | null;
  /** Bloque sobre el que está parado (null en el aire o en una nube). */
  on: number | null;
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
  /** Trepando una red. */
  climbing: boolean;
  /** Después de soltarse saltando, un ratito sin agarrarse. */
  netCooldown: number;
  /** Lo está subiendo un géiser. */
  lifted: boolean;
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
  /** Lo que suman la temporada, la mascota y los eventos. */
  bonusFame: number;
  total: number;
};

export type Progress = {
  /** Mejor altura de la historia (m). */
  record: number;
  /** Último descanso al que llegaste (índice de piso, -1 = ninguno). */
  highestRest: number;
  /** Estrellas doradas ya encontradas (ids). */
  stars?: number[];
};

/** Plataformas que se desinflan: cuándo las pisaron y hasta cuándo están desinfladas. */
export type CrumbleState = { touched: number; downUntil: number };

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
  modifier: Modifier | null;
  crumbles: Record<number, CrumbleState>;
};

export type HazardKind = Exclude<MoverKind, "cloud"> | "cannon";

export type SimEvent =
  | { type: "jump"; double: boolean }
  | { type: "land"; impact: number; kind: Ground }
  | { type: "bounce"; kind: "bubble" | "trampoline"; big: boolean }
  | { type: "knock"; x: number; y: number; z: number; by: HazardKind }
  | { type: "deflate"; x: number; y: number; z: number }
  | { type: "climb" }
  | { type: "mantle" }
  | { type: "lift" }
  | { type: "chip"; value: number; x: number; y: number; z: number }
  | { type: "star"; id: number; floor: number; x: number; y: number; z: number }
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

/** Recarga de un descanso (una vez por intento). */
export const REST_REFILL = 12;
/** Premio por llegar a la cima. */
export const TOP_BONUS = 500;
/** Fama por metro por encima del récord. */
export const RECORD_FAME_PER_M = 3;

const byId = new WeakMap<Tower, Map<number, Block>>();
/** Bloque por id (con un índice armado una vez por torre). */
export function blockOf(tower: Tower, id: number): Block | undefined {
  let map = byId.get(tower);
  if (!map) {
    map = new Map(tower.blocks.map((b) => [b.id, b]));
    byId.set(tower, map);
  }
  return map.get(id);
}

export function createWorld(tower: Tower, stats: Stats, progress: Progress, seed = 1, modifier: Modifier | null = null): World {
  return {
    tower,
    stats,
    progress: { ...progress, stars: [...(progress.stars ?? [])] },
    seed,
    time: 0,
    phase: "playing",
    phaseTime: 0,
    player: newPlayer(tower.start.x, tower.start.y, tower.start.z),
    energy: stats.energy,
    run: newRun(tower, seed, 0, tower.start.y, modifier),
    summary: null,
    modifier,
    crumbles: {},
  };
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
    on: null,
    riding: null,
    coyote: 0,
    jumpBuffer: 0,
    usedDouble: false,
    stun: 0,
    facing: Math.PI / 2, // mirando para el lado de la torre (+x)
    exhausted: 0,
    slipping: false,
    gliding: false,
    safe: true,
    climbing: false,
    netCooldown: 0,
    lifted: false,
  };
}

/** Sortea qué hay en cada lugar: fichas en el camino, objetos en las cornisas. */
function newRun(tower: Tower, seed: number, number: number, startY: number, modifier: Modifier | null): Run {
  const random = mulberry32(seed * 7919 + number * 104729);
  const gifts = modifier === "gifts";
  const contents: Record<number, Content> = {};
  for (const spot of tower.spots) {
    if (spot.ledge) {
      if (gifts || random() < 0.7) contents[spot.id] = { kind: "item", item: rollItem(random, spot.floor, gifts ? 3 : 1) };
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
  p.netCooldown = Math.max(0, p.netCooldown - dt);
  stepEnergy(w, dt, events);
  climb(w, input, events);
  if (!p.climbing) moveHorizontal(w, input, dt);
  jumpAndGravity(w, input, dt, events);
  geysers(w, events);
  integrate(w, dt, events);
  crumble(w, events);
  hazards(w, events);
  pickUp(w, events);
  checkPlaces(w, events);

  if (!p.climbing && Math.abs(p.vx) + Math.abs(p.vz) > 0.5) p.facing = Math.atan2(p.vx, p.vz);
  if (p.y < TUNING.waterY) splash(w, events);
  return events;
}

const SAFE: readonly (Ground | null)[] = ["deck", "rest", "elevator", "goal"];

function stepEnergy(w: World, dt: number, events: SimEvent[]) {
  const p = w.player;
  // En la orilla y en los descansos no se gasta.
  if (!p.safe && w.energy > 0) {
    const drain = (TUNING.drainPerSecond + (p.climbing ? TUNING.climbDrain : 0)) * w.stats.drainMult;
    w.energy = Math.max(0, w.energy - drain * dt);
    if (w.energy === 0) events.push({ type: "exhausted" });
  }
  if (w.energy > 0) {
    p.exhausted = 0;
    return;
  }
  if (p.safe) return;
  p.exhausted += dt;
  if (!p.slipping && p.exhausted >= TUNING.exhaustedFor) {
    p.slipping = true;
    p.climbing = false;
    events.push({ type: "slip" });
  }
}

function touchingNet(w: World): Net | null {
  const p = w.player;
  for (const n of w.tower.nets) {
    if (p.x > n.minX - 0.1 && p.x < n.maxX + 0.1 && p.z >= n.minZ && p.z <= n.maxZ && p.y >= n.minY - 0.4 && p.y < n.maxY) return n;
  }
  return null;
}

/** Redes: apretando hacia la pared (adelante) se trepa; arriba se sube al borde solo. */
function climb(w: World, input: PlayerInput, events: SimEvent[]) {
  const p = w.player;
  const net = p.netCooldown > 0 ? null : touchingNet(w);
  if (!net || input.moveZ > -0.35 || w.energy <= 0 || p.slipping) {
    p.climbing = false;
    return;
  }
  if (p.y >= net.maxY - 0.15) {
    // Arriba de todo: se sube al borde (un saltito para adentro).
    if (p.climbing) {
      p.climbing = false;
      p.vy = TUNING.mantleSpeed;
      p.vz = -TUNING.mantlePush;
      events.push({ type: "mantle" });
    }
    return;
  }
  if (!p.climbing) events.push({ type: "climb" });
  p.climbing = true;
  p.grounded = false;
  p.on = null;
  p.riding = null;
  p.usedDouble = false;
  p.vx = input.moveX * TUNING.climbSide;
  p.vz = -1.5;
  p.vy = TUNING.climbSpeed;
  p.facing = Math.PI;
}

function moveHorizontal(w: World, input: PlayerInput, dt: number) {
  const p = w.player;
  if (p.slipping) {
    // Sin piernas: se va resbalando para afuera, a la pileta.
    p.vx *= 0.9;
    p.vz = TUNING.slipSpeed;
    return;
  }
  const len = Math.sqrt(input.moveX * input.moveX + input.moveZ * input.moveZ);
  const scale = len > 1 ? 1 / len : 1;
  const grip = w.stats.grip;
  // Ventiladores: cuando soplan, te arrastran (el agarre lo aguanta mejor).
  let driftX = 0;
  let driftZ = 0;
  for (const wind of w.tower.winds) {
    if (!inside(wind, p.x, p.y + 0.8, p.z) || !windBlowing(wind, w.time)) continue;
    const force = TUNING.windDrift * (1 - 0.25 * grip) * (p.grounded ? TUNING.windGroundFactor : 1);
    driftX += wind.dirX * force;
    driftZ += wind.dirZ * force;
  }
  // La bola roja es redonda: si no estás en el medio, te vas cayendo para el costado.
  const block = p.grounded && p.on !== null ? blockOf(w.tower, p.on) : undefined;
  if (block?.kind === "ball") {
    const c = centerOf(block);
    driftX += (p.x - c.x) * TUNING.ballRoll;
    driftZ += (p.z - c.z) * TUNING.ballRoll;
  }
  const tx = input.moveX * scale * TUNING.moveSpeed + driftX;
  const tz = input.moveZ * scale * TUNING.moveSpeed + driftZ;
  const soapy = p.grounded && p.ground === "soap";
  const ball = p.grounded && p.ground === "ball";
  const pushing = len > 0.01 || driftX !== 0 || driftZ !== 0;
  let rate: number;
  if (!p.grounded) rate = pushing ? TUNING.airAccel : TUNING.airDecel;
  else if (soapy) rate = pushing ? TUNING.soapAccel + grip * 4 : TUNING.soapDecel + grip * 2;
  else if (ball) rate = (pushing ? TUNING.ballAccel : TUNING.ballDecel) + grip * 4;
  else rate = pushing ? TUNING.groundAccel : TUNING.groundDecel;
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
    if (p.climbing) {
      // Se suelta de la red saltando para atrás.
      p.climbing = false;
      p.netCooldown = TUNING.netCooldown;
      p.vy = w.stats.jumpSpeed * 0.85;
      p.vz = TUNING.netJumpOut;
      p.jumpBuffer = 0;
      spend(w, events);
      events.push({ type: "jump", double: false });
    } else if (p.coyote > 0) {
      p.vy = w.stats.jumpSpeed;
      p.grounded = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      p.on = null;
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
  if (p.climbing) {
    p.gliding = false;
    return;
  }
  const gravity = TUNING.gravity * (w.modifier === "lowgrav" ? TUNING.lowGravity : 1);
  p.vy = Math.max(-TUNING.maxFallSpeed, p.vy - gravity * dt);
  p.gliding = w.stats.float && !p.grounded && input.jumpHeld && p.vy < -TUNING.glideFallSpeed;
  if (p.gliding) p.vy = -TUNING.glideFallSpeed;
}

function spend(w: World, events: SimEvent[]) {
  // Desde la orilla o un descanso (y en el aire después de salir de ahí) no se gasta.
  if (w.player.safe) return;
  const before = w.energy;
  w.energy = Math.max(0, w.energy - TUNING.jumpCost * w.stats.drainMult);
  if (before > 0 && w.energy === 0) events.push({ type: "exhausted" });
}

/** Géiseres: mientras salen, si estás en el chorro te suben. */
function geysers(w: World, events: SimEvent[]) {
  const p = w.player;
  let lifted = false;
  for (const g of w.tower.geysers) {
    if (!geyserOn(g, w.time)) continue;
    if (p.x > g.minX && p.x < g.maxX && p.z > g.minZ && p.z < g.maxZ && p.y >= g.minY - 0.2 && p.y < g.maxY) {
      lifted = true;
      p.vy = Math.max(p.vy, TUNING.geyserSpeed);
      p.grounded = false;
      p.on = null;
    }
  }
  if (lifted && !p.lifted) events.push({ type: "lift" });
  p.lifted = lifted;
}

const inside = (b: Box, x: number, y: number, z: number) =>
  x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ;

type Solid = { box: Box; kind: Ground; id: number; mover: boolean };

/** ¿Se puede pisar este bloque ahora? (las parpadeantes y las desinfladas, no). */
export function solidNow(w: World, b: Block): boolean {
  if (b.kind === "elevator") return false; // es un dibujo en el piso del muelle
  if (b.kind === "blink") return blinkOn(b, w.time);
  if (b.kind === "crumble") return w.time >= (w.crumbles[b.id]?.downUntil ?? 0);
  return true;
}

/** Lo sólido cerca del jugador: bloques y nubes donde están ahora. */
function solidsNear(w: World): Solid[] {
  const p = w.player;
  const out: Solid[] = [];
  for (const b of w.tower.blocks) {
    if (b.maxY < p.y - 3 || b.minY > p.y + 4) continue;
    if (!solidNow(w, b)) continue;
    out.push({ box: b, kind: b.kind, id: b.id, mover: false });
  }
  for (const m of w.tower.movers) {
    if (m.kind !== "cloud") continue;
    const box = moverBox(m, w.time);
    if (box.maxY < p.y - 3 || box.minY > p.y + 4) continue;
    out.push({ box, kind: "cloud", id: m.id, mover: true });
  }
  return out;
}

function integrate(w: World, dt: number, events: SimEvent[]) {
  const p = w.player;
  const r = TUNING.playerRadius;
  const h = TUNING.playerHeight;

  // Lo que te lleva: la nube, la cinta, la calesita.
  if (p.grounded && p.riding !== null) {
    const m = w.tower.movers.find((x) => x.id === p.riding);
    if (m) {
      const now = moverBox(m, w.time);
      const before = moverBox(m, w.time - dt);
      p.x += now.minX - before.minX;
      p.z += now.minZ - before.minZ;
    }
  } else if (p.grounded && p.on !== null) {
    const b = blockOf(w.tower, p.on);
    if (b?.kind === "conveyor") p.x += (b.belt ?? 0) * dt;
    if (b?.kind === "spinner") {
      const c = centerOf(b);
      const a = (b.spin ?? 0) * dt;
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      p.x = c.x + dx * Math.cos(a) + dz * Math.sin(a);
      p.z = c.z - dx * Math.sin(a) + dz * Math.cos(a);
      p.facing += a;
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
  p.on = landed && !landed.mover ? landed.id : null;
  p.riding = landed?.mover ? landed.id : null;
  if (landed) {
    p.usedDouble = false;
    p.climbing = false;
    p.safe = SAFE.includes(landed.kind);
    if (!wasGrounded) events.push({ type: "land", impact: -vyBefore, kind: landed.kind });
    if (landed.kind === "bubble" || landed.kind === "trampoline") {
      // Rebota; si venías con el salto apretado, más alto.
      const big = p.jumpBuffer > 0;
      const speed = landed.kind === "bubble" ? TUNING.bounceSpeed : TUNING.trampolineSpeed;
      p.vy = speed * (big ? TUNING.superBounce : 1);
      p.jumpBuffer = 0;
      p.grounded = false;
      p.on = null;
      events.push({ type: "bounce", kind: landed.kind, big });
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
}

/** Las que se desinflan: aguantan un ratito desde que las pisás y después vuelven. */
function crumble(w: World, events: SimEvent[]) {
  const p = w.player;
  if (p.grounded && p.ground === "crumble" && p.on !== null) {
    const c = (w.crumbles[p.on] ??= { touched: -1, downUntil: 0 });
    if (c.touched < 0) c.touched = w.time;
  }
  for (const [key, c] of Object.entries(w.crumbles)) {
    if (c.touched < 0 || w.time - c.touched < TUNING.crumbleDelay) continue;
    c.touched = -1;
    c.downUntil = w.time + TUNING.crumbleDown;
    const b = blockOf(w.tower, Number(key));
    if (b) events.push({ type: "deflate", ...centerOf(b) });
  }
}

/** Barredoras, martillos, guantes y cañones: si te tocan, volás. */
function hazards(w: World, events: SimEvent[]) {
  const p = w.player;
  if (p.stun > 0) return;
  const r = TUNING.playerRadius;
  const h = TUNING.playerHeight;
  const hit = (by: HazardKind, vx: number, vz: number) => {
    p.vx = vx;
    p.vz = vz;
    p.vy = TUNING.knockLift;
    p.grounded = false;
    p.climbing = false;
    p.on = null;
    p.riding = null;
    p.stun = TUNING.stunTime;
    events.push({ type: "knock", x: p.x, y: p.y + 1, z: p.z, by });
  };
  for (const m of w.tower.movers) {
    if (m.kind === "cloud") continue;
    const b = moverBox(m, w.time);
    const touching = p.x + r > b.minX && p.x - r < b.maxX && p.y + h > b.minY && p.y < b.maxY && p.z + r > b.minZ && p.z - r < b.maxZ;
    if (!touching) continue;
    if (m.kind === "piston") return hit("piston", p.vx * 0.3, TUNING.pistonKnock);
    // Te tira para donde va.
    const dir = moverVelocity(m, w.time) >= 0 ? 1 : -1;
    return hit(m.kind, m.axis === "x" ? dir * TUNING.knockSpeed : p.vx * 0.3, m.axis === "z" ? dir * TUNING.knockSpeed : p.vz * 0.3);
  }
  for (const c of w.tower.cannons) {
    const ball = cannonBall(c, w.time);
    if (!ball) continue;
    const dx = ball.x - p.x;
    const dz = ball.z - p.z;
    const reach = CANNON_BALL + r;
    if (dx * dx + dz * dz > reach * reach || ball.y < p.y - CANNON_BALL || ball.y > p.y + h + CANNON_BALL) continue;
    return hit("cannon", c.dx * TUNING.knockSpeed, c.dz * TUNING.knockSpeed);
  }
}

function pickUp(w: World, events: SimEvent[]) {
  const p = w.player;
  const radius = w.stats.pickRadius;
  const cy = p.y + 0.8;
  // Estrellas doradas: se cuentan al tocarlas (quedan para siempre).
  const found = (w.progress.stars ??= []);
  for (const star of w.tower.stars) {
    if (found.includes(star.id)) continue;
    const dx = star.x - p.x;
    const dy = star.y - cy;
    const dz = star.z - p.z;
    if (dx * dx + dy * dy + dz * dz > (radius + 0.4) * (radius + 0.4)) continue;
    found.push(star.id);
    events.push({ type: "star", id: star.id, floor: star.floor, x: star.x, y: star.y, z: star.z });
  }
  for (const spot of w.tower.spots) {
    const content = w.run.contents[spot.id];
    if (!content) continue;
    const dx = spot.x - p.x;
    const dy = spot.y - cy;
    const dz = spot.z - p.z;
    if (dx * dx + dy * dy + dz * dz > (radius + 0.4) * (radius + 0.4)) continue;
    if (content.kind === "chip") {
      const value = Math.round(content.value * w.stats.chipMult * (w.modifier === "chips2" ? 2 : 1));
      w.run.chips += value;
      delete w.run.contents[spot.id];
      events.push({ type: "chip", value, x: spot.x, y: spot.y, z: spot.z });
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
  if (p.ground === "deck" && w.stats.elevator && w.progress.highestRest >= 0 && p.x > el.minX && p.x < el.maxX && p.z > el.minZ && p.z < el.maxZ) {
    const f = Math.min(w.progress.highestRest, tower.rests.length - 2);
    const spot = tower.restSpots[f];
    Object.assign(p, newPlayer(spot.x, spot.y, spot.z));
    run.startY = spot.y;
    run.maxY = spot.y;
    run.floor = f + 1;
    run.refilled.push(f); // ya está descansado
    events.push({ type: "elevator", floor: f });
  }
}

export function summarize(w: World): RunSummary {
  const { run, progress, stats } = w;
  const height = Math.max(0, run.maxY);
  const climbed = Math.max(0, run.maxY - run.startY);
  const record = height > progress.record + 0.05;
  const recordFame = record ? Math.round((height - progress.record) * RECORD_FAME_PER_M) : 0;
  const heightFame = Math.round(climbed);
  const itemsFame = run.bag.reduce((sum, item) => sum + item.value, 0) + (run.reachedTop ? TOP_BONUS : 0);
  const base = heightFame + recordFame + run.chips + itemsFame;
  const multiplier = stats.fameMult * (w.modifier === "fame2" ? 2 : 1);
  const bonusFame = Math.round(base * (multiplier - 1));
  return {
    height: Math.round(height * 10) / 10,
    climbed: Math.round(climbed * 10) / 10,
    record,
    heightFame,
    recordFame,
    chips: run.chips,
    items: [...run.bag],
    itemsFame,
    bonusFame,
    total: base + bonusFame,
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
  w.player.climbing = false;
  events.push({ type: "splash", summary, x: w.player.x, z: w.player.z });
}

function respawn(w: World, events: SimEvent[]) {
  const { start } = w.tower;
  w.player = newPlayer(start.x, start.y, start.z);
  w.energy = w.stats.energy;
  w.run = newRun(w.tower, w.seed, w.run.number + 1, start.y, w.modifier);
  w.phase = "playing";
  w.phaseTime = 0;
  events.push({ type: "respawn" });
}

/** Cambiar mejoras entre intentos (o en la orilla): la energía se llena. */
export function applyStats(w: World, stats: Stats) {
  w.stats = stats;
  if (w.player.safe) w.energy = stats.energy;
}

export const IDLE_INPUT = IDLE;
export type { Block };

/** Altura del piso más alto debajo de un punto (para la sombra del personaje). */
export function groundBelow(w: World, x: number, z: number, y: number): number {
  let best: number = TUNING.waterY;
  const r = TUNING.playerRadius * 0.5;
  for (const b of w.tower.blocks) {
    if (b.maxY > y + 0.05 || b.maxY <= best || b.kind === "wall" || !solidNow(w, b)) continue;
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
