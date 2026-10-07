import type { KAPLAYCtx } from "kaplay";
import { createFx } from "../../engine/fx";
import { clamp } from "../../engine/physics";
import { rollerCenterY } from "./level";
import type { SimEvent, World } from "./sim";
import { PLAYER_SIZE, TUNING } from "./tuning";

const VIEW_W = 1280;
const VIEW_H = 720;
const LEG = 34;
const TORSO = { width: PLAYER_SIZE.width, height: 46 };
const HEAD_R = 17;
const DECK_H = 26;
const RUN_OFF = 1200; // puente extra después de la meta

/**
 * Dibuja el Puente a partir del estado de la simulación. Solo guarda estado
 * visual (cámara, fase de las piernas, efectos); nunca modifica `world`.
 */
export function createRenderer(k: KAPLAYCtx, teamColor: string) {
  const c = {
    team: k.rgb(teamColor),
    ink: k.rgb("#1f1147"),
    skin: k.rgb("#ffd7b5"),
    water: k.rgb("#22d3ee"),
    waterDeep: k.rgb("#0e7490"),
    deck: k.rgb("#e0f2fe"),
    deckEdge: k.rgb("#7dd3fc"),
    white: k.rgb("#ffffff"),
    pillar: k.rgb("#64748b"),
    rubber: k.rgb("#f472b6"),
    rubberDark: k.rgb("#9d174d"),
    rubberStripe: k.rgb("#fce7f3"),
    rope: k.rgb("#fde68a"),
    bumper: k.rgb("#ef4444"),
    star: k.rgb("#facc15"),
    danger: k.rgb("#f87171"),
  };
  const fx = createFx(k);
  const outline = (width = 3) => ({ width, color: c.ink });

  let camX: number | null = null;
  let runPhase = 0;
  let bannerAge = 0;

  function react(events: readonly SimEvent[], world: World) {
    const p = world.player;
    const floor = world.level.floorY;
    for (const e of events) {
      switch (e.type) {
        case "jump":
          fx.burst({ x: p.x, y: floor, count: 6, speed: 160, colors: [c.white], size: 5, spread: 120 });
          break;
        case "land":
          if (e.impact > 500) {
            fx.burst({ x: p.x, y: floor, count: 10, speed: 220, colors: [c.white, c.deckEdge], size: 5, spread: 160 });
            k.shake(2 + e.impact / 300);
          }
          break;
        case "wall":
          if (e.impact > 300) {
            fx.popup("¡PUM!", p.x + 40, p.y - 140, c.white, 44);
            k.shake(6);
          }
          break;
        case "bonk":
          fx.burst({ x: (p.x + e.x) / 2, y: (p.y - 50 + e.y) / 2, count: 16, speed: 520, colors: [c.star, c.white, c.rubber], size: 7, spread: 360 });
          fx.popup("¡BOING!", e.x, e.y - 110, c.star);
          k.shake(14);
          break;
        case "splash":
          fx.burst({ x: e.x, y: floor + 14, count: 36, speed: 760, colors: [c.water, c.white, c.deckEdge], size: 8, spread: 70, life: 0.9 });
          fx.popup("¡PLAF!", e.x, floor - 140, c.water);
          k.shake(8);
          break;
        case "finish":
          fx.burst({ x: p.x, y: p.y - 80, count: 40, speed: 700, colors: [c.team, c.star, c.white, c.rubber], size: 7, spread: 140, life: 1.2 });
          break;
      }
    }
  }

  function update(dt: number, world: World, move: number) {
    const p = world.player;
    fx.update(dt);

    // Piernas: si aprieta, pedalean rápido aunque no avance (hielo).
    runPhase += dt * (move !== 0 && p.grounded ? 16 : Math.abs(p.vx) / 45);

    const minCam = world.level.wallX - 40 + VIEW_W / 2;
    const target = clamp(p.x + 180, minCam, world.level.finishX + RUN_OFF - VIEW_W / 2);
    camX = camX === null ? target : camX + (target - camX) * Math.min(1, dt * 6);
    k.setCamPos(camX, VIEW_H / 2);

    bannerAge = world.outcome ? bannerAge + dt : 0;
  }

  function draw(world: World) {
    const center = camX ?? VIEW_W / 2;
    const left = center - VIEW_W / 2 - 100;
    const right = center + VIEW_W / 2 + 100;
    drawBackdrop(world, left, right);
    drawPlayer(world);
    drawPuddleWater(world);
    drawRollers(world, left, right);
    fx.draw();
    drawOverlay(world);
  }

  function drawBackdrop(world: World, left: number, right: number) {
    const { floorY, wallX, finishX, puddles } = world.level;

    for (let x = Math.floor(left / 300) * 300; x < right; x += 300) {
      if (x < wallX || x > finishX + RUN_OFF) continue;
      k.drawRect({ pos: k.vec2(x, floorY + DECK_H), width: 16, height: VIEW_H, color: c.pillar });
    }
    k.drawRect({ pos: k.vec2(left, floorY + 34), width: right - left, height: VIEW_H, color: c.water, opacity: 0.85 });
    for (let x = Math.floor(left / 160) * 160; x < right; x += 160) {
      const wave = Math.sin(world.time * 2 + x * 0.05) * 4;
      k.drawRect({ pos: k.vec2(x, floorY + 52 + wave), width: 60, height: 4, color: c.white, opacity: 0.35 });
    }

    // Tablero del puente, cortado por los charcos.
    let from = wallX - 40;
    for (const gap of [...puddles, { x0: finishX + RUN_OFF, x1: Infinity }]) {
      drawDeck(from, gap.x0, floorY);
      if (Number.isFinite(gap.x1)) {
        k.drawRect({ pos: k.vec2(gap.x0, floorY), width: gap.x1 - gap.x0, height: 34, color: c.waterDeep });
      }
      from = gap.x1;
    }

    // Bumper de largada.
    k.drawRect({ pos: k.vec2(wallX - 36, floorY - 170), width: 36, height: 170, color: c.bumper, radius: 10, outline: outline() });
    for (let i = 1; i < 5; i++) {
      k.drawRect({ pos: k.vec2(wallX - 36, floorY - 170 + i * 34), width: 36, height: 10, color: c.white });
    }

    // Meta.
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 2; j++) {
        k.drawRect({ pos: k.vec2(finishX + j * 13, floorY + i * 4.5 - 1), width: 13, height: 4.5, color: (i + j) % 2 ? c.ink : c.white });
      }
    }
    k.drawRect({ pos: k.vec2(finishX + 9, floorY - 230), width: 8, height: 230, color: c.white, outline: outline(2) });
    k.drawText({ text: "META", pos: k.vec2(finishX + 13, floorY - 260), size: 48, anchor: "center", color: c.star });
  }

  function drawDeck(x0: number, x1: number, floorY: number) {
    if (x1 <= x0) return;
    k.drawRect({ pos: k.vec2(x0, floorY), width: x1 - x0, height: DECK_H, color: c.deck, outline: outline(2) });
    k.drawRect({ pos: k.vec2(x0, floorY + 2), width: x1 - x0, height: 4, color: c.white });
    // Brillos de jabón.
    for (let x = Math.ceil(x0 / 90) * 90 + 20; x < x1 - 40; x += 90) {
      k.drawEllipse({ pos: k.vec2(x, floorY + 12), radiusX: 18, radiusY: 3, color: c.deckEdge, opacity: 0.8 });
    }
  }

  function drawPuddleWater(world: World) {
    const { floorY, puddles } = world.level;
    for (const [i, p] of puddles.entries()) {
      k.drawRect({ pos: k.vec2(p.x0, floorY + 14), width: p.x1 - p.x0, height: VIEW_H, color: c.water, opacity: 0.9 });
      for (let b = 0; b < 5; b++) {
        const t = world.time * (0.8 + b * 0.13) + i * 1.7 + b;
        const bx = p.x0 + 18 + ((b * 37 + Math.sin(t) * 10 + 400) % (p.x1 - p.x0 - 36));
        const by = floorY + 22 - Math.abs(Math.sin(t * 1.3)) * 10;
        k.drawCircle({ pos: k.vec2(bx, by), radius: 4 + (b % 3) * 2, color: c.white, opacity: 0.7 });
      }
    }
  }

  function drawRollers(world: World, left: number, right: number) {
    for (const r of world.level.rollers) {
      if (r.x + r.radius < left || r.x - r.radius > right) continue;
      const cy = rollerCenterY(world.level, r, world.time);
      const center = k.vec2(r.x, cy);
      k.drawLine({ p1: k.vec2(r.x, -40), p2: k.vec2(r.x, cy), width: 5, color: c.rope });
      k.drawCircle({ pos: center, radius: r.radius, color: c.rubber, outline: outline(4) });
      // Gira hacia atrás: la cara que mira al jugador baja y lo escupe.
      const spin = (-world.time * 540 * Math.PI) / 180;
      for (let i = 0; i < 3; i++) {
        const a = spin + (i * 2 * Math.PI) / 3;
        const d = k.vec2(Math.cos(a), Math.sin(a)).scale(r.radius * 0.78);
        k.drawLine({ p1: center.sub(d), p2: center.add(d), width: 7, color: c.rubberStripe });
      }
      k.drawCircle({ pos: center, radius: r.radius * 0.22, color: c.rubberDark });
    }
  }

  function drawPlayer(world: World) {
    const p = world.player;
    const rad = (p.lean * Math.PI) / 180;
    // Tirado en el piso, el pivote baja hasta casi tocar el suelo.
    const pivotY = p.y - Math.max(8, LEG * Math.abs(Math.cos(rad)));
    const t = world.time;
    const flailing = p.ragdoll || !p.grounded || p.getUp > 0;
    const dizzy = p.ragdoll || p.getUp > 0;

    k.pushTransform();
    k.pushTranslate(p.x, pivotY);
    k.pushRotate(p.lean);

    // Piernas.
    const swing = p.grounded && !dizzy ? Math.sin(runPhase) * 0.6 : 0.35 + Math.sin(t * 20) * (flailing ? 0.4 : 0);
    for (const side of [1, -1]) {
      const a = side * swing;
      k.drawLine({ p1: k.vec2(side * 6, 0), p2: k.vec2(Math.sin(a) * LEG, Math.cos(a) * LEG), width: 7, color: c.ink });
    }

    // Brazos: más revoleo cuanto más descontrol.
    const amp = flailing ? 75 : 20 + (25 * Math.abs(p.vx)) / TUNING.maxRunSpeed;
    for (const [base, phase] of [[-35, 0], [25, 1.7]] as const) {
      const a = ((base + Math.sin(t * 14 + phase) * amp) * Math.PI) / 180;
      const shoulder = k.vec2(0, -TORSO.height + 8);
      k.drawLine({ p1: shoulder, p2: shoulder.add(k.vec2(Math.sin(a) * 30, Math.cos(a) * 30)), width: 6, color: c.ink });
    }

    k.drawRect({ pos: k.vec2(0, 0), width: TORSO.width, height: TORSO.height, anchor: "bot", radius: 12, color: c.team, outline: outline() });

    // Cabeza con bamboleo propio.
    const head = k.vec2(clamp(-p.leanVel * 0.02, -7, 7), -TORSO.height - HEAD_R + 2);
    k.drawCircle({ pos: head, radius: HEAD_R, color: c.skin, outline: outline() });
    if (dizzy) {
      for (const ex of [4, 12]) {
        const e = head.add(k.vec2(ex, -4));
        k.drawLine({ p1: e.add(k.vec2(-3, -3)), p2: e.add(k.vec2(3, 3)), width: 2, color: c.ink });
        k.drawLine({ p1: e.add(k.vec2(-3, 3)), p2: e.add(k.vec2(3, -3)), width: 2, color: c.ink });
      }
    } else {
      for (const ex of [5, 12]) k.drawCircle({ pos: head.add(k.vec2(ex, -4)), radius: 2.5, color: c.ink });
    }
    if (flailing) k.drawEllipse({ pos: head.add(k.vec2(9, 7)), radiusX: 3, radiusY: 4.5, color: c.ink });

    k.popTransform();
  }

  function drawOverlay(world: World) {
    const { startX, finishX, puddles, rollers } = world.level;
    const track = { x: 440, y: 28, w: 400 };
    const toTrack = (x: number) => track.x + clamp((x - startX) / (finishX - startX), 0, 1) * track.w;

    k.drawLine({ p1: k.vec2(track.x, track.y), p2: k.vec2(track.x + track.w, track.y), width: 4, color: c.white, opacity: 0.35, fixed: true });
    for (const p of puddles) {
      k.drawRect({ pos: k.vec2(toTrack(p.x0), track.y - 5), width: Math.max(4, toTrack(p.x1) - toTrack(p.x0)), height: 10, color: c.water, fixed: true });
    }
    for (const r of rollers) k.drawCircle({ pos: k.vec2(toTrack(r.x), track.y), radius: 5, color: c.rubber, fixed: true });
    k.drawRect({ pos: k.vec2(track.x + track.w, track.y - 10), width: 4, height: 20, color: c.white, fixed: true });
    k.drawCircle({ pos: k.vec2(toTrack(world.player.x), track.y), radius: 8, color: c.team, outline: outline(2), fixed: true });

    const timeLeft = Math.max(0, TUNING.timeLimit - world.time);
    k.drawText({ text: String(Math.ceil(timeLeft)), pos: k.vec2(VIEW_W / 2, 62), size: 26, anchor: "center", color: timeLeft < 10 ? c.danger : c.white, fixed: true });

    if (world.time < 4) {
      k.drawText({
        text: "A/D o FLECHAS: patinar  ·  ESPACIO: saltar",
        pos: k.vec2(VIEW_W / 2, VIEW_H - 36),
        size: 22,
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
      for (const [dx, col] of [[6, c.ink], [0, color]] as const) {
        k.drawText({ text, pos: k.vec2(VIEW_W / 2 + dx, 280 + dx), size: 84, anchor: "center", scale, color: col, fixed: true });
      }
    }
  }

  return { react, update, draw };
}
