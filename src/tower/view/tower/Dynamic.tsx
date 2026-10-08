"use client";

import { Outlines, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { type Block, blinkLeft, blinkOn, centerOf, type Tower } from "../../sim/level";
import { TUNING } from "../../sim/tuning";
import type { Frame } from "../frame";
import { INK, PALETTE, toon } from "../toon";
import { OUTLINE } from "./Blocks";

type Props = { tower: Tower; frame: React.RefObject<Frame | null> };

/** Las que se desinflan: tiemblan cuando las pisás, se aplastan y vuelven a inflarse. */
function Crumbles({ blocks, frame }: { blocks: readonly Block[]; frame: Props["frame"] }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const f = frame.current;
    if (!f) return;
    const w = f.world;
    blocks.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      const c = w.crumbles[b.id];
      const down = c && w.time < c.downUntil;
      const shaking = c && c.touched >= 0;
      if (down) {
        // Desinflada: chatita y transparente; las últimas décimas se vuelve a inflar.
        const back = Math.max(0, 1 - (c.downUntil - w.time) / 0.4);
        g.scale.set(1, 0.12 + back * 0.88, 1);
        g.visible = true;
      } else {
        const k = shaking ? (w.time - c.touched) / TUNING.crumbleDelay : 0;
        g.scale.set(1 + k * 0.08, 1 - k * 0.25, 1 + k * 0.08);
        g.position.x = shaking ? Math.sin(f.clock * 60) * 0.05 : 0;
      }
    });
  });
  return (
    <>
      {blocks.map((b, i) => {
        const c = centerOf(b);
        return (
          <group key={b.id} position={[c.x, b.minY, c.z]}>
            <group ref={(g) => void (refs.current[i] = g)}>
              <RoundedBox args={[b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ]} radius={0.2} position={[0, (b.maxY - b.minY) / 2, 0]} material={toon("#fb923c")} castShadow receiveShadow>
                <Outlines thickness={OUTLINE} color={INK} />
              </RoundedBox>
              {/* El piquito para inflar */}
              <mesh position={[(b.maxX - b.minX) / 2 - 0.25, b.maxY - b.minY + 0.08, 0]} material={toon(PALETTE.white)}>
                <cylinderGeometry args={[0.07, 0.09, 0.18, 8]} />
              </mesh>
            </group>
          </group>
        );
      })}
    </>
  );
}

/**
 * Las parpadeantes: se ven fuerte, titilan antes de irse y quedan como un
 * fantasma (sin contorno: el contorno es opaco y se vería como una mancha).
 */
function Blinks({ blocks, frame }: { blocks: readonly Block[]; frame: Props["frame"] }) {
  const solid = useRef<(THREE.Mesh | null)[]>([]);
  const ghost = useRef<(THREE.Mesh | null)[]>([]);
  const ghostMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#a5f3fc", transparent: true, opacity: 0.18, depthWrite: false }), []);
  useFrame(() => {
    const f = frame.current;
    if (!f) return;
    blocks.forEach((b, i) => {
      const on = blinkOn(b, f.world.time);
      // En el último cuarto titila para avisar.
      const warn = on && blinkLeft(b, f.world.time) < 0.25 && Math.floor(f.clock * 12) % 2 === 0;
      const s = solid.current[i];
      const g = ghost.current[i];
      if (s) s.visible = on && !warn;
      if (g) g.visible = !on || warn;
    });
  });
  return (
    <>
      {blocks.map((b, i) => {
        const c = centerOf(b);
        const size: [number, number, number] = [b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ];
        return (
          <group key={b.id} position={[c.x, (b.minY + b.maxY) / 2, c.z]}>
            <mesh ref={(m) => void (solid.current[i] = m)} material={toon("#22d3ee")} castShadow>
              <boxGeometry args={size} />
              <Outlines thickness={OUTLINE} color={INK} />
            </mesh>
            <mesh ref={(m) => void (ghost.current[i] = m)} material={ghostMaterial} visible={false}>
              <boxGeometry args={size} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/** Calesitas: discos a gajos que giran (y te llevan). */
function spinnerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const colors = [PALETTE.pink, PALETTE.white, PALETTE.yellow, PALETTE.white];
  for (let k = 0; k < 8; k++) {
    ctx.fillStyle = colors[k % colors.length];
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.arc(64, 64, 64, (k / 8) * Math.PI * 2, ((k + 1) / 8) * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Spinners({ blocks, frame }: { blocks: readonly Block[]; frame: Props["frame"] }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const texture = useMemo(() => spinnerTexture(), []);
  const top = useMemo(() => new THREE.MeshToonMaterial({ map: texture }), [texture]);
  useFrame(() => {
    const f = frame.current;
    if (!f) return;
    blocks.forEach((b, i) => {
      const g = refs.current[i];
      if (g) g.rotation.y = (b.spin ?? 0) * f.world.time;
    });
  });
  return (
    <>
      {blocks.map((b, i) => {
        const c = centerOf(b);
        const r = (b.maxX - b.minX) / 2 + 0.3;
        return (
          <group key={b.id} position={[c.x, b.maxY, c.z]}>
            <group ref={(g) => void (refs.current[i] = g)}>
              <mesh position={[0, -0.25, 0]} material={[toon(PALETTE.purple), top, toon(PALETTE.purple)]} castShadow receiveShadow>
                <cylinderGeometry args={[r, r, 0.5, 32]} />
                <Outlines thickness={OUTLINE} color={INK} />
              </mesh>
              <mesh position={[0, 0.25, 0]} material={toon(PALETTE.gold)}>
                <cylinderGeometry args={[0.18, 0.22, 0.5, 12]} />
              </mesh>
            </group>
            {/* El eje de abajo */}
            <mesh position={[0, -1.2, 0]} material={toon(PALETTE.white)}>
              <cylinderGeometry args={[0.12, 0.12, 1.4, 8]} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

export function DynamicBlocks({ tower, frame }: Props) {
  const crumbles = useMemo(() => tower.blocks.filter((b) => b.kind === "crumble"), [tower]);
  const blinks = useMemo(() => tower.blocks.filter((b) => b.kind === "blink"), [tower]);
  const spinners = useMemo(() => tower.blocks.filter((b) => b.kind === "spinner"), [tower]);
  return (
    <>
      <Crumbles blocks={crumbles} frame={frame} />
      <Blinks blocks={blinks} frame={frame} />
      <Spinners blocks={spinners} frame={frame} />
    </>
  );
}
