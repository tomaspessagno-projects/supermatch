"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { itemDef, MUTATION } from "../sim/items";
import type { SimEvent } from "../sim/sim";
import { TUNING } from "../sim/tuning";
import { bus } from "./bus";
import type { Frame } from "./frame";
import { INK, PALETTE } from "./toon";

const FONT = "/game/fonts/LuckiestGuy-Regular.ttf";
const MAX_PARTICLES = 400;

type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; color: THREE.Color; gravity: number };
type Popup = { id: number; text: string; color: string; x: number; y: number; z: number; born: number; size: number };

/**
 * Efectos: salpicones al caer al agua, confeti, estrellas en los golpes y
 * carteles que flotan ("+3", "¡PATITO DE GOMA!"). Son solo visuales (usan
 * Math.random, no tocan la simulación).
 */
export function Effects({ frame }: { frame: React.RefObject<Frame | null> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const particles = useRef<Particle[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const nextId = useRef(1);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: false, toneMapped: false }), []);

  useEffect(() => {
    const burst = (x: number, y: number, z: number, count: number, colors: string[], speed: number, up: number, gravity = 18, size = 0.12, life = 0.9) => {
      for (let i = 0; i < count && particles.current.length < MAX_PARTICLES; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.6);
        particles.current.push({
          x, y, z,
          vx: Math.cos(a) * s,
          vz: Math.sin(a) * s,
          vy: up * (0.5 + Math.random() * 0.8),
          life,
          max: life,
          size: size * (0.6 + Math.random() * 0.8),
          color: new THREE.Color(colors[i % colors.length]),
          gravity,
        });
      }
    };
    const pop = (text: string, color: string, x: number, y: number, z: number, size = 0.5) => {
      const id = nextId.current++;
      const born = frame.current?.clock ?? 0;
      setPopups((list) => [...list.slice(-7), { id, text, color, x, y, z, born, size }]);
    };
    return bus.on((events: readonly SimEvent[]) => {
      const p = frame.current?.world.player;
      if (!p) return;
      for (const e of events) {
        switch (e.type) {
          case "splash":
            burst(e.x, TUNING.waterY + 0.1, e.z, 70, [PALETTE.water, "#ffffff", "#7dd3fc"], 6, 9, 20, 0.16, 1.1);
            pop("¡PLAF!", PALETTE.cyan, e.x, TUNING.waterY + 3, e.z, 1.1);
            break;
          case "chip":
            burst(e.x, e.y, e.z, 10, [PALETTE.gold, "#fff7ae"], 2.5, 4, 10, 0.08, 0.6);
            pop(`+${e.value}`, PALETTE.yellow, e.x, e.y + 0.8, e.z, 0.45);
            break;
          case "item": {
            const def = itemDef(e.item.def);
            const mutation = MUTATION[e.item.mutation].label;
            burst(e.x, e.y, e.z, 40, [PALETTE.pink, PALETTE.yellow, PALETTE.cyan, "#ffffff"], 4, 7, 12, 0.11, 1.2);
            pop(`${mutation ? mutation.toUpperCase() + " · " : ""}${def.name.toUpperCase()}`, e.item.mutation === "none" ? PALETTE.white : PALETTE.gold, e.x, e.y + 1.2, e.z, 0.45);
            break;
          }
          case "bagFull":
            pop("¡MOCHILA LLENA!", PALETTE.red, e.x, e.y + 1, e.z, 0.4);
            break;
          case "knock":
            burst(e.x, e.y, e.z, 14, [PALETTE.yellow, "#ffffff"], 5, 4, 8, 0.12, 0.6);
            pop("¡PUM!", PALETTE.yellow, e.x, e.y + 1, e.z, 0.7);
            break;
          case "bounce":
            burst(p.x, p.y, p.z, 12, [PALETTE.pink, "#ffffff"], 3, 2, 6, 0.1, 0.5);
            pop("¡BOING!", PALETTE.pink, p.x, p.y + 2, p.z, 0.5);
            break;
          case "land":
            if (e.impact > 9) burst(p.x, p.y + 0.05, p.z, 10, ["#ffffff", "#e2e8f0"], 2.5, 1.5, 6, 0.1, 0.4);
            break;
          case "refill":
            burst(p.x, p.y + 1, p.z, 24, [PALETTE.green, "#ffffff"], 3, 5, 8, 0.1, 0.8);
            pop("¡DESCANSO! +ENERGÍA", PALETTE.green, p.x, p.y + 2.4, p.z, 0.5);
            break;
          case "exhausted":
            pop("¡SIN NAFTA!", PALETTE.red, p.x, p.y + 2.4, p.z, 0.55);
            break;
          case "top":
            burst(p.x, p.y + 1, p.z, 160, [PALETTE.pink, PALETTE.yellow, PALETTE.cyan, PALETTE.green, "#ffffff"], 7, 12, 8, 0.14, 2.4);
            pop("¡LA COPA!", PALETTE.gold, p.x, p.y + 3, p.z, 1.2);
            break;
          case "floor":
            burst(p.x, p.y + 1, p.z, 30, [PALETTE.yellow, PALETTE.pink], 4, 6, 10, 0.1, 1);
            break;
          case "jump":
            if (e.double) burst(p.x, p.y, p.z, 10, ["#ffffff"], 2, -1, 0, 0.12, 0.4);
            break;
        }
      }
    });
  }, [frame]);

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(delta, 0.05);
    const list = particles.current;
    const mat = new THREE.Matrix4();
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
    for (const p of list) {
      const s = p.size * Math.min(1, p.life / p.max + 0.3);
      mat.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
      m.setMatrixAt(n, mat);
      m.setColorAt(n, p.color);
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    // Los carteles viven 1,2 s.
    const now = frame.current?.clock ?? 0;
    if (popups.length && popups.some((p) => now - p.born > 1.2)) setPopups((l) => l.filter((p) => now - p.born <= 1.2));
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, material, MAX_PARTICLES]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
      {popups.map((p) => (
        <FloatingText key={p.id} popup={p} frame={frame} />
      ))}
    </>
  );
}

function FloatingText({ popup, frame }: { popup: Popup; frame: React.RefObject<Frame | null> }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const age = (frame.current?.clock ?? 0) - popup.born;
    g.position.y = popup.y + age * 1.4;
    const s = age < 0.15 ? 0.4 + (age / 0.15) * 0.8 : 1.2 - Math.min(0.2, (age - 0.15) * 0.4);
    g.scale.setScalar(s);
  });
  return (
    <group ref={group} position={[popup.x, popup.y, popup.z]}>
      <Billboard>
        <Text font={FONT} fontSize={popup.size} color={popup.color} outlineWidth={popup.size * 0.12} outlineColor={INK}>
          {popup.text}
        </Text>
      </Billboard>
    </group>
  );
}
