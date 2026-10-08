"use client";

import { Outlines, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { groundBelow } from "../sim/sim";
import { TUNING } from "../sim/tuning";
import { type Frame, playerPosition } from "./frame";
import { INK, PALETTE, toon } from "./toon";

/**
 * El concursante en 3D, armado con piezas (como el títere 2D, pero con
 * volumen): cabeza grande con vincha, camiseta del equipo, codos y rodillas.
 * La animación es por código y sigue a la simulación: correr, saltar
 * (rodillas recogidas al subir), caer, planear con el flotador, trepar la
 * red, volar en el géiser, los golpes, el resbalón sin energía y el chapuzón.
 *
 * Cuando llegue el modelo 3D con esqueleto (Tripo/Meshy + Mixamo), este
 * componente se reemplaza y el resto del juego no cambia.
 */

type Joints = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  mouth: THREE.Mesh;
  ring: THREE.Mesh;
  shadow: THREE.Mesh;
};

const OUTLINE = 0.035;
const SPRING_STEP = 1 / 120;

export function Player({ frame, teamColor }: { frame: React.RefObject<Frame | null>; teamColor: string }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const anim = useRef({ phase: 0, stride: 0, squash: 1, squashVel: 0, wasGrounded: true, spin: 0, facing: Math.PI / 2 });

  const mats = useMemo(
    () => ({
      shirt: toon(teamColor),
      skin: toon(PALETTE.skin),
      white: toon(PALETTE.white),
      hair: toon(PALETTE.hair),
      shoe: toon(PALETTE.red),
      sole: toon(PALETTE.yellow),
      ink: toon(INK),
      ring: toon(PALETTE.orange),
      shadow: new THREE.MeshBasicMaterial({ color: "#0b0620", transparent: true, opacity: 0.35, depthWrite: false }),
    }),
    [teamColor],
  );

  useFrame((_, delta) => {
    const f = frame.current;
    if (!f || !root.current) return;
    const J = {
      root: root.current, body: body.current!, head: head.current!, armL: armL.current!, armR: armR.current!,
      elbowL: elbowL.current!, elbowR: elbowR.current!, legL: legL.current!, legR: legR.current!,
      kneeL: kneeL.current!, kneeR: kneeR.current!, mouth: mouth.current!, ring: ring.current!, shadow: shadow.current!,
    } satisfies Joints;
    const w = f.world;
    const p = w.player;
    const pos = playerPosition(f);
    const a = anim.current;
    const dt = Math.min(delta, 0.1);
    const t = f.clock;

    J.root.position.set(pos.x, pos.y, pos.z);
    // Gira suave hacia donde va.
    let diff = p.facing - a.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    a.facing += diff * (1 - Math.exp(-dt * 14));
    J.root.rotation.y = a.facing;

    const speed = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
    const targetStride = p.grounded ? Math.min(1, speed / TUNING.moveSpeed) : 0;
    a.stride += (targetStride - a.stride) * (1 - Math.exp(-dt * 10));
    a.phase += dt * (4 + speed * 1.6);

    // Aterrizaje: se aplasta y rebota.
    if (p.grounded && !a.wasGrounded) a.squash = 0.78;
    a.wasGrounded = p.grounded;
    // Resorte en pasos chicos: con un paso de 0,1 s (pocos fps) explotaría.
    for (let left = dt; left > 1e-6; left -= SPRING_STEP) {
      const h = Math.min(left, SPRING_STEP);
      a.squashVel += (-(a.squash - 1) * 300 - a.squashVel * 14) * h;
      a.squash += a.squashVel * h;
    }
    if (!Number.isFinite(a.squash)) a.squash = 1;
    a.squash = Math.min(1.25, Math.max(0.7, a.squash));

    let thighL = 0, thighR = 0, kL = 0.1, kR = 0.1;
    let aL = 0.1, aR = 0.1, eL = 0.4, eR = 0.4, spreadL = 0.15, spreadR = 0.15;
    let lean = 0, bob = 0, mouthOpen = 0.2, tilt = 0;
    const splash = w.phase === "splash";

    if (splash) {
      // Chapuzón: brazos arriba, hundiéndose.
      aL = aR = -2.9 + Math.sin(t * 18) * 0.25;
      eL = eR = 0.2;
      thighL = -0.4; thighR = 0.3; kL = kR = 0.6;
      mouthOpen = 1;
      J.root.position.y = Math.max(TUNING.waterY - 0.9, pos.y) - Math.min(1.1, w.phaseTime * 0.9);
    } else if (p.stun > 0) {
      // Golpe de la barredora: da vueltas sin control.
      a.spin += dt * 14;
      lean = a.spin;
      aL = -2 + Math.sin(t * 20); aR = 2 + Math.cos(t * 17);
      thighL = Math.sin(t * 18) * 0.8; thighR = -Math.sin(t * 18) * 0.8; kL = kR = 0.8;
      mouthOpen = 1;
    } else if (p.climbing) {
      // Trepando la red: mano, mano, pie, pie.
      const c = Math.sin(t * 9);
      aL = -2.7 + c * 0.45; aR = -2.7 - c * 0.45;
      eL = eR = 0.5;
      spreadL = spreadR = 0.35;
      thighL = 0.7 + c * 0.45; thighR = 0.7 - c * 0.45; kL = kR = 1.2;
      mouthOpen = 0.4;
    } else if (p.lifted) {
      // En el géiser: brazos arriba y piernas que patalean.
      aL = aR = -2.9;
      spreadL = spreadR = 0.5;
      eL = eR = 0.1;
      thighL = 0.3 + Math.sin(t * 14) * 0.35; thighR = 0.3 - Math.sin(t * 14) * 0.35; kL = kR = 0.6;
      mouthOpen = 1;
    } else if (p.slipping || (p.exhausted > 0 && p.grounded)) {
      // Sin energía: piernas de gelatina y brazos en molino.
      const shake = Math.sin(t * 30) * 0.25;
      thighL = 0.2 + shake; thighR = -0.2 - shake; kL = kR = 0.9 + shake;
      aL = (t * 9) % (Math.PI * 2); aR = aL + Math.PI;
      bob = -0.12;
      mouthOpen = 1;
      tilt = Math.sin(t * 7) * 0.25;
    } else if (p.gliding) {
      // Flotador: brazos abiertos, piernas colgando.
      spreadL = spreadR = 1.4;
      aL = aR = -0.2;
      eL = eR = 0.2;
      thighL = 0.25 + Math.sin(t * 5) * 0.15; thighR = -0.1 - Math.sin(t * 5) * 0.15; kL = kR = 0.4;
      mouthOpen = 0.6;
    } else if (!p.grounded && p.vy > 0) {
      // Subiendo: rodillas recogidas, un brazo arriba.
      thighL = 1.1; thighR = 0.5; kL = 1.6; kR = 1.2;
      aL = -2.6; aR = 0.6; eL = 0.3; eR = 0.9;
      mouthOpen = 0.5;
    } else if (!p.grounded) {
      // Bajando: piernas que buscan el piso, brazos que revolean.
      thighL = 0.45; thighR = -0.15; kL = 0.5; kR = 0.25;
      aL = -1.8 + Math.sin(t * 16) * 0.5; aR = -1.6 + Math.cos(t * 15) * 0.5;
      spreadL = spreadR = 0.6;
      mouthOpen = p.vy < -12 ? 1 : 0.5;
    } else {
      // Correr / respirar.
      const s = Math.sin(a.phase) * 0.85 * a.stride;
      thighL = s; thighR = -s;
      kL = 0.15 + Math.max(0, -s) * 1.5 + a.stride * 0.2;
      kR = 0.15 + Math.max(0, s) * 1.5 + a.stride * 0.2;
      aL = -s * 0.9; aR = s * 0.9;
      eL = eR = 0.35 + a.stride * 0.6;
      lean = 0.18 * a.stride;
      bob = Math.abs(Math.cos(a.phase)) * 0.06 * a.stride + Math.sin(t * 2.5) * 0.01 * (1 - a.stride);
      if (p.ground === "soap" && speed > 3) {
        // Patinando en el jabón.
        aL = -1.2 + Math.sin(t * 14) * 0.6; aR = 1.2 - Math.sin(t * 14) * 0.6;
        spreadL = spreadR = 0.9;
        mouthOpen = 0.8;
      }
    }
    if (p.stun <= 0) a.spin = 0;

    // Agachada al aterrizar.
    const crouch = Math.max(0, 1 - a.squash);
    kL += crouch * 2.2; kR += crouch * 2.2;
    thighL += crouch * 1.1; thighR += crouch * 1.1;

    J.body.position.y = bob - crouch * 0.18;
    J.body.rotation.x = lean;
    J.body.rotation.z = tilt;
    J.body.scale.set(1 + (1 - a.squash) * 0.5, a.squash, 1 + (1 - a.squash) * 0.5);
    // Rotación positiva en x = el pie (o la mano) va para atrás.
    J.legL.rotation.x = -thighL; J.legR.rotation.x = -thighR;
    J.kneeL.rotation.x = kL; J.kneeR.rotation.x = kR;
    J.armL.rotation.set(-aL, 0, -spreadL); J.armR.rotation.set(-aR, 0, spreadR);
    J.elbowL.rotation.x = -eL; J.elbowR.rotation.x = -eR;
    J.head.rotation.x = -lean * 0.5 + Math.sin(a.phase * 2) * 0.04 * a.stride;
    J.mouth.scale.set(1, 0.3 + mouthOpen * 0.9, 1);
    J.ring.visible = p.gliding;

    // Sombra en lo que tenga abajo: clave para calcular los saltos en 3D.
    const ground = groundBelow(w, pos.x, pos.z, pos.y + 0.05);
    const height = Math.max(0, pos.y - ground);
    J.shadow.position.set(pos.x, ground + 0.03, pos.z);
    const sz = Math.max(0.25, 0.75 - height * 0.05);
    J.shadow.scale.set(sz, sz, sz);
    (J.shadow.material as THREE.MeshBasicMaterial).opacity = splash ? 0 : Math.max(0.12, 0.45 - height * 0.025);
  });

  return (
    <>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} material={mats.shadow} renderOrder={1}>
        <circleGeometry args={[0.6, 24]} />
      </mesh>
      <group ref={root}>
        <group ref={body}>
          {/* Piernas */}
          {(["L", "R"] as const).map((side) => (
            <group key={side} position={[side === "L" ? -0.12 : 0.12, 0.74, 0]} ref={side === "L" ? legL : legR}>
              <mesh position={[0, -0.17, 0]} material={mats.skin} castShadow>
                <capsuleGeometry args={[0.085, 0.24, 4, 10]} />
                <Outlines thickness={OUTLINE} color={INK} />
              </mesh>
              <group position={[0, -0.36, 0]} ref={side === "L" ? kneeL : kneeR}>
                <mesh position={[0, -0.15, 0]} material={mats.skin} castShadow>
                  <capsuleGeometry args={[0.075, 0.2, 4, 10]} />
                  <Outlines thickness={OUTLINE} color={INK} />
                </mesh>
                <mesh position={[0, -0.24, 0]} material={mats.white}>
                  <cylinderGeometry args={[0.085, 0.085, 0.08, 10]} />
                </mesh>
                <RoundedBox args={[0.18, 0.12, 0.32]} radius={0.05} position={[0, -0.33, 0.06]} material={mats.shoe} castShadow>
                  <Outlines thickness={OUTLINE} color={INK} />
                </RoundedBox>
              </group>
            </group>
          ))}
          {/* Short y camiseta */}
          <RoundedBox args={[0.5, 0.2, 0.32]} radius={0.08} position={[0, 0.72, 0]} material={mats.white} castShadow>
            <Outlines thickness={OUTLINE} color={INK} />
          </RoundedBox>
          <RoundedBox args={[0.52, 0.46, 0.34]} radius={0.13} position={[0, 0.98, 0]} material={mats.shirt} castShadow>
            <Outlines thickness={OUTLINE} color={INK} />
          </RoundedBox>
          {/* Flotador (mejora): aparece al planear */}
          <mesh ref={ring} position={[0, 0.85, 0]} rotation-x={Math.PI / 2} material={mats.ring} visible={false}>
            <torusGeometry args={[0.38, 0.11, 10, 24]} />
            <Outlines thickness={OUTLINE} color={INK} />
          </mesh>
          {/* Brazos */}
          {(["L", "R"] as const).map((side) => (
            <group key={side} position={[side === "L" ? -0.3 : 0.3, 1.12, 0]} ref={side === "L" ? armL : armR}>
              <mesh position={[0, -0.1, 0]} material={mats.shirt} castShadow>
                <capsuleGeometry args={[0.075, 0.12, 4, 10]} />
                <Outlines thickness={OUTLINE} color={INK} />
              </mesh>
              <group position={[0, -0.24, 0]} ref={side === "L" ? elbowL : elbowR}>
                <mesh position={[0, -0.1, 0]} material={mats.skin} castShadow>
                  <capsuleGeometry args={[0.06, 0.14, 4, 10]} />
                  <Outlines thickness={OUTLINE} color={INK} />
                </mesh>
                <mesh position={[0, -0.24, 0]} material={mats.white} castShadow>
                  <sphereGeometry args={[0.09, 14, 12]} />
                  <Outlines thickness={OUTLINE} color={INK} />
                </mesh>
              </group>
            </group>
          ))}
          {/* Cabeza */}
          <group position={[0, 1.2, 0]} ref={head}>
            <mesh position={[0, 0.2, 0]} material={mats.skin} castShadow>
              <sphereGeometry args={[0.27, 20, 16]} />
              <Outlines thickness={OUTLINE} color={INK} />
            </mesh>
            {/* Pelo y vincha */}
            <mesh position={[0, 0.3, -0.03]} scale={[1.04, 0.75, 1.04]} material={mats.hair}>
              <sphereGeometry args={[0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <Outlines thickness={OUTLINE} color={INK} />
            </mesh>
            <mesh position={[0, 0.33, 0]} rotation-x={Math.PI / 2} material={mats.white}>
              <torusGeometry args={[0.255, 0.04, 8, 28]} />
              <Outlines thickness={OUTLINE * 0.7} color={INK} />
            </mesh>
            {/* Ojos, nariz y boca (mira para +z) */}
            {[-0.09, 0.09].map((x) => (
              <group key={x} position={[x, 0.24, 0.22]}>
                <mesh material={mats.white}>
                  <sphereGeometry args={[0.065, 12, 10]} />
                  <Outlines thickness={0.015} color={INK} />
                </mesh>
                <mesh position={[0, 0, 0.05]} material={mats.ink}>
                  <sphereGeometry args={[0.028, 8, 8]} />
                </mesh>
              </group>
            ))}
            <mesh position={[0, 0.17, 0.27]} material={mats.skin}>
              <sphereGeometry args={[0.045, 10, 8]} />
              <Outlines thickness={0.012} color={INK} />
            </mesh>
            <mesh ref={mouth} position={[0, 0.08, 0.23]} material={mats.ink}>
              <sphereGeometry args={[0.055, 10, 8]} />
            </mesh>
          </group>
        </group>
      </group>
    </>
  );
}
