import type { KAPLAYCtx } from "kaplay";
import { FONT, hasSprite, SPRITES, type SpriteName } from "../../assets";
import { createContestant, type Expression } from "../../engine/contestant";
import { createFx } from "../../engine/fx";
import { clamp, spring } from "../../engine/physics";
import { puddleAt, rollerCenterY } from "./level";
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

/**
 * Dibuja el Puente a partir del estado de la simulación. Solo guarda estado
 * visual (cámara, animación, efectos); nunca modifica `world`.
 */
export function createRenderer(k: KAPLAYCtx, teamColor: string) {
  const c = {
    team: k.rgb(teamColor),
    ink: k.rgb("#1f1147"),
    water: k.rgb("#22d3ee"),
    waterDeep: k.rgb("#0e7490"),
    waterAbyss: k.rgb("#123a6b"),
    deck: k.rgb("#e0f2fe"),
    deckEdge: k.rgb("#7dd3fc"),
    white: k.rgb("#ffffff"),
    rope: k.rgb("#fde68a"),
    star: k.rgb("#facc15"),
    danger: k.rgb("#f87171"),
  };
  const fx = createFx(k, FONT);
  const contestant = createContestant(k, teamColor);

  let camX: number | null = null;
  let runPhase = 0;
  let squash = 1;
  let squashVel = 0;
  let screamFor = 0;
  let bannerAge = 0;

  function react(events: readonly SimEvent[], world: World) {
    const p = world.player;
    const floor = world.level.floorY;
    for (const e of events) {
      switch (e.type) {
        case "jump":
          squash = 1.2;
          fx.burst({ x: p.x, y: floor - 6, count: 4, speed: 140, sprites: ["fx-bubbles"], size: 20, spread: 140, gravity: -250, life: 0.7 });
          break;
        case "land":
          squash = clamp(1 - e.impact / 2200, 0.68, 0.94);
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
          screamFor = 0.3;
          fx.burst({ x: (p.x + e.x) / 2, y: (p.y - 50 + e.y) / 2, count: 10, speed: 520, sprites: ["fx-star"], size: 22, spread: 360 });
          fx.popup("¡BOING!", e.x, e.y - 120, c.star, { size: 50, backdrop: "fx-burst", backdropSize: 210 });
          k.shake(14);
          break;
        case "splash":
          fx.flash("fx-splash", e.x, floor + 40, { anchor: "bot", from: 0.5, to: 1.1, life: 0.8 });
          fx.burst({ x: e.x, y: floor + 14, count: 24, speed: 700, colors: [c.water, c.white, c.deckEdge], size: 14, spread: 70, life: 0.9 });
          fx.popup("¡PLAF!", e.x, floor - 170, c.water, { size: 56 });
          k.shake(8);
          break;
        case "finish":
          fx.burst({ x: p.x, y: p.y - 120, count: 60, speed: 650, sprites: CONFETTI, size: 18, spread: 150, life: 1.8, gravity: 500 });
          break;
      }
    }
  }

  function update(dt: number, world: World, move: number) {
    const p = world.player;
    fx.update(dt);

    // Piernas: si aprieta, pedalean rápido aunque no avance (hielo).
    runPhase += dt * (move !== 0 && p.grounded ? 14 : Math.abs(p.vx) / 40);
    [squash, squashVel] = spring(squash, squashVel, 1, 320, 12, dt);
    screamFor = Math.max(0, screamFor - dt);

    const minCam = world.level.wallX - 60 + HALF_VIEW;
    const target = clamp(p.x + LOOK_AHEAD, minCam, world.level.finishX + RUN_OFF - HALF_VIEW);
    camX = camX === null ? target : camX + (target - camX) * Math.min(1, dt * 6);
    k.setCamPos(camX, CAM_Y);
    k.setCamScale(ZOOM);

    bannerAge = world.outcome ? bannerAge + dt : 0;
  }

  function draw(world: World) {
    const center = camX ?? VIEW_W / 2;
    const left = center - HALF_VIEW - 150;
    const right = center + HALF_VIEW + 150;
    drawStudio(center);
    drawPool(world, left, right);
    drawBridge(world);
    drawShadow(world);
    drawPlayer(world);
    drawPuddleWater(world);
    drawRollers(world, left, right);
    fx.draw();
    drawOverlay(world);
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
      k.drawRect({ pos: k.vec2(x0, floorY + 2), width: x1 - x0, height: 5, color: c.white });
      for (let x = Math.ceil(x0 / 90) * 90 + 20; x < x1 - 40; x += 90) {
        k.drawEllipse({ pos: k.vec2(x, floorY + 13), radiusX: 18, radiusY: 3, color: c.deckEdge, opacity: 0.8 });
      }
    }
    // Corte del tablero en el borde de cada charco.
    for (const x of [x0, x1]) {
      k.drawRect({ pos: k.vec2(x, floorY - 2), width: 4, height: hasSprite(DECK) ? DECK_THICKNESS : 30, anchor: "top", color: c.ink });
    }
  }

  function drawShadow(world: World) {
    const p = world.player;
    if (p.sinking || puddleAt(world.level, p.x)) return;
    const height = world.level.floorY - p.y;
    const s = clamp(1 - height / 260, 0.3, 1);
    k.drawEllipse({ pos: k.vec2(p.x, world.level.floorY + 2), radiusX: 24 * s, radiusY: 5 * s, color: c.ink, opacity: 0.35 * s });
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

  function drawRollers(world: World, left: number, right: number) {
    for (const r of world.level.rollers) {
      if (r.x + r.radius < left || r.x - r.radius > right) continue;
      const cy = rollerCenterY(world.level, r, world.time);
      k.drawLine({ p1: k.vec2(r.x, -40), p2: k.vec2(r.x, cy), width: 6, color: c.rope });
      k.drawSprite({ sprite: "prop-roller", pos: k.vec2(r.x, cy), anchor: "center", width: r.radius * 2.06, angle: -world.time * 420 });
    }
  }

  function drawPlayer(world: World) {
    const p = world.player;
    const t = world.time;
    const lying = p.getUp > 0;
    const tumbling = p.ragdoll && !p.grounded;
    const airborne = !p.grounded && !p.ragdoll;

    let legs: [number, number];
    let arms: [number, number];
    if (tumbling) {
      legs = [Math.sin(t * 18) * 45, -Math.sin(t * 18 + 1) * 45];
      arms = [Math.sin(t * 20) * 130, Math.cos(t * 17) * 130];
    } else if (lying) {
      legs = [15 + Math.sin(t * 22) * 15, -10 + Math.cos(t * 22) * 15];
      arms = [160, -160];
    } else if (airborne || p.sinking) {
      legs = [-25 + Math.sin(t * 16) * 10, 35 + Math.sin(t * 15) * 10];
      arms = [-150 + Math.sin(t * 16) * 30, 150 + Math.sin(t * 14) * 30];
    } else {
      const swing = Math.sin(runPhase) * 38;
      legs = [-swing, swing];
      arms = [swing * 1.1, -swing * 1.1];
    }

    let expression: Expression = "normal";
    if (p.ragdoll || lying) expression = "dizzy";
    else if (p.sinking || screamFor > 0 || (airborne && p.vy > 250)) expression = "scream";

    contestant.draw({
      x: p.x,
      y: p.y,
      lean: p.lean,
      squash,
      legs,
      arms,
      headTilt: clamp(-p.leanVel * 0.03, -20, 20),
      expression,
      dizzy: p.ragdoll || lying,
      time: t,
    });
  }

  function drawOverlay(world: World) {
    const { startX, finishX, puddles, rollers } = world.level;
    const track = { x: 440, y: 30, w: 400 };
    const toTrack = (x: number) => track.x + clamp((x - startX) / (finishX - startX), 0, 1) * track.w;

    k.drawRect({ pos: k.vec2(track.x - 10, track.y - 9), width: track.w + 20, height: 18, radius: 9, color: c.ink, opacity: 0.6, fixed: true });
    for (const p of puddles) {
      k.drawRect({ pos: k.vec2(toTrack(p.x0), track.y - 5), width: Math.max(4, toTrack(p.x1) - toTrack(p.x0)), height: 10, radius: 3, color: c.water, fixed: true });
    }
    for (const r of rollers) {
      k.drawSprite({ sprite: "prop-roller", pos: k.vec2(toTrack(r.x), track.y), anchor: "center", width: 13, fixed: true });
    }
    k.drawSprite({ sprite: "prop-arch", pos: k.vec2(track.x + track.w, track.y + 7), anchor: "bot", width: 26, fixed: true });
    k.drawCircle({ pos: k.vec2(toTrack(world.player.x), track.y), radius: 13, color: c.team, outline: { width: 3, color: c.ink }, fixed: true });
    k.drawSprite({ sprite: "char-head", pos: k.vec2(toTrack(world.player.x), track.y), anchor: "center", width: 22, fixed: true });

    const timeLeft = Math.max(0, TUNING.timeLimit - world.time);
    k.drawText({ text: String(Math.ceil(timeLeft)), pos: k.vec2(VIEW_W / 2, 72), size: 34, font: FONT, anchor: "center", color: timeLeft < 10 ? c.danger : c.white, fixed: true });

    if (world.time < 4) {
      k.drawText({
        text: "A/D o FLECHAS: patinar  ·  ESPACIO: saltar",
        pos: k.vec2(VIEW_W / 2, VIEW_H - 40),
        size: 26,
        font: FONT,
        anchor: "center",
        color: c.white,
        opacity: Math.min(1, 4 - world.time),
        fixed: true,
      });
    }

    if (world.outcome) {
      const text = { drowned: "¡AL AGUA!", finished: "¡LLEGASTE!", timeout: "¡TIEMPO!" }[world.outcome];
      const color = { drowned: c.water, finished: c.star, timeout: c.white }[world.outcome];
      const scale = 1 + 0.35 * Math.max(0, 1 - bannerAge * 4);
      k.drawText({ text, pos: k.vec2(VIEW_W / 2, 280), size: 96, font: FONT, anchor: "center", scale, color, fixed: true, angle: -4 });
    }
  }

  return { react, update, draw };
}
