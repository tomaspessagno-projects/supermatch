"use client";

import { useFrame } from "@react-three/fiber";
import { Component, type ReactNode, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { groundBelow } from "../sim/sim";
import { bus } from "./bus";
import { CharacterModel } from "./character/Model";
import { Procedural } from "./character/Procedural";
import { CharacterDriver } from "./character/state";
import { type Frame, playerPosition } from "./frame";

/**
 * El concursante. Hay dos formas de dibujarlo, con la misma lógica de
 * animación (character/state.ts elige qué hace y mezcla):
 * - el muñeco armado con piezas y animado por código (lo de siempre);
 * - un modelo 3D con esqueleto y animaciones (GLB), si está CHARACTER_MODEL.
 *   Si el archivo falla, vuelve solo al muñeco.
 */

/** El GLB del personaje (en public/). null: el muñeco por código. */
export const CHARACTER_MODEL: string | null = null;
/** Para probar otro modelo sin tocar el código: ?modelo=/game/models/nombre.glb (solo de esta carpeta). */
const MODEL_PARAM = /^\/game\/models\/[\w-]+\.glb$/;

function modelUrl(): string | null {
  const q = new URLSearchParams(window.location.search);
  if (q.has("sinmodelo")) return null;
  const asked = q.get("modelo");
  return asked && MODEL_PARAM.test(asked) ? asked : CHARACTER_MODEL;
}
const noSubscribe = () => () => {};

/** Si el modelo no carga (archivo roto, formato raro), sigue con el muñeco. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("No se pudo cargar el modelo del personaje; sigue el muñeco.", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Player({ frame, teamColor }: { frame: React.RefObject<Frame | null>; teamColor: string }) {
  const [driver] = useState(() => new CharacterDriver());
  useEffect(() => bus.on((events) => driver.onEvents(events)), [driver]);
  const url = useSyncExternalStore(noSubscribe, modelUrl, () => CHARACTER_MODEL);

  const procedural = <Procedural frame={frame} driver={driver} teamColor={teamColor} />;
  return (
    <>
      <Shadow frame={frame} />
      {url ? (
        <ModelBoundary key={url} fallback={procedural}>
          <Suspense fallback={procedural}>
            <CharacterModel url={url} frame={frame} driver={driver} teamColor={teamColor} />
          </Suspense>
        </ModelBoundary>
      ) : (
        procedural
      )}
    </>
  );
}

/** Sombra en lo que tenga abajo: clave para calcular los saltos en 3D. */
function Shadow({ frame }: { frame: React.RefObject<Frame | null> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: "#0b0620", transparent: true, opacity: 0.35, depthWrite: false }), []);
  useFrame(() => {
    const f = frame.current;
    const m = mesh.current;
    if (!f || !m) return;
    const w = f.world;
    const pos = playerPosition(f);
    const ground = groundBelow(w, pos.x, pos.z, pos.y + 0.05);
    const height = Math.max(0, pos.y - ground);
    m.position.set(pos.x, ground + 0.03, pos.z);
    const size = Math.max(0.25, 0.75 - height * 0.05);
    m.scale.set(size, size, size);
    (m.material as THREE.MeshBasicMaterial).opacity = w.phase === "splash" ? 0 : Math.max(0.12, 0.45 - height * 0.025);
  });
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} material={material} renderOrder={1}>
      <circleGeometry args={[0.6, 24]} />
    </mesh>
  );
}
