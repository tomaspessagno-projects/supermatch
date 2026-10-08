import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildTower, centerOf } from "../../sim/level";
import { NO_UPGRADES, statsFor } from "../../sim/progression";
import { blockOf, createWorld, type World } from "../../sim/sim";
import { TUNING } from "../../sim/tuning";
import { normalizeClipName, resolveClips } from "./clips";
import { poseFor } from "./poses";
import { CHANNELS, type Pose, RIG } from "./rig";
import { type AnimCtx, CharacterDriver, CLIPS, edgeNear, pickClip } from "./state";

const tower = buildTower();
const world = () => createWorld(tower, statsFor(NO_UPGRADES), { record: 0, highestRest: -1 }, 1);
const block = tower.path.map((s) => blockOf(tower, s.id)).find((b) => b && b.kind === "normal" && b.floor >= 1)!;

function standOn(w: World, dx = 0) {
  const c = centerOf(block);
  Object.assign(w.player, { x: c.x + dx, y: block.maxY, z: c.z, vx: 0, vy: 0, vz: 0, grounded: true, ground: "normal", on: block.id });
}

/** Unos cuadros del driver a 60 fps. */
function frames(d: CharacterDriver, w: World, seconds: number, from = 0) {
  for (let t = 0; t < seconds; t += 1 / 60) d.update(w, from + t, 1 / 60);
}

describe("qué animación toca", () => {
  it("cada estado de la simulación tiene la suya", () => {
    const w = world();
    const d = new CharacterDriver();
    const pick = () => pickClip(w, d.ctx);
    standOn(w);
    expect(pick()).toBe("idle");
    Object.assign(w.player, { vx: 5 });
    d.ctx.speed = 5;
    expect(pick()).toBe("run");
    Object.assign(w.player, { grounded: false, vy: 6 });
    expect(pick()).toBe("jump");
    Object.assign(w.player, { vy: -4 });
    expect(pick()).toBe("fall");
    w.player.hang = { block: block.id, axis: "z", side: 1, time: 0 };
    expect(pick()).toBe("hang");
    d.ctx.shimmy = 1.2;
    expect(pick()).toBe("shimmy");
    w.player.pullUp = { block: block.id, t: 0.3, from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 1, z: 0 } };
    expect(pick()).toBe("pullUp");
    w.player.stun = 0.5;
    expect(pick()).toBe("hit");
    w.phase = "splash";
    expect(pick()).toBe("swim");
  });

  it("parado en la punta de un bloque se tambalea (en el medio, no)", () => {
    const w = world();
    standOn(w);
    expect(edgeNear(w)).toBeNull();
    standOn(w, (block.maxX - block.minX) / 2 + 0.05);
    expect(edgeNear(w)).toEqual({ x: 1, z: 0 });
    const d = new CharacterDriver();
    frames(d, w, 1);
    expect(d.clip).toBe("teeter");
  });

  it("de una animación a otra pasa mezclando (sin saltos) y después queda sola", () => {
    const w = world();
    standOn(w);
    const d = new CharacterDriver();
    frames(d, w, 0.5);
    expect(d.clip).toBe("idle");
    Object.assign(w.player, { grounded: false, vy: -3, on: null });
    d.update(w, 0.6, 1 / 60);
    expect(d.clip).toBe("fall");
    const idle = d.weights.get("idle")!;
    expect(idle).toBeGreaterThan(0.5);
    expect(idle).toBeLessThan(1);
    frames(d, w, 1, 0.7);
    expect([...d.weights.keys()]).toEqual(["fall"]);
    expect(d.weights.get("fall")).toBeCloseTo(1, 2);
  });

  it("el doble salto es un mortal: vuelta entera en el aire y después a caer", () => {
    const w = world();
    Object.assign(w.player, { grounded: false, vy: 4, on: null });
    const d = new CharacterDriver();
    d.onEvents([{ type: "jump", double: true }]);
    d.update(w, 0, 1 / 60);
    expect(d.clip).toBe("flip");
    frames(d, w, 0.5, 1 / 60);
    expect(d.ctx.flip).toBe(0);
    expect(d.clip).toBe("jump");
  });

  it("al caer se aplasta (más cuanto más fuerte) y se recupera", () => {
    const d = new CharacterDriver();
    d.onEvents([{ type: "land", impact: 20, kind: "normal" }]);
    const hard = d.squash;
    const soft = new CharacterDriver();
    soft.onEvents([{ type: "land", impact: 8, kind: "normal" }]);
    expect(hard).toBeLessThan(soft.squash);
    expect(soft.squash).toBeLessThan(1);
    const w = world();
    standOn(w);
    frames(d, w, 1.5);
    expect(d.squash).toBeCloseTo(1, 2);
  });
});

describe("las poses", () => {
  it("ninguna se rompe (todo número) en ningún momento", () => {
    const ctx: AnimCtx = {
      t: 0, speed: 0, stride: 0, phase: 0, vy: 0, turn: 0, accel: 0, idleTime: 0, hangTime: 0, hangLimit: 2.5, shimmy: 0, shimmyPhase: 0,
      swing: 0, pull: 0, climbPhase: 0, teeterX: 0, teeterZ: 1, flip: 0.5, cheer: 1, splashTime: 0, strain: 0,
    };
    for (let i = 0; i < 200; i++) {
      const k = i / 199;
      Object.assign(ctx, { t: i * 0.137, speed: k * 8, stride: k, phase: i * 0.7, vy: -30 + k * 45, turn: Math.sin(i) * 5, accel: Math.cos(i) * 30, idleTime: k * 10, hangTime: k * 3, shimmy: Math.sin(i) * 2, shimmyPhase: i, swing: Math.sin(i) * 0.5, pull: k, climbPhase: i, strain: k });
      for (const clip of CLIPS) {
        const p = poseFor(clip, ctx);
        for (const c of CHANNELS) expect(Number.isFinite(p[c]), `${clip}.${c}`).toBe(true);
      }
    }
  });

  /** Dónde queda la mano izquierda (respecto de los pies), con las medidas del muñeco. */
  function hand(p: Pose) {
    const pivot = new THREE.Object3D();
    pivot.position.set(0, RIG.hipY, 0);
    const hips = new THREE.Object3D();
    hips.position.set(0, p.hipY, p.hipZ);
    hips.rotation.set(p.lean, p.hipYaw, p.roll);
    const spine = new THREE.Object3D();
    spine.position.set(0, RIG.spineY, 0);
    spine.rotation.set(p.chestPitch, p.chestYaw, p.chestRoll);
    const arm = new THREE.Object3D();
    arm.position.set(-RIG.shoulderX, RIG.shoulderY, 0);
    arm.rotation.set(-p.armL, 0, -p.armOutL);
    const elbow = new THREE.Object3D();
    elbow.position.set(0, -RIG.upperArm, 0);
    elbow.rotation.x = -p.elbowL;
    const tip = new THREE.Object3D();
    tip.position.set(0, -RIG.forearm, 0);
    pivot.add(hips);
    hips.add(spine);
    spine.add(arm);
    arm.add(elbow);
    elbow.add(tip);
    pivot.updateMatrixWorld(true);
    return tip.getWorldPosition(new THREE.Vector3());
  }

  it("colgado, las manos quedan arriba del borde del que se agarró la simulación", () => {
    const ctx = { t: 0, swing: 0, strain: 0 } as AnimCtx;
    const h = hand(poseFor("hang", ctx));
    // El borde está a hangReach de los pies y la cara del bloque, a un radio adelante.
    expect(h.y).toBeGreaterThan(TUNING.hangReach - 0.05);
    expect(h.y).toBeLessThan(TUNING.hangReach + 0.15);
    expect(h.z).toBeGreaterThan(TUNING.playerRadius - 0.05);
    expect(h.z).toBeLessThan(TUNING.playerRadius + 0.2);
  });
});

describe("el modelo 3D (GLB)", () => {
  it("encuentra las animaciones por nombre, con los de Mixamo y Blender", () => {
    expect(normalizeClipName("Armature|Hanging Idle")).toBe("hangingidle");
    const names = resolveClips(["Armature|Idle", "Running", "Jump", "Falling Idle", "Hanging Idle", "Braced Hang Shimmy", "Braced Hang To Crouch", "Victory"]);
    expect(names).toMatchObject({
      idle: "Armature|Idle", run: "Running", jump: "Jump", fall: "Falling Idle", hang: "Hanging Idle",
      shimmy: "Braced Hang Shimmy", pullUp: "Braced Hang To Crouch", cheer: "Victory",
    });
  });

  it("si falta alguna, usa la más parecida que haya", () => {
    // Las del robot de ejemplo de three.js.
    const names = resolveClips(["Dance", "Death", "Idle", "Jump", "No", "Punch", "Running", "Sitting", "Standing", "ThumbsUp", "Walking", "WalkJump", "Wave", "Yes"]);
    expect(names).toMatchObject({ idle: "Idle", run: "Running", jump: "Jump", fall: "Jump", hang: "Jump", shimmy: "Jump", skate: "Running", cheer: "Wave", teeter: "Idle" });
    expect(resolveClips([]).idle).toBeNull();
  });
});
