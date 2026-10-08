"use client";

import { Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { PetId } from "../sim/progression";
import { useTower } from "../store";
import { type Frame, playerPosition } from "./frame";
import { INK, PALETTE, toon } from "./toon";

const O = 0.03;

function Eyes({ y, z, gap = 0.08, size = 0.05 }: { y: number; z: number; gap?: number; size?: number }) {
  return (
    <>
      {[-gap, gap].map((x) => (
        <group key={x} position={[x, y, z]}>
          <mesh material={toon(PALETTE.white)}>
            <sphereGeometry args={[size, 10, 8]} />
          </mesh>
          <mesh position={[0, 0, size * 0.7]} material={toon(INK)}>
            <sphereGeometry args={[size * 0.45, 8, 6]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Cada mascota armada con formas simples (mira para +z). */
function PetModel({ id }: { id: PetId }) {
  switch (id) {
    case "duck":
      return (
        <group>
          <mesh position={[0, 0.2, 0]} material={toon(PALETTE.yellow)} castShadow>
            <sphereGeometry args={[0.22, 16, 12]} />
            <Outlines thickness={O} color={INK} />
          </mesh>
          <mesh position={[0, 0.45, 0.08]} material={toon(PALETTE.yellow)} castShadow>
            <sphereGeometry args={[0.15, 14, 10]} />
            <Outlines thickness={O} color={INK} />
          </mesh>
          <mesh position={[0, 0.43, 0.24]} rotation-x={Math.PI / 2} material={toon(PALETTE.orange)}>
            <coneGeometry args={[0.06, 0.14, 8]} />
          </mesh>
          <Eyes y={0.5} z={0.18} gap={0.06} size={0.035} />
        </group>
      );
    case "dog":
      return (
        <group>
          <mesh position={[0, 0.22, 0]} scale={[1, 0.8, 1.3]} material={toon("#b45309")} castShadow>
            <sphereGeometry args={[0.2, 14, 10]} />
            <Outlines thickness={O} color={INK} />
          </mesh>
          <mesh position={[0, 0.42, 0.22]} material={toon("#d97706")} castShadow>
            <sphereGeometry args={[0.16, 14, 10]} />
            <Outlines thickness={O} color={INK} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.13, 0.5, 0.18]} rotation-z={s * 0.5} scale={[0.5, 1, 0.3]} material={toon("#78350f")}>
              <sphereGeometry args={[0.1, 8, 6]} />
            </mesh>
          ))}
          <mesh position={[0, 0.4, 0.37]} material={toon(INK)}>
            <sphereGeometry args={[0.035, 8, 6]} />
          </mesh>
          <Eyes y={0.48} z={0.33} gap={0.06} size={0.03} />
          <mesh position={[0, 0.3, -0.27]} rotation-x={-0.8} material={toon("#b45309")}>
            <cylinderGeometry args={[0.03, 0.02, 0.2, 6]} />
          </mesh>
        </group>
      );
    case "cloud":
      return (
        <group position={[0, 0.3, 0]}>
          {[
            [0, 0, 0, 0.2],
            [0.17, -0.02, 0, 0.15],
            [-0.17, -0.02, 0, 0.15],
            [0, 0.1, -0.05, 0.15],
          ].map(([x, y, z, r], k) => (
            <mesh key={k} position={[x, y, z]} material={toon("#ffffff")} castShadow>
              <sphereGeometry args={[r, 12, 10]} />
              <Outlines thickness={O} color={INK} />
            </mesh>
          ))}
          <Eyes y={0.02} z={0.18} gap={0.07} size={0.035} />
        </group>
      );
    case "octopus":
      return (
        <group>
          <mesh position={[0, 0.35, 0]} material={toon("#a855f7")} castShadow>
            <sphereGeometry args={[0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
            <Outlines thickness={O} color={INK} />
          </mesh>
          {Array.from({ length: 6 }, (_, k) => {
            const a = (k / 6) * Math.PI * 2;
            return (
              <mesh key={k} position={[Math.sin(a) * 0.14, 0.18, Math.cos(a) * 0.14]} rotation={[Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4]} material={toon("#c084fc")}>
                <capsuleGeometry args={[0.035, 0.16, 4, 6]} />
              </mesh>
            );
          })}
          <Eyes y={0.38} z={0.16} gap={0.07} size={0.045} />
        </group>
      );
    case "dragon":
      return (
        <group>
          <mesh position={[0, 0.25, 0]} scale={[1, 0.9, 1.2]} material={toon("#22c55e")} castShadow>
            <sphereGeometry args={[0.2, 14, 10]} />
            <Outlines thickness={O} color={INK} />
          </mesh>
          <mesh position={[0, 0.48, 0.18]} material={toon("#4ade80")} castShadow>
            <sphereGeometry args={[0.16, 14, 10]} />
            <Outlines thickness={O} color={INK} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.24, 0.35, -0.02]} rotation={[0, 0, s * 0.7]} material={toon(PALETTE.yellow)}>
              <boxGeometry args={[0.3, 0.02, 0.2]} />
              <Outlines thickness={0.02} color={INK} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.07, 0.64, 0.14]} material={toon(PALETTE.yellow)}>
              <coneGeometry args={[0.03, 0.1, 6]} />
            </mesh>
          ))}
          <mesh position={[0, 0.2, -0.3]} rotation-x={-1.2} material={toon("#22c55e")}>
            <coneGeometry args={[0.06, 0.3, 8]} />
          </mesh>
          <Eyes y={0.52} z={0.3} gap={0.06} size={0.035} />
        </group>
      );
  }
}

/** La mascota: te sigue de cerca, flotando y saltando detrás tuyo. */
export function Pet({ frame }: { frame: React.RefObject<Frame | null> }) {
  const pet = useTower((s) => s.pet);
  const group = useRef<THREE.Group>(null);
  const state = useRef({ x: 0, y: 0, z: 0, ready: false, facing: 0 });
  useFrame((_, delta) => {
    const f = frame.current;
    const g = group.current;
    if (!f || !g) return;
    const s = state.current;
    const p = playerPosition(f);
    const facing = f.world.player.facing;
    // Atrás y a un costado del jugador.
    const tx = p.x - Math.sin(facing) * 0.9 + Math.cos(facing) * 0.5;
    const tz = p.z - Math.cos(facing) * 0.9 - Math.sin(facing) * 0.5;
    const ty = p.y + 0.9 + Math.sin(f.clock * 3) * 0.12;
    if (!s.ready || Math.hypot(tx - s.x, ty - s.y, tz - s.z) > 8) Object.assign(s, { x: tx, y: ty, z: tz, ready: true });
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 6);
    s.x += (tx - s.x) * k;
    s.y += (ty - s.y) * k;
    s.z += (tz - s.z) * k;
    s.facing += Math.atan2(Math.sin(facing - s.facing), Math.cos(facing - s.facing)) * k;
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = s.facing;
    g.visible = f.world.phase !== "splash";
  });
  if (!pet) return null;
  return (
    <group ref={group}>
      <PetModel id={pet} />
    </group>
  );
}
