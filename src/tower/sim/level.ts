import { mulberry32 } from "./random";

/**
 * La torre inflable: un caracol de bloques alrededor de una columna, por
 * pisos de 12 m, cada uno con su obstáculo. Arriba de cada piso hay un anillo
 * de descanso (salvavidas). Abajo, la pileta y la orilla con el kiosco.
 * La torre es igual para todos (semilla fija); lo que cambia en cada intento
 * es qué hay en las cornisas.
 */

export type Box = { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
export type Vec3 = { x: number; y: number; z: number };

export type BlockKind = "deck" | "normal" | "soap" | "bubble" | "rest" | "ledge" | "goal" | "elevator";
export type Block = Box & { id: number; kind: BlockKind; floor: number };

/** Lo que se mueve: barredoras (te tiran) y nubes (te llevan). */
export type Mover = {
  id: number;
  kind: "sweeper" | "cloud";
  /** Caja en el centro del recorrido. */
  box: Box;
  axis: "x" | "z";
  amplitude: number;
  period: number;
  phase: number;
  floor: number;
};

/** Zona de viento: cuando sopla, empuja para afuera de la torre. */
export type Wind = Box & { dirX: number; dirZ: number; period: number; phase: number; floor: number };

/** Lugar donde puede aparecer una ficha (camino) o un objeto (cornisa). */
export type Spot = Vec3 & { id: number; floor: number; ledge: boolean };

export type Theme = "warmup" | "soap" | "wind" | "sweeper" | "bubble" | "cloud";

export type Floor = {
  index: number;
  name: string;
  theme: Theme;
  bottom: number;
  top: number;
  /** Altura de salto necesaria para el escalón más alto del piso (m). */
  needJump: number;
};

/** Un escalón del camino, en orden de abajo para arriba (bloque fijo o nube). */
export type PathStep = { kind: "block" | "mover"; id: number; floor: number };

export type Tower = {
  blocks: Block[];
  path: PathStep[];
  movers: Mover[];
  winds: Wind[];
  spots: Spot[];
  floors: Floor[];
  columnRadius: number;
  /** Altura de la cima (la Copa). */
  top: number;
  /** Alturas de los anillos de descanso, de abajo para arriba. */
  rests: number[];
  start: Vec3;
  kiosk: Vec3;
  elevator: Box;
};

/** El caracol va por afuera de los anillos de descanso (que abrazan la columna). */
const SPIRAL_RADIUS = 7;
const RING_RADIUS = 3.6;
const RING_BLOCK = 1.9;
const COLUMN_RADIUS = 2.6;
const FLOOR_HEIGHT = 12;
const BLOCK_THICKNESS = 0.5;

type FloorDef = {
  name: string;
  theme: Theme;
  /** Subida entre escalones (m). */
  rise: readonly [number, number];
  /** Giro entre escalones (radianes). */
  step: readonly [number, number];
  size: readonly [number, number];
};

const FLOOR_DEFS: readonly FloorDef[] = [
  { name: "Calentamiento", theme: "warmup", rise: [0.8, 1.1], step: [0.37, 0.44], size: [2.4, 2.6] },
  { name: "Jabón", theme: "soap", rise: [0.95, 1.25], step: [0.39, 0.46], size: [2.0, 2.4] },
  // Desde acá los escalones más altos piden mejoras de salto (nivel 1, 2, 3).
  { name: "Viento", theme: "wind", rise: [1.3, 1.7], step: [0.39, 0.46], size: [2.0, 2.3] },
  { name: "Barredoras", theme: "sweeper", rise: [1.5, 1.86], step: [0.41, 0.48], size: [2.3, 2.6] },
  { name: "Burbujas", theme: "bubble", rise: [1.6, 2.04], step: [0.41, 0.48], size: [2.0, 2.4] },
  { name: "Nubes", theme: "cloud", rise: [1.4, 1.86], step: [0.44, 0.51], size: [2.0, 2.3] },
];

/** Las burbujas tiran para arriba: el escalón después de una puede estar mucho más alto. */
const BUBBLE_RISE = 2.9;

const box = (cx: number, top: number, cz: number, sx: number, sz: number, thick = BLOCK_THICKNESS): Box => ({
  minX: cx - sx / 2,
  maxX: cx + sx / 2,
  minY: top - thick,
  maxY: top,
  minZ: cz - sz / 2,
  maxZ: cz + sz / 2,
});

export function buildTower(seed = 7): Tower {
  const random = mulberry32(seed);
  const between = ([a, b]: readonly [number, number]) => a + (b - a) * random();
  const blocks: Block[] = [];
  const movers: Mover[] = [];
  const winds: Wind[] = [];
  const spots: Spot[] = [];
  const floors: Floor[] = [];
  const rests: number[] = [];
  const path: PathStep[] = [];
  let id = 1;
  const add = (b: Box, kind: BlockKind, floor: number) => {
    const block = { ...b, id: id++, kind, floor };
    blocks.push(block);
    return block;
  };

  // La orilla: un muelle grande con el kiosco y el ascensor.
  add({ minX: -17, maxX: -8.7, minY: -1, maxY: 0, minZ: -4.5, maxZ: 4.5 }, "deck", -1);
  const elevator = { minX: -16.5, maxX: -14.7, minY: -0.02, maxY: 0.04, minZ: 2.4, maxZ: 4.2 };
  add(elevator, "elevator", -1);

  // El caracol arranca justo enfrente de la orilla: caminar derecho lleva al primer escalón.
  let angle = Math.PI - 0.4;
  let prev: Box | null = null; // escalón anterior del caracol
  let y = 0;
  FLOOR_DEFS.forEach((def, index) => {
    const bottom = index * FLOOR_HEIGHT;
    const top = bottom + FLOOR_HEIGHT;
    let maxRise = 0;
    let n = 0;
    let bubbleNext = false;
    // Escalones hasta que el anillo de descanso quede a un salto normal.
    while (top - y > def.rise[1]) {
      let rise = bubbleNext ? BUBBLE_RISE : between(def.rise);
      // No pasarse: lo que falte hasta el anillo tiene que ser un escalón posible.
      if (top - (y + rise) < def.rise[0] * 0.5) rise = Math.min(def.rise[1], (top - y) / 2);
      if (bubbleNext && top - (y + rise) < def.rise[0] * 0.5) rise = (top - y) / 2;
      angle += between(def.step);
      y += rise;
      if (!bubbleNext) maxRise = Math.max(maxRise, rise);
      bubbleNext = false;
      const size = between(def.size);
      // Nunca encima del escalón anterior (te golpearías la cabeza al saltar):
      // si se pisan visto desde arriba, se gira un poco más.
      const overlapsPrev = (a: number) => {
        if (!prev) return false;
        const x = Math.cos(a) * SPIRAL_RADIUS;
        const z = Math.sin(a) * SPIRAL_RADIUS;
        return x + size / 2 + 0.15 > prev.minX && x - size / 2 - 0.15 < prev.maxX && z + size / 2 + 0.15 > prev.minZ && z - size / 2 - 0.15 < prev.maxZ;
      };
      while (overlapsPrev(angle)) angle += 0.03;
      const cx = Math.cos(angle) * SPIRAL_RADIUS;
      const cz = Math.sin(angle) * SPIRAL_RADIUS;
      n++;

      if (def.theme === "cloud" && n % 2 === 0) {
        // Nube que va y viene a lo largo del camino.
        const along = Math.abs(Math.sin(angle)) > Math.abs(Math.cos(angle)) ? "x" : "z";
        const cloudId = id++;
        prev = box(cx, y, cz, size, size, 0.6);
        movers.push({ id: cloudId, kind: "cloud", box: prev, axis: along, amplitude: 0.9, period: 3 + random() * 1.5, phase: random() * Math.PI * 2, floor: index });
        path.push({ kind: "mover", id: cloudId, floor: index });
      } else {
        const kind: BlockKind =
          def.theme === "soap" && random() < 0.75 ? "soap" : def.theme === "bubble" && n % 3 === 0 ? "bubble" : "normal";
        const block = add(box(cx, y, cz, size, size), kind, index);
        prev = block;
        path.push({ kind: "block", id: block.id, floor: index });
        if (kind === "bubble") bubbleNext = true;
        if (def.theme === "sweeper" && n % 2 === 0) {
          // Barredora de goma que cruza el escalón.
          const along = Math.abs(Math.sin(angle)) > Math.abs(Math.cos(angle)) ? "z" : "x";
          const long = size + 0.4;
          movers.push({
            id: id++,
            kind: "sweeper",
            box: { minX: cx - (along === "x" ? 0.25 : long / 2), maxX: cx + (along === "x" ? 0.25 : long / 2), minY: y + 0.15, maxY: y + 0.75, minZ: cz - (along === "z" ? 0.25 : long / 2), maxZ: cz + (along === "z" ? 0.25 : long / 2) },
            axis: along,
            amplitude: size / 2 + 0.3,
            period: 2.2 + random() * 0.8,
            phase: random() * Math.PI * 2,
            floor: index,
          });
        }
        if (def.theme === "wind" && n % 2 === 1) {
          winds.push({ ...box(cx, y + 3, cz, size + 1, size + 1, 3.2), dirX: Math.cos(angle), dirZ: Math.sin(angle), period: 3.5 + random(), phase: random() * Math.PI * 2, floor: index });
        }
      }
      // Fichas en el camino (una cada dos escalones).
      if (n % 2 === 0) spots.push({ id: id++, x: cx, y: y + 0.5, z: cz, floor: index, ledge: false });
      // Cornisas afuera del camino, con premio.
      if (n % 5 === 3 && def.theme !== "cloud") {
        const lx = Math.cos(angle + 0.12) * (SPIRAL_RADIUS + 2.7);
        const lz = Math.sin(angle + 0.12) * (SPIRAL_RADIUS + 2.7);
        add(box(lx, y + 0.6, lz, 1.4, 1.4), "ledge", index);
        spots.push({ id: id++, x: lx, y: y + 1.1, z: lz, floor: index, ledge: true });
      }
    }
    // Anillo de descanso arriba del piso: rodea la columna (se llega desde cualquier lado).
    maxRise = Math.max(maxRise, top - y);
    y = top;
    rests.push(top);
    let nearest: Block | null = null;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const ring = add(box(Math.cos(a) * RING_RADIUS, top, Math.sin(a) * RING_RADIUS, RING_BLOCK, RING_BLOCK), index === FLOOR_DEFS.length - 1 ? "goal" : "rest", index);
      // En el camino, el pedazo de anillo que queda más cerca de donde venías.
      const da = Math.abs(((a - angle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      const dn = nearest ? Math.abs(((Math.atan2((nearest.minZ + nearest.maxZ) / 2, (nearest.minX + nearest.maxX) / 2) - angle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) : Infinity;
      if (da < dn) nearest = ring;
    }
    if (nearest) path.push({ kind: "block", id: nearest.id, floor: index });
    // Del anillo se sale para cualquier lado, pero el primer escalón del piso
    // siguiente no puede quedar encima del último de este (`prev` sigue siendo ese).
    floors.push({ index, name: def.name, theme: def.theme, bottom, top, needJump: maxRise + 0.12 });
  });

  return {
    blocks,
    path,
    movers,
    winds,
    spots,
    floors,
    columnRadius: COLUMN_RADIUS,
    top: y,
    rests,
    start: { x: -12, y: 0, z: 0 },
    kiosk: { x: -15.2, y: 0, z: -2.6 },
    elevator,
  };
}

/** Posición de una barredora o nube en el tiempo `t`. */
export function moverOffset(m: Mover, t: number): number {
  return m.amplitude * Math.sin((t / m.period) * Math.PI * 2 + m.phase);
}

export function moverBox(m: Mover, t: number): Box {
  const d = moverOffset(m, t);
  return m.axis === "x"
    ? { ...m.box, minX: m.box.minX + d, maxX: m.box.maxX + d }
    : { ...m.box, minZ: m.box.minZ + d, maxZ: m.box.maxZ + d };
}

/** ¿Sopla el viento ahora? (ráfagas: un rato sí, un rato no). */
export function windBlowing(w: Wind, t: number): boolean {
  return Math.sin((t / w.period) * Math.PI * 2 + w.phase) > 0.15;
}

export function floorAt(tower: Tower, y: number): number {
  const i = tower.floors.findIndex((f) => y < f.top + 0.5);
  return i < 0 ? tower.floors.length - 1 : i;
}
