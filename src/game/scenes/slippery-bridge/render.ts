import type { KAPLAYCtx } from "kaplay";
import { FONT, hasSprite, SPRITES, type SpriteName } from "../../assets";
import { createAnimator } from "../../engine/animator";
import { createContestant } from "../../engine/contestant";
import { createFx } from "../../engine/fx";
import { clamp, spring } from "../../engine/physics";
import { createReferee } from "../../engine/referee";
import { createRankTracker, createShow } from "../../engine/show";
import {
  BALL_RADIUS,
  CANNON_WARNING,
  cannonBalls,
  hammerHead,
  hammerPivotY,
  puddleAt,
  rollerCenterY,
} from "./level";
import type { SimEvent, World } from "./sim";
import { TUNING } from "./tuning";

const VIEW_W = 1280;
const VIEW_H = 720;
const RUN_OFF = 1200; // puente extra después de la meta
const PILLAR_EVERY = 320;
const STUDIO_PARALLAX = 0.25;
const ZOOM = 1.25; // de cerca se lee el dibujo; el hitbox no cambia
const LOOK_AHEAD = 250; // px por delante del jugador: tiempo para reaccionar
const CAM_Y = 370;
const HALF_VIEW = VIEW_W / 2 / ZOOM;
const CONFETTI = Object.keys(SPRITES).filter((n) => n.startsWith("fx-confetti-"));

// Opcionales: si todavía no se generaron, se dibuja un reemplazo por código.
const STUDIO: string = "bg-studio";
const DECK: string = "deck-tile";
const DECK_H = 66; // alto del tablero en px de juego (con la espuma)
const DECK_SURFACE = 0.255; // fracción del sprite donde está el riel pisable
const DECK_THICKNESS = 36; // del riel al borde inferior del panel
const POOL_Y = 60; // nivel del agua de la pileta, bajo el piso
const RIVAL_OPACITY = 0.55;
const RIVAL_Y = -10; // un poco más atrás en el puente
const REFEREE_START_X = 92;

// Martillo: la argolla y el centro de la cabeza medidos en el sprite.
const HAMMER_W = 112;
const HAMMER_RING = { x: 0.705, y: 0.063 };
const HAMMER_HEAD = { x: 0.509, y: 0.745 };
const HAMMER_TILT = -10.7; // ° para que la soga del dibujo quede vertical

const CANNON_W = 100;
const CANNON_MUZZLE_Y = 0.32;

// Inflables flotando en la pileta.
const DECOR = [
  { sprite: "prop-duck", x: 1150, width: 80 },
  { sprite: "prop-shark", x: 3000, width: 170 },
  { sprite: "prop-duck", x: 4800, width: 80 },
  { sprite: "prop-shark", x: 6000, width: 170 },
  { sprite: "prop-duck", x: 7700, width: 80 },
] as const;

const KNOCK_TEXT = { roller: "¡BOING!", hammer: "¡PAF!", ball: "¡PUM!" } as const;
const STREAK_LIFE = 0.3;

type Streak = { x: number; y: number; len: number; age: number };

/**
 * Dibuja el Puente a partir del estado de la simulación. Solo guarda estado
 * visual (cámara, animación, efectos); nunca modifica `world`.
 */
export function createRenderer(
  k: KAPLAYCtx,
  teamColor: string,
  rivalTeams: readonly { color: string; name: string; tag?: string }[],
) {
  const c = {
    team: k.rgb(teamColor),
    ink: k.rgb("#1f1147"),
    water: k.rgb("#22d3ee"),
    waterDeep: k.rgb("#0e7490"),
    waterAbyss: k.rgb("#123a6b"),
    deck: k.rgb("#e0f2fe"),
    deckEdge: k.rgb("#7dd3fc"),
    white: k.rgb("#ffffff"),
    rope: k.rgb("#e2c48f"),
    star: k.rgb("#facc15"),
    danger: k.rgb("#f87171"),
    belt: k.rgb("#4b5563"),
    beltRoller: k.rgb("#9ca3af"),
    good: k.rgb("#4ade80"),
  };
  const fx = createFx(k, FONT);
  const referee = createReferee(k);
  const show = createShow(k, [teamColor, ...rivalTeams.map((r) => r.color)]);
  const ranking = createRankTracker(rivalTeams.map((r) => r.name.toUpperCase()));
  const player = { look: createContestant(k, teamColor), anim: createAnimator() };
  const rivals = rivalTeams.map((team) => ({
    color: k.rgb(team.color),
    tag: team.tag,
    look: createContestant(k, team.color),
    anim: createAnimator(),
  }));

  let camX: number | null = null;
  let camY = CAM_Y;
  let zoom = ZOOM;
  let punch = 0;
  let punchVel = 0;
  let bannerAge = 0;
  let time = 0;
  let rank = 1;
  let callout: { text: string; good: boolean; age: number } | null = null;
  const streaks: Streak[] = [];
  const padSquash = new Map<number, number>();
  const aimingUntil = new Map<number, number>();
  const recoil = new Map<number, number>();

  /** Golpe de cámara: positivo acerca, negativo aleja. */
  const kick = (amount: number) => {
    punchVel += amount * 30;
  };

  function react(events: readonly SimEvent[], world: World) {
    const p = world.player;
    const { floorY: floor, trampolines, cannons } = world.level;
    player.anim.react(events);
    for (const e of events) {
      switch (e.type) {
        case "jump":
          fx.burst({ x: p.x, y: floor - 6, count: 4, speed: 140, sprites: ["fx-bubbles"], size: 20, spread: 140, gravity: -250, life: 0.7 });
          break;
        case "land":
          if (e.impact > 500) {
            fx.flash("fx-puff", p.x, floor + 4, { anchor: "bot", from: 0.15, to: 0.4, life: 0.45 });
            k.shake(2 + e.impact / 300);
          }
          break;
        case "wall":
          if (e.impact > 300) {
            fx.popup("¡PUM!", p.x + 50, p.y - 150, c.white, { size: 44, backdrop: "fx-burst", backdropSize: 150 });
            k.shake(6);
          }
          break;
        case "bonk":
          fx.burst({ x: (p.x + e.x) / 2, y: (p.y - 50 + e.y) / 2, count: 12, speed: 560, sprites: ["fx-star"], size: 22, spread: 360 });
          fx.popup(KNOCK_TEXT[e.by], e.x, e.y - 120, c.star, { size: 50, backdrop: "fx-burst", backdropSize: 210 });
          k.shake(14);
          kick(0.1);
          show.excite(0.45);
          break;
        case "launch": {
          padSquash.set(trampolines.findIndex((t) => (t.x0 + t.x1) / 2 === e.x), 1);
          fx.flash("fx-puff", e.x, floor + 6, { anchor: "bot", from: 0.15, to: 0.45, life: 0.4 });
          fx.popup("¡YUJUUU!", e.x + 60, floor - 200, c.white, { size: 40 });
          kick(-0.12);
          show.excite(0.35);
          break;
        }
        case "pompa":
          fx.burst({ x: e.x, y: e.y, count: 14, speed: 360, sprites: CONFETTI, size: 12, spread: 360, life: 0.8, gravity: 400 });
          fx.burst({ x: e.x, y: e.y, count: 6, speed: 220, sprites: ["fx-star"], size: 16, spread: 360, life: 0.6 });
          fx.popup("+15", e.x, e.y - 50, c.star, { size: 36 });
          show.excite(0.2);
          break;
        case "aim":
          aimingUntil.set(
            cannons.findIndex((cn) => cn.x === e.x),
            world.time + CANNON_WARNING,
          );
          break;
        case "fire":
          recoil.set(
            cannons.findIndex((cn) => cn.x === e.x),
            1,
          );
          if (Math.abs(e.x - p.x) < VIEW_W) {
            fx.flash("fx-puff", e.x - 40, floor - 22, { anchor: "center", from: 0.1, to: 0.3, life: 0.35 });
          }
          break;
        case "splash":
          referee.card();
          fx.flash("fx-splash", e.x, floor + 40, { anchor: "bot", from: 0.5, to: 1.1, life: 0.8 });
          fx.burst({ x: e.x, y: floor + 14, count: 28, speed: 760, colors: [c.water, c.white, c.deckEdge], size: 14, spread: 70, life: 1 });
          fx.popup("¡PLAF!", e.x, floor - 170, c.water, { size: 60 });
          k.shake(10);
          kick(0.14);
          show.excite(0.9);
          break;
        case "timeout":
          referee.end();
          show.excite(0.5);
          break;
        case "finish":
          referee.end();
          fx.burst({ x: p.x, y: p.y - 120, count: 70, speed: 700, sprites: CONFETTI, size: 18, spread: 150, life: 1.8, gravity: 500 });
          kick(0.12);
          show.excite(1);
          break;
        case "checkpoint":
          fx.burst({ x: e.x, y: floor - 90, count: 14, speed: 380, sprites: CONFETTI, size: 14, spread: 120, life: 1, gravity: 600 });
          fx.popup("¡BANDERA!", e.x, floor - 170, c.team, { size: 36 });
          show.excite(0.2);
          break;
        case "respawn":
          // Cae desde arriba de la bandera.
          fx.flash("fx-puff", e.x, floor - TUNING.respawnDrop - 40, { anchor: "center", from: 0.2, to: 0.5, life: 0.5 });
          break;
      }
    }
  }

  /** Lo que les pasa a los rivales: animación y efectos discretos (sin sacudón ni carteles). */
  function reactRival(i: number, events: readonly SimEvent[], world: World) {
    rivals[i]?.anim.react(events);
    const floor = world.level.floorY;
    for (const e of events) {
      if (e.type === "splash") {
        fx.burst({ x: e.x, y: floor + 14, count: 10, speed: 520, colors: [c.water, c.white], size: 10, spread: 60, life: 0.7 });
      } else if (e.type === "bonk") {
        fx.burst({ x: e.x, y: e.y, count: 5, speed: 360, sprites: ["fx-star"], size: 14, spread: 360 });
      }
    }
  }

  function update(dt: number, world: World, rivalWorlds: readonly World[], move: number) {
    const p = world.player;
    const { floorY } = world.level;
    time += dt;
    fx.update(dt);
    referee.update(dt);
    show.update(dt);
    player.anim.update(dt, p, move);
    rivalWorlds.forEach((w, i) => {
      const vx = w.player.vx;
      rivals[i]?.anim.update(dt, w.player, Math.abs(vx) > 40 ? Math.sign(vx) : 0);
    });

    // Líneas de velocidad: a fondo sobre el jabón, el aire se raya.
    if (p.grounded && !p.ragdoll && Math.abs(p.vx) > 480 && world.respawnIn === 0 && Math.random() < dt * 30) {
      const dir = Math.sign(p.vx);
      streaks.push({ x: p.x - dir * 30, y: p.y - 10 - Math.random() * 80, len: dir * (30 + Math.random() * 40), age: 0 });
    }
    for (const s of streaks) s.age += dt;
    while (streaks.length && streaks[0].age > STREAK_LIFE) streaks.shift();

    for (const [i, v] of padSquash) padSquash.set(i, Math.max(0, v - dt * 4));
    for (const [i, v] of recoil) recoil.set(i, Math.max(0, v - dt * 5));

    // Cámara: adelante del jugador; sube y se aleja si vuela alto (trampolín).
    const minCam = world.level.wallX - 60 + HALF_VIEW;
    const targetX = clamp(p.x + LOOK_AHEAD, minCam, world.level.finishX + RUN_OFF - HALF_VIEW);
    const height = floorY - p.y;
    // En vertical se adelanta a la velocidad: al salir del trampolín la cámara ya está subiendo.
    const targetY = world.respawnIn > 0 ? CAM_Y : Math.min(CAM_Y, p.y + 140 + Math.min(0, p.vy) * 0.18);
    const targetZoom = ZOOM - 0.18 * clamp((height - 150) / 280, 0, 1);
    const follow = Math.min(1, dt * 6);
    camX = camX === null ? targetX : camX + (targetX - camX) * follow;
    camY += (targetY - camY) * Math.min(1, dt * (targetY < camY ? 10 : 4));
    zoom += (targetZoom - zoom) * Math.min(1, dt * 4);
    [punch, punchVel] = spring(punch, punchVel, 0, 220, 16, dt);
    k.setCamPos(camX, camY);
    k.setCamScale(zoom * (1 + punch));

    // Puesto en la carrera y avisos de adelantamiento.
    const race = ranking.update(p.maxX, rivalWorlds.map((w) => w.player.maxX), world.time);
    rank = race.rank;
    if (race.calls.length && world.outcome === null) callout = { ...race.calls[race.calls.length - 1], age: 0 };
    if (callout) {
      callout.age += dt;
      if (callout.age > 1.8) callout = null;
    }

    bannerAge = world.outcome ? bannerAge + dt : 0;
  }

  function draw(world: World, rivalWorlds: readonly World[]) {
    const center = camX ?? VIEW_W / 2;
    const halfView = VIEW_W / 2 / (zoom * (1 + punch));
    const left = center - halfView - 200;
    const right = center + halfView + 200;
    drawStudio(center);
    show.drawLights();
    drawPool(world, left, right);
    drawCannons(world, left, right);
    drawBridge(world);
    drawConveyors(world, left, right);
    drawTrampolines(world, left, right);
    drawFlags(world);
    // El árbitro: da la largada y espera en la meta mirando para atrás.
    referee.draw(REFEREE_START_X, world.level.floorY + 4, 84);
    referee.draw(world.level.finishX + 190, world.level.floorY + 4, 92, { flip: true });
    drawRivals(rivalWorlds, left, right);
    drawShadow(world);
    drawStreaks();
    if (world.respawnIn === 0) {
      player.look.draw(player.anim.pose(world.player, world.time, { celebrate: world.outcome === "finished" }));
    }
    drawPuddleWater(world);
    drawRollers(world, left, right);
    drawHammers(world, left, right);
    drawBalls(world, left, right);
    drawPompas(world, left, right);
    fx.draw();
    show.drawCrowd(center);
    drawOverlay(world, rivalWorlds);
  }

  // --- escenario ------------------------------------------------------------

  function drawRivals(rivalWorlds: readonly World[], left: number, right: number) {
    rivalWorlds.forEach((w, i) => {
      const rival = rivals[i];
      const p = w.player;
      if (!rival || w.respawnIn > 0 || p.x < left || p.x > right) return;
      rival.look.draw(rival.anim.pose(w.player, w.time, { yOffset: RIVAL_Y, opacity: RIVAL_OPACITY }));
      // Marcador del equipo sobre la cabeza (y el apodo, si es una persona).
      k.drawCircle({ pos: k.vec2(p.x, p.y + RIVAL_Y - 132), radius: 7, color: rival.color, outline: { width: 3, color: c.ink }, opacity: 0.9 });
      if (rival.tag) drawTag(rival.tag, p.x, p.y + RIVAL_Y - 156);
    });
  }

  function drawTag(text: string, x: number, y: number) {
    k.drawText({ text, pos: k.vec2(x + 2, y + 2), size: 20, font: FONT, anchor: "center", color: c.ink });
    k.drawText({ text, pos: k.vec2(x, y), size: 20, font: FONT, anchor: "center", color: c.white });
  }

  function drawFlags(world: World) {
    const { floorY, checkpoints } = world.level;
    for (const x of checkpoints.slice(1)) {
      // Blanca hasta que la pasás; después, del color de tu equipo.
      const reached = world.checkpoint >= x;
      if (hasSprite("prop-flag")) {
        k.drawSprite({
          sprite: "prop-flag",
          pos: k.vec2(x, floorY + 4),
          anchor: "bot",
          height: 120,
          color: reached ? c.team : c.white,
          angle: Math.sin(world.time * 3 + x) * 2,
        });
        continue;
      }
      k.drawLine({ p1: k.vec2(x, floorY + 2), p2: k.vec2(x, floorY - 110), width: 5, color: c.ink });
      const top = floorY - 108;
      const wave = Math.sin(world.time * 6 + x) * 4;
      k.drawPolygon({
        pts: [k.vec2(x + 2, top), k.vec2(x + 54, top + 14 + wave), k.vec2(x + 2, top + 30)],
        color: reached ? c.team : c.white,
        outline: { width: 3, color: c.ink },
      });
    }
  }

  /** Repite un sprite en horizontal, alineado al mundo y espejado cada vez para que no se note la unión. */
  function tileStrip(sprite: SpriteName, x0: number, x1: number, y: number, height: number, opacity = 1) {
    const tw = (SPRITES[sprite].w / SPRITES[sprite].h) * height;
    for (let i = Math.floor(x0 / tw); i * tw < x1; i++) {
      const a = Math.max(x0, i * tw);
      const b = Math.min(x1, (i + 1) * tw);
      if (b <= a) continue;
      const u0 = (a - i * tw) / tw;
      const u1 = (b - i * tw) / tw;
      const flip = i % 2 !== 0;
      k.drawSprite({
        sprite,
        pos: k.vec2(a, y),
        width: b - a,
        height,
        flipX: flip,
        quad: flip ? k.quad(1 - u1, 0, u1 - u0, 1) : k.quad(u0, 0, u1 - u0, 1),
        opacity,
      });
    }
  }

  function drawStudio(center: number) {
    if (!hasSprite(STUDIO)) return; // el color de fondo de KAPLAY hace de reemplazo
    const tw = (SPRITES[STUDIO].w / SPRITES[STUDIO].h) * VIEW_H;
    const scroll = center * STUDIO_PARALLAX;
    for (let i = Math.floor(scroll / tw); i * tw < scroll + VIEW_W; i++) {
      k.drawSprite({ sprite: STUDIO, pos: k.vec2(i * tw - scroll, 0), width: tw, height: VIEW_H, flipX: i % 2 !== 0, fixed: true });
    }
  }

  function drawWater(x: number, width: number, top: number) {
    const depth = 150;
    k.drawRect({ pos: k.vec2(x, top), width, height: depth, gradient: [c.water, c.waterAbyss] });
    k.drawRect({ pos: k.vec2(x, top + depth), width, height: VIEW_H, color: c.waterAbyss });
  }

  function drawPool(world: World, left: number, right: number) {
    const { floorY, wallX, finishX } = world.level;
    drawWater(left, right - left, floorY + POOL_Y);
    // Pilares: arriba del agua enteros, abajo apenas se ven.
    for (let x = Math.ceil(left / PILLAR_EVERY) * PILLAR_EVERY; x < right; x += PILLAR_EVERY) {
      if (x < wallX || x > finishX + RUN_OFF || puddleAt(world.level, x)) continue;
      const pos = k.vec2(x, floorY + DECK_THICKNESS - 4);
      k.drawSprite({ sprite: "prop-pillar", pos, anchor: "top", width: 46, height: 230, opacity: 0.3 });
      k.drawSprite({ sprite: "prop-pillar", pos, anchor: "top", width: 46, height: 230 * 0.12, quad: k.quad(0, 0, 1, 0.12) });
    }
    // Inflables flotando: la pileta es parte del programa.
    for (const [i, d] of DECOR.entries()) {
      if (!hasSprite(d.sprite) || d.x < left - 200 || d.x > right + 200) continue;
      k.drawSprite({
        sprite: d.sprite,
        pos: k.vec2(d.x + Math.sin(world.time * 0.4 + i) * 20, floorY + POOL_Y + 22 + Math.sin(world.time * 1.5 + i) * 3),
        anchor: "bot",
        width: d.width,
        angle: Math.sin(world.time * 1.1 + i) * 4,
      });
    }
    const bob = Math.sin(world.time * 1.6) * 3;
    tileStrip("prop-water", left, right, floorY + POOL_Y - 14 + bob, 30);
  }

  function drawBridge(world: World) {
    const { floorY, wallX, finishX, puddles } = world.level;

    // Bumper de largada y arco de meta (detrás del jugador).
    k.drawSprite({ sprite: "prop-bumper", pos: k.vec2(wallX + 6, floorY + 6), anchor: "botright", height: 210 });
    k.drawSprite({ sprite: "prop-arch", pos: k.vec2(finishX + 13, floorY + 14), anchor: "bot", width: 320 });
    k.drawText({ text: "META", pos: k.vec2(finishX + 13, floorY - 250), size: 56, font: FONT, anchor: "center", color: c.star });

    let from = wallX - 40;
    for (const gap of [...puddles, { x0: finishX + RUN_OFF, x1: Infinity }]) {
      if (Number.isFinite(gap.x1)) {
        k.drawRect({ pos: k.vec2(gap.x0, floorY), width: gap.x1 - gap.x0, height: POOL_Y, color: c.waterDeep });
      }
      drawDeck(from, gap.x0, floorY);
      from = gap.x1;
    }
  }

  function drawDeck(x0: number, x1: number, floorY: number) {
    if (x1 <= x0) return;
    if (hasSprite(DECK)) {
      tileStrip(DECK, x0, x1, floorY - DECK_H * DECK_SURFACE, DECK_H);
    } else {
      k.drawRect({ pos: k.vec2(x0, floorY), width: x1 - x0, height: 26, color: c.deck, outline: { width: 3, color: c.ink } });
    }
    // Corte del tablero en el borde de cada charco.
    for (const x of [x0, x1]) {
      k.drawRect({ pos: k.vec2(x, floorY - 2), width: 4, height: hasSprite(DECK) ? DECK_THICKNESS : 30, anchor: "top", color: c.ink });
    }
  }

  function drawShadow(world: World) {
    const p = world.player;
    if (p.sinking || puddleAt(world.level, p.x) || world.respawnIn > 0) return;
    const height = world.level.floorY - p.y;
    const s = clamp(1 - height / 400, 0.25, 1);
    k.drawEllipse({ pos: k.vec2(p.x, world.level.floorY + 2), radiusX: 24 * s, radiusY: 5 * s, color: c.ink, opacity: 0.35 * s });
  }

  function drawStreaks() {
    for (const s of streaks) {
      const fade = 1 - s.age / STREAK_LIFE;
      k.drawLine({ p1: k.vec2(s.x, s.y), p2: k.vec2(s.x - s.len, s.y), width: 3, color: c.white, opacity: 0.6 * fade });
    }
  }

  function drawPuddleWater(world: World) {
    const { floorY, puddles } = world.level;
    for (const [i, p] of puddles.entries()) {
      // Tapa al que se hunde con la misma agua que la pileta.
      drawWater(p.x0, p.x1 - p.x0, floorY + 26);
      k.drawSprite({ sprite: "prop-water", pos: k.vec2(p.x0, floorY + 8 + Math.sin(world.time * 2 + i) * 2), width: p.x1 - p.x0, height: 30 });
      const t = world.time * 0.6 + i * 1.3;
      const rise = (t % 1) * 30;
      k.drawSprite({
        sprite: "fx-bubbles",
        pos: k.vec2(p.x0 + (p.x1 - p.x0) * (0.3 + 0.4 * Math.sin(t)), floorY + 4 - rise),
        anchor: "center",
        width: 22,
        opacity: 1 - (t % 1),
      });
    }
  }

  // --- obstáculos -----------------------------------------------------------

  const visible = (x0: number, x1: number, left: number, right: number) => x1 > left && x0 < right;

  function drawRollers(world: World, left: number, right: number) {
    for (const r of world.level.rollers) {
      if (!visible(r.x - r.radius, r.x + r.radius, left, right)) continue;
      const cy = rollerCenterY(world.level, r, world.time);
      k.drawLine({ p1: k.vec2(r.x, -400), p2: k.vec2(r.x, cy), width: 6, color: c.rope });
      k.drawSprite({ sprite: "prop-roller", pos: k.vec2(r.x, cy), anchor: "center", width: r.radius * 2.06, angle: -world.time * 420 });
    }
  }

  /** Cinta de goma: las flechas amarillas corren para atrás a la velocidad de la cinta. */
  function drawConveyors(world: World, left: number, right: number) {
    const { floorY } = world.level;
    for (const belt of world.level.conveyors) {
      if (!visible(belt.x0, belt.x1, left, right)) continue;
      k.drawRect({ pos: k.vec2(belt.x0, floorY - 6), width: belt.x1 - belt.x0, height: 30, radius: 14, color: c.belt, outline: { width: 4, color: c.ink } });
      for (let x = belt.x0 + 16; x < belt.x1 - 10; x += 34) {
        k.drawCircle({ pos: k.vec2(x, floorY + 16), radius: 6, color: c.beltRoller, outline: { width: 2, color: c.ink } });
      }
      const spacing = 70;
      const dir = Math.sign(belt.speed) || -1;
      const offset = (((world.time * belt.speed) % spacing) + spacing) % spacing;
      for (let x = belt.x0 + offset; x < belt.x1 - 26; x += spacing) {
        if (x < belt.x0 + 12) continue;
        const y = floorY + 2;
        k.drawPolygon({
          pts: [k.vec2(x + dir * 12, y), k.vec2(x - dir * 6, y - 7), k.vec2(x - dir * 6, y + 7)],
          color: c.star,
          outline: { width: 2, color: c.ink },
        });
      }
    }
  }

  function drawTrampolines(world: World, left: number, right: number) {
    const { floorY } = world.level;
    world.level.trampolines.forEach((pad, i) => {
      if (!visible(pad.x0, pad.x1, left, right)) return;
      const squash = padSquash.get(i) ?? 0;
      const wobble = Math.sin(squash * 18) * squash;
      const width = (pad.x1 - pad.x0 + 24) * (1 + 0.15 * wobble);
      const height = 30 * (1 - 0.45 * wobble);
      if (hasSprite("prop-trampoline")) {
        k.drawSprite({ sprite: "prop-trampoline", pos: k.vec2((pad.x0 + pad.x1) / 2, floorY + 10), anchor: "bot", width, height });
      } else {
        k.drawRect({ pos: k.vec2(pad.x0, floorY - 18), width: pad.x1 - pad.x0, height: 24, radius: 10, color: c.danger, outline: { width: 3, color: c.ink } });
      }
    });
  }

  function drawHammers(world: World, left: number, right: number) {
    for (const hammer of world.level.hammers) {
      const reach = hammer.length + 80;
      if (!visible(hammer.x - reach, hammer.x + reach, left, right)) continue;
      const head = hammerHead(world.level, hammer, world.time);
      const pivot = k.vec2(hammer.x, hammerPivotY(world.level, hammer));
      const angle = (-head.angle * 180) / Math.PI + HAMMER_TILT;
      // Sombra en el tablón: más oscura cuanto más abajo pasa la cabeza.
      const low = clamp(1 - (world.level.floorY - head.y - hammer.radius) / 120, 0, 1);
      k.drawEllipse({ pos: k.vec2(head.x, world.level.floorY + 2), radiusX: 50, radiusY: 7, color: c.ink, opacity: 0.12 + 0.3 * low });

      const h = HAMMER_W * (SPRITES["prop-hammer"].h / SPRITES["prop-hammer"].w);
      const ringLocal = k.vec2((HAMMER_RING.x - HAMMER_HEAD.x) * HAMMER_W, (HAMMER_RING.y - HAMMER_HEAD.y) * h);
      const rad = (angle * Math.PI) / 180;
      const ring = k.vec2(
        head.x + ringLocal.x * Math.cos(rad) - ringLocal.y * Math.sin(rad),
        head.y + ringLocal.x * Math.sin(rad) + ringLocal.y * Math.cos(rad),
      );
      k.drawLine({ p1: k.vec2(pivot.x, -400), p2: pivot, width: 8, color: c.ink });
      k.drawLine({ p1: pivot, p2: ring, width: 9, color: c.ink });
      k.drawLine({ p1: pivot, p2: ring, width: 5, color: c.rope });
      k.drawCircle({ pos: pivot, radius: 9, color: c.ink });
      k.drawSprite({
        sprite: "prop-hammer",
        pos: k.vec2(head.x, head.y),
        anchor: k.vec2(HAMMER_HEAD.x * 2 - 1, HAMMER_HEAD.y * 2 - 1),
        width: HAMMER_W,
        angle,
      });
    }
  }

  function drawCannons(world: World, left: number, right: number) {
    const { floorY } = world.level;
    const height = CANNON_W * (SPRITES["prop-cannon"].h / SPRITES["prop-cannon"].w);
    world.level.cannons.forEach((cannon, i) => {
      if (!visible(cannon.x - 100, cannon.x + 100, left, right)) return;
      const aiming = world.time < (aimingUntil.get(i) ?? 0);
      const shake = aiming ? Math.sin(time * 60) * 2 : 0;
      const back = (recoil.get(i) ?? 0) * 14;
      const muzzle = k.vec2(cannon.x - 40, floorY - 22);
      if (aiming) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 20);
        k.drawCircle({ pos: muzzle, radius: 24 + pulse * 8, color: c.danger, opacity: 0.35 + pulse * 0.3 });
        k.drawText({ text: "!", pos: k.vec2(cannon.x + 10, floorY - 90), size: 44, font: FONT, anchor: "center", color: c.danger });
      }
      k.drawSprite({
        sprite: "prop-cannon",
        pos: k.vec2(muzzle.x + back + shake, muzzle.y - height * CANNON_MUZZLE_Y),
        width: CANNON_W,
      });
    });
  }

  function drawBalls(world: World, left: number, right: number) {
    world.level.cannons.forEach((cannon, i) => {
      for (const ball of cannonBalls(world.level, cannon, world.time)) {
        if (world.spentBalls.includes(`${i}:${ball.shot}`) || !visible(ball.x - 30, ball.x + 30, left, right)) continue;
        k.drawSprite({ sprite: "prop-foam-ball", pos: k.vec2(ball.x, ball.y), anchor: "center", width: BALL_RADIUS * 2 + 6, angle: -ball.x * 1.6 });
      }
    });
  }

  function drawPompas(world: World, left: number, right: number) {
    world.level.pompas.forEach((pompa, i) => {
      if (world.pompas[i] || !visible(pompa.x - 40, pompa.x + 40, left, right)) return;
      const bob = Math.sin(world.time * 3 + i) * 5;
      k.drawSprite({ sprite: "prop-bubble", pos: k.vec2(pompa.x, pompa.y + bob), anchor: "center", width: 50, angle: Math.sin(world.time * 2 + i) * 8 });
    });
  }

  // --- capa de TV -----------------------------------------------------------

  function drawOverlay(world: World, rivalWorlds: readonly World[]) {
    const { startX, finishX, puddles, rollers, hammers, trampolines } = world.level;
    const track = { x: 440, y: 30, w: 400 };
    const toTrack = (x: number) => track.x + clamp((x - startX) / (finishX - startX), 0, 1) * track.w;
    referee.drawCardInset(VIEW_H);
    show.drawLiveBadge(FONT);

    k.drawRect({ pos: k.vec2(track.x - 10, track.y - 9), width: track.w + 20, height: 18, radius: 9, color: c.ink, opacity: 0.6, fixed: true });
    for (const p of puddles) {
      k.drawRect({ pos: k.vec2(toTrack(p.x0), track.y - 5), width: Math.max(4, toTrack(p.x1) - toTrack(p.x0)), height: 10, radius: 3, color: c.water, fixed: true });
    }
    for (const t of trampolines) {
      k.drawRect({ pos: k.vec2(toTrack(t.x0), track.y + 2), width: 6, height: 5, color: c.danger, fixed: true });
    }
    for (const r of rollers) {
      k.drawSprite({ sprite: "prop-roller", pos: k.vec2(toTrack(r.x), track.y), anchor: "center", width: 13, fixed: true });
    }
    for (const h of hammers) {
      k.drawCircle({ pos: k.vec2(toTrack(h.x), track.y), radius: 5, color: c.danger, outline: { width: 2, color: c.ink }, fixed: true });
    }
    k.drawSprite({ sprite: "prop-arch", pos: k.vec2(track.x + track.w, track.y + 7), anchor: "bot", width: 26, fixed: true });
    rivalWorlds.forEach((w, i) => {
      const rival = rivals[i];
      if (!rival) return;
      k.drawCircle({ pos: k.vec2(toTrack(w.player.maxX), track.y), radius: 7, color: rival.color, outline: { width: 2, color: c.ink }, fixed: true });
    });
    k.drawCircle({ pos: k.vec2(toTrack(world.player.x), track.y), radius: 13, color: c.team, outline: { width: 3, color: c.ink }, fixed: true });
    k.drawSprite({ sprite: "char-head", pos: k.vec2(toTrack(world.player.x), track.y), anchor: "center", width: 22, fixed: true });
    show.drawRank(rank, track.x - 46, track.y + 2, FONT, { gold: c.star, plain: c.white });

    const timeLeft = Math.max(0, TUNING.timeLimit - world.time);
    k.drawText({ text: String(Math.ceil(timeLeft)), pos: k.vec2(VIEW_W / 2, 72), size: 34, font: FONT, anchor: "center", color: timeLeft < 10 ? c.danger : c.white, fixed: true });

    if (callout) {
      const pop = 1 + 0.4 * Math.max(0, 1 - callout.age * 5);
      const fade = Math.min(1, (1.8 - callout.age) * 3);
      k.drawText({
        text: callout.text,
        pos: k.vec2(VIEW_W / 2, 128),
        size: 32,
        font: FONT,
        anchor: "center",
        scale: pop,
        color: callout.good ? c.good : c.danger,
        opacity: fade,
        fixed: true,
      });
    }

    if (world.outcome) {
      const text = { finished: "¡LLEGASTE!", timeout: "¡TIEMPO!" }[world.outcome];
      const color = { finished: c.star, timeout: c.white }[world.outcome];
      const scale = 1 + 0.35 * Math.max(0, 1 - bannerAge * 4);
      k.drawText({ text, pos: k.vec2(VIEW_W / 2, 280), size: 96, font: FONT, anchor: "center", scale, color, fixed: true, angle: -4 });
    }
  }

  return { react, reactRival, update, draw };
}
