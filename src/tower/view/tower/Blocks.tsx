"use client";

import { Outlines, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { type Block, type BlockKind, centerOf, type Tower } from "../../sim/level";
import { INK, PALETTE, toon } from "../toon";
import { THEME_COLOR } from "./Facade";

export const OUTLINE = 0.06;
const BLOCK_COLORS = [PALETTE.pink, PALETTE.yellow, PALETTE.cyan, PALETTE.purple, PALETTE.orange] as const;

/** Bloques del mismo tipo en un solo InstancedMesh (una sola llamada de dibujo). */
export function BlockSet({ blocks, color, radius = 0.14 }: { blocks: readonly Block[]; color: (b: Block, i: number) => string; radius?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 3, radius), [radius]);
  const material = useMemo(() => toon("#ffffff"), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    blocks.forEach((b, i) => {
      m.compose(
        new THREE.Vector3((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2),
        new THREE.Quaternion(),
        new THREE.Vector3(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ),
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(color(b, i)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [blocks, color]);
  if (!blocks.length) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, material, blocks.length]} castShadow receiveShadow>
      <Outlines thickness={OUTLINE} color={INK} />
    </instancedMesh>
  );
}

/** Espuma de jabón arriba de los bloques enjabonados. */
function SoapFoam({ blocks }: { blocks: readonly Block[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const per = 5;
  const material = useMemo(() => toon("#ffffff", { transparent: true, opacity: 0.9 }), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    let i = 0;
    for (const b of blocks) {
      for (let k = 0; k < per; k++) {
        const x = b.minX + 0.3 + ((k * 0.37 + b.id * 0.13) % 1) * (b.maxX - b.minX - 0.6);
        const z = b.minZ + 0.3 + ((k * 0.61 + b.id * 0.29) % 1) * (b.maxZ - b.minZ - 0.6);
        const s = 0.12 + ((k * 0.43) % 0.15);
        m.compose(new THREE.Vector3(x, b.maxY + s * 0.4, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
        mesh.setMatrixAt(i++, m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [blocks]);
  if (!blocks.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, material, blocks.length * per]}>
      <sphereGeometry args={[1, 10, 8]} />
    </instancedMesh>
  );
}

/** Flechas que corren sobre la cinta (la textura se desliza). */
function arrowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#334155";
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = "#facc15";
  for (const x0 of [8, 72]) {
    ctx.beginPath();
    ctx.moveTo(x0, 12);
    ctx.lineTo(x0 + 34, 32);
    ctx.lineTo(x0, 52);
    ctx.lineTo(x0 + 12, 32);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Conveyors({ blocks }: { blocks: readonly Block[] }) {
  const tops = useRef<(THREE.Mesh | null)[]>([]);
  const textures = useMemo(
    () =>
      blocks.map((b) => {
        const t = arrowTexture();
        t.repeat.set((b.maxX - b.minX) / 2, 1);
        return t;
      }),
    [blocks],
  );
  useFrame((_, dt) => {
    blocks.forEach((b, i) => {
      const map = (tops.current[i]?.material as THREE.MeshBasicMaterial | undefined)?.map;
      if (map) map.offset.x -= ((b.belt ?? 0) * dt) / ((b.maxX - b.minX) / 2);
    });
  });
  return (
    <>
      <BlockSet blocks={blocks} color={() => "#475569"} radius={0.1} />
      {blocks.map((b, i) => {
        const c = centerOf(b);
        const w = b.maxX - b.minX;
        return (
          <mesh key={b.id} ref={(m) => void (tops.current[i] = m)} position={[c.x, b.maxY + 0.012, c.z]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[w - 0.2, b.maxZ - b.minZ - 0.25]} />
            <meshBasicMaterial map={textures[i]} toneMapped={false} />
          </mesh>
        );
      })}
    </>
  );
}

/** Camas elásticas: marco azul y lona rosa (que se hunde un poco cuando rebotás). */
function Trampolines({ blocks }: { blocks: readonly Block[] }) {
  return (
    <>
      <BlockSet blocks={blocks} color={() => "#2563eb"} radius={0.12} />
      {blocks.map((b) => {
        const c = centerOf(b);
        return (
          <mesh key={b.id} position={[c.x, b.maxY + 0.01, c.z]} material={toon(PALETTE.pink)}>
            <cylinderGeometry args={[(b.maxX - b.minX) / 2 - 0.2, (b.maxX - b.minX) / 2 - 0.2, 0.04, 24]} />
          </mesh>
        );
      })}
    </>
  );
}

/** Bolas rojas gigantes (con su franja blanca). */
function Balls({ blocks }: { blocks: readonly Block[] }) {
  return (
    <>
      {blocks.map((b) => {
        const c = centerOf(b);
        const r = (b.maxX - b.minX) / 2 + 0.35;
        return (
          <group key={b.id} position={[c.x, b.maxY - r + 0.02, c.z]}>
            <mesh material={toon("#ef4444")} castShadow receiveShadow>
              <sphereGeometry args={[r, 28, 20]} />
              <Outlines thickness={OUTLINE} color={INK} />
            </mesh>
            <mesh rotation-x={Math.PI / 2} material={toon(PALETTE.white)}>
              <torusGeometry args={[r * 1.0, 0.07, 8, 32]} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/** Burbujas gigantes: rebotan. Respiran un poquito. */
function Bubbles({ blocks }: { blocks: readonly Block[] }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    group.current?.children.forEach((child, i) => {
      const s = 1 + Math.sin(clock.elapsedTime * 3 + i) * 0.04;
      child.scale.set(s, 0.45 / s, s);
    });
  });
  return (
    <group ref={group}>
      {blocks.map((b) => (
        <mesh key={b.id} position={[(b.minX + b.maxX) / 2, b.maxY - 0.15, (b.minZ + b.maxZ) / 2]} scale-y={0.45} material={toon(PALETTE.pink, { transparent: true, opacity: 0.85 })} castShadow>
          <sphereGeometry args={[(b.maxX - b.minX) / 2 + 0.1, 24, 16]} />
          <Outlines thickness={OUTLINE} color={INK} />
        </mesh>
      ))}
    </group>
  );
}

/** La red: una trama de sogas en la cara de adelante de la columna. */
function netTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.strokeStyle = "#fef3c7";
  ctx.lineWidth = 7;
  ctx.beginPath();
  for (let i = 0; i <= 2; i++) {
    ctx.moveTo(0, i * 64);
    ctx.lineTo(128, i * 64);
    ctx.moveTo(i * 64, 0);
    ctx.lineTo(i * 64, 128);
  }
  ctx.stroke();
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 2;
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Nets({ tower }: { tower: Tower }) {
  const textures = useMemo(
    () =>
      tower.nets.map((n) => {
        const t = netTexture();
        t.repeat.set((n.maxX - n.minX - 0.2) / 0.5, (n.maxY - n.minY - 0.1) / 0.5);
        return t;
      }),
    [tower],
  );
  return (
    <>
      {tower.nets.map((n, i) => (
        <mesh key={n.id} position={[(n.minX + n.maxX) / 2, (n.minY + n.maxY) / 2, n.minZ + 0.07]}>
          <planeGeometry args={[n.maxX - n.minX - 0.2, n.maxY - n.minY - 0.1]} />
          <meshToonMaterial map={textures[i]} transparent alphaTest={0.3} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

/** La Copa Supermatch, arriba de todo. */
function Cup({ block }: { block: Block }) {
  const ref = useRef<THREE.Group>(null);
  const profile = useMemo(
    () => [
      [0.0, 0], [0.55, 0], [0.55, 0.12], [0.2, 0.2], [0.14, 0.55], [0.22, 0.7], [0.6, 0.95], [0.75, 1.55], [0.7, 1.6], [0.0, 1.6],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    [],
  );
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.6;
  });
  const c = centerOf(block);
  // Atrás, contra la pared: así el que llega se para adelante y se lo ve festejar.
  return (
    <group ref={ref} position={[c.x, block.maxY, block.minZ + 0.8]} scale={1.1}>
      <mesh material={toon(PALETTE.gold, { emissive: "#7c5800" })} castShadow>
        <latheGeometry args={[profile, 28]} />
        <Outlines thickness={0.04} color={INK} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.72, 1.15, 0]} rotation-z={s * 0.3} material={toon(PALETTE.gold, { emissive: "#7c5800" })}>
          <torusGeometry args={[0.25, 0.06, 8, 16, Math.PI * 1.3]} />
        </mesh>
      ))}
      <Sparkles count={30} scale={[3, 3, 3]} position={[0, 1, 0]} size={6} speed={0.5} color="#fde68a" />
    </group>
  );
}

export function StaticBlocks({ tower }: { tower: Tower }) {
  const byKind = useMemo(() => {
    const groups: Partial<Record<BlockKind, Block[]>> = {};
    for (const b of tower.blocks) (groups[b.kind] ??= []).push(b);
    return groups;
  }, [tower]);
  const solid = useMemo(() => [...(byKind.normal ?? []), ...(byKind.ledge ?? [])], [byKind]);
  const floorTheme = useMemo(() => new Map(tower.floors.map((f) => [f.index, f.theme])), [tower]);
  const colorNormal = useMemo(() => (b: Block, i: number) => (b.kind === "ledge" ? PALETTE.purple : BLOCK_COLORS[i % BLOCK_COLORS.length]), []);
  const colorSoap = useMemo(() => () => PALETTE.soap, []);
  // Descansos: colchonetas a rayas rojas y blancas (cada una con el color de su piso en el borde).
  const colorRest = useMemo(() => (b: Block) => THEME_COLOR[floorTheme.get(b.floor) ?? "warmup"], [floorTheme]);
  const colorGoal = useMemo(() => () => PALETTE.gold, []);
  const colorPillar = useMemo(() => (_: Block, i: number) => (i % 2 ? PALETTE.orange : PALETTE.pink), []);
  const colorRail = useMemo(() => () => PALETTE.white, []);
  const goal = byKind.goal?.[0];
  return (
    <group>
      <BlockSet blocks={solid} color={colorNormal} />
      <BlockSet blocks={byKind.soap ?? []} color={colorSoap} />
      <SoapFoam blocks={byKind.soap ?? []} />
      <BlockSet blocks={byKind.rest ?? []} color={colorRest} radius={0.2} />
      <RestStripes blocks={byKind.rest ?? []} />
      <BlockSet blocks={byKind.goal ?? []} color={colorGoal} radius={0.2} />
      <BlockSet blocks={byKind.pillar ?? []} color={colorPillar} />
      <BlockSet blocks={byKind.rail ?? []} color={colorRail} radius={0.08} />
      <Nets tower={tower} />
      <Conveyors blocks={byKind.conveyor ?? []} />
      <Trampolines blocks={byKind.trampoline ?? []} />
      <Balls blocks={byKind.ball ?? []} />
      <Bubbles blocks={byKind.bubble ?? []} />
      {goal && <Cup block={goal} />}
    </group>
  );
}

/** Franjas rojas sobre los descansos (como un salvavidas). */
function RestStripes({ blocks }: { blocks: readonly Block[] }) {
  return (
    <>
      {blocks.map((b) => {
        const c = centerOf(b);
        const w = b.maxX - b.minX;
        return [-0.3, 0, 0.3].map((k) => (
          <mesh key={`${b.id}${k}`} position={[c.x + k * w, b.maxY + 0.012, c.z]} rotation-x={-Math.PI / 2} material={toon(PALETTE.red)}>
            <planeGeometry args={[w * 0.12, b.maxZ - b.minZ - 0.3]} />
          </mesh>
        ));
      })}
    </>
  );
}
