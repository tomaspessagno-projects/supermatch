"use client";

import { Outlines, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { CANNON_BALL, cannonBall, geyserOn, geyserPhase, geyserWarn, type Mover, moverBox, moverOffset, type Tower, windBlowing } from "../../sim/level";
import type { Frame } from "../frame";
import { INK, PALETTE, toon } from "../toon";
import { OUTLINE } from "./Blocks";

type Props = { tower: Tower; frame: React.RefObject<Frame | null> };

function Sweeper({ m }: { m: Mover }) {
  const sx = m.box.maxX - m.box.minX;
  const sy = m.box.maxY - m.box.minY;
  const sz = m.box.maxZ - m.box.minZ;
  return (
    <>
      <RoundedBox args={[sx, sy, sz]} radius={0.22} material={toon(PALETTE.yellow)} castShadow>
        <Outlines thickness={OUTLINE} color={INK} />
      </RoundedBox>
      {[-0.3, 0, 0.3].map((t) => (
        <mesh key={t} position={m.axis === "z" ? [t * sx, 0, 0] : [0, 0, t * sz]} material={toon(PALETTE.pink)}>
          <boxGeometry args={m.axis === "z" ? [0.18, sy + 0.02, sz + 0.02] : [sx + 0.02, sy + 0.02, 0.18]} />
        </mesh>
      ))}
    </>
  );
}

function Cloud({ m }: { m: Mover }) {
  const sx = m.box.maxX - m.box.minX;
  const sy = m.box.maxY - m.box.minY;
  const sz = m.box.maxZ - m.box.minZ;
  return (
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
      {/* Carita */}
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.15, sz / 2 + 0.05]} material={toon(INK)}>
          <sphereGeometry args={[0.07, 8, 8]} />
        </mesh>
      ))}
    </group>
  );
}

/** Martillo de goma colgado de una soga: se balancea como un péndulo. */
function Hammer({ m }: { m: Mover }) {
  const L = m.length ?? 3;
  const sz = m.box.maxZ - m.box.minZ;
  return (
    <group>
      <mesh position={[0, L / 2, 0]} material={toon("#fef3c7")}>
        <cylinderGeometry args={[0.05, 0.05, L, 6]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} material={toon("#ef4444")} castShadow>
        <cylinderGeometry args={[0.5, 0.5, sz, 20]} />
        <Outlines thickness={OUTLINE} color={INK} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0, (s * sz) / 2]} rotation-x={Math.PI / 2} material={toon(PALETTE.yellow)}>
          <cylinderGeometry args={[0.52, 0.52, 0.12, 20]} />
          <Outlines thickness={0.04} color={INK} />
        </mesh>
      ))}
    </group>
  );
}

/** Guante de box inflable que sale de la pared. */
function Glove() {
  return (
    <group>
      <RoundedBox args={[1.1, 1.0, 1.0]} radius={0.4} material={toon("#dc2626")} castShadow>
        <Outlines thickness={OUTLINE} color={INK} />
      </RoundedBox>
      <mesh position={[0.5, 0.15, 0.1]} material={toon("#dc2626")}>
        <sphereGeometry args={[0.28, 12, 10]} />
        <Outlines thickness={0.04} color={INK} />
      </mesh>
      <mesh position={[0, 0, -0.55]} rotation-x={Math.PI / 2} material={toon(PALETTE.white)}>
        <cylinderGeometry args={[0.38, 0.38, 0.2, 16]} />
      </mesh>
    </group>
  );
}

/** Todo lo que se mueve (barredoras, nubes, martillos y guantes), donde está ahora. */
function Movers({ tower, frame }: Props) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const arms = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const f = frame.current;
    if (!f) return;
    const t = f.world.time;
    tower.movers.forEach((m, i) => {
      const g = refs.current[i];
      if (!g) return;
      if (m.kind === "hammer") {
        // Pivote fijo arriba; la soga se inclina según cuánto se corrió la cabeza.
        const L = m.length ?? 3;
        const theta = Math.asin(Math.max(-1, Math.min(1, moverOffset(m, t) / L)));
        g.rotation.z = theta;
        return;
      }
      const b = moverBox(m, t);
      g.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
      if (m.kind === "piston") {
        // El brazo de acordeón va desde la pared hasta el guante.
        const arm = arms.current[i];
        if (arm) {
          const len = Math.max(0.05, b.minZ);
          arm.scale.set(1, len, 1);
          arm.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, len / 2);
        }
      }
    });
  });
  return (
    <>
      {tower.movers.map((m, i) => {
        const cx = (m.box.minX + m.box.maxX) / 2;
        const cy = (m.box.minY + m.box.maxY) / 2;
        const cz = (m.box.minZ + m.box.maxZ) / 2;
        if (m.kind === "hammer") {
          const L = m.length ?? 3;
          return (
            <group key={m.id} position={[cx, cy + L, cz]} ref={(g) => void (refs.current[i] = g)}>
              <group position={[0, -L, 0]}>
                <Hammer m={m} />
              </group>
            </group>
          );
        }
        return (
          <group key={m.id}>
            <group ref={(g) => void (refs.current[i] = g)}>
              {m.kind === "sweeper" ? <Sweeper m={m} /> : m.kind === "cloud" ? <Cloud m={m} /> : <Glove />}
            </group>
            {m.kind === "piston" && (
              <mesh ref={(a) => void (arms.current[i] = a)} rotation-x={Math.PI / 2} material={toon(PALETTE.yellow)}>
                <cylinderGeometry args={[0.22, 0.22, 1, 10]} />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

/** Cañones de espuma en la pared, y la pelota que va volando. */
function Cannons({ tower, frame }: Props) {
  const balls = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const f = frame.current;
    if (!f) return;
    tower.cannons.forEach((c, i) => {
      const mesh = balls.current[i];
      if (!mesh) return;
      const p = cannonBall(c, f.world.time);
      mesh.visible = p !== null;
      if (p) mesh.position.set(p.x, p.y, p.z);
    });
  });
  return (
    <>
      {tower.cannons.map((c, i) => (
        <group key={c.id}>
          <group position={[c.x, c.y, c.z]} rotation={[-Math.asin(c.dy), Math.atan2(c.dx, c.dz), 0, "YXZ"]}>
            <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.3]} material={toon("#334155")} castShadow>
              <cylinderGeometry args={[0.42, 0.5, 0.9, 16]} />
              <Outlines thickness={0.05} color={INK} />
            </mesh>
            <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.78]} material={toon(PALETTE.yellow)}>
              <torusGeometry args={[0.42, 0.08, 8, 16]} />
            </mesh>
          </group>
          <mesh ref={(m) => void (balls.current[i] = m)} material={toon(PALETTE.pink)} castShadow visible={false}>
            <sphereGeometry args={[CANNON_BALL, 16, 12]} />
            <Outlines thickness={0.04} color={INK} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Géiseres: la boquilla en la plataforma y el chorro de agua cuando sale. */
function Geysers({ tower, frame }: Props) {
  const jets = useRef<(THREE.Mesh | null)[]>([]);
  const material = useMemo(() => new THREE.MeshToonMaterial({ color: "#7dd3fc", transparent: true, opacity: 0.7 }), []);
  useFrame(() => {
    const f = frame.current;
    if (!f) return;
    tower.geysers.forEach((g, i) => {
      const jet = jets.current[i];
      if (!jet) return;
      const full = g.maxY - g.minY;
      const t = f.world.time;
      let h = 0;
      if (geyserOn(g, t)) h = full * Math.min(1, geyserPhase(g, t) / 0.06);
      else if (geyserWarn(g, t)) h = 0.25 + Math.abs(Math.sin(f.clock * 20)) * 0.25;
      jet.visible = h > 0.01;
      jet.scale.set(1 + Math.sin(f.clock * 25) * 0.04, Math.max(0.01, h), 1 + Math.cos(f.clock * 23) * 0.04);
      jet.position.y = g.minY + h / 2;
    });
  });
  return (
    <>
      {tower.geysers.map((g, i) => {
        const cx = (g.minX + g.maxX) / 2;
        const cz = (g.minZ + g.maxZ) / 2;
        return (
          <group key={g.id}>
            <mesh position={[cx, g.minY + 0.1, cz]} material={toon("#0e7490")}>
              <cylinderGeometry args={[0.45, 0.55, 0.2, 16]} />
              <Outlines thickness={0.04} color={INK} />
            </mesh>
            <mesh ref={(m) => void (jets.current[i] = m)} position={[cx, g.minY, cz]} material={material}>
              <cylinderGeometry args={[(g.maxX - g.minX) / 2, (g.maxX - g.minX) / 2 + 0.15, 1, 16, 1, true]} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/** Ventiladores: aspas que giran cuando soplan, y cintas blancas que vuelan. */
function Fans({ tower, frame }: Props) {
  const blades = useRef<(THREE.Group | null)[]>([]);
  const streaks = useRef<THREE.InstancedMesh>(null);
  const per = 6;
  const streakMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.75 }), []);
  useFrame((_, dt) => {
    const f = frame.current;
    if (!f) return;
    const mesh = streaks.current;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    tower.winds.forEach((w, wi) => {
      const blowing = windBlowing(w, f.world.time);
      const g = blades.current[wi];
      if (g) g.rotation.z += dt * (blowing ? 18 : 1.5);
      if (!mesh) return;
      const angle = Math.atan2(w.dirX, w.dirZ);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      const sx = w.maxX - w.minX;
      const sz = w.maxZ - w.minZ;
      const along = Math.abs(w.dirX) > 0.5 ? sx : sz;
      for (let k = 0; k < per; k++) {
        const travel = ((f.clock * 1.6 + k / per) % 1) * along;
        const side = ((k % 3) - 1) * 0.6;
        const cx = (w.minX + w.maxX) / 2 + w.dirX * (travel - along / 2) + w.dirZ * side;
        const cz = (w.minZ + w.maxZ) / 2 + w.dirZ * (travel - along / 2) - w.dirX * side;
        const y = w.minY + 0.7 + (k % 3) * 0.7;
        const s = blowing ? 1 : 0.0001;
        m.compose(new THREE.Vector3(cx, y, cz), q, new THREE.Vector3(0.05 * s, 0.05 * s, 0.9 * s));
        mesh.setMatrixAt(wi * per + k, m);
      }
    });
    if (mesh) mesh.instanceMatrix.needsUpdate = true;
  });
  if (!tower.winds.length) return null;
  return (
    <>
      {tower.winds.map((w, i) => {
        // El ventilador va del lado de donde sale el viento, mirando para donde sopla.
        const cx = (w.minX + w.maxX) / 2 - w.dirX * ((w.maxX - w.minX) / 2 + 0.3);
        const cz = Math.max(0.35, (w.minZ + w.maxZ) / 2 - w.dirZ * ((w.maxZ - w.minZ) / 2 + 0.3));
        return (
          <group key={w.id} position={[cx, w.minY + 1.5, cz]} rotation-y={Math.atan2(w.dirX, w.dirZ)}>
            <mesh material={toon("#e2e8f0")}>
              <torusGeometry args={[0.9, 0.12, 8, 24]} />
              <Outlines thickness={0.04} color={INK} />
            </mesh>
            <group ref={(g) => void (blades.current[i] = g)}>
              {[0, 1, 2].map((k) => (
                <mesh key={k} rotation-z={(k * Math.PI * 2) / 3} position={[0, 0, 0]} material={toon(PALETTE.cyan)}>
                  <boxGeometry args={[0.28, 1.5, 0.05]} />
                </mesh>
              ))}
              <mesh material={toon(PALETTE.yellow)}>
                <sphereGeometry args={[0.18, 10, 8]} />
              </mesh>
            </group>
          </group>
        );
      })}
      <instancedMesh ref={streaks} args={[undefined, streakMaterial, tower.winds.length * per]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </>
  );
}

export function Hazards({ tower, frame }: Props) {
  return (
    <>
      <Movers tower={tower} frame={frame} />
      <Cannons tower={tower} frame={frame} />
      <Geysers tower={tower} frame={frame} />
      <Fans tower={tower} frame={frame} />
    </>
  );
}
