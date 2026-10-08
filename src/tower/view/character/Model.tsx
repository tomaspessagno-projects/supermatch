"use client";

import { useGLTF } from "@react-three/drei";
import { createPortal, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { TUNING } from "../../sim/tuning";
import { useTower } from "../../store";
import { type Frame, playerPosition } from "../frame";
import { toonGradient } from "../toon";
import { CLIP_NAMES, CLIP_PLAY, normalizeClipName, resolveClips } from "./clips";
import { Hat } from "./Hat";
import { clamp } from "./rig";
import type { Clip, CharacterDriver } from "./state";

/**
 * El concursante como modelo 3D con esqueleto y animaciones (un GLB, por
 * ejemplo de Tripo o Meshy, animado con Mixamo). El driver elige qué hacer
 * (correr, colgarse, subirse…) y acá se pasa de una animación a otra con
 * crossfade. Pide al GLB:
 * - animaciones "en el lugar" (sin avanzar: la simulación mueve al personaje),
 *   con los nombres de clips.ts (idle, run, jump, fall, hang, shimmy, pullup…);
 * - el material de la camiseta llamado "shirt" (se pinta del color del equipo).
 */

const FADE = 0.16;
/** Cuánto más alto que la simulación (la cabeza es grande). */
const HEIGHT = TUNING.playerHeight * 1.08;
const SHIRT = /shirt|camiseta|remera|team|equipo/i;

type Rig = {
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  names: Record<Clip, string | null>;
  head: THREE.Object3D | null;
  /** Escala del hueso de la cabeza (para que el sombrero mida lo mismo). */
  headScale: number;
  headY: number;
  hipY: number;
  /** Cuánto bajar al personaje colgado para que las manos queden en el borde. */
  hangOffset: number;
};

const findBone = (root: THREE.Object3D, test: (name: string) => boolean) => {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!found && (o as THREE.Bone).isBone && test(o.name.toLowerCase())) found = o;
  });
  return found as THREE.Object3D | null;
};

/** Sin avanzar: al hueso raíz le saca lo que se mueve en x y z. */
function inPlace(clip: THREE.AnimationClip, rootBone: string | null): THREE.AnimationClip {
  if (!rootBone) return clip;
  const out = clip.clone();
  for (const track of out.tracks) {
    if (track.name !== `${rootBone}.position`) continue;
    const v = track.values;
    for (let i = 0; i < v.length; i += 3) {
      v[i] = v[0];
      v[i + 2] = v[2];
    }
  }
  return out;
}

/** Materiales toon como el resto del juego (con la textura del modelo). */
function toToon(material: THREE.Material): THREE.Material {
  const src = material as THREE.MeshStandardMaterial;
  const out = new THREE.MeshToonMaterial({
    color: src.color ?? new THREE.Color("#ffffff"),
    map: src.map ?? null,
    gradientMap: toonGradient(),
    transparent: src.transparent,
    opacity: src.opacity,
    alphaTest: src.alphaTest,
    side: src.side,
  });
  out.name = src.name;
  return out;
}

function prepare(scene: THREE.Object3D, clips: THREE.AnimationClip[]): Rig {
  const model = clone(scene);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    // Los que tienen esqueleto se mueven fuera de su caja original: que no desaparezcan.
    mesh.frustumCulled = false;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(toToon) : toToon(mesh.material);
  });
  // Que mida lo que mide el jugador, con los pies en 0.
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const scale = HEIGHT / Math.max(0.01, box.max.y - box.min.y);
  model.scale.multiplyScalar(scale);
  model.position.y -= box.min.y * scale;
  model.updateMatrixWorld(true);

  const hips = findBone(model, (n) => /hips|pelvis/.test(n)) ?? findBone(model, () => true);
  const head = findBone(model, (n) => /head$/.test(n) || n.endsWith("head")) ?? findBone(model, (n) => n.includes("head") && !n.includes("end") && !n.includes("top"));
  const hand = findBone(model, (n) => /hand$/.test(n) || /hand_?[lr]$/.test(n)) ?? findBone(model, (n) => n.includes("hand"));
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const headY = head ? head.getWorldPosition(v).y : HEIGHT * 0.8;
  const headScale = head ? head.getWorldScale(s).y : 1;
  const hipY = hips ? hips.getWorldPosition(v).y : HEIGHT * 0.5;

  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of clips) actions.set(clip.name, mixer.clipAction(inPlace(clip, hips?.name ?? null)));
  const names = resolveClips(clips.map((c) => c.name));

  // Colgado: mide a qué altura quedan las manos en la animación y lo baja (o sube) al borde.
  let hangOffset = 0;
  const hangAction = names.hang ? actions.get(names.hang) : undefined;
  if (hand && hangAction && names.hang && CLIP_NAMES.hang.includes(normalizeClipName(names.hang))) {
    hangAction.reset().play();
    mixer.update(0);
    model.updateMatrixWorld(true);
    hangOffset = TUNING.hangReach + 0.05 - hand.getWorldPosition(v).y;
    hangAction.stop();
    mixer.update(0);
  }
  return { model, mixer, actions, names, head, headScale, headY, hipY, hangOffset };
}

export function CharacterModel({ url, frame, driver, teamColor }: { url: string; frame: React.RefObject<Frame | null>; driver: CharacterDriver; teamColor: string }) {
  const gltf = useGLTF(url);
  const rig = useMemo(() => prepare(gltf.scene, gltf.animations), [gltf]);
  const hat = useTower((s) => s.hat);
  const root = useRef<THREE.Group>(null);
  const squash = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const playing = useRef<THREE.AnimationAction | null>(null);

  // La camiseta, del color del equipo.
  useEffect(() => paintShirt(rig.model, teamColor), [rig, teamColor]);
  useEffect(
    () => () => {
      rig.mixer.stopAllAction();
    },
    [rig],
  );

  useFrame((_, delta) => {
    const f = frame.current;
    if (!f || !root.current || !squash.current || !pivot.current) return;
    const w = f.world;
    const p = w.player;
    const dt = Math.min(delta, 0.1);
    driver.update(w, f.clock, delta);
    const c = driver.ctx;

    const pos = playerPosition(f);
    const hanging = (driver.weights.get("hang") ?? 0) + (driver.weights.get("shimmy") ?? 0) + (driver.weights.get("pullUp") ?? 0) * (1 - c.pull);
    root.current.position.set(pos.x, pos.y + rig.hangOffset * Math.min(1, hanging), pos.z);
    if (w.phase === "splash") root.current.position.y = Math.max(TUNING.waterY - 0.9, pos.y) - Math.min(1.1, c.splashTime * 0.9);
    root.current.rotation.y = driver.facing;
    const sq = driver.squash;
    const sy = sq < 1 ? 1 - (1 - sq) * 0.3 : 1 + (sq - 1) * 0.6;
    squash.current.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    pivot.current.rotation.x = (c.flip > 0 ? (1 - (1 - c.flip) ** 2) * Math.PI * 2 : 0) + driver.tumble;

    // Cambio de animación: la nueva entra mientras la anterior se va.
    const name = rig.names[driver.clip];
    const action = name ? rig.actions.get(name) : undefined;
    if (action && action !== playing.current) {
      const mode = CLIP_PLAY[driver.clip];
      action.reset();
      action.setLoop(mode === "loop" ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = mode !== "loop";
      action.setEffectiveWeight(1);
      action.play();
      if (playing.current) action.crossFadeFrom(playing.current, FADE, false);
      playing.current = action;
    }
    if (action) {
      switch (driver.clip) {
        case "run":
          action.timeScale = clamp((c.speed / TUNING.moveSpeed) * 1.1, 0.4, 1.6);
          break;
        case "shimmy":
          action.timeScale = clamp(Math.abs(c.shimmy) / TUNING.shimmySpeed, 0.3, 1.5) * (c.shimmy < 0 ? -1 : 1);
          break;
        case "climb":
          action.timeScale = clamp(Math.abs(p.vy) / TUNING.climbSpeed + Math.abs(c.speed) / TUNING.climbSide, 0, 1.4);
          break;
        case "pullUp":
          // La simulación maneja el tiempo: la animación va al mismo ritmo que la subida.
          action.timeScale = 0;
          action.time = c.pull * action.getClip().duration;
          break;
        default:
          action.timeScale = 1;
      }
    }
    rig.mixer.update(dt);
  });

  // El sombrero va en el hueso de la cabeza (con la escala de nuestras medidas).
  const headTop = HEIGHT - rig.headY;
  return (
    <group ref={root}>
      <group ref={squash}>
        <group ref={pivot} position-y={rig.hipY}>
          <group position-y={-rig.hipY}>
            <primitive object={rig.model} />
          </group>
        </group>
      </group>
      {hat && rig.head &&
        createPortal(
          <group scale={1 / rig.headScale} position-y={(headTop - 0.47) / rig.headScale}>
            <Hat id={hat} />
          </group>,
          rig.head,
        )}
    </group>
  );
}

function paintShirt(model: THREE.Object3D, color: string) {
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (SHIRT.test(m.name) || SHIRT.test(mesh.name)) (m as THREE.MeshToonMaterial).color.set(color);
    }
  });
}
