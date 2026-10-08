"use client";

import { Outlines, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { TUNING } from "../../sim/tuning";
import { useTower } from "../../store";
import { type Frame, playerPosition } from "../frame";
import { INK, PALETTE, toon } from "../toon";
import { Hat } from "./Hat";
import { currentPose } from "./poses";
import { RIG } from "./rig";
import type { CharacterDriver } from "./state";

/**
 * El concursante armado con piezas (cabeza grande con vincha, camiseta del
 * equipo, codos, rodillas y tobillos), animado por código: las poses de
 * poses.ts mezcladas por el driver, más lo que se mueve solo (las cintas de
 * la vincha, el parpadeo, la respiración).
 */

const OUTLINE = 0.035;
type Side = "L" | "R";
const SIDES: readonly Side[] = ["L", "R"];

/** Las articulaciones por nombre ("hips", "legL", "kneeR", "eyeL"…), buscadas una vez. */
type Bones = Record<string, THREE.Object3D | undefined>;
const found = new WeakMap<THREE.Object3D, Bones>();
function bonesOf(root: THREE.Object3D): Bones {
  let bones = found.get(root);
  if (!bones) {
    const named: Bones = {};
    root.traverse((o) => {
      if (o.name) named[o.name] = o;
    });
    found.set(root, named);
    bones = named;
  }
  return bones;
}

export function Procedural({ frame, driver, teamColor }: { frame: React.RefObject<Frame | null>; driver: CharacterDriver; teamColor: string }) {
  const root = useRef<THREE.Group>(null);
  const hat = useTower((s) => s.hat);

  const mats = useMemo(
    () => ({
      shirt: toon(teamColor),
      skin: toon(PALETTE.skin),
      white: toon(PALETTE.white),
      hair: toon(PALETTE.hair),
      shoe: toon(PALETTE.red),
      ink: toon(INK),
      ring: toon(PALETTE.orange),
      band: toon(PALETTE.white),
    }),
    [teamColor],
  );

  useFrame((_, delta) => {
    const f = frame.current;
    if (!f || !root.current) return;
    const B = bonesOf(root.current);
    const g = (key: string) => B[key]!;
    const w = f.world;
    const p = w.player;
    driver.update(w, f.clock, delta);
    const c = driver.ctx;
    const P = currentPose(driver, p.grounded);

    const pos = playerPosition(f);
    root.current.position.set(pos.x, pos.y, pos.z);
    // El chapuzón: se hunde.
    if (w.phase === "splash") root.current.position.y = Math.max(TUNING.waterY - 0.9, pos.y) - Math.min(1.1, c.splashTime * 0.9);
    root.current.rotation.y = driver.facing;

    // Aplastarse (al caer) y estirarse (al saltar), desde los pies.
    const s = driver.squash;
    const sy = s < 1 ? 1 - (1 - s) * 0.35 : s;
    const sxz = 1 / Math.sqrt(sy);
    g("squash").scale.set(sxz, sy, sxz);
    // Vueltas enteras (mortal del doble salto, golpes) alrededor de la cadera.
    const flip = c.flip > 0 ? (1 - (1 - c.flip) ** 2) * Math.PI * 2 : 0;
    g("pivot").rotation.x = flip + driver.tumble;

    g("hips").position.set(0, P.hipY, P.hipZ);
    g("hips").rotation.set(P.lean, P.hipYaw, P.roll);
    g("spine").rotation.set(P.chestPitch, P.chestYaw, P.chestRoll);
    const breath = 1 + P.breath * 0.012;
    g("spine").scale.set(breath, 1 + P.breath * 0.008, breath);
    g("head").rotation.set(P.headPitch, P.headYaw, P.headRoll);

    g("legL").rotation.set(-P.thighL, 0, -P.legOutL);
    g("legR").rotation.set(-P.thighR, 0, P.legOutR);
    g("kneeL").rotation.x = P.kneeL;
    g("kneeR").rotation.x = P.kneeR;
    g("ankleL").rotation.x = P.ankleL;
    g("ankleR").rotation.x = P.ankleR;
    g("armL").rotation.set(-P.armL, 0, -P.armOutL);
    g("armR").rotation.set(-P.armR, 0, P.armOutR);
    g("elbowL").rotation.x = -P.elbowL;
    g("elbowR").rotation.x = -P.elbowR;

    // Cara: ojos (parpadeo, bien abiertos del susto), pupilas que miran, cejas y boca.
    const eyes = Math.max(0.06, P.eyes);
    for (const side of SIDES) {
      g(`eye${side}`).scale.set(1, eyes, 1);
      g(`pupil${side}`).position.set(P.lookX * 0.022, P.lookY * 0.02, 0.05);
    }
    g("browL").position.y = 0.33 + P.brow * 0.01 + Math.max(0, P.eyes - 1) * 0.05;
    g("browR").position.y = g("browL").position.y;
    g("browL").rotation.z = -P.brow * 0.45;
    g("browR").rotation.z = P.brow * 0.45;
    const open = Math.min(1, Math.max(0, (P.mouth - 0.28) / 0.72));
    g("mouth").visible = open > 0.02;
    g("mouth").scale.set(0.8 + open * 0.3, 0.25 + open * 1.0, 1);
    g("smile").visible = open < 0.5;
    g("smile").scale.set(1 - open, Math.max(0.15, P.smile) * (1 - open), 1);

    // Cintas de la vincha: flamean con la velocidad.
    g("tails").rotation.x = 0.25 + driver.tails * 1.0 + Math.sin(c.t * 22) * 0.08 * driver.tails;
    g("ring").visible = p.gliding;
  });

  return (
    <group ref={root}>
      <group name="squash">
        <group name="pivot" position={[0, RIG.hipY, 0]}>
          <group name="hips">
            {/* Piernas: muslo, rodilla, tobillo */}
            {SIDES.map((side) => (
              <group key={side} position={[side === "L" ? -RIG.hipX : RIG.hipX, 0, 0]} name={`leg${side}`}>
                <mesh position={[0, -0.17, 0]} material={mats.skin} castShadow>
                  <capsuleGeometry args={[0.085, 0.24, 4, 10]} />
                  <Outlines thickness={OUTLINE} color={INK} />
                </mesh>
                <group position={[0, -RIG.thigh, 0]} name={`knee${side}`}>
                  <mesh position={[0, -0.14, 0]} material={mats.skin} castShadow>
                    <capsuleGeometry args={[0.075, 0.18, 4, 10]} />
                    <Outlines thickness={OUTLINE} color={INK} />
                  </mesh>
                  <mesh position={[0, -0.24, 0]} material={mats.white}>
                    <cylinderGeometry args={[0.085, 0.085, 0.08, 10]} />
                  </mesh>
                  <group position={[0, -RIG.shin, 0]} name={`ankle${side}`}>
                    <RoundedBox args={[0.18, 0.12, 0.32]} radius={0.05} position={[0, -0.03, 0.06]} material={mats.shoe} castShadow>
                      <Outlines thickness={OUTLINE} color={INK} />
                    </RoundedBox>
                  </group>
                </group>
              </group>
            ))}
            {/* Short */}
            <RoundedBox args={[0.5, 0.2, 0.32]} radius={0.08} position={[0, -0.02, 0]} material={mats.white} castShadow>
              <Outlines thickness={OUTLINE} color={INK} />
            </RoundedBox>
            {/* Flotador (mejora): aparece al planear */}
            <mesh name="ring" position={[0, 0.11, 0]} rotation-x={Math.PI / 2} material={mats.ring} visible={false}>
              <torusGeometry args={[0.38, 0.11, 10, 24]} />
              <Outlines thickness={OUTLINE} color={INK} />
            </mesh>
            <group name="spine" position={[0, RIG.spineY, 0]}>
              {/* Camiseta del equipo */}
              <RoundedBox args={[0.52, 0.46, 0.34]} radius={0.13} position={[0, 0.18, 0]} material={mats.shirt} castShadow>
                <Outlines thickness={OUTLINE} color={INK} />
              </RoundedBox>
              {/* Brazos: hombro, codo y guante */}
              {SIDES.map((side) => (
                <group key={side} position={[side === "L" ? -RIG.shoulderX : RIG.shoulderX, RIG.shoulderY, 0]} name={`arm${side}`}>
                  <mesh position={[0, -0.1, 0]} material={mats.shirt} castShadow>
                    <capsuleGeometry args={[0.075, 0.12, 4, 10]} />
                    <Outlines thickness={OUTLINE} color={INK} />
                  </mesh>
                  <group position={[0, -RIG.upperArm, 0]} name={`elbow${side}`}>
                    <mesh position={[0, -0.1, 0]} material={mats.skin} castShadow>
                      <capsuleGeometry args={[0.06, 0.14, 4, 10]} />
                      <Outlines thickness={OUTLINE} color={INK} />
                    </mesh>
                    <mesh position={[0, -RIG.forearm, 0]} material={mats.white} castShadow>
                      <sphereGeometry args={[0.09, 14, 12]} />
                      <Outlines thickness={OUTLINE} color={INK} />
                    </mesh>
                  </group>
                </group>
              ))}
              {/* Cabeza */}
              <group position={[0, RIG.neckY, 0]} name="head">
                <mesh position={[0, 0.2, 0]} material={mats.skin} castShadow>
                  <sphereGeometry args={[0.27, 22, 18]} />
                  <Outlines thickness={OUTLINE} color={INK} />
                </mesh>
                {/* Orejas */}
                {[-1, 1].map((s) => (
                  <mesh key={s} position={[s * 0.265, 0.19, 0]} scale={[0.5, 1, 0.8]} material={mats.skin}>
                    <sphereGeometry args={[0.07, 10, 8]} />
                    <Outlines thickness={OUTLINE * 0.6} color={INK} />
                  </mesh>
                ))}
                {/* Pelo, vincha y sus cintas */}
                <mesh position={[0, 0.3, -0.03]} scale={[1.04, 0.75, 1.04]} material={mats.hair}>
                  <sphereGeometry args={[0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <Outlines thickness={OUTLINE} color={INK} />
                </mesh>
                <mesh position={[0, 0.37, -0.02]} rotation-x={Math.PI / 2} material={mats.band}>
                  <torusGeometry args={[0.262, 0.036, 8, 28]} />
                  <Outlines thickness={OUTLINE * 0.7} color={INK} />
                </mesh>
                <group name="tails" position={[0, 0.37, -0.29]}>
                  {[-1, 1].map((s) => (
                    <mesh key={s} position={[s * 0.035, -0.1, 0]} rotation-z={s * 0.18} material={mats.band}>
                      <boxGeometry args={[0.06, 0.2, 0.014]} />
                      <Outlines thickness={OUTLINE * 0.5} color={INK} />
                    </mesh>
                  ))}
                </group>
                {/* Ojos (mira para +z), cejas, nariz y boca */}
                {SIDES.map((side) => (
                  <group key={side} position={[side === "L" ? -0.09 : 0.09, 0.24, 0.22]} name={`eye${side}`}>
                    <mesh material={mats.white}>
                      <sphereGeometry args={[0.065, 14, 12]} />
                      <Outlines thickness={0.015} color={INK} />
                    </mesh>
                    <mesh
                      name={`pupil${side}`}
                      position={[0, 0, 0.05]}
                      material={mats.ink}
                    >
                      <sphereGeometry args={[0.028, 8, 8]} />
                    </mesh>
                  </group>
                ))}
                {SIDES.map((side) => (
                  <mesh
                    key={side}
                    name={`brow${side}`}
                    position={[side === "L" ? -0.095 : 0.095, 0.33, 0.258]}
                    rotation-x={-0.35}
                    material={mats.ink}
                  >
                    <boxGeometry args={[0.1, 0.024, 0.02]} />
                  </mesh>
                ))}
                <mesh position={[0, 0.17, 0.27]} material={mats.skin}>
                  <sphereGeometry args={[0.045, 10, 8]} />
                  <Outlines thickness={0.012} color={INK} />
                </mesh>
                <mesh name="mouth" position={[0, 0.08, 0.235]} material={mats.ink}>
                  <sphereGeometry args={[0.055, 12, 10]} />
                </mesh>
                <mesh name="smile" position={[0, 0.115, 0.238]} rotation={[-0.35, 0, Math.PI]} material={mats.ink}>
                  <torusGeometry args={[0.055, 0.013, 6, 14, Math.PI]} />
                </mesh>
                {hat && <Hat id={hat} />}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
