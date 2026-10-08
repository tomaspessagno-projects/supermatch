"use client";

import { Outlines } from "@react-three/drei";
import type { HatId } from "../../sim/cosmetics";
import { INK, PALETTE, toon } from "../toon";

const OUTLINE = 0.035;

/** Los sombreros (cosméticos), apoyados arriba de la cabeza. */
export function Hat({ id }: { id: HatId }) {
  switch (id) {
    case "cap":
      return (
        <group position={[0, 0.38, 0]}>
          <mesh material={toon(PALETTE.red)} castShadow>
            <sphereGeometry args={[0.28, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Outlines thickness={OUTLINE} color={INK} />
          </mesh>
          <mesh position={[0, 0.01, 0.27]} material={toon(PALETTE.red)}>
            <boxGeometry args={[0.36, 0.03, 0.22]} />
            <Outlines thickness={OUTLINE * 0.7} color={INK} />
          </mesh>
          <mesh position={[0, 0.27, 0]} material={toon(PALETTE.white)}>
            <sphereGeometry args={[0.04, 8, 6]} />
          </mesh>
        </group>
      );
    case "party":
      return (
        <group position={[0.05, 0.62, 0]} rotation-z={-0.2}>
          <mesh material={toon(PALETTE.pink)} castShadow>
            <coneGeometry args={[0.16, 0.42, 16]} />
            <Outlines thickness={OUTLINE} color={INK} />
          </mesh>
          <mesh position={[0, 0.23, 0]} material={toon(PALETTE.yellow)}>
            <sphereGeometry args={[0.06, 10, 8]} />
          </mesh>
        </group>
      );
    case "viking":
      return (
        <group position={[0, 0.36, 0]}>
          <mesh material={toon("#94a3b8")} castShadow>
            <sphereGeometry args={[0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Outlines thickness={OUTLINE} color={INK} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.3, 0.12, 0]} rotation-z={-s * 0.9} material={toon("#fef3c7")}>
              <coneGeometry args={[0.06, 0.3, 10]} />
              <Outlines thickness={OUTLINE * 0.7} color={INK} />
            </mesh>
          ))}
        </group>
      );
    case "tophat":
      return (
        <group position={[0, 0.48, 0]}>
          <mesh material={toon("#1f2937")} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.36, 18]} />
            <Outlines thickness={OUTLINE} color={INK} />
          </mesh>
          <mesh position={[0, -0.16, 0]} material={toon("#1f2937")}>
            <cylinderGeometry args={[0.32, 0.32, 0.03, 20]} />
          </mesh>
          <mesh position={[0, -0.09, 0]} material={toon(PALETTE.red)}>
            <cylinderGeometry args={[0.205, 0.205, 0.07, 18]} />
          </mesh>
        </group>
      );
    case "crown":
      return (
        <group position={[0, 0.48, 0]}>
          <mesh material={toon(PALETTE.gold, { emissive: "#7c5800" })} castShadow>
            <cylinderGeometry args={[0.22, 0.24, 0.12, 18, 1, true]} />
            <Outlines thickness={OUTLINE} color={INK} />
          </mesh>
          {Array.from({ length: 6 }, (_, k) => {
            const a = (k / 6) * Math.PI * 2;
            return (
              <mesh key={k} position={[Math.sin(a) * 0.22, 0.12, Math.cos(a) * 0.22]} material={toon(PALETTE.gold, { emissive: "#7c5800" })}>
                <coneGeometry args={[0.05, 0.14, 6]} />
              </mesh>
            );
          })}
          <mesh position={[0, 0.02, 0.24]} material={toon(PALETTE.red)}>
            <sphereGeometry args={[0.035, 8, 6]} />
          </mesh>
        </group>
      );
    case "halo":
      return (
        <mesh position={[0, 0.72, 0]} rotation-x={Math.PI / 2} material={toon(PALETTE.gold, { emissive: "#b45309" })}>
          <torusGeometry args={[0.22, 0.035, 8, 28]} />
        </mesh>
      );
  }
}
