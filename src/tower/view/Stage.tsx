"use client";

import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { TUNING } from "../sim/tuning";
import type { Frame } from "./frame";
import { PALETTE, toon } from "./toon";

/** Agua con olitas: una textura de espuma que se desliza. */
function waterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    const x = (i * 73) % 256;
    const y = (i * 151) % 256;
    ctx.beginPath();
    ctx.arc(x, y, 18 + (i % 4) * 6, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(30, 30);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Pool() {
  const water = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.MeshToonMaterial({ map: waterTexture(), transparent: true, opacity: 0.92 }), []);
  useFrame((_, dt) => {
    const map = (water.current?.material as THREE.MeshToonMaterial | undefined)?.map;
    if (!map) return;
    map.offset.x += dt * 0.02;
    map.offset.y += dt * 0.012;
  });
  return (
    <group>
      <mesh ref={water} rotation-x={-Math.PI / 2} position={[0, TUNING.waterY, 0]} material={material} receiveShadow>
        <circleGeometry args={[60, 64]} />
      </mesh>
      {/* Fondo de la pileta, más oscuro */}
      <mesh rotation-x={-Math.PI / 2} position={[0, TUNING.waterY - 3, 0]} material={toon("#0e4a6e")}>
        <circleGeometry args={[60, 32]} />
      </mesh>
      {/* Borde de la pileta */}
      <mesh rotation-x={-Math.PI / 2} position={[0, TUNING.waterY + 0.05, 0]} material={toon(PALETTE.white)}>
        <ringGeometry args={[60, 64, 64]} />
      </mesh>
    </group>
  );
}

/** El estudio y los reflectores suben con la cámara (la torre es muy alta). */
function FollowCamera({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (group.current) group.current.position.y = Math.max(0, camera.position.y - 20);
  });
  return <group ref={group}>{children}</group>;
}

/** El estudio: la foto del programa envolviendo todo, con niebla. */
function Backdrop() {
  const texture = useTexture("/game/sprites/bg-studio.jpg", (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.MirroredRepeatWrapping;
    t.repeat.set(4, 1);
  });
  return (
    <mesh position={[0, 26, 0]}>
      <cylinderGeometry args={[95, 95, 80, 48, 1, true]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} fog={false} color="#c4b5fd" />
    </mesh>
  );
}

/** Reflectores que barren el estudio (conos de luz transparentes). */
function Spotlights() {
  const group = useRef<THREE.Group>(null);
  const colors = [PALETTE.pink, PALETTE.cyan, PALETTE.yellow, "#ffffff", PALETTE.purple];
  useFrame(({ clock }) => {
    group.current?.children.forEach((child, i) => {
      child.rotation.z = Math.sin(clock.elapsedTime * (0.3 + i * 0.07) + i) * 0.35;
      child.rotation.x = Math.cos(clock.elapsedTime * (0.25 + i * 0.05) + i * 2) * 0.25;
    });
  });
  return (
    <group ref={group}>
      {colors.map((color, i) => {
        const a = (i / colors.length) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 32, 60, Math.sin(a) * 32]}>
            <mesh position={[0, -30, 0]}>
              <coneGeometry args={[9, 60, 24, 1, true]} />
              <meshBasicMaterial color={color} transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} fog={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Luz principal: sigue al jugador para que la sombra se vea nítida donde está. */
function Lights({ frame }: { frame: React.RefObject<Frame | null> }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const f = frame.current;
    const light = sun.current;
    if (!f || !light) return;
    const p = f.world.player;
    // De adelante y arriba: la sombra cae sobre la fachada y se entiende la profundidad.
    light.position.set(p.x + 5, p.y + 16, p.z + 14);
    light.target.position.set(p.x, p.y, p.z);
    light.target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight args={["#e9d5ff", "#1e1b4b", 1.4]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        ref={sun}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-bias={-0.0008}
      />
      <pointLight position={[0, 40, 0]} intensity={60} distance={90} color="#f9a8d4" />
    </>
  );
}

export function Stage({ frame }: { frame: React.RefObject<Frame | null> }) {
  return (
    <>
      <color attach="background" args={["#1a1033"]} />
      <fog attach="fog" args={["#2a1650", 45, 120]} />
      <Lights frame={frame} />
      <FollowCamera>
        <Backdrop />
        <Spotlights />
      </FollowCamera>
      <Pool />
    </>
  );
}
