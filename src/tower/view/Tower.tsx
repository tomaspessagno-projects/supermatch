"use client";

import { Billboard, Outlines, RoundedBox, Sparkles, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Rarity } from "../sim/items";
import { itemDef } from "../sim/items";
import { type Block, type BlockKind, moverBox, type Tower as TowerData, windBlowing } from "../sim/level";
import type { Frame } from "./frame";
import { INK, PALETTE, stripes, toon } from "./toon";

const FONT = "/game/fonts/LuckiestGuy-Regular.ttf";
const OUTLINE = 0.06;
const BLOCK_COLORS = [PALETTE.pink, PALETTE.yellow, PALETTE.cyan, PALETTE.purple] as const;

const RARITY_COLOR: Record<Rarity, string> = {
  common: "#93c5fd",
  rare: "#22d3ee",
  epic: "#a855f7",
  legendary: "#fbbf24",
  mythic: "#f472b6",
};

/** Bloques del mismo tipo en un solo InstancedMesh (una sola llamada de dibujo). */
function BlockSet({ blocks, color }: { blocks: readonly Block[]; color: (b: Block, i: number) => string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 3, 0.14), []);
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
    <instancedMesh ref={ref} args={[undefined, toon("#ffffff", { transparent: true, opacity: 0.9 }), blocks.length * per]}>
      <sphereGeometry args={[1, 10, 8]} />
    </instancedMesh>
  );
}

/** Burbujas gigantes: rebotan. Se aplastan y vuelven cuando alguien cae encima. */
function Bubbles({ blocks }: { blocks: readonly Block[]; frame: React.RefObject<Frame | null> }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    group.current?.children.forEach((child, i) => {
      const s = 1 + Math.sin(clock.elapsedTime * 3 + i) * 0.04;
      child.scale.set(s, 1 / s, s);
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

/** La columna inflable a rayas, con la cúpula arriba. */
function Column({ tower }: { tower: TowerData }) {
  const texture = useMemo(() => {
    const t = stripes(PALETTE.pink, PALETTE.white, 2);
    t.repeat.set(1, tower.top / 3);
    return t;
  }, [tower.top]);
  const material = useMemo(() => new THREE.MeshToonMaterial({ map: texture }), [texture]);
  return (
    <group>
      <mesh position={[0, tower.top / 2 - 0.5, 0]} material={material} receiveShadow castShadow>
        <cylinderGeometry args={[tower.columnRadius, tower.columnRadius * 1.08, tower.top + 1, 32, 1]} />
        <Outlines thickness={0.08} color={INK} />
      </mesh>
      <mesh position={[0, tower.top + 0.5, 0]} material={toon(PALETTE.gold)}>
        <sphereGeometry args={[tower.columnRadius * 0.9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Outlines thickness={0.08} color={INK} />
      </mesh>
    </group>
  );
}

/** Barredoras (te tiran) y nubes (te llevan), donde están ahora. */
function Movers({ tower, frame }: { tower: TowerData; frame: React.RefObject<Frame | null> }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const f = frame.current;
    if (!f) return;
    tower.movers.forEach((m, i) => {
      const g = refs.current[i];
      if (!g) return;
      const b = moverBox(m, f.world.time);
      g.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
    });
  });
  return (
    <>
      {tower.movers.map((m, i) => {
        const sx = m.box.maxX - m.box.minX;
        const sy = m.box.maxY - m.box.minY;
        const sz = m.box.maxZ - m.box.minZ;
        return (
          <group key={m.id} ref={(g) => void (refs.current[i] = g)}>
            {m.kind === "sweeper" ? (
              <>
                <RoundedBox args={[sx, sy, sz]} radius={0.22} material={toon(PALETTE.yellow)} castShadow>
                  <Outlines thickness={OUTLINE} color={INK} />
                </RoundedBox>
                {[-0.3, 0, 0.3].map((t) => (
                  <mesh key={t} position={m.axis === "x" ? [0, 0, t * sz] : [t * sx, 0, 0]} material={toon(PALETTE.pink)}>
                    <boxGeometry args={m.axis === "x" ? [sx + 0.02, sy + 0.02, 0.18] : [0.18, sy + 0.02, sz + 0.02]} />
                  </mesh>
                ))}
              </>
            ) : (
              // Nube: varias pelotas blancas.
              <group>
                {[
                  [0, 0, 0, 0.75],
                  [sx * 0.3, 0.15, 0, 0.6],
                  [-sx * 0.3, 0.1, sz * 0.15, 0.62],
                  [0, 0.2, sz * 0.3, 0.55],
                  [0, 0.12, -sz * 0.3, 0.55],
                ].map(([x, y, z, r], k) => (
                  <mesh key={k} position={[x, y, z]} scale={[sx / 1.6, sy / 1.0, sz / 1.6]} material={toon("#ffffff")} castShadow>
                    <sphereGeometry args={[r, 16, 12]} />
                    <Outlines thickness={0.05} color={INK} />
                  </mesh>
                ))}
              </group>
            )}
          </group>
        );
      })}
    </>
  );
}

/** Viento: cintas blancas que vuelan para afuera cuando sopla. */
function Winds({ tower, frame }: { tower: TowerData; frame: React.RefObject<Frame | null> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const per = 6;
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7 }), []);
  useFrame(() => {
    const f = frame.current;
    const mesh = ref.current;
    if (!f || !mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    tower.winds.forEach((w, wi) => {
      const blowing = windBlowing(w, f.world.time);
      const angle = Math.atan2(w.dirX, w.dirZ);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      for (let k = 0; k < per; k++) {
        const travel = ((f.clock * 1.6 + k / per) % 1) * 3.2;
        const cx = (w.minX + w.maxX) / 2 + w.dirX * (travel - 1) + Math.cos(angle) * ((k % 3) - 1) * 0.6;
        const cz = (w.minZ + w.maxZ) / 2 + w.dirZ * (travel - 1) - Math.sin(angle) * ((k % 3) - 1) * 0.6;
        const y = w.minY + 0.6 + (k % 3) * 0.7;
        const s = blowing ? 1 : 0.0001;
        m.compose(new THREE.Vector3(cx, y, cz), q, new THREE.Vector3(0.05 * s, 0.05 * s, 0.9 * s));
        mesh.setMatrixAt(wi * per + k, m);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  if (!tower.winds.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, material, tower.winds.length * per]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

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
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[deck.minX + 0.55 + i * 1.1, deck.maxY + 0.005, 0]} rotation-x={-Math.PI / 2} material={toon("#cbd5e1")}>
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

/** Carteles de cada piso, flotando donde empieza. */
function FloorSigns({ tower }: { tower: TowerData }) {
  return (
    <>
      {tower.floors.map((floor) => {
        const first = tower.path.find((s) => s.floor === floor.index);
        const b = first?.kind === "block" ? tower.blocks.find((x) => x.id === first.id) : undefined;
        if (!b) return null;
        return (
          <Billboard key={floor.index} position={[(b.minX + b.maxX) / 2, b.maxY + 2.6, (b.minZ + b.maxZ) / 2]}>
            <Text font={FONT} fontSize={0.55} color={PALETTE.yellow} outlineWidth={0.06} outlineColor={INK} anchorY="bottom">
              {`PISO ${floor.index + 1}`}
            </Text>
            <Text font={FONT} fontSize={0.42} color={PALETTE.white} outlineWidth={0.05} outlineColor={INK} anchorY="top">
              {floor.name.toUpperCase()}
            </Text>
          </Billboard>
        );
      })}
      <Billboard position={[0, tower.top + 4, 0]}>
        <Text font={FONT} fontSize={0.9} color={PALETTE.gold} outlineWidth={0.08} outlineColor={INK}>
          ¿?
        </Text>
      </Billboard>
    </>
  );
}

export function Tower({ tower, frame }: { tower: TowerData; frame: React.RefObject<Frame | null> }) {
  const byKind = useMemo(() => {
    const groups: Partial<Record<BlockKind, Block[]>> = {};
    for (const b of tower.blocks) (groups[b.kind] ??= []).push(b);
    return groups;
  }, [tower]);
  const solid = useMemo(() => [...(byKind.normal ?? []), ...(byKind.ledge ?? [])], [byKind]);
  const colorNormal = useMemo(() => (b: Block, i: number) => (b.kind === "ledge" ? PALETTE.purple : BLOCK_COLORS[i % BLOCK_COLORS.length]), []);
  const colorSoap = useMemo(() => () => PALETTE.soap, []);
  // Anillos de descanso como salvavidas: rojo y blanco.
  const colorRest = useMemo(() => (_: Block, i: number) => (i % 2 ? PALETTE.red : PALETTE.white), []);
  const colorGoal = useMemo(() => () => PALETTE.gold, []);
  return (
    <group>
      <Column tower={tower} />
      <BlockSet blocks={solid} color={colorNormal} />
      <BlockSet blocks={byKind.soap ?? []} color={colorSoap} />
      <SoapFoam blocks={byKind.soap ?? []} />
      <BlockSet blocks={byKind.rest ?? []} color={colorRest} />
      <BlockSet blocks={byKind.goal ?? []} color={colorGoal} />
      <Bubbles blocks={byKind.bubble ?? []} frame={frame} />
      <Movers tower={tower} frame={frame} />
      <Winds tower={tower} frame={frame} />
      <Pickups tower={tower} frame={frame} />
      <Deck tower={tower} />
      <FloorSigns tower={tower} />
    </group>
  );
}
