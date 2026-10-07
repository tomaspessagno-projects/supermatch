import type { KAPLAYCtx } from "kaplay";
import { FONT, hasSprite, SPRITES } from "../../assets";
import { createAnimator } from "../../engine/animator";
import { createContestant } from "../../engine/contestant";
import { createFx } from "../../engine/fx";
import { clamp } from "../../engine/physics";
import { createReferee } from "../../engine/referee";
import { createRankTracker, createShow } from "../../engine/show";
import { score, type SimEvent, type World } from "./sim";
import { TUNING } from "./tuning";

const VIEW_W = 1280;
const VIEW_H = 720;
const CONFETTI = Object.keys(SPRITES).filter((n) => n.startsWith("fx-confetti-"));

const CANNON_W = 100;
const CANNON_H = CANNON_W * (SPRITES["prop-cannon"].h / SPRITES["prop-cannon"].w);
const MUZZLE_Y = 0.32; // altura de la boca en el sprite (fracción)
const RECOIL = 14;

/** Troncos de los rivales al fondo de la pileta: centro en pantalla y escala. */
const RIVAL_SPOTS = [
  { x: 300, scale: 0.36 },
  { x: 1010, scale: 0.36 },
  { x: 1150, scale: 0.3 },
] as const;
const RIVAL_OPACITY = 0.85;

const POOLSIDE_W = 175; // borde de la pileta donde está el árbitro

type CannonKey = `${-1 | 1}:${"low" | "high"}`;

/**
 * Dibuja El Tronco Loco a partir de la simulación. Cámara fija: el "nivel" es
 * lo que pasa en el tiempo (giro, disparos, burbujas). Nunca modifica `world`.
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
    waterAbyss: k.rgb("#123a6b"),
    white: k.rgb("#ffffff"),
    star: k.rgb("#facc15"),
    danger: k.rgb("#f87171"),
    deck: k.rgb("#e0f2fe"),
    pole: k.rgb("#3b2a6b"),
    good: k.rgb("#4ade80"),
  };
  const fx = createFx(k, FONT);
  const referee = createReferee(k);
  const show = createShow(k, [teamColor, ...rivalTeams.map((r) => r.color)]);
  const ranking = createRankTracker(rivalTeams.map((r) => r.name.toUpperCase()));
  const player = { look: createContestant(k, teamColor), anim: createAnimator() };
  const rivals = rivalTeams.map(({ color, tag }, i) => ({
    color: k.rgb(color),
    tag,
    look: createContestant(k, color),
    anim: createAnimator(),
    spot: RIVAL_SPOTS[i % RIVAL_SPOTS.length],
  }));

  const aimingUntil = new Map<CannonKey, number>();
  const recoil = new Map<CannonKey, number>();
  let creakUntil = 0;
  let creakDir = 0;
  let bannerAge = 0;
  let time = 0;
  let rank = 1;
  let callout: { text: string; good: boolean; age: number } | null = null;

  function react(events: readonly SimEvent[], world: World) {
    const p = world.player;
    const { center, radius, waterY } = world.level;
    player.anim.react(events);
    for (const e of events) {
      switch (e.type) {
        case "jump":
          fx.burst({ x: p.x, y: p.y, count: 4, speed: 140, sprites: ["fx-bubbles"], size: 20, spread: 140, gravity: -250, life: 0.7 });
          break;
        case "land":
          if (e.impact > 500) fx.flash("fx-puff", p.x, p.y + 4, { anchor: "bot", from: 0.12, to: 0.32, life: 0.4 });
          break;
        case "creak":
          creakUntil = world.time + TUNING.spinWarning;
          creakDir = Math.sign(e.omega);
          fx.popup("¡CRAC!", center.x + (creakDir || 1) * (radius + 70), center.y - 40, c.danger, { size: 40 });
          break;
        case "aim":
          aimingUntil.set(`${e.side}:${e.height}`, world.time + TUNING.shotWarning);
          break;
        case "fire": {
          const key: CannonKey = `${e.side}:${e.height}`;
          recoil.set(key, 1);
          const x = e.side < 0 ? world.level.muzzleX.left : world.level.muzzleX.right;
          fx.flash("fx-puff", x, world.level.ballY[e.height] + 20, { anchor: "bot", from: 0.1, to: 0.3, life: 0.35 });
          break;
        }
        case "hit":
          fx.burst({ x: e.x, y: e.y, count: 10, speed: 520, sprites: ["fx-star"], size: 22, spread: 360 });
          fx.popup("¡PUM!", e.x, e.y - 90, c.star, { size: 48, backdrop: "fx-burst", backdropSize: 180 });
          k.shake(12);
          show.excite(0.45);
          break;
        case "pop":
          fx.burst({ x: e.x, y: e.y, count: 12, speed: 320, sprites: CONFETTI, size: 12, spread: 360, life: 0.8, gravity: 400 });
          fx.popup("+25", e.x, e.y - 40, c.star, { size: 34 });
          show.excite(0.2);
          break;
        case "slip":
          fx.popup("¡UY!", e.x, p.y - 140, c.white, { size: 40 });
          break;
        case "splash":
          referee.card();
          fx.flash("fx-splash", e.x, waterY + 30, { anchor: "bot", from: 0.5, to: 1.1, life: 0.8 });
          fx.burst({ x: e.x, y: waterY, count: 24, speed: 700, colors: [c.water, c.white], size: 14, spread: 70, life: 0.9 });
          fx.popup("¡PLAF!", e.x, waterY - 150, c.water, { size: 56 });
          k.shake(8);
          show.excite(0.9);
          break;
        case "respawn":
          fx.flash("fx-puff", e.x, center.y - radius + 4, { anchor: "bot", from: 0.2, to: 0.5, life: 0.5 });
          break;
        case "finish":
          referee.end();
          show.excite(1);
          fx.burst({ x: p.x, y: p.y - 120, count: 60, speed: 650, sprites: CONFETTI, size: 18, spread: 150, life: 1.8, gravity: 500 });
          break;
        case "out":
          referee.end();
          break;
      }
    }
  }

  /** Efectos chicos para los rivales (sin sacudón ni carteles). */
  function reactRival(i: number, events: readonly SimEvent[], world: World) {
    const rival = rivals[i];
    if (!rival) return;
    rival.anim.react(events);
    for (const e of events) {
      if (e.type === "splash") {
        const at = toRival(rival.spot, world, e.x, world.level.waterY);
        fx.burst({ x: at.x, y: world.level.waterY, count: 8, speed: 380, colors: [c.water, c.white], size: 8, spread: 60, life: 0.6 });
      } else if (e.type === "hit") {
        const at = toRival(rival.spot, world, e.x, e.y);
        fx.burst({ x: at.x, y: at.y, count: 4, speed: 260, sprites: ["fx-star"], size: 10, spread: 360 });
      }
    }
  }

  function update(dt: number, world: World, rivalWorlds: readonly World[], move: number) {
    time += dt;
    fx.update(dt);
    referee.update(dt);
    show.update(dt);
    const carried = world.player.grounded ? world.omega * world.level.radius : 0;
    player.anim.update(dt, world.player, move, world.player.vx - carried);
    rivalWorlds.forEach((w, i) => {
      const relative = w.player.vx - (w.player.grounded ? w.omega * w.level.radius : 0);
      rivals[i]?.anim.update(dt, w.player, Math.abs(relative) > 40 ? Math.sign(relative) : 0, relative);
    });
    for (const [key, r] of recoil) recoil.set(key, Math.max(0, r - dt * 5));
    k.setCamPos(VIEW_W / 2, VIEW_H / 2);
    k.setCamScale(1);

    // Puesto por puntaje y avisos de adelantamiento.
    const race = ranking.update(score(world), rivalWorlds.map(score), world.time);
    rank = race.rank;
    if (race.calls.length && world.outcome === null) callout = { ...race.calls[race.calls.length - 1], age: 0 };
    if (callout) {
      callout.age += dt;
      if (callout.age > 1.8) callout = null;
    }
    bannerAge = world.outcome ? bannerAge + dt : 0;
  }

  function draw(world: World, rivalWorlds: readonly World[]) {
    drawStudio();
    show.drawLights();
    rivalWorlds.forEach((w, i) => drawRival(i, w));
    drawWater(world, 1);
    drawDuck(world);
    drawStand(world);
    drawLog(world);
    drawPlayer(world);
    drawWater(world, 0.72, 12);
    drawPoolside(world);
    drawCannons(world);
    drawBalls(world);
    drawBubbles(world);
    referee.draw(POOLSIDE_W / 2, world.level.waterY - 10, 92);
    fx.draw();
    show.drawCrowd(0);
    drawOverlay(world);
  }

  // --- piezas ---------------------------------------------------------------

  function drawStudio() {
    if (!hasSprite("bg-studio")) return;
    const w = (SPRITES["bg-studio"].w / SPRITES["bg-studio"].h) * VIEW_H;
    k.drawSprite({ sprite: "bg-studio", pos: k.vec2((VIEW_W - w) / 2, 0), width: w, height: VIEW_H });
  }

  function drawWater(world: World, opacity: number, offset = 0) {
    const top = world.level.waterY + offset;
    k.drawRect({ pos: k.vec2(0, top), width: VIEW_W, height: VIEW_H - top, gradient: [c.water, c.waterAbyss], opacity });
    if (offset > 0) {
      const bob = Math.sin(time * 1.6) * 3;
      const tw = (SPRITES["prop-water"].w / SPRITES["prop-water"].h) * 30;
      for (let x = -tw * ((time * 20) % 1); x < VIEW_W; x += tw) {
        k.drawSprite({ sprite: "prop-water", pos: k.vec2(x, world.level.waterY - 16 + bob), width: tw + 1, height: 30 });
      }
    }
  }

  /** Un pato inflable flotando en la pileta: decoración, para que el agua se sienta pileta. */
  function drawDuck(world: World) {
    if (!hasSprite("prop-duck")) return;
    k.drawSprite({
      sprite: "prop-duck",
      pos: k.vec2(438 + Math.sin(time * 0.5) * 10, world.level.waterY + 16 + Math.sin(time * 1.7) * 3),
      anchor: "bot",
      width: 74,
      angle: Math.sin(time * 1.3) * 5,
    });
  }

  function drawStand(world: World) {
    const { center, radius } = world.level;
    k.drawSprite({ sprite: "prop-log-stand", pos: k.vec2(center.x, center.y + radius * 0.25), anchor: "top", width: radius * 2.3 });
  }

  function drawLog(world: World) {
    const { center, radius } = world.level;
    const creaking = world.time < creakUntil;
    const jitter = creaking ? Math.sin(time * 70) * 2.5 : 0;
    k.drawSprite({
      sprite: "prop-log",
      pos: k.vec2(center.x + jitter, center.y),
      anchor: "center",
      width: radius * 2 + 8,
      angle: (world.angle * 180) / Math.PI,
    });
    if (creaking) {
      // Hacia dónde va a girar: flechas pintadas sobre el tronco.
      const blink = Math.sin(time * 18) > -0.3 ? 1 : 0.35;
      k.drawText({
        text: creakDir > 0 ? ">>>" : "<<<",
        pos: k.vec2(center.x, center.y + 10),
        size: 64,
        font: FONT,
        anchor: "center",
        color: c.danger,
        opacity: blink,
      });
    }
  }

  function drawPlayer(world: World) {
    if (world.respawnIn > 0) return;
    player.look.draw(player.anim.pose(world.player, world.time, { celebrate: world.outcome === "finished" }));
  }

  /** Borde de la pileta: el mismo tablón enjabonado del Puente. */
  function drawPoolside(world: World) {
    const top = world.level.waterY - 10;
    k.drawRect({ pos: k.vec2(-20, top + 14), width: POOLSIDE_W + 20, height: VIEW_H - top, color: c.pole, outline: { width: 4, color: c.ink } });
    if (hasSprite("deck-tile")) {
      const h = 66;
      const w = (SPRITES["deck-tile"].w / SPRITES["deck-tile"].h) * h;
      k.drawSprite({ sprite: "deck-tile", pos: k.vec2(POOLSIDE_W - w, top - h * 0.255), width: w, height: h });
    }
  }

  function drawCannons(world: World) {
    const { muzzleX, ballY, waterY } = world.level;
    for (const side of [-1, 1] as const) {
      const muzzle = side < 0 ? muzzleX.left : muzzleX.right;
      const x = side < 0 ? muzzle - CANNON_W : muzzle;
      // Poste que los sostiene.
      const poleX = x + CANNON_W * (side < 0 ? 0.35 : 0.65);
      k.drawRect({ pos: k.vec2(poleX - 7, ballY.high), width: 14, height: waterY - ballY.high, color: c.pole, outline: { width: 3, color: c.ink } });
      for (const height of ["high", "low"] as const) {
        const key: CannonKey = `${side}:${height}`;
        const aiming = world.time < (aimingUntil.get(key) ?? 0);
        const shake = aiming ? Math.sin(time * 60) * 2 : 0;
        const back = (recoil.get(key) ?? 0) * RECOIL * -side;
        const top = ballY[height] - CANNON_H * MUZZLE_Y;
        if (aiming) {
          const pulse = 0.5 + 0.5 * Math.sin(time * 20);
          k.drawCircle({ pos: k.vec2(muzzle, ballY[height]), radius: 26 + pulse * 8, color: c.danger, opacity: 0.35 + pulse * 0.3 });
          k.drawText({ text: "!", pos: k.vec2(x + CANNON_W / 2, top - 26), size: 40, font: FONT, anchor: "center", color: c.danger });
        }
        k.drawSprite({
          sprite: "prop-cannon",
          pos: k.vec2(x + back + shake, top),
          width: CANNON_W,
          flipX: side < 0,
        });
      }
    }
  }

  function drawBalls(world: World) {
    for (const ball of world.balls) {
      k.drawSprite({
        sprite: "prop-foam-ball",
        pos: k.vec2(ball.x, ball.y),
        anchor: "center",
        width: TUNING.ballRadius * 2 + 6,
        angle: ball.x * 1.5,
      });
    }
  }

  function drawBubbles(world: World) {
    world.activeBubbles.forEach((b, i) => {
      const age = world.time - b.bornAt;
      const left = TUNING.bubbleLife - age;
      const appear = clamp(age / 0.3, 0, 1);
      const blink = left < 0.8 && Math.sin(time * 30) < 0 ? 0.35 : 1;
      k.drawSprite({
        sprite: "prop-bubble-gold",
        pos: k.vec2(b.x, b.y + Math.sin(time * 3 + i) * 4),
        anchor: "center",
        width: TUNING.bubbleRadius * 2.2 * appear,
        opacity: blink,
      });
    });
  }

  /** Punto del mundo de un rival, llevado a su tronquito del fondo. */
  function toRival(spot: (typeof RIVAL_SPOTS)[number], world: World, x: number, y: number) {
    const { center, radius, waterY } = world.level;
    const cy = waterY - radius * spot.scale + 8;
    return { x: spot.x + (x - center.x) * spot.scale, y: cy + (y - center.y) * spot.scale };
  }

  function drawRival(i: number, w: World) {
    const rival = rivals[i];
    if (!rival) return;
    const { center, radius, waterY } = w.level;
    const { spot } = rival;
    const cy = waterY - radius * spot.scale + 8;
    k.pushTransform();
    k.pushTranslate(spot.x, cy);
    k.pushScale(spot.scale);
    k.pushTranslate(-center.x, -center.y);
    k.drawSprite({ sprite: "prop-log", pos: k.vec2(center.x, center.y), anchor: "center", width: radius * 2 + 8, angle: (w.angle * 180) / Math.PI, opacity: RIVAL_OPACITY });
    if (w.respawnIn === 0) rival.look.draw(rival.anim.pose(w.player, w.time, { opacity: RIVAL_OPACITY }));
    k.popTransform();

    // Equipo y vidas sobre el tronquito.
    const top = cy - (radius + 120) * spot.scale;
    k.drawCircle({ pos: k.vec2(spot.x, top), radius: 8, color: rival.color, outline: { width: 3, color: c.ink } });
    if (rival.tag) {
      // El apodo de la persona, arriba de las vidas.
      k.drawText({ text: rival.tag, pos: k.vec2(spot.x + 2, top - 38), size: 18, font: FONT, anchor: "center", color: c.ink });
      k.drawText({ text: rival.tag, pos: k.vec2(spot.x, top - 40), size: 18, font: FONT, anchor: "center", color: c.white });
    }
    for (let life = 0; life < TUNING.lives; life++) {
      k.drawCircle({
        pos: k.vec2(spot.x - 14 + life * 14, top - 18),
        radius: 4,
        color: life < w.lives ? c.white : c.ink,
        opacity: life < w.lives ? 0.95 : 0.5,
      });
    }
  }

  function drawOverlay(world: World) {
    show.drawLiveBadge(FONT);
    show.drawRank(rank, VIEW_W / 2 - 92, 62, FONT, { gold: c.star, plain: c.white });
    const timeLeft = Math.max(0, TUNING.timeLimit - world.time);
    k.drawText({ text: String(Math.ceil(timeLeft)), pos: k.vec2(VIEW_W / 2, 60), size: 40, font: FONT, anchor: "center", color: timeLeft < 10 ? c.danger : c.white });
    if (callout) {
      const pop = 1 + 0.4 * Math.max(0, 1 - callout.age * 5);
      k.drawText({
        text: callout.text,
        pos: k.vec2(VIEW_W / 2, 160),
        size: 32,
        font: FONT,
        anchor: "center",
        scale: pop,
        color: callout.good ? c.good : c.danger,
        opacity: Math.min(1, (1.8 - callout.age) * 3),
      });
    }

    // Vidas: cabecitas; las perdidas, apagadas.
    for (let life = 0; life < TUNING.lives; life++) {
      k.drawSprite({
        sprite: "char-head",
        pos: k.vec2(VIEW_W / 2 + (life - 1) * 42, 112),
        anchor: "center",
        width: 34,
        opacity: life < world.lives ? 1 : 0.25,
      });
    }

    if (world.outcome) {
      const text = { finished: "¡AGUANTASTE!", out: "¡AFUERA!" }[world.outcome];
      const color = { finished: c.star, out: c.white }[world.outcome];
      const scale = 1 + 0.35 * Math.max(0, 1 - bannerAge * 4);
      k.drawText({ text, pos: k.vec2(VIEW_W / 2, 250), size: 92, font: FONT, anchor: "center", scale, color, angle: -4 });
    }
  }

  return { react, reactRival, update, draw };
}
