import type { PlayerInput } from "../../contract";
import { approach, clamp } from "../../engine/physics";
import { makeScript, onSoap, type RoundConfig, ROUNDS, type Script, STAGE } from "./level";
import { SCORING, TUNING } from "./tuning";

/**
 * Simulación de El Colchón: TypeScript puro, determinista y sin KAPLAY.
 *
 * Cuatro portadores llevan dos colchones (dos por colchón) sobre una
 * pasarela. Desde la torre se tiran saltadores: hay que atajarlos con el
 * colchón y hacerlos rebotar de un colchón al otro hasta el pelotero. Si los
 * dos de un colchón saltan juntos justo cuando cae alguien, sale con súper
 * rebote (y desde el primer colchón llega directo).
 *
 * Es compartida: en una sala online todas las compus simulan el mismo mundo
 * con las teclas de todos. Por eso solo usa sumas, productos, divisiones y
 * raíces (Math.sqrt da exactamente lo mismo en todos los navegadores; seno,
 * coseno y compañía no).
 */

export type BotSkill = {
  /** Cada cuánto vuelve a mirar dónde va a caer el próximo (s). */
  reaction: number;
  /** Error al calcular dónde ponerse (px). */
  error: number;
  /** Probabilidad de saltar para el súper rebote. */
  pump: number;
  /** Probabilidad de saltar a tiempo un rodillo. */
  hurdle: number;
};

export const BOT_SKILL: BotSkill = { reaction: 0.16, error: 20, pump: 0.55, hurdle: 0.85 };

type BotState = {
  skill: BotSkill;
  target: number;
  nextDecision: number;
  /** Saltador para el que ya decidió si bombea (cada uno se decide una vez). */
  pumpFor: number;
  /** Hora a la que salta para bombear el colchón. */
  pumpAt: number | null;
  /** Rodillos ya decididos: si los salta y si ya saltó. */
  rollers: { id: number; jump: boolean }[];
};

export type Holder = {
  /** Centro de los pies. */
  x: number;
  vx: number;
  /** Altura del salto sobre la pasarela (0 = parado). */
  h: number;
  vh: number;
  grounded: boolean;
  /** Segundos que le quedan tirado (0 = bien). */
  stun: number;
  /** Segundos que le quedan empapado. */
  soak: number;
  jumpBuffer: number;
  jumpedAt: number;
  /** null: lo maneja una persona. */
  bot: BotState | null;
};

export type JumperState = "ready" | "flying" | "splash" | "delivered" | "out";

export type Jumper = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: JumperState;
  /** Hora del último cambio de estado. */
  since: number;
  launchAt: number;
  golden: boolean;
  shirt: number;
  aim: number;
  bounces: number;
  /** Colchón del último rebote (-1 = ninguno todavía). */
  lastPair: number;
  /** Vueltas en el aire (grados, solo para dibujar). */
  spin: number;
  spinRate: number;
};

export type Balloon = { id: number; x: number; y: number; vy: number; burstAt: number | null };
export type Roller = { id: number; x: number; vx: number; hit: number[] };

export type Pair = {
  /** Hasta cuándo dura el bombeo (súper rebote). */
  pumpUntil: number;
};

export type Stats = { delivered: number; missed: number; supers: number; streak: number; bestStreak: number };

export type World = {
  round: 1 | 2 | 3;
  config: RoundConfig;
  script: Script;
  time: number;
  holders: Holder[];
  pairs: Pair[];
  jumpers: Jumper[];
  balloons: Balloon[];
  rollers: Roller[];
  cursor: { jumper: number; balloon: number; roller: number };
  nextId: number;
  /** Estado del aleatorio de los bots (mulberry32), vive en el mundo para poder clonarlo. */
  rng: number;
  score: number;
  stats: Stats;
  endedAt: number | null;
};

export type SimEvent =
  | { type: "ready"; id: number }
  | { type: "launch"; id: number }
  | { type: "bounce"; id: number; pair: number; super: boolean; x: number; y: number }
  | { type: "deliver"; id: number; golden: boolean; direct: boolean; points: number; streak: number; x: number; y: number }
  | { type: "splash"; id: number; x: number }
  | { type: "out"; id: number }
  | { type: "jump"; holder: number }
  | { type: "land"; holder: number }
  | { type: "pump"; pair: number }
  | { type: "balloon"; id: number }
  | { type: "burst"; id: number; x: number; y: number; pair: number | null; holder: number | null }
  | { type: "roller"; id: number }
  | { type: "trip"; holder: number }
  | { type: "end" };

const IDLE: PlayerInput = { move: 0, jumpPressed: false };

/** Posiciones de arranque: cada colchón en el medio de su mitad. */
const START = [330, 500, 790, 960];

/**
 * `bots[i]`: el portador i lo maneja la computadora. Los portadores 0-1 llevan
 * el primer colchón (cerca de la torre) y 2-3 el segundo (cerca del pelotero).
 */
export function createWorld(round: 1 | 2 | 3, seed: number, bots: readonly boolean[]): World {
  return {
    round,
    config: ROUNDS[round],
    script: makeScript(round, seed),
    time: 0,
    holders: START.map((x, i) => ({
      x,
      vx: 0,
      h: 0,
      vh: 0,
      grounded: true,
      stun: 0,
      soak: 0,
      jumpBuffer: 0,
      jumpedAt: -Infinity,
      bot: bots[i] ? { skill: BOT_SKILL, target: x, nextDecision: 0, pumpFor: 0, pumpAt: null, rollers: [] } : null,
    })),
    pairs: [{ pumpUntil: -Infinity }, { pumpUntil: -Infinity }],
    jumpers: [],
    balloons: [],
    rollers: [],
    cursor: { jumper: 0, balloon: 0, roller: 0 },
    nextId: 1,
    rng: (seed ^ 0x5bd1e995) | 0,
    score: 0,
    stats: { delivered: 0, missed: 0, supers: 0, streak: 0, bestStreak: 0 },
    endedAt: null,
  };
}

/** Copia para predecir o rebobinar (el guion y la ronda no cambian: se comparten). */
export function cloneWorld(w: World): World {
  return {
    ...w,
    holders: w.holders.map((h) => ({
      ...h,
      bot: h.bot && { ...h.bot, rollers: h.bot.rollers.map((r) => ({ ...r })) },
    })),
    pairs: w.pairs.map((p) => ({ ...p })),
    jumpers: w.jumpers.map((j) => ({ ...j })),
    balloons: w.balloons.map((b) => ({ ...b })),
    rollers: w.rollers.map((r) => ({ ...r, hit: [...r.hit] })),
    cursor: { ...w.cursor },
    stats: { ...w.stats },
  };
}

/** mulberry32 sobre el estado del mundo. */
function random(w: World): number {
  const a = (w.rng + 0x6d2b79f5) | 0;
  w.rng = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export type Mattress = { lx: number; ly: number; rx: number; ry: number };

/** El colchón del par `p`, de punta a punta (las manos de cada portador). */
export function mattressOf(w: World, p: number): Mattress {
  const left = w.holders[p * 2];
  const right = w.holders[p * 2 + 1];
  const end = (h: Holder) => STAGE.deckY - h.h - TUNING.holdHeight + (h.stun > 0 ? TUNING.stunDrop : 0);
  return { lx: left.x + TUNING.handReach, ly: end(left), rx: right.x - TUNING.handReach, ry: end(right) };
}

/** Altura del colchón en `x` (recortado a sus puntas). */
export function surfaceAt(m: Mattress, x: number): number {
  const t = (clamp(x, m.lx, m.rx) - m.lx) / (m.rx - m.lx);
  return m.ly + (m.ry - m.ly) * t;
}

/** Cuándo y dónde cruza un saltador la altura `y` bajando (null si no llega). */
export function landing(j: Jumper, y: number): { t: number; x: number } | null {
  const target = y - TUNING.jumperRadius;
  const disc = j.vy * j.vy + 2 * TUNING.gravity * (target - j.y);
  if (disc < 0) return null;
  const t = (-j.vy + Math.sqrt(disc)) / TUNING.gravity;
  return t < 0 ? null : { t, x: j.x + j.vx * t };
}

export function step(w: World, inputs: readonly PlayerInput[], dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  w.time += dt;
  const playing = w.endedAt === null;

  if (playing) spawn(w, events);
  w.holders.forEach((h, i) => stepHolder(w, i, h.bot ? botInput(w, i) : (inputs[i] ?? IDLE), dt, events));
  for (let p = 0; p < 2; p++) constrainPair(w, p);
  for (const j of w.jumpers) stepJumper(w, j, dt, events, playing);
  for (const b of w.balloons) stepBalloon(w, b, dt, events);
  for (const r of w.rollers) stepRoller(w, r, dt, events);

  // Limpieza: lo que ya se fue de la escena.
  w.jumpers = w.jumpers.filter((j) => j.state === "ready" || j.state === "flying" || w.time - j.since < TUNING.goneAfter);
  w.balloons = w.balloons.filter((b) => b.burstAt === null || w.time - b.burstAt < 0.6);
  w.rollers = w.rollers.filter((r) => r.x > STAGE.deckLeft - 80 && r.x < STAGE.deckRight + 80);

  if (playing && w.time >= TUNING.duration) {
    w.endedAt = w.time;
    events.push({ type: "end" });
  }
  return events;
}

function spawn(w: World, events: SimEvent[]) {
  const { script, cursor } = w;
  while (cursor.jumper < script.jumpers.length && script.jumpers[cursor.jumper].at <= w.time) {
    const s = script.jumpers[cursor.jumper++];
    const id = w.nextId++;
    w.jumpers.push({
      id,
      x: STAGE.spawn.x,
      y: STAGE.spawn.y,
      // La velocidad de salida ya queda puesta; se aplica al tirarse.
      vx: s.vx,
      vy: s.vy,
      state: "ready",
      since: w.time,
      launchAt: s.at + TUNING.readyTime,
      golden: s.golden,
      shirt: s.shirt,
      aim: s.aim,
      bounces: 0,
      lastPair: -1,
      spin: 0,
      spinRate: 0,
    });
    events.push({ type: "ready", id });
  }
  while (cursor.balloon < script.balloons.length && script.balloons[cursor.balloon].at <= w.time) {
    const s = script.balloons[cursor.balloon++];
    const id = w.nextId++;
    w.balloons.push({ id, x: s.x, y: -30, vy: 60, burstAt: null });
    events.push({ type: "balloon", id });
  }
  while (cursor.roller < script.rollers.length && script.rollers[cursor.roller].at <= w.time) {
    const s = script.rollers[cursor.roller++];
    const id = w.nextId++;
    const speed = w.config.rollers?.speed ?? 0;
    w.rollers.push({ id, x: s.dir < 0 ? STAGE.deckRight + 40 : STAGE.deckLeft - 40, vx: s.dir * speed, hit: [] });
    events.push({ type: "roller", id });
  }
}

function stepHolder(w: World, i: number, rawInput: PlayerInput, dt: number, events: SimEvent[]) {
  const h = w.holders[i];
  const stunned = h.stun > 0;
  const input = stunned ? IDLE : rawInput;
  h.stun = Math.max(0, h.stun - dt);
  h.soak = Math.max(0, h.soak - dt);

  h.jumpBuffer = input.jumpPressed ? TUNING.jumpBuffer : Math.max(0, h.jumpBuffer - dt);
  if (h.grounded && h.jumpBuffer > 0 && !stunned) {
    h.jumpBuffer = 0;
    h.grounded = false;
    h.vh = TUNING.jumpSpeed;
    h.jumpedAt = w.time;
    events.push({ type: "jump", holder: i });
    // ¿Saltó también su compañero, casi a la vez? El colchón bombea.
    const partner = w.holders[i ^ 1];
    if (w.time - partner.jumpedAt <= TUNING.pumpWindow) {
      w.pairs[i >> 1].pumpUntil = w.time + TUNING.pumpTime;
      events.push({ type: "pump", pair: i >> 1 });
    }
  }

  const soapy = w.config.soap && h.grounded && onSoap(h.x);
  const top = TUNING.walkSpeed * (h.soak > 0 ? TUNING.soakSpeed : 1);
  const move = Math.sign(input.move);
  if (move !== 0) h.vx = approach(h.vx, move * top, (soapy ? TUNING.soapAccel : TUNING.accel) * dt);
  else h.vx = approach(h.vx, 0, (soapy ? TUNING.soapDecel : TUNING.decel) * dt);
  h.x += h.vx * dt;

  if (!h.grounded) {
    h.vh -= TUNING.holderGravity * dt;
    h.h += h.vh * dt;
    if (h.h <= 0) {
      h.h = 0;
      h.vh = 0;
      h.grounded = true;
      events.push({ type: "land", holder: i });
    }
  }
}

/** Los dos de un colchón no se pueden alejar ni juntar de más: se tironean. */
function constrainPair(w: World, p: number) {
  const left = w.holders[p * 2];
  const right = w.holders[p * 2 + 1];
  const zone = STAGE.zones[p];
  // Si uno tira para su lado, arrastra al otro: se mueven juntos.
  const together = () => {
    const avg = (left.vx + right.vx) / 2;
    left.vx = avg;
    right.vx = avg;
  };
  const spread = right.x - left.x;
  if (spread > TUNING.maxSpread) {
    const excess = spread - TUNING.maxSpread;
    left.x += excess / 2;
    right.x -= excess / 2;
    if (right.vx > left.vx) together();
  } else if (spread < TUNING.minSpread) {
    const missing = TUNING.minSpread - spread;
    left.x -= missing / 2;
    right.x += missing / 2;
    if (right.vx < left.vx) together();
  }
  // Cada colchón en su mitad de la pasarela.
  if (left.x < zone.min) {
    const push = zone.min - left.x;
    left.x += push;
    right.x += push;
    if (left.vx < 0) left.vx = 0;
  }
  if (right.x > zone.max) {
    const push = right.x - zone.max;
    left.x -= push;
    right.x -= push;
    if (right.vx > 0) right.vx = 0;
  }
}

function stepJumper(w: World, j: Jumper, dt: number, events: SimEvent[], playing: boolean) {
  if (j.state === "ready") {
    if (w.time < j.launchAt) return;
    j.state = "flying";
    j.since = w.time;
    j.spinRate = 220;
    events.push({ type: "launch", id: j.id });
    return;
  }
  if (j.state !== "flying") {
    // Se hunde (o se queda en el pelotero) despacito.
    if (j.state === "splash") j.y += 60 * dt;
    return;
  }

  const px = j.x;
  const py = j.y;
  j.vy += TUNING.gravity * dt;
  j.x += j.vx * dt;
  j.y += j.vy * dt;
  j.spin += j.spinRate * dt;

  if (j.vy > 0) {
    for (let p = 0; p < 2; p++) {
      const m = mattressOf(w, p);
      if (j.x < m.lx - TUNING.catchMargin || j.x > m.rx + TUNING.catchMargin) continue;
      const before = surfaceAt(m, px);
      const now = surfaceAt(m, j.x);
      // Venía por arriba y ahora lo toca (con margen: el colchón también sube).
      if (py + TUNING.jumperRadius <= before + 8 && j.y + TUNING.jumperRadius >= now) {
        bounce(w, j, p, m, now, events, playing);
        return;
      }
    }
  }

  const { goal } = STAGE;
  if (j.vy > 0 && j.x >= goal.left + 8 && j.x <= goal.right - 4 && j.y + TUNING.jumperRadius >= goal.top) {
    deliver(w, j, events, playing);
    return;
  }
  if (j.y - TUNING.jumperRadius > STAGE.waterY - 6) {
    miss(w, j, "splash", playing);
    events.push({ type: "splash", id: j.id, x: j.x });
    return;
  }
  if (j.x > STAGE.width + 40) {
    miss(w, j, "out", playing);
    events.push({ type: "out", id: j.id });
  }
}

function bounce(w: World, j: Jumper, p: number, m: Mattress, surface: number, events: SimEvent[], playing: boolean) {
  const half = (m.rx - m.lx) / 2;
  const offset = clamp((j.x - (m.lx + half)) / half, -1, 1);
  const slope = (m.ry - m.ly) / (m.rx - m.lx);
  const pumped = w.time <= w.pairs[p].pumpUntil;
  const speed = pumped ? TUNING.superSpeed : TUNING.bounceSpeed * (1 - TUNING.edgeSoftness * Math.abs(offset));

  // Apunta al otro colchón o, desde el segundo (o con súper rebote), al pelotero.
  const toGoal = p === 1 || pumped;
  const target = toGoal ? (STAGE.goal.left + STAGE.goal.right) / 2 + j.aim * 0.3 : (STAGE.zones[1].min + STAGE.zones[1].max) / 2 + j.aim;
  const flight = (2 * speed) / TUNING.gravity;
  const aimed = (target - j.x) / flight + TUNING.edgeAim * offset + TUNING.slopeAim * slope;

  j.vx = Math.max(TUNING.minForwardSpeed, aimed);
  j.vy = -speed;
  j.y = surface - TUNING.jumperRadius;
  j.bounces++;
  j.lastPair = p;
  j.spinRate = pumped ? 720 : 360;
  if (playing) {
    w.score += pumped ? SCORING.super : SCORING.bounce;
    if (pumped) w.stats.supers++;
  }
  events.push({ type: "bounce", id: j.id, pair: p, super: pumped, x: j.x, y: surface });
}

function deliver(w: World, j: Jumper, events: SimEvent[], playing: boolean) {
  j.state = "delivered";
  j.since = w.time;
  j.y = STAGE.goal.top - 4;
  j.vx = 0;
  j.vy = 0;
  // Directo: el último rebote fue en el primer colchón (súper rebote).
  const direct = j.lastPair === 0;
  let points = 0;
  if (playing) {
    w.stats.delivered++;
    w.stats.streak++;
    w.stats.bestStreak = Math.max(w.stats.bestStreak, w.stats.streak);
    points =
      SCORING.deliver +
      (j.golden ? SCORING.golden : 0) +
      (direct ? SCORING.direct : 0) +
      SCORING.streakStep * Math.min(w.stats.streak - 1, SCORING.streakMax);
    w.score += points;
  }
  events.push({ type: "deliver", id: j.id, golden: j.golden, direct, points, streak: w.stats.streak, x: j.x, y: j.y });
}

function miss(w: World, j: Jumper, state: "splash" | "out", playing: boolean) {
  j.state = state;
  j.since = w.time;
  j.spinRate = 0;
  if (playing) {
    w.stats.missed++;
    w.stats.streak = 0;
  }
}

function stepBalloon(w: World, b: Balloon, dt: number, events: SimEvent[]) {
  if (b.burstAt !== null) return;
  const py = b.y;
  b.vy += TUNING.balloonGravity * dt;
  b.y += b.vy * dt;
  const r = TUNING.balloonRadius;
  const burst = (pair: number | null, holder: number | null) => {
    b.burstAt = w.time;
    events.push({ type: "burst", id: b.id, x: b.x, y: b.y, pair, holder });
  };

  for (let p = 0; p < 2; p++) {
    const m = mattressOf(w, p);
    if (b.x < m.lx || b.x > m.rx) continue;
    const surface = surfaceAt(m, b.x);
    if (py + r <= surface + 8 && b.y + r >= surface) {
      // Empapa el colchón: los dos se ponen lentos.
      w.holders[p * 2].soak = TUNING.soakTime;
      w.holders[p * 2 + 1].soak = TUNING.soakTime;
      b.y = surface - r;
      burst(p, null);
      return;
    }
  }
  for (let i = 0; i < w.holders.length; i++) {
    const h = w.holders[i];
    const head = STAGE.deckY - h.h - 100;
    if (Math.abs(b.x - h.x) < r + 16 && b.y + r >= head && py + r < head + 30) {
      if (h.stun <= 0) h.stun = TUNING.stunTime * 0.8;
      h.soak = TUNING.soakTime;
      burst(null, i);
      return;
    }
  }
  if (b.y > STAGE.waterY) burst(null, null);
}

function stepRoller(w: World, r: Roller, dt: number, events: SimEvent[]) {
  r.x += r.vx * dt;
  const height = TUNING.rollerRadius * 2;
  for (let i = 0; i < w.holders.length; i++) {
    const h = w.holders[i];
    if (r.hit.includes(i) || h.stun > 0) continue;
    // Perdona un poco: alcanza con levantar los pies por encima de la mitad de arriba.
    if (Math.abs(h.x - r.x) < TUNING.rollerRadius + 6 && h.h < height - 18) {
      r.hit.push(i);
      h.stun = TUNING.stunTime;
      h.vx = r.vx * 0.5;
      events.push({ type: "trip", holder: i });
    }
  }
}

// --- La computadora ----------------------------------------------------------

/** El próximo saltador que va a caer en este colchón: cuál, cuándo y dónde. */
export function nextCatch(w: World, p: number): { id: number; x: number; t: number } | null {
  const m = mattressOf(w, p);
  const y = (m.ly + m.ry) / 2;
  const zone = STAGE.zones[p];
  let best: { id: number; x: number; t: number } | null = null;
  for (const j of w.jumpers) {
    if (j.state !== "flying") continue;
    const at = landing(j, y);
    if (!at || at.x < zone.min - 30 || at.x > zone.max + 30) continue;
    if (!best || at.t < best.t) best = { id: j.id, ...at };
  }
  return best;
}

function botInput(w: World, i: number): PlayerInput {
  const h = w.holders[i];
  const bot = h.bot!;
  const p = i >> 1;
  const isLeft = i % 2 === 0;
  const zone = STAGE.zones[p];

  if (w.time >= bot.nextDecision) {
    bot.nextDecision = w.time + bot.skill.reaction * (0.8 + 0.4 * random(w));
    const target = nextCatch(w, p);
    // Sin nadie por caer: espera en el medio de su mitad.
    const center = target ? target.x + (random(w) - 0.5) * 2 * bot.skill.error : (zone.min + zone.max) / 2;
    bot.target = center + (isLeft ? -85 : 85);
    // El súper rebote se decide una vez por saltador.
    if (target && target.id !== bot.pumpFor && target.t > 0.25) {
      bot.pumpFor = target.id;
      bot.pumpAt = random(w) < bot.skill.pump ? w.time + target.t - 0.14 + (random(w) - 0.5) * 0.08 : null;
    }
  }

  let jump = false;
  if (bot.pumpAt !== null && w.time >= bot.pumpAt) {
    bot.pumpAt = null;
    jump = true;
  }

  // Rodillos: decide una vez si lo salta y salta cuando está por llegar.
  for (const r of w.rollers) {
    const reach = (h.x - r.x) / r.vx;
    let plan = bot.rollers.find((x) => x.id === r.id);
    if (!plan && reach > 0) {
      plan = { id: r.id, jump: random(w) < bot.skill.hurdle };
      bot.rollers.push(plan);
    }
    if (plan?.jump && reach > 0 && reach <= 0.28 && h.grounded) {
      plan.jump = false;
      jump = true;
    }
  }

  const gap = bot.target - h.x;
  return { move: Math.abs(gap) > 8 ? Math.sign(gap) : 0, jumpPressed: jump };
}

export function liveScore(w: World): number {
  return Math.min(SCORING.max, Math.round(w.score));
}

export const finalScore = liveScore;
