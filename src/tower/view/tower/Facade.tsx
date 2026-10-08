"use client";

import { Billboard, Outlines, Text } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { Theme, Tower } from "../../sim/level";
import { INK, PALETTE, stripes, toon } from "../toon";

export const FONT = "/game/fonts/LuckiestGuy-Regular.ttf";

/** Color de cada piso en la fachada (y en sus carteles). */
export const THEME_COLOR: Record<Theme, string> = {
  warmup: "#a5b4fc",
  soap: "#7dd3fc",
  bounce: "#f9a8d4",
  balls: "#fca5a5",
  hammers: "#fde68a",
  nets: "#86efac",
  geysers: "#67e8f9",
  sky: "#c4b5fd",
};

/**
 * La cara de la torre: un inflable gigante con franjas de color por piso y
 * costuras de "tubos", en el borde dos columnas a rayas y arriba una corona de
 * torrecitas como un castillo inflable.
 */
function facadeTexture(tower: Tower): THREE.CanvasTexture {
  const wall = tower.wall;
  const height = wall.maxY - wall.minY;
  const width = wall.maxX - wall.minX;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const py = (y: number) => canvas.height - ((y - wall.minY) / height) * canvas.height;
  ctx.fillStyle = "#ddd6fe";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const f of tower.floors) {
    ctx.fillStyle = THEME_COLOR[f.theme];
    ctx.fillRect(0, py(f.top), canvas.width, py(f.bottom) - py(f.top));
    // Borde blanco entre pisos.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, py(f.top) - 3, canvas.width, 6);
  }
  // Costuras de los tubos inflables: sombra a un lado y brillo al otro.
  const tubes = Math.round(width / 2.5);
  for (let i = 0; i < tubes; i++) {
    const x0 = (i / tubes) * canvas.width;
    const w = canvas.width / tubes;
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, "rgba(31,17,71,0.22)");
    g.addColorStop(0.25, "rgba(255,255,255,0.18)");
    g.addColorStop(0.75, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(31,17,71,0.22)");
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, w, canvas.height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Turret({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <group position={[x, y, -0.6]}>
      <mesh position={[0, 1.2, 0]} material={toon(color)} castShadow>
        <cylinderGeometry args={[1.1, 1.25, 2.4, 20]} />
        <Outlines thickness={0.07} color={INK} />
      </mesh>
      <mesh position={[0, 3.3, 0]} material={toon(PALETTE.yellow)} castShadow>
        <coneGeometry args={[1.3, 1.8, 20]} />
        <Outlines thickness={0.07} color={INK} />
      </mesh>
      <mesh position={[0, 4.6, 0]} material={toon(PALETTE.white)}>
        <cylinderGeometry args={[0.05, 0.05, 1.2, 6]} />
      </mesh>
      <mesh position={[0.35, 4.95, 0]} material={toon(PALETTE.red)}>
        <boxGeometry args={[0.7, 0.4, 0.04]} />
      </mesh>
    </group>
  );
}

export function Facade({ tower }: { tower: Tower }) {
  const wall = tower.wall;
  const texture = useMemo(() => facadeTexture(tower), [tower]);
  const material = useMemo(() => new THREE.MeshToonMaterial({ map: texture }), [texture]);
  const tubeTexture = useMemo(() => {
    const t = stripes(PALETTE.pink, PALETTE.white, 2);
    t.repeat.set(1, (wall.maxY - wall.minY) / 3);
    return t;
  }, [wall]);
  const tubeMaterial = useMemo(() => new THREE.MeshToonMaterial({ map: tubeTexture }), [tubeTexture]);
  const height = wall.maxY - wall.minY;
  const turrets = [-wall.maxX, -wall.maxX / 2, 0, wall.maxX / 2, wall.maxX];
  return (
    <group>
      <mesh position={[(wall.minX + wall.maxX) / 2, (wall.minY + wall.maxY) / 2, (wall.minZ + wall.maxZ) / 2]} material={material} receiveShadow>
        <boxGeometry args={[wall.maxX - wall.minX, height, wall.maxZ - wall.minZ]} />
        <Outlines thickness={0.1} color={INK} />
      </mesh>
      {[wall.minX, wall.maxX].map((x) => (
        <mesh key={x} position={[x, (wall.minY + wall.maxY) / 2, -0.3]} material={tubeMaterial} castShadow receiveShadow>
          <cylinderGeometry args={[0.9, 0.9, height, 24]} />
          <Outlines thickness={0.08} color={INK} />
        </mesh>
      ))}
      {turrets.map((x, i) => (
        <Turret key={x} x={x} y={wall.maxY} color={i % 2 ? PALETTE.pink : PALETTE.cyan} />
      ))}
      <FloorSigns tower={tower} />
    </group>
  );
}

/** Carteles pintados en la fachada, uno por piso, y el misterio arriba de todo. */
function FloorSigns({ tower }: { tower: Tower }) {
  return (
    <>
      {tower.floors.map((floor, i) => (
        <group key={floor.index} position={[i % 2 ? 6 : -6, floor.bottom + 1.6, 0.03]}>
          <Text font={FONT} fontSize={0.9} color={PALETTE.white} outlineWidth={0.09} outlineColor={INK} anchorY="bottom">
            {`PISO ${floor.index + 1}`}
          </Text>
          <Text font={FONT} fontSize={0.6} color={PALETTE.yellow} outlineWidth={0.07} outlineColor={INK} anchorY="top">
            {floor.name.toUpperCase()}
          </Text>
        </group>
      ))}
      <Billboard position={[0, tower.wall.maxY + 7, 0]}>
        <Text font={FONT} fontSize={1.6} color={PALETTE.gold} outlineWidth={0.14} outlineColor={INK}>
          ¿?
        </Text>
      </Billboard>
    </>
  );
}
