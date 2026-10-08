"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildTower } from "../sim/level";
import { applyStats, createWorld, type SimEvent, step } from "../sim/sim";
import { useTower } from "../store";
import { bus } from "./bus";
import { Effects } from "./Effects";
import { type Frame, playerPosition } from "./frame";
import { input } from "./input";
import { Player } from "./Player";
import { play } from "./sfx";
import { Stage } from "./Stage";
import { Tower } from "./Tower";

const STEP = 1 / 120;
const CAMERA_DISTANCE = 8.5;
const CAMERA_HEIGHT = 3.4;

const FLOOR_LINES: Record<number, string> = {
  1: "¡Piso 2: el jabón! Ojo que ahí no se frena...",
  2: "¡Piso 3: el viento! Cuando sopla, te lleva para afuera.",
  3: "¡Piso 4: las barredoras! Esperá el momento justo.",
  4: "¡Piso 5: las burbujas! Rebotan solas, aprovechalas.",
  5: "¡Piso 6: las nubes! Se mueven... ¡y arriba está la Copa!",
};

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

type LoopState = { acc: number; hudAt: number; yaw: number; ready: boolean; look: THREE.Vector3; fwd: THREE.Vector3 };

/** Un cuadro: teclas → simulación en pasos fijos → cámara → HUD. */
function advance(f: Frame, c: LoopState, camera: THREE.Camera, delta: number, onEvents: (e: readonly SimEvent[]) => void) {
  const dt = Math.min(delta, 0.1);
  f.clock += dt;
  const w = f.world;
  const panelOpen = useTower.getState().panel !== null;

  // Para adelante = hacia donde mira la cámara (en el piso).
  camera.getWorldDirection(c.fwd);
  c.fwd.y = 0;
  c.fwd.normalize();
  const ix = panelOpen ? 0 : input.x;
  const iy = panelOpen ? 0 : input.y;
  const moveX = c.fwd.x * iy - c.fwd.z * ix;
  const moveZ = c.fwd.z * iy + c.fwd.x * ix;

  c.acc += dt;
  while (c.acc >= STEP) {
    c.acc -= STEP;
    f.prev = { x: w.player.x, y: w.player.y, z: w.player.z };
    const events = step(w, { moveX, moveZ, jumpPressed: input.jumpPressed && !panelOpen, jumpHeld: input.jumpHeld }, STEP);
    input.jumpPressed = false;
    if (events.length) onEvents(events);
  }
  f.alpha = c.acc / STEP;

  // Cámara: afuera de la torre, del lado del jugador, mirándolo contra la torre.
  const pos = playerPosition(f);
  const d = Math.hypot(pos.x, pos.z);
  const around = d > 0.5 ? Math.atan2(pos.x, pos.z) : c.yaw;
  const targetYaw = around + input.yaw;
  if (!c.ready) c.yaw = targetYaw;
  c.yaw += angleDiff(targetYaw, c.yaw) * (1 - Math.exp(-dt * 3.5));
  // En pantallas angostas (celular parado) se abre el lente y se aleja, para ver los escalones de al lado.
  const lens = camera as THREE.PerspectiveCamera;
  const narrow = Math.max(0, 1 - lens.aspect);
  const fov = 55 + narrow * 30;
  if (Math.abs(lens.fov - fov) > 0.1) {
    lens.fov = fov;
    lens.updateProjectionMatrix();
  }
  const distance = CAMERA_DISTANCE * (1 + narrow * 0.6);
  const height = (CAMERA_HEIGHT + input.pitch * 4) * (1 + narrow * 0.4);
  const desired = new THREE.Vector3(pos.x + Math.sin(c.yaw) * distance, pos.y + height, pos.z + Math.cos(c.yaw) * distance);
  const look = new THREE.Vector3(pos.x, pos.y + 1.1, pos.z);
  if (!c.ready) {
    camera.position.copy(desired);
    c.look.copy(look);
    c.ready = true;
  }
  if (w.phase !== "splash") {
    camera.position.lerp(desired, 1 - Math.exp(-dt * 6));
    c.look.lerp(look, 1 - Math.exp(-dt * 10));
  }
  camera.lookAt(c.look);

  // HUD unas 10 veces por segundo.
  c.hudAt += dt;
  if (c.hudAt > 0.1) {
    c.hudAt = 0;
    const k = w.tower.kiosk;
    const onDeck = w.player.safe && w.player.y < 0.5;
    const nearKiosk = onDeck && Math.hypot(w.player.x - k.x, w.player.z - k.z) < 2.8;
    useTower.getState().setHud({
      height: Math.max(0, w.player.y),
      energy: w.energy,
      energyMax: w.stats.energy,
      bag: w.run.bag.length,
      bagMax: w.stats.bag,
      chips: w.run.chips,
      floor: w.run.floor,
      onDeck,
      nearKiosk,
    });
    if (input.action && nearKiosk) useTower.getState().openPanel("shop");
    input.action = false;
  }
}

/** El bucle: corre antes que todo lo demás en cada cuadro. */
function Loop({ frame, onEvents }: { frame: React.RefObject<Frame | null>; onEvents: (e: readonly SimEvent[]) => void }) {
  // Estado del bucle (mutable, fuera de React).
  const loop = useRef<LoopState>({ acc: 0, hudAt: 0, yaw: -Math.PI / 2, ready: false, look: new THREE.Vector3(), fwd: new THREE.Vector3() });
  useFrame((state, delta) => {
    if (frame.current) advance(frame.current, loop.current, state.camera, delta, onEvents);
  }, -1);
  return null;
}

export function TowerCanvas({ teamColor }: { teamColor: string }) {
  const frame = useRef<Frame | null>(null);
  const tower = useMemo(() => buildTower(), []);
  const bagWarned = useRef(false);

  // El mundo se arma al montar (el bucle espera hasta que exista).
  useEffect(() => {
    const s = useTower.getState();
    frame.current = {
      world: createWorld(tower, s.stats(), { record: s.record, highestRest: s.highestRest }, Math.floor(Math.random() * 1e9)),
      prev: { x: tower.start.x, y: tower.start.y, z: tower.start.z },
      alpha: 0,
      clock: 0,
    };
    // Con ?debug, las pruebas pueden mirar y mover el mundo desde la consola.
    if (new URLSearchParams(window.location.search).has("debug")) Object.assign(window, { __torre: frame });
  }, [tower]);

  // Comprar en el kiosco cambia el personaje enseguida (está en la orilla).
  useEffect(
    () =>
      useTower.subscribe((state, prev) => {
        if (state.levels !== prev.levels && frame.current) applyStats(frame.current.world, state.stats());
      }),
    [],
  );

  useEffect(() => {
    const s = useTower.getState();
    if (s.runs === 0) s.announce("¡Bienvenido a La Torre! Subí todo lo que puedas: lo que juntes se cobra cuando caés a la pileta.");
  }, []);

  const onEvents = (events: readonly SimEvent[]) => {
    bus.emit(events);
    const store = useTower.getState();
    const w = frame.current!.world;
    for (const e of events) {
      switch (e.type) {
        case "jump":
          play("jump", { vary: 2, volume: e.double ? 0.8 : 0.6 });
          break;
        case "land":
          if (e.impact > 8) play("land", { volume: Math.min(1, e.impact / 25), vary: 2 });
          break;
        case "bounce":
          play("spring", { vary: 1 });
          break;
        case "knock":
          play("bonk", { vary: 1 });
          break;
        case "chip":
          play("pop", { vary: 3, volume: 0.6 });
          break;
        case "item":
          play("checkpoint", { vary: 1 });
          break;
        case "bagFull":
          play("wall", { volume: 0.5 });
          if (!bagWarned.current) {
            bagWarned.current = true;
            store.announce("¡Mochila llena! En el kiosco hay mochilas más grandes.");
          }
          break;
        case "exhausted":
          play("fail", { volume: 0.6 });
          store.announce("¡Se quedó sin nafta! Más energía en el kiosco = más alto.");
          break;
        case "refill":
          play("checkpoint");
          break;
        case "rest":
          if (e.first) {
            store.reachRest(e.floor);
            store.announce(`¡Descanso del piso ${e.floor + 1}! Con el ascensor podés arrancar desde acá.`);
          }
          break;
        case "floor":
          play("count", { volume: 0.7 });
          if (FLOOR_LINES[e.floor]) store.announce(FLOOR_LINES[e.floor]);
          break;
        case "top":
          play("finish");
          play("cheer");
          store.announce("¡LLEGÓ A LA CIMA! ¡La Copa Supermatch es tuya! ¡Qué temporada!");
          break;
        case "elevator":
          play("spring");
          break;
        case "splash": {
          play("splash", { vary: 1 });
          play("laugh", { vary: 1, volume: 0.7 });
          // Caerse del muelle sin subir nada no es un intento: solo una risa.
          if (e.summary.climbed < 0.5 && e.summary.total === 0) store.announce("¡Ups! La torre está para el otro lado. Caminá derecho y saltá al primer escalón.");
          else store.finishRun(e.summary);
          break;
        }
        case "respawn":
          bagWarned.current = false;
          applyStats(w, store.stats());
          break;
      }
    }
  };

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 55, near: 0.1, far: 300, position: [-20, 4, 0] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
    >
      <Loop frame={frame} onEvents={onEvents} />
      <Suspense fallback={null}>
        <Stage frame={frame} />
        <Tower tower={tower} frame={frame} />
        <Player frame={frame} teamColor={teamColor} />
        <Effects frame={frame} />
      </Suspense>
    </Canvas>
  );
}
