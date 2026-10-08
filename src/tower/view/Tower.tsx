"use client";

import { Billboard, Outlines, RoundedBox, Sparkles, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Rarity } from "../sim/items";
import { itemDef } from "../sim/items";
import type { Tower as TowerData } from "../sim/level";
import type { Frame } from "./frame";
import { INK, PALETTE, toon } from "./toon";
import { OUTLINE, StaticBlocks } from "./tower/Blocks";
import { DynamicBlocks } from "./tower/Dynamic";
import { Facade, FONT } from "./tower/Facade";
import { Hazards } from "./tower/Hazards";

const RARITY_COLOR: Record<Rarity, string> = {
  common: "#93c5fd",
  rare: "#22d3ee",
  epic: "#a855f7",
  legendary: "#fbbf24",
  mythic: "#f472b6",
};

/** Fichas (monedas doradas) y premios de las cornisas: aparecen según el intento. */
function Pickups({ tower, frame }: { tower: TowerData; frame: React.RefObject<Frame | null> }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const boxes = useRef<(THREE.Mesh | null)[]>([]);
  const lastRun = useRef(-1);
  useFrame(() => {
    const f = frame.current;
    if (!f) return;
    const contents = f.world.run.contents;
    const newRun = f.world.run.number !== lastRun.current;
    lastRun.current = f.world.run.number;
    tower.spots.forEach((spot, i) => {
      const g = refs.current[i];
      if (!g) return;
      const content = contents[spot.id];
      g.visible = !!content;
      if (!content) return;
      g.position.y = spot.y + Math.sin(f.clock * 2.5 + i) * 0.1;
      g.rotation.y = f.clock * (spot.ledge ? 1 : 2.5) + i;
      // El color del regalo dice la rareza.
      if (newRun && content.kind === "item") {
        const mat = (boxes.current[i]?.material as THREE.MeshToonMaterial) ?? null;
        if (mat) mat.color.set(RARITY_COLOR[itemDef(content.item.def).rarity]);
      }
    });
  });
  return (
    <>
      {tower.spots.map((spot, i) => (
        <group key={spot.id} position={[spot.x, spot.y, spot.z]} ref={(g) => void (refs.current[i] = g)}>
          {spot.ledge ? (
            <>
              <mesh ref={(m) => void (boxes.current[i] = m)} castShadow>
                <boxGeometry args={[0.55, 0.55, 0.55]} />
                <meshToonMaterial color={RARITY_COLOR.common} />
                <Outlines thickness={0.05} color={INK} />
              </mesh>
              <mesh material={toon(PALETTE.white)}>
                <boxGeometry args={[0.58, 0.12, 0.58]} />
              </mesh>
              <mesh material={toon(PALETTE.white)}>
                <boxGeometry args={[0.12, 0.58, 0.58]} />
              </mesh>
              <Sparkles count={10} scale={1.4} size={4} speed={0.6} color="#fde68a" />
            </>
          ) : (
            <mesh rotation-x={Math.PI / 2} material={toon(PALETTE.gold, { emissive: "#7c5800" })}>
              <cylinderGeometry args={[0.24, 0.24, 0.07, 18]} />
              <Outlines thickness={0.035} color={INK} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

/** El muelle de la orilla: kiosco de mejoras y ascensor. */
function Deck({ tower }: { tower: TowerData }) {
  const deck = tower.blocks.find((b) => b.kind === "deck")!;
  const el = tower.elevator;
  const k = tower.kiosk;
  return (
    <group>
      <mesh position={[(deck.minX + deck.maxX) / 2, (deck.minY + deck.maxY) / 2, (deck.minZ + deck.maxZ) / 2]} material={toon(PALETTE.deck)} receiveShadow>
        <boxGeometry args={[deck.maxX - deck.minX, deck.maxY - deck.minY, deck.maxZ - deck.minZ]} />
        <Outlines thickness={OUTLINE} color={INK} />
      </mesh>
      {/* Tablones */}
      {Array.from({ length: Math.floor((deck.maxX - deck.minX) / 1.1) }, (_, i) => (
        <mesh key={i} position={[deck.minX + 0.55 + i * 1.1, deck.maxY + 0.005, (deck.minZ + deck.maxZ) / 2]} rotation-x={-Math.PI / 2} material={toon("#cbd5e1")}>
          <planeGeometry args={[0.06, deck.maxZ - deck.minZ]} />
        </mesh>
      ))}
      {/* Kiosco */}
      <group position={[k.x, 0, k.z]}>
        <RoundedBox args={[1.8, 1.2, 1.2]} radius={0.1} position={[0, 0.6, 0]} material={toon(PALETTE.cyan)} castShadow>
          <Outlines thickness={OUTLINE} color={INK} />
        </RoundedBox>
        {[-0.75, 0.75].map((x) => (
          <mesh key={x} position={[x, 1.6, 0.45]} material={toon(PALETTE.white)}>
            <cylinderGeometry args={[0.06, 0.06, 0.9, 8]} />
          </mesh>
        ))}
        <mesh position={[0, 2.15, 0.25]} rotation-x={-0.35} material={toon(PALETTE.pink)} castShadow>
          <boxGeometry args={[2.1, 0.12, 1.3]} />
          <Outlines thickness={0.05} color={INK} />
        </mesh>
        <Billboard position={[0, 2.85, 0]}>
          <Text font={FONT} fontSize={0.42} color={PALETTE.yellow} outlineWidth={0.05} outlineColor={INK}>
            KIOSCO
          </Text>
        </Billboard>
      </group>
      {/* Ascensor */}
      <group position={[(el.minX + el.maxX) / 2, 0, (el.minZ + el.maxZ) / 2]}>
        <mesh position={[0, 0.03, 0]} material={toon(PALETTE.purple, { emissive: "#5b21b6" })}>
          <boxGeometry args={[el.maxX - el.minX, 0.06, el.maxZ - el.minZ]} />
          <Outlines thickness={0.04} color={INK} />
        </mesh>
        <Billboard position={[0, 1.2, 0]}>
          <Text font={FONT} fontSize={0.3} color={PALETTE.white} outlineWidth={0.04} outlineColor={INK}>
            ASCENSOR
          </Text>
        </Billboard>
      </group>
    </group>
  );
}

/** Estrellas doradas escondidas: giran y brillan hasta que las encontrás. */
function Stars({ tower, frame }: { tower: TowerData; frame: React.RefObject<Frame | null> }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 0.22 : 0.5;
      const a = (k / 10) * Math.PI * 2 + Math.PI / 2;
      if (k === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
    g.center();
    return g;
  }, []);
  useFrame(() => {
    const f = frame.current;
    if (!f) return;
    const found = f.world.progress.stars ?? [];
    tower.stars.forEach((star, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.visible = !found.includes(star.id);
      g.rotation.y = f.clock * 2 + i;
      g.position.y = star.y + Math.sin(f.clock * 2.2 + i) * 0.12;
    });
  });
  return (
    <>
      {tower.stars.map((star, i) => (
        <group key={star.id} position={[star.x, star.y, star.z]} ref={(g) => void (refs.current[i] = g)}>
          <mesh geometry={geometry} material={toon(PALETTE.gold, { emissive: "#b45309" })}>
            <Outlines thickness={0.04} color={INK} />
          </mesh>
          <Sparkles count={8} scale={1.6} size={5} speed={0.8} color="#fde68a" />
        </group>
      ))}
    </>
  );
}

export function Tower({ tower, frame }: { tower: TowerData; frame: React.RefObject<Frame | null> }) {
  return (
    <group>
      <Facade tower={tower} />
      <StaticBlocks tower={tower} />
      <DynamicBlocks tower={tower} frame={frame} />
      <Hazards tower={tower} frame={frame} />
      <Pickups tower={tower} frame={frame} />
      <Stars tower={tower} frame={frame} />
      <Deck tower={tower} />
    </group>
  );
}
