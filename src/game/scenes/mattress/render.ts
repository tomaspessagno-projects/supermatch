import type { Color, KAPLAYCtx } from "kaplay";
import { FONT, hasSprite, SPRITES } from "../../assets";
import type { CrewMember } from "../../contract";
import { type AnimatedBody, createAnimator } from "../../engine/animator";
import { type ContestantPose, createContestant } from "../../engine/contestant";
import { createFx } from "../../engine/fx";
import { clamp, spring } from "../../engine/physics";
import { createReferee } from "../../engine/referee";
import { createShow } from "../../engine/show";
import { STAGE } from "./level";
import { type Jumper, landing, type SimEvent, surfaceAt, type World } from "./sim";
import { TUNING } from "./tuning";

const VIEW_W = STAGE.width;
const VIEW_H = STAGE.height;
const CONFETTI = Object.keys(SPRITES).filter((n) => n.startsWith("fx-confetti-"));
/** Camisetas de los saltadores: los 4 equipos y la dorada. */
const SHIRTS = ["#E63946", "#1D4ED8", "#FACC15", "#16A34A"] as const;
const GOLD = "#FFC93C";
const JUMPER_SCALE = 0.62;
/** Del centro del saltador a sus pies, a escala 1. */
const JUMPER_CENTER = 52;
/** Retraso visual para suavizar las correcciones de la red (s). */
const REMOTE_LAG = 0.07;
const JUMPER_LAG = 0.025;

/**
 * Dibuja El Colchón a partir de la simulación. Cámara fija con todo el
 * escenario a la vista. Nunca modifica `world`.
 *
 * Lo que viene de la red se corrige de a saltos (rollback): los portadores
 * remotos y los saltadores se dibujan persiguiendo su posición real, así las
 * correcciones se ven como un deslizamiento corto y no como un teletransporte.
 */
export function createRenderer(k: KAPLAYCtx, crew: readonly CrewMember[], me: number) {
  const c = {
    ink: k.rgb("#1f1147"),
    water: k.rgb("#22d3ee"),
    waterAbyss: k.rgb("#123a6b"),
    white: k.rgb("#ffffff"),
    star: k.rgb("#facc15"),
    danger: k.rgb("#f87171"),
    good: k.rgb("#4ade80"),
    pink: k.rgb("#f472b6"),
    pinkDark: k.rgb("#be185d"),
    yellow: k.rgb("#fde047"),
    pole: k.rgb("#3b2a6b"),
    shadow: k.rgb("#0b0620"),
    foam: k.rgb("#f0f9ff"),
    balloon: [k.rgb("#38bdf8"), k.rgb("#f472b6"), k.rgb("#a3e635")],
  };
  const fx = createFx(k, FONT);
  const referee = createReferee(k);
  const show = createShow(k, crew.map((m) => m.team.color));
  const holders = crew.map((m, i) => ({
    member: m,
    look: createContestant(k, m.team.color),
    anim: createAnimator(),
    color: k.rgb(m.team.color),
    facing: (i % 2 === 0 ? 1 : -1) as 1 | -1,
    x: 0,
    h: 0,
    lean: 0,
    leanVel: 0,
    ready: false,
  }));
  const shirts = [...SHIRTS.map((s) => createContestant(k, s)), createContestant(k, GOLD)];
  const shown = new Map<number, { x: number; y: number }>();
  const dips = [
    { value: 0, vel: 0 },
    { value: 0, vel: 0 },
  ];
  let time = 0;
  let endAge = -1;
  let callout: { text: string; color: Color; age: number } | null = null;

  const say = (text: string, color: Color) => {
    callout = { text, color, age: 0 };
  };

  function react(events: readonly SimEvent[], world: World) {
    for (const e of events) {
      switch (e.type) {
        case "bounce": {
          dips[e.pair].vel += e.super ? 260 : 170;
          fx.burst({ x: e.x, y: e.y, count: e.super ? 14 : 6, speed: e.super ? 520 : 300, sprites: ["fx-star"], size: e.super ? 22 : 14, spread: 160 });
          if (e.super) {
            fx.popup("¡SÚPER REBOTE!", e.x, e.y - 120, c.star, { size: 44, backdrop: "fx-burst", backdropSize: 210 });
            k.shake(7);
            show.excite(0.5);
          } else {
            fx.popup("¡BOING!", e.x, e.y - 70, c.white, { size: 30 });
          }
          break;
        }
        case "pump":
          fx.popup("¡JUNTOS!", (holders[e.pair * 2].x + holders[e.pair * 2 + 1].x) / 2, STAGE.deckY - 150, c.good, { size: 34 });
          break;
        case "deliver":
          fx.burst({ x: e.x, y: e.y, count: e.golden ? 50 : 26, speed: 600, sprites: CONFETTI, size: 16, spread: 120, life: 1.4, gravity: 500 });
          fx.popup(`+${e.points}`, e.x - 20, e.y - 70, e.golden ? c.yellow : c.star, { size: e.golden ? 52 : 40 });
          if (e.direct) say("¡DIRECTO AL PELOTERO!", c.star);
          else if (e.golden) say("¡EL DORADO!", c.yellow);
          else if (e.streak >= 3) say(`¡RACHA ×${e.streak}!`, c.good);
          show.excite(e.golden || e.direct ? 0.8 : 0.4);
          break;
        case "splash":
          referee.card();
          fx.flash("fx-splash", e.x, STAGE.waterY + 28, { anchor: "bot", from: 0.45, to: 1, life: 0.8 });
          fx.burst({ x: e.x, y: STAGE.waterY, count: 20, speed: 620, colors: [c.water, c.white], size: 13, spread: 70, life: 0.9 });
          fx.popup("¡PLAF!", e.x, STAGE.waterY - 130, c.water, { size: 48 });
          k.shake(5);
          show.excite(0.7);
          break;
        case "out":
          say("¡AFUERA!", c.danger);
          break;
        case "burst":
          fx.burst({ x: e.x, y: e.y, count: 18, speed: 420, colors: [c.water, c.white], size: 11, spread: 360, life: 0.7, gravity: 900 });
          if (e.pair !== null) fx.popup("¡EMPAPADOS!", e.x, e.y - 60, c.water, { size: 30 });
          if (e.holder !== null) fx.popup("¡SPLASH!", e.x, e.y - 40, c.water, { size: 30 });
          break;
        case "trip":
          holders[e.holder].anim.react([{ type: "bonk" }]);
          fx.burst({ x: holders[e.holder].x, y: STAGE.deckY - 40, count: 6, speed: 300, sprites: ["fx-star"], size: 16, spread: 360 });
          fx.popup("¡PUM!", holders[e.holder].x, STAGE.deckY - 150, c.star, { size: 34 });
          k.shake(4);
          break;
        case "jump":
          holders[e.holder].anim.react([{ type: "jump" }]);
          break;
        case "land":
          holders[e.holder].anim.react([{ type: "land", impact: 600 }]);
          break;
        case "end":
          referee.end();
          endAge = 0;
          break;
      }
    }
    void world;
  }

  function update(dt: number, world: World) {
    time += dt;
    if (endAge >= 0) endAge += dt;
    fx.update(dt);
    referee.update(dt);
    show.update(dt);
    if (callout) {
      callout.age += dt;
      if (callout.age > 1.6) callout = null;
    }
    k.setCamPos(VIEW_W / 2, VIEW_H / 2);
    k.setCamScale(1);

    world.holders.forEach((h, i) => {
      const view = holders[i];
      const follow = view.member.control === "remote" ? 1 - Math.exp(-dt / REMOTE_LAG) : 1;
      if (!view.ready) {
        view.x = h.x;
        view.ready = true;
      }
      view.x += (h.x - view.x) * follow;
      view.h += (h.h - view.h) * follow;
      // Tirado (rodillo, globo): cae para atrás; si no, se inclina un poco al caminar.
      const target = h.stun > 0 ? -view.facing * 80 : clamp(h.vx * 0.035, -12, 12);
      [view.lean, view.leanVel] = spring(view.lean, view.leanVel, target, 140, 11, dt);
      view.anim.update(dt, body(h, view), Math.abs(h.vx) > 30 ? Math.sign(h.vx) : 0, h.vx);
    });

    const alive = new Set<number>();
    for (const j of world.jumpers) {
      alive.add(j.id);
      const prev = shown.get(j.id);
      // Corrección grande (otro desenlace): salta directo.
      if (!prev || Math.abs(prev.x - j.x) + Math.abs(prev.y - j.y) > 160) shown.set(j.id, { x: j.x, y: j.y });
      else {
        const f = 1 - Math.exp(-dt / JUMPER_LAG);
        prev.x += (j.x - prev.x) * f;
        prev.y += (j.y - prev.y) * f;
      }
    }
    for (const id of shown.keys()) if (!alive.has(id)) shown.delete(id);

    for (const d of dips) [d.value, d.vel] = spring(d.value, d.vel, 0, 260, 9, dt);
  }

  function body(h: World["holders"][number], view: (typeof holders)[number]): AnimatedBody {
    return {
      x: view.x,
      y: STAGE.deckY - view.h,
      vx: h.vx,
      vy: -h.vh,
      grounded: h.grounded,
      ragdoll: false,
      getUp: h.stun,
      sinking: false,
      lean: view.lean,
      leanVel: view.leanVel,
    };
  }

  function draw(world: World) {
    drawStudio();
    show.drawLights();
    drawPoolBack();
    drawTower(world);
    drawGoal(world, "back");
    for (const j of world.jumpers) if (j.state === "delivered") drawJumper(j, world);
    drawGoal(world, "front");
    for (const j of world.jumpers) if (j.state === "splash") drawJumper(j, world);
    drawWaterFront();
    drawDeck();
    if (world.config.soap) drawSoap();
    drawShadows(world);
    drawRollers(world);
    for (let p = 0; p < 2; p++) drawPair(world, p);
    for (const j of world.jumpers) if (j.state === "flying" || j.state === "ready" || j.state === "out") drawJumper(j, world);
    drawBalloons(world);
    referee.draw(98, STAGE.waterY - 2, 66);
    fx.draw();
    k.pushTransform();
    k.pushTranslate(0, 64);
    show.drawCrowd(0);
    k.popTransform();
    drawOverlay(world);
  }

  // --- escenario --------------------------------------------------------------

  function drawStudio() {
    if (!hasSprite("bg-studio")) return;
    const w = (SPRITES["bg-studio"].w / SPRITES["bg-studio"].h) * VIEW_H;
    k.drawSprite({ sprite: "bg-studio", pos: k.vec2((VIEW_W - w) / 2, 0), width: w, height: VIEW_H });
  }

  function drawPoolBack() {
    const top = STAGE.waterY - 8;
    k.drawRect({ pos: k.vec2(0, top), width: VIEW_W, height: VIEW_H - top, gradient: [c.water, c.waterAbyss] });
    // Un pato de goma a la deriva.
    if (hasSprite("prop-duck")) {
      k.drawSprite({
        sprite: "prop-duck",
        pos: k.vec2(640 + Math.sin(time * 0.3) * 260, STAGE.waterY + 14 + Math.sin(time * 1.7) * 3),
        anchor: "bot",
        width: 58,
        angle: Math.sin(time * 1.3) * 5,
        opacity: 0.9,
      });
    }
  }

  /** La torre: andamio de caños, escalera y el trampolín de donde se tiran. */
  function drawTower(world: World) {
    const { left, right, top } = STAGE.tower;
    const tile = 70;
    if (hasSprite("prop-pillar")) {
      for (const x of [left + 6, right - 6 - (SPRITES["prop-pillar"].w / SPRITES["prop-pillar"].h) * tile]) {
        for (let y = top + 14; y < STAGE.waterY + 20; y += tile) {
          k.drawSprite({ sprite: "prop-pillar", pos: k.vec2(x, y), height: tile });
        }
      }
    } else {
      k.drawRect({ pos: k.vec2(left, top), width: right - left, height: STAGE.waterY - top, color: c.pole });
    }
    // Plataforma y tabla.
    k.drawRect({ pos: k.vec2(left - 6, top), width: right - left + 12, height: 16, radius: 4, color: c.pink, outline: { width: 4, color: c.ink } });
    const wobble = world.jumpers.some((j) => j.state === "ready") ? Math.sin(time * 30) * 1.5 : 0;
    k.drawRect({ pos: k.vec2(right - 30, top - 4 + wobble), width: 58, height: 10, radius: 4, color: c.yellow, outline: { width: 3, color: c.ink } });
    // Baranda con banderines.
    for (let i = 0; i < 4; i++) {
      const x = left + 8 + i * 30;
      k.drawLine({ p1: k.vec2(x, top), p2: k.vec2(x, top - 40), width: 4, color: c.ink });
      k.drawPolygon({ pts: [k.vec2(x, top - 40), k.vec2(x + 22, top - 34 + Math.sin(time * 6 + i) * 3), k.vec2(x, top - 28)], color: holders[i % holders.length].color, outline: { width: 2, color: c.ink } });
    }
  }

  /** El pelotero: pileta inflable con pelotas, arco de meta arriba. */
  function drawGoal(world: World, layer: "back" | "front") {
    const { left, right, top } = STAGE.goal;
    const w = right - left;
    if (layer === "back") {
      if (hasSprite("prop-arch")) {
        k.drawSprite({ sprite: "prop-arch", pos: k.vec2((left + right) / 2, top + 30), anchor: "bot", width: w + 30, opacity: 0.95 });
      }
      // Pelotas de colores adentro (atrás de los que llegan).
      for (let i = 0; i < 26; i++) {
        const bx = left + 14 + ((i * 37) % (w - 28));
        const by = top + 6 + ((i * 13) % 22) + Math.sin(time * 4 + i) * (world.endedAt === null ? 1 : 3);
        k.drawCircle({ pos: k.vec2(bx, by), radius: 9, color: holders[i % holders.length].color, outline: { width: 2, color: c.ink } });
      }
      return;
    }
    if (hasSprite("prop-trampoline")) {
      const h = (SPRITES["prop-trampoline"].h / SPRITES["prop-trampoline"].w) * (w + 24);
      k.drawSprite({ sprite: "prop-trampoline", pos: k.vec2(left - 12, top + 4), width: w + 24, height: h });
    } else {
      k.drawRect({ pos: k.vec2(left, top + 10), width: w, height: 60, radius: 20, color: c.pink, outline: { width: 4, color: c.ink } });
    }
  }

  function drawWaterFront() {
    if (!hasSprite("prop-water")) return;
    const bob = Math.sin(time * 1.6) * 3;
    const tw = (SPRITES["prop-water"].w / SPRITES["prop-water"].h) * 28;
    for (let x = -tw * ((time * 0.4) % 1); x < VIEW_W; x += tw) {
      k.drawSprite({ sprite: "prop-water", pos: k.vec2(x, STAGE.waterY - 18 + bob), width: tw + 1, height: 28, opacity: 0.9 });
    }
  }

  /** La pasarela flotante (los tablones del Puente) sobre boyas. */
  function drawDeck() {
    const { deckLeft, deckRight, deckY } = STAGE;
    for (let x = deckLeft + 40; x < deckRight; x += 150) {
      k.drawCircle({ pos: k.vec2(x, deckY + 40 + Math.sin(time * 2 + x) * 2), radius: 20, color: c.pink, outline: { width: 3, color: c.ink } });
    }
    if (hasSprite("deck-tile")) {
      const h = 60;
      const w = (SPRITES["deck-tile"].w / SPRITES["deck-tile"].h) * h;
      for (let x = deckLeft; x < deckRight; x += w) {
        const width = Math.min(w, deckRight - x);
        k.drawSprite({ sprite: "deck-tile", pos: k.vec2(x, deckY - h * 0.255), width, height: h, quad: k.quad(0, 0, width / w, 1) });
      }
    } else {
      k.drawRect({ pos: k.vec2(deckLeft, deckY), width: deckRight - deckLeft, height: 24, color: c.foam, outline: { width: 3, color: c.ink } });
    }
  }

  /** Charcos de jabón: espuma celeste con burbujas y brillo (se tienen que ver sobre el tablón blanco). */
  function drawSoap() {
    for (const s of STAGE.soap) {
      const mid = (s.from + s.to) / 2;
      const half = (s.to - s.from) / 2;
      k.drawEllipse({ pos: k.vec2(mid, STAGE.deckY + 1), radiusX: half, radiusY: 9, color: c.water, opacity: 0.55, outline: { width: 2, color: c.ink } });
      k.drawEllipse({ pos: k.vec2(mid - 10, STAGE.deckY - 1), radiusX: half * 0.6, radiusY: 4, color: c.white, opacity: 0.8 });
      for (let i = 0; i < 7; i++) {
        const bx = s.from + 8 + ((i * 29) % (s.to - s.from - 16));
        const rise = (time * 0.6 + i * 0.37) % 1;
        k.drawCircle({
          pos: k.vec2(bx + Math.sin(time * 3 + i) * 3, STAGE.deckY - 4 - rise * 26),
          radius: 4 + (i % 3) * 1.5,
          color: c.white,
          opacity: 0.85 * (1 - rise),
          outline: { width: 1.5, color: c.water },
        });
      }
    }
  }

  /** Sombra de cada saltador en la pasarela: dónde va a caer. */
  function drawShadows(world: World) {
    for (const j of world.jumpers) {
      if (j.state !== "flying") continue;
      const pos = shown.get(j.id) ?? j;
      if (pos.x < STAGE.deckLeft || pos.x > STAGE.deckRight) continue;
      const near = clamp(1 - (STAGE.deckY - pos.y) / 420, 0.15, 1);
      k.drawEllipse({ pos: k.vec2(pos.x, STAGE.deckY + 4), radiusX: 10 + near * 18, radiusY: 4 + near * 3, color: c.shadow, opacity: 0.25 + near * 0.3 });
    }
    for (const b of world.balloons) {
      if (b.burstAt !== null) continue;
      const near = clamp(1 - (STAGE.deckY - b.y) / 600, 0.1, 1);
      const pulse = 0.5 + 0.5 * Math.sin(time * 16);
      k.drawEllipse({ pos: k.vec2(b.x, STAGE.deckY + 4), radiusX: 8 + near * 16, radiusY: 3 + near * 3, color: c.danger, opacity: 0.2 + near * 0.35 * pulse });
    }
  }

  function drawRollers(world: World) {
    for (const r of world.rollers) {
      const size = TUNING.rollerRadius * 2 + 6;
      k.drawSprite({
        sprite: "prop-roller",
        pos: k.vec2(r.x, STAGE.deckY - TUNING.rollerRadius),
        anchor: "center",
        width: size,
        height: size,
        angle: (r.x / TUNING.rollerRadius) * 57.3,
      });
      // Aviso de que viene: flecha en la punta de la pasarela.
      const entering = r.vx < 0 ? r.x > STAGE.deckRight - 60 : r.x < STAGE.deckLeft + 60;
      if (entering) {
        const x = r.vx < 0 ? STAGE.deckRight - 30 : STAGE.deckLeft + 30;
        k.drawText({ text: r.vx < 0 ? "◀ ¡SALTEN!" : "¡SALTEN! ▶", pos: k.vec2(x, STAGE.deckY - 120), size: 26, font: FONT, anchor: "center", color: c.danger, opacity: Math.sin(time * 18) > -0.2 ? 1 : 0.4 });
      }
    }
  }

  // --- portadores y colchón ----------------------------------------------------

  function drawPair(world: World, p: number) {
    const [a, b] = [p * 2, p * 2 + 1];
    for (const i of [a, b]) drawHolder(world, i);
    drawMattress(world, p);
    drawCatchRing(world, p);
  }

  function drawHolder(world: World, i: number) {
    const h = world.holders[i];
    const view = holders[i];
    const pose: ContestantPose = view.anim.pose(body(h, view), world.time);
    pose.facing = view.facing;
    if (h.stun <= 0) {
      // Agarra el colchón con las dos manos, adelante.
      const bob = Math.sin(time * 9 + i) * (Math.abs(h.vx) > 30 ? 6 : 2);
      pose.arms = [62 + bob, 70 - bob];
      if (!h.grounded) pose.legs = [-28, 22];
    }
    if (h.soak > 0) pose.expression = "scream";
    view.look.draw(pose);
    if (h.soak > 0) {
      // Gotas.
      for (let d = 0; d < 3; d++) {
        const t = (time * 2 + d / 3) % 1;
        k.drawCircle({ pos: k.vec2(view.x - 10 + d * 10, STAGE.deckY - view.h - 100 + t * 70), radius: 3, color: c.water, opacity: 1 - t });
      }
    }
  }

  /** Puntas del colchón según dónde se ven los portadores (no la simulación exacta). */
  function mattressView(world: World, p: number) {
    const end = (i: number) => {
      const h = world.holders[i];
      return STAGE.deckY - holders[i].h - TUNING.holdHeight + (h.stun > 0 ? TUNING.stunDrop : 0);
    };
    return {
      lx: holders[p * 2].x + TUNING.handReach,
      ly: end(p * 2),
      rx: holders[p * 2 + 1].x - TUNING.handReach,
      ry: end(p * 2 + 1),
    };
  }

  /** Colchón inflable a rayas, que se hunde al rebotar y brilla al bombear. */
  function drawMattress(world: World, p: number) {
    const m = mattressView(world, p);
    const pumped = world.time <= world.pairs[p].pumpUntil;
    const thick = 17;
    const steps = 12;
    const top: { x: number; y: number }[] = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const sag = Math.sin(t * Math.PI) * (dips[p].value * 0.08 + 5);
      top.push({ x: m.lx + (m.rx - m.lx) * t, y: m.ly + (m.ry - m.ly) * t + sag });
    }
    const upper = top.map((q) => k.vec2(q.x, q.y - thick));
    const lower = [...top].reverse().map((q) => k.vec2(q.x, q.y + thick * 0.8));
    // Sombra en la pasarela.
    const mid = top[steps / 2];
    k.drawEllipse({ pos: k.vec2(mid.x, STAGE.deckY + 4), radiusX: (m.rx - m.lx) / 2, radiusY: 6, color: c.shadow, opacity: 0.25 });
    if (pumped) k.drawPolygon({ pts: [...upper, ...lower], color: c.yellow, opacity: 0.55, outline: { width: 16, color: c.yellow } });
    k.drawPolygon({ pts: [...upper, ...lower], color: c.pink, outline: { width: 4, color: c.ink } });
    // Tubos inflados: franjas amarillas entre costuras, y brillo arriba.
    for (let s = 1; s < steps; s += 3) {
      const a = top[s];
      const b = top[s + 1];
      k.drawPolygon({
        pts: [k.vec2(a.x, a.y - thick + 3), k.vec2(b.x, b.y - thick + 3), k.vec2(b.x, b.y + thick * 0.8 - 3), k.vec2(a.x, a.y + thick * 0.8 - 3)],
        color: c.yellow,
        opacity: 0.9,
      });
    }
    for (let s = 1; s < steps; s++) {
      const q = top[s];
      k.drawLine({ p1: k.vec2(q.x, q.y - thick + 4), p2: k.vec2(q.x, q.y + thick * 0.8 - 4), width: 1.5, color: c.pinkDark, opacity: 0.5 });
    }
    k.drawLine({ p1: k.vec2(top[1].x, top[1].y - thick + 5), p2: k.vec2(top[steps - 1].x, top[steps - 1].y - thick + 5), width: 4, color: c.white, opacity: 0.55 });
    for (const q of [top[0], top[steps]]) k.drawEllipse({ pos: k.vec2(q.x, q.y - 1), radiusX: thick * 0.75, radiusY: thick, color: c.pinkDark, outline: { width: 4, color: c.ink } });
  }

  /** Anillo que se cierra donde va a caer el próximo: cuando se cierra, ¡salten juntos! */
  function drawCatchRing(world: World, p: number) {
    const m = mattressView(world, p);
    let next: { j: Jumper; t: number; x: number } | null = null;
    for (const j of world.jumpers) {
      if (j.state !== "flying") continue;
      const at = landing(j, (m.ly + m.ry) / 2);
      if (!at || at.t > 0.9 || at.x < m.lx - 30 || at.x > m.rx + 30) continue;
      if (!next || at.t < next.t) next = { j, t: at.t, x: at.x };
    }
    if (!next) return;
    const now = next.t < TUNING.pumpWindow + 0.05;
    const y = surfaceAt(m, next.x) - 4;
    k.drawCircle({
      pos: k.vec2(next.x, y),
      radius: 14 + next.t * 60,
      fill: false,
      outline: { width: now ? 6 : 4, color: now ? c.good : c.white },
      opacity: 0.85,
    });
    if (now) k.drawText({ text: "¡YA!", pos: k.vec2(next.x, y - 44), size: 24, font: FONT, anchor: "center", color: c.good });
  }

  // --- saltadores y globos -------------------------------------------------------

  function drawJumper(j: Jumper, world: World) {
    const pos = shown.get(j.id) ?? j;
    const look = shirts[j.golden ? 4 : j.shirt % 4];
    const t = time + j.id;
    let pose: ContestantPose;
    let spin = 0;
    let scale = JUMPER_SCALE;
    let x = pos.x;
    let y = pos.y;
    if (j.state === "ready") {
      // En la punta del trampolín, mirando para abajo con miedo.
      scale = 0.7;
      x = STAGE.spawn.x + Math.sin(t * 22) * 1.5;
      y = STAGE.tower.top - JUMPER_CENTER * scale;
      pose = basePose({ arms: [150 + Math.sin(t * 20) * 25, 170 + Math.cos(t * 18) * 25], legs: [-8, 8], expression: "scream" });
    } else if (j.state === "delivered") {
      pose = basePose({ arms: [175 + Math.sin(t * 12) * 20, 185 + Math.cos(t * 12) * 20], legs: [-10, 10], expression: "normal" });
      y = STAGE.goal.top + 8 - Math.abs(Math.sin(t * 7)) * 10;
    } else if (j.state === "splash") {
      pose = basePose({ arms: [160 + Math.sin(t * 25) * 30, -160], legs: [20, -20], expression: "scream" });
      y = Math.max(pos.y, STAGE.waterY + 6) + (world.time - j.since) * 50;
    } else {
      spin = j.spin;
      pose = basePose({
        arms: [140 + Math.sin(t * 20) * 35, -140 + Math.cos(t * 17) * 35],
        legs: [Math.sin(t * 18) * 40, -Math.sin(t * 18 + 1) * 40],
        expression: j.vy > 200 ? "scream" : "normal",
      });
    }
    pose.facing = j.vx < 0 ? -1 : 1;
    k.pushTransform();
    k.pushTranslate(x, y);
    k.pushRotate(spin);
    k.pushScale(scale);
    look.draw({ ...pose, x: 0, y: JUMPER_CENTER });
    k.popTransform();
    if (j.golden && j.state !== "splash") {
      for (let s = 0; s < 3; s++) {
        const a = time * 4 + (s * Math.PI * 2) / 3;
        k.drawSprite({ sprite: "fx-star", pos: k.vec2(x + Math.cos(a) * 34, y + Math.sin(a) * 34), anchor: "center", width: 14, angle: time * 300 });
      }
    }
    if (j.state === "ready") {
      const blink = Math.sin(time * 16) > 0 ? 1 : 0.4;
      k.drawText({ text: "!", pos: k.vec2(x + 26, y - 56), size: 40, font: FONT, anchor: "center", color: c.danger, opacity: blink });
    }
  }

  function basePose(parts: Pick<ContestantPose, "arms" | "legs" | "expression">): ContestantPose {
    return { x: 0, y: 0, lean: 0, facing: 1, squash: 1, headTilt: 0, dizzy: false, time, ...parts };
  }

  function drawBalloons(world: World) {
    for (const b of world.balloons) {
      if (b.burstAt !== null) continue;
      const color = c.balloon[b.id % c.balloon.length];
      const r = TUNING.balloonRadius;
      const wobble = Math.sin(time * 9 + b.id) * 0.06;
      k.drawLine({ p1: k.vec2(b.x, b.y + r), p2: k.vec2(b.x + Math.sin(time * 7 + b.id) * 4, b.y + r + 12), width: 2, color: c.ink });
      k.drawEllipse({ pos: k.vec2(b.x, b.y), radiusX: r * (1 + wobble), radiusY: r * (1.12 - wobble), color, outline: { width: 3, color: c.ink } });
      k.drawCircle({ pos: k.vec2(b.x - r * 0.35, b.y - r * 0.4), radius: r * 0.25, color: c.white, opacity: 0.8 });
    }
  }

  // --- pantalla ------------------------------------------------------------------

  function drawOverlay(world: World) {
    show.drawLiveBadge(FONT);
    const timeLeft = Math.max(0, TUNING.duration - world.time);
    k.drawText({ text: String(Math.ceil(timeLeft)), pos: k.vec2(VIEW_W / 2, 60), size: 40, font: FONT, anchor: "center", color: timeLeft < 10 ? c.danger : c.white });

    // Cuántos llegaron y la racha.
    const { delivered, streak } = world.stats;
    k.drawText({ text: `LLEGARON ${delivered}`, pos: k.vec2(VIEW_W / 2, 100), size: 24, font: FONT, anchor: "center", color: c.star });
    if (streak >= 2) {
      const pulse = 1 + Math.max(0, Math.sin(time * 8)) * 0.08;
      k.drawText({ text: `RACHA ×${streak}`, pos: k.vec2(VIEW_W / 2, 128), size: 22, font: FONT, anchor: "center", color: c.good, scale: pulse });
    }

    // Quién es quién: "VOS" arriba tuyo, el apodo de las personas de la sala.
    world.holders.forEach((h, i) => {
      const view = holders[i];
      // Escalonadas: las de los dos portadores de un colchón no se pisan.
      const y = STAGE.deckY - view.h - (i % 2 === 0 ? 150 : 176);
      if (i === me) {
        const bounce = Math.abs(Math.sin(time * 5)) * 6;
        k.drawText({ text: "VOS", pos: k.vec2(view.x, y - 20 - bounce), size: 24, font: FONT, anchor: "center", color: c.star });
        k.drawPolygon({ pts: [k.vec2(view.x - 9, y - 6 - bounce), k.vec2(view.x + 9, y - 6 - bounce), k.vec2(view.x, y + 6 - bounce)], color: c.star, outline: { width: 2, color: c.ink } });
      } else if (view.member.control === "remote") {
        k.drawText({ text: view.member.name, pos: k.vec2(view.x + 2, y + 2), size: 18, font: FONT, anchor: "center", color: c.ink });
        k.drawText({ text: view.member.name, pos: k.vec2(view.x, y), size: 18, font: FONT, anchor: "center", color: c.white });
      }
      void h;
    });

    // El título de la ronda, recién cuando suena el silbato.
    const bannerAge = world.time;
    if (bannerAge > 0 && bannerAge < 2.6) {
      const scale = 1 + 0.3 * Math.max(0, 1 - bannerAge * 4);
      const fade = clamp((2.6 - bannerAge) * 3, 0, 1);
      k.drawText({ text: `RONDA ${world.round}`, pos: k.vec2(VIEW_W / 2, 200), size: 34, font: FONT, anchor: "center", color: c.white, opacity: fade });
      k.drawText({ text: world.config.title, pos: k.vec2(VIEW_W / 2, 250), size: 64, font: FONT, anchor: "center", color: c.star, scale, angle: -3, opacity: fade });
    }
    if (callout) {
      const pop = 1 + 0.4 * Math.max(0, 1 - callout.age * 5);
      k.drawText({ text: callout.text, pos: k.vec2(VIEW_W / 2, 175), size: 38, font: FONT, anchor: "center", scale: pop, color: callout.color, opacity: Math.min(1, (1.6 - callout.age) * 3) });
    }
    if (endAge >= 0) {
      const scale = 1 + 0.35 * Math.max(0, 1 - endAge * 4);
      k.drawText({ text: "¡TIEMPO!", pos: k.vec2(VIEW_W / 2, 250), size: 92, font: FONT, anchor: "center", scale, color: c.star, angle: -4 });
      const total = world.stats.delivered + world.stats.missed;
      k.drawText({ text: `${world.stats.delivered} DE ${total} LLEGARON`, pos: k.vec2(VIEW_W / 2, 330), size: 34, font: FONT, anchor: "center", color: c.white });
    }
  }

  return { react, update, draw };
}
