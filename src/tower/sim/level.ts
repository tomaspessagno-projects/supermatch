import { mulberry32 } from "./random";

/**
 * La torre inflable, vista de frente: una fachada enorme en medio de la pileta
 * y un camino de plataformas que la sube en zigzag, de un costado al otro.
 * En cada vuelta cambia de carril (pegado a la pared o más afuera), así una
 * fila nunca queda justo arriba de la anterior. Ocho pisos (de 10 a 15 m),
 * cada uno con sus cosas, y un descanso ancho al final de cada piso.
 *
 * La torre es igual para todos (semilla fija); lo que cambia en cada intento
 * es qué hay en las cornisas.
 */

export type Box = { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
export type Vec3 = { x: number; y: number; z: number };

export type BlockKind =
  | "deck"
  | "elevator"
  | "wall"
  | "normal"
  | "soap"
  | "conveyor"
  | "trampoline"
  | "crumble"
  | "ball"
  | "bubble"
  | "blink"
  | "spinner"
  | "pillar"
  | "rail"
  | "rest"
  | "ledge"
  | "goal";

export type Block = Box & {
  id: number;
  kind: BlockKind;
  floor: number;
  /** Cinta: velocidad en x (m/s). */
  belt?: number;
  /** Calesita: velocidad de giro (rad/s, el signo es el sentido). */
  spin?: number;
  /** Parpadeo: período (s) y fase (0 a 1). */
  period?: number;
  phase?: number;
};

/**
 * Lo que se mueve: barredoras (te tiran), nubes (te llevan), martillos
 * (péndulos que te tiran) y guantes de box (salen de la pared y te empujan a
 * la pileta).
 */
export type MoverKind = "sweeper" | "cloud" | "hammer" | "piston";
export type Mover = {
  id: number;
  kind: MoverKind;
  /** Caja en el centro del recorrido (el guante: guardado en la pared). */
  box: Box;
  axis: "x" | "z";
  amplitude: number;
  period: number;
  phase: number;
  floor: number;
  /** Martillo: largo de la soga (m). */
  length?: number;
};

/** Ventilador: cuando sopla, empuja hacia `dir`. */
export type Wind = Box & { id: number; dirX: number; dirZ: number; period: number; phase: number; floor: number };

/** Cañón de espuma: dispara pelotas en línea recta cada `period` segundos. */
export type Cannon = {
  id: number;
  x: number;
  y: number;
  z: number;
  /** Dirección del tiro (unitaria). */
  dx: number;
  dy: number;
  dz: number;
  range: number;
  speed: number;
  period: number;
  phase: number;
  floor: number;
};

/** Géiser: un chorro que sale de una plataforma y te sube. */
export type Geyser = Box & { id: number; period: number; phase: number; floor: number };

/** Red para trepar: la zona delante de la cara de una columna. */
export type Net = Box & { id: number; floor: number; pillar: number };

/** Lugar donde puede aparecer una ficha (camino) o un objeto (cornisa). */
export type Spot = Vec3 & { id: number; floor: number; ledge: boolean };

/**
 * Estrella dorada escondida: tres por piso, fuera del camino. Una vez que la
 * tocás queda encontrada para siempre (aunque después te caigas).
 * - "high": arriba de una plataforma, hay que saltar para agarrarla.
 * - "out": flotando sobre la pileta: te tirás por ella (y seguro caés).
 * - "skill": arriba de una cama elástica (solo con súper rebote) o de una cornisa.
 */
export type StarKind = "high" | "out" | "skill";
export type Star = Vec3 & { id: number; floor: number; kind: StarKind };

export type Theme = "warmup" | "soap" | "bounce" | "balls" | "hammers" | "nets" | "geysers" | "sky";

export type Floor = {
  index: number;
  name: string;
  theme: Theme;
  bottom: number;
  top: number;
  /** Altura de salto necesaria para el escalón más alto del piso (m). */
  needJump: number;
};

/** Un paso del camino, en orden de abajo para arriba (bloque fijo o nube). */
export type PathStep = { kind: "block" | "mover"; id: number; floor: number };

export type Tower = {
  blocks: Block[];
  path: PathStep[];
  movers: Mover[];
  winds: Wind[];
  cannons: Cannon[];
  geysers: Geyser[];
  nets: Net[];
  spots: Spot[];
  stars: Star[];
  floors: Floor[];
  /** Altura de la cima (la Copa). */
  top: number;
  /** Alturas de los descansos, de abajo para arriba. */
  rests: number[];
  /** Centro de cada descanso (donde te deja el ascensor). */
  restSpots: Vec3[];
  start: Vec3;
  kiosk: Vec3;
  elevator: Box;
  /** La fachada de la torre (no se atraviesa). */
  wall: Box;
};

/** Media fachada (m). */
export const WALL_HALF = 12.5;
/** Las plataformas comunes van de -EDGE a EDGE en x. */
const EDGE = 11.5;
/** Centro de cada carril en z: pegado a la pared, o más afuera. */
const LANE_Z: readonly (readonly [number, number])[] = [
  [1.35, 1.75],
  [4.5, 4.9],
];
const THICK = 0.5;
const REST_WIDTH = 4.4;
/** Los descansos ocupan todo su carril (en z). */
const REST_Z: readonly (readonly [number, number])[] = [
  [0.3, 3.0],
  [3.4, 6.1],
];

/** Lo que te lanza para arriba: el paso siguiente puede estar mucho más alto. */
const BUBBLE_RISE: readonly [number, number] = [2.6, 2.9];
const TRAMPOLINE_RISE: readonly [number, number] = [3.0, 3.5];
const GEYSER_RISE: readonly [number, number] = [3.0, 3.6];
/** Alto de las columnas con red. */
const NET_RISE: readonly [number, number] = [3.4, 4.4];

type Beat =
  | "step"
  | "soap"
  | "conveyor"
  | "trampoline"
  | "crumble"
  | "ball"
  | "fan"
  | "hammer"
  | "piston"
  | "sweeper"
  | "net"
  | "geyser"
  | "bubble"
  | "cloud"
  | "spinner"
  | "blink";

type FloorDef = {
  name: string;
  theme: Theme;
  /** Subida común entre plataformas (m). */
  rise: readonly [number, number];
  /** Cada tres subidas comunes, una más alta: es la que pide mejoras de salto. */
  tall?: readonly [number, number];
  /** Hueco entre plataformas (m). */
  gap: readonly [number, number];
  size: readonly [number, number];
  /** Lo especial del piso, en ronda. Si uno no entra donde toca, pasa al paso siguiente. */
  specials: readonly Beat[];
  /** Alto del piso (m): los que tienen lanzamientos y redes son más altos. */
  height: number;
};

const FLOOR_DEFS: readonly FloorDef[] = [
  { name: "Calentamiento", theme: "warmup", rise: [0.5, 0.9], gap: [0.7, 1.3], size: [2.2, 2.6], specials: ["step"], height: 10 },
  { name: "Jabón y cintas", theme: "soap", rise: [0.6, 1.0], gap: [0.8, 1.3], size: [2.0, 2.5], specials: ["soap", "conveyor", "soap", "step"], height: 10 },
  { name: "Camas elásticas", theme: "bounce", rise: [0.6, 1.0], tall: [1.1, 1.25], gap: [0.8, 1.3], size: [2.0, 2.4], specials: ["trampoline", "crumble", "crumble", "trampoline", "crumble", "step"], height: 14 },
  { name: "Bolas rojas", theme: "balls", rise: [0.6, 1.0], tall: [1.1, 1.3], gap: [0.9, 1.3], size: [2.0, 2.3], specials: ["ball", "ball", "ball", "fan", "step", "fan"], height: 10 },
  // Desde acá las subidas altas piden mejoras de salto.
  { name: "Martillos y guantes", theme: "hammers", rise: [0.7, 1.1], tall: [1.62, 1.7], gap: [0.9, 1.3], size: [2.2, 2.6], specials: ["hammer", "piston", "step", "sweeper", "piston"], height: 12 },
  { name: "Redes y cañones", theme: "nets", rise: [0.7, 1.1], tall: [1.8, 1.88], gap: [0.9, 1.3], size: [2.1, 2.5], specials: ["net", "step", "net", "step"], height: 15 },
  { name: "Géiseres y burbujas", theme: "geysers", rise: [0.8, 1.2], tall: [1.8, 1.88], gap: [0.9, 1.3], size: [2.0, 2.4], specials: ["geyser", "bubble", "step", "geyser", "step"], height: 15 },
  { name: "Nubes y calesitas", theme: "sky", rise: [0.8, 1.2], tall: [1.8, 1.88], gap: [1.0, 1.4], size: [2.0, 2.3], specials: ["cloud", "spinner", "blink", "step"], height: 12 },
];

/** Altura de la cima (la suma de los pisos). */
export const TOWER_TOP = FLOOR_DEFS.reduce((sum, f) => sum + f.height, 0);

const LAUNCH_RISE: Partial<Record<Beat, readonly [number, number]>> = {
  trampoline: TRAMPOLINE_RISE,
  geyser: GEYSER_RISE,
  bubble: BUBBLE_RISE,
};

const box = (cx: number, top: number, cz: number, sx: number, sz: number, thick = THICK): Box => ({
  minX: cx - sx / 2,
  maxX: cx + sx / 2,
  minY: top - thick,
  maxY: top,
  minZ: cz - sz / 2,
  maxZ: cz + sz / 2,
});

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const centerOf = (b: Box): Vec3 => ({ x: (b.minX + b.maxX) / 2, y: b.maxY, z: (b.minZ + b.maxZ) / 2 });

export function buildTower(seed = 7): Tower {
  const random = mulberry32(seed);
  const between = ([a, b]: readonly [number, number]) => a + (b - a) * random();
  const blocks: Block[] = [];
  const movers: Mover[] = [];
  const winds: Wind[] = [];
  const cannons: Cannon[] = [];
  const geysers: Geyser[] = [];
  const nets: Net[] = [];
  const spots: Spot[] = [];
  const floors: Floor[] = [];
  const rests: number[] = [];
  const restSpots: Vec3[] = [];
  const path: PathStep[] = [];
  let id = 1;
  const add = (b: Box, kind: BlockKind, floor: number, extra: Partial<Block> = {}) => {
    const block: Block = { ...b, ...extra, id: id++, kind, floor };
    blocks.push(block);
    return block;
  };

  const top = TOWER_TOP;
  // La orilla, a la izquierda de la torre: kiosco y ascensor.
  const deck = add({ minX: -25, maxX: -13.5, minY: -1, maxY: 0, minZ: 0.3, maxZ: 7 }, "deck", -1);
  const elevator = { minX: -16.4, maxX: -14.6, minY: -0.02, maxY: 0.04, minZ: 5.0, maxZ: 6.6 };
  add(elevator, "elevator", -1);
  const wall: Box = { minX: -WALL_HALF, maxX: WALL_HALF, minY: -1, maxY: top + 6, minZ: -7, maxZ: 0 };
  add(wall, "wall", -1);

  let dir: 1 | -1 = 1;
  let lane = 1;
  let y = 0;
  let prev: Box = deck;
  /** La próxima plataforma sigue de largo sí o sí (la primera, y la que sale de un descanso). */
  let straight = true;

  const laneZ = (depth: number) => Math.max(depth / 2 + 0.2, between(LANE_Z[lane]));
  const nextX = (size: number, gap: number) => (dir > 0 ? prev.maxX : prev.minX) + dir * (gap + size / 2);
  const fits = (size: number, gap: number) => straight || Math.abs(nextX(size, gap)) + size / 2 <= EDGE;
  /** Dónde va la próxima plataforma: sigue de largo si entra; si no, da la vuelta (otro carril, mismo lugar). */
  const place = (size: number, gap: number, depth: number, zGap: readonly [number, number]) => {
    if (fits(size, gap)) {
      straight = false;
      return { cx: nextX(size, gap), cz: laneZ(depth) };
    }
    dir = dir > 0 ? -1 : 1;
    lane = 1 - lane;
    const dz = between(zGap);
    const cz = lane === 1 ? prev.maxZ + dz + depth / 2 : prev.minZ - dz - depth / 2;
    const px = (prev.minX + prev.maxX) / 2;
    return { cx: clamp(px, -EDGE + size / 2, EDGE - size / 2), cz: Math.max(depth / 2 + 0.2, cz) };
  };

  let bottom = 0;
  FLOOR_DEFS.forEach((def, index) => {
    const floorTop = bottom + def.height;
    let maxRise = 0;
    let n = 0;
    /** El paso anterior te lanza (cama elástica, géiser, burbuja): este puede estar bien alto. */
    let launch: readonly [number, number] | null = null;

    let special = 0;
    let common = 0;
    const maxStep = def.tall ? def.tall[1] : def.rise[1];
    while (floorTop - y > maxStep) {
      n++;
      // El primer paso de cada piso es común; después, lo especial en ronda.
      const wanted: Beat = n === 1 ? "step" : def.specials[special % def.specials.length];
      let beat = wanted;
      const launched = launch !== null;
      if (launched && (beat === "ball" || beat === "cloud" || beat === "blink" || beat === "net")) beat = "step";
      const tall = !launched && beat !== "ball" && def.tall !== undefined && ++common % 3 === 0;
      let rise = launched ? between(launch!) : beat === "ball" ? between([0.25, 0.6]) : between(tall ? def.tall! : def.rise);
      launch = null;
      // No pasarse del descanso: lo que falte tiene que ser una subida posible.
      if (!launched && floorTop - (y + rise) < def.rise[0] * 0.5) rise = Math.min(maxStep, (floorTop - y) / 2);
      // Después de un lanzamiento el hueco es más grande: así no te das la cabeza al subir.
      const gap = launched ? between([1.0, 1.4]) : beat === "ball" ? between([1.1, 1.5]) : between(def.gap);
      // Lo que lanza (o la red) solo si después queda lugar en el piso; la red, sin dar la vuelta.
      const big = LAUNCH_RISE[beat];
      if (big && floorTop - (y + rise) < big[1] + 0.4) beat = "step";
      if (beat === "net" && (floorTop - (y + rise) < NET_RISE[1] + 0.4 || !fits(2.2, gap))) beat = "step";
      // Si lo especial no entró, queda para el paso siguiente.
      if (n > 1 && (beat === wanted || wanted === "step")) special++;
      if (!launched) maxRise = Math.max(maxRise, rise);
      y += rise;

      let size = between(def.size);
      let depth = size;
      if (beat === "conveyor") {
        size = 3.0;
        depth = 1.7;
      } else if (beat === "trampoline") size = depth = 1.9;
      else if (beat === "ball") size = depth = 1.4;
      else if (beat === "spinner") size = depth = 2.4;
      else if (beat === "net") {
        size = 2.2;
        depth = 1.6;
      }

      const { cx, cz } = place(size, gap, depth, launched ? [1.0, 1.4] : [0.35, 0.7]);
      let here: Box;
      let pathId: PathStep;

      if (beat === "cloud") {
        here = box(cx, y, cz, size, depth, 0.6);
        const cloudId = id++;
        movers.push({ id: cloudId, kind: "cloud", box: here, axis: "x", amplitude: 0.9 + random() * 0.3, period: 3 + random() * 1.5, phase: random() * Math.PI * 2, floor: index });
        pathId = { kind: "mover", id: cloudId, floor: index };
      } else if (beat === "net") {
        // El pie (delante) y la columna con la red en la cara de adelante.
        const foot = add(box(cx, y, cz + depth / 2 + 0.8, size, 1.6), "normal", index);
        path.push({ kind: "block", id: foot.id, floor: index });
        const height = between(NET_RISE);
        const pillar = add({ minX: cx - size / 2, maxX: cx + size / 2, minY: y - THICK, maxY: y + height, minZ: cz - depth / 2, maxZ: cz + depth / 2 }, "pillar", index);
        // Baranda atrás, arriba de la columna: subiste trepando, no te caés para atrás.
        add({ minX: pillar.minX, maxX: pillar.maxX, minY: pillar.maxY, maxY: pillar.maxY + 0.7, minZ: pillar.minZ, maxZ: pillar.minZ + 0.25 }, "rail", index);
        nets.push({ id: id++, floor: index, pillar: pillar.id, minX: pillar.minX, maxX: pillar.maxX, minY: y - 0.1, maxY: pillar.maxY, minZ: pillar.maxZ - 0.05, maxZ: pillar.maxZ + 0.8 });
        y += height;
        here = pillar;
        pathId = { kind: "block", id: pillar.id, floor: index };
      } else {
        const kind: BlockKind =
          beat === "soap" ? "soap"
          : beat === "conveyor" ? "conveyor"
          : beat === "trampoline" ? "trampoline"
          : beat === "crumble" ? "crumble"
          : beat === "ball" ? "ball"
          : beat === "bubble" ? "bubble"
          : beat === "spinner" ? "spinner"
          : beat === "blink" ? "blink"
          : "normal";
        const extra: Partial<Block> = {};
        if (kind === "conveyor") extra.belt = (random() < 0.5 ? 1 : -1) * 2.2;
        if (kind === "spinner") extra.spin = (random() < 0.5 ? 1 : -1) * (0.8 + random() * 0.4);
        if (kind === "blink") {
          extra.period = 3 + random() * 0.6;
          extra.phase = random();
        }
        const thick = kind === "trampoline" ? 0.35 : kind === "ball" ? 0.6 : THICK;
        const block = add(box(cx, y, cz, size, depth, thick), kind, index, extra);
        here = block;
        pathId = { kind: "block", id: block.id, floor: index };
        if (LAUNCH_RISE[beat]) launch = LAUNCH_RISE[beat]!;

        if (beat === "geyser") {
          const rise = launch!;
          geysers.push({ id: id++, floor: index, period: 3.2 + random() * 0.6, phase: random(), minX: cx - 0.7, maxX: cx + 0.7, minZ: cz - 0.7, maxZ: cz + 0.7, minY: y, maxY: y + rise[1] + 2 });
        }
        if (beat === "fan") {
          // Ventilador: para afuera (a la pileta) o en contra del camino.
          const out = n % 12 === 4;
          winds.push({ id: id++, ...box(cx, y + 3, cz, size + 1, depth + 1, 3.2), dirX: out ? 0 : -dir, dirZ: out ? 1 : 0, period: 3.4 + random(), phase: random() * Math.PI * 2, floor: index });
        }
        if (beat === "hammer" || (beat === "piston" && cz > 3)) {
          // Martillo de goma colgado: va y viene a lo largo del camino.
          const length = 3.2;
          movers.push({ id: id++, kind: "hammer", box: { minX: cx - 0.45, maxX: cx + 0.45, minY: y + 0.35, maxY: y + 1.35, minZ: cz - 0.65, maxZ: cz + 0.65 }, axis: "x", amplitude: size / 2 + 0.5, period: 2.4 + random() * 0.8, phase: random() * Math.PI * 2, floor: index, length });
        } else if (beat === "piston") {
          // Guante de box: guardado en la pared, sale hasta el borde de afuera de la plataforma.
          const reach = block.maxZ - 0.35;
          movers.push({ id: id++, kind: "piston", box: { minX: cx - 0.55, maxX: cx + 0.55, minY: y + 0.2, maxY: y + 1.3, minZ: -1.3, maxZ: -0.1 }, axis: "z", amplitude: reach + 0.1, period: 2.6 + random() * 0.8, phase: random(), floor: index });
        } else if (def.theme === "nets" && beat === "step" && n > 1) {
          // Cañón de espuma en la pared: tira para afuera, por arriba de la plataforma.
          cannons.push({ id: id++, x: cx, y: y + 0.9, z: 0.2, dx: 0, dy: 0, dz: 1, range: block.maxZ + 1.5, speed: 7.5, period: 2.4 + random() * 0.6, phase: random(), floor: index });
        } else if (beat === "sweeper") {
          // Barredora que cruza de la pared para afuera.
          movers.push({ id: id++, kind: "sweeper", box: { minX: cx - size / 2 - 0.2, maxX: cx + size / 2 + 0.2, minY: y + 0.15, maxY: y + 0.75, minZ: cz - 0.25, maxZ: cz + 0.25 }, axis: "z", amplitude: depth / 2 + 0.3, period: 2.2 + random() * 0.8, phase: random() * Math.PI * 2, floor: index });
        }
      }
      path.push(pathId);
      prev = here;

      // Fichas en el camino (una cada dos pasos).
      if (n % 2 === 0) spots.push({ id: id++, x: cx, y: here.maxY + 0.6, z: (here.minZ + here.maxZ) / 2, floor: index, ledge: false });
      // Cornisas en el otro carril, con premio.
      // Solo cerca del medio: así las filas que pasan por arriba y por abajo quedan lejos.
      if (n % 5 === 3 && def.theme !== "sky" && beat !== "net" && Math.abs(cx) < 5.5) {
        const lz = cz < 3 ? 5.1 : 1.0;
        add(box(cx, y + 0.7, lz, 1.4, 1.4), "ledge", index);
        spots.push({ id: id++, x: cx, y: y + 1.2, z: lz, floor: index, ledge: true });
      }
    }

    // Descanso al final del piso: una plataforma ancha en su carril. Siempre
    // sigue de largo (en las puntas queda como balcón).
    maxRise = Math.max(maxRise, floorTop - y);
    y = floorTop;
    const gap = between(def.gap);
    const edge = dir > 0 ? prev.maxX : prev.minX;
    const rx = edge + dir * (gap + REST_WIDTH / 2);
    const last = index === FLOOR_DEFS.length - 1;
    const rest = add({ minX: rx - REST_WIDTH / 2, maxX: rx + REST_WIDTH / 2, minY: y - THICK, maxY: y, minZ: REST_Z[lane][0], maxZ: REST_Z[lane][1] }, last ? "goal" : "rest", index);
    path.push({ kind: "block", id: rest.id, floor: index });
    rests.push(floorTop);
    restSpots.push(centerOf(rest));
    prev = rest;
    straight = true;
    // En las puntas da la vuelta: otro sentido y otro carril (si no, pasaría por arriba de la fila de recién).
    if (Math.abs(rx) + REST_WIDTH / 2 > EDGE) {
      dir = dir > 0 ? -1 : 1;
      lane = 1 - lane;
    }
    floors.push({ index, name: def.name, theme: def.theme, bottom, top: floorTop, needJump: maxRise + 0.12 });
    bottom = floorTop;
  });

  const stars = hideStars(blocks, path, floors, () => id++);

  return {
    blocks,
    path,
    movers,
    winds,
    cannons,
    geysers,
    nets,
    spots,
    stars,
    floors,
    top,
    rests,
    restSpots,
    start: { x: -17, y: 0, z: 3.6 },
    kiosk: { x: -22.5, y: 0, z: 1.8 },
    elevator,
    wall,
  };
}

/** Las tres estrellas de cada piso (ver `Star`), en lugares con aire libre arriba. */
function hideStars(blocks: Block[], path: PathStep[], floors: Floor[], nextId: () => number): Star[] {
  const stars: Star[] = [];
  const byId = new Map(blocks.map((b) => [b.id, b]));
  /** ¿No hay ningún bloque en esta columna de aire (para saltar hasta ahí y que la estrella no quede adentro)? */
  const clear = (x: number, z: number, y0: number, y1: number, r = 0.9) =>
    !blocks.some((b) => b.maxY > y0 && b.minY < y1 && b.minX < x + r && b.maxX > x - r && b.minZ < z + r && b.maxZ > z - r);
  /** El primero de la lista (empezando cerca de `k`) que cumpla. */
  const pick = <T,>(list: T[], k: number, ok: (t: T) => boolean): T | undefined => {
    const start = Math.floor(list.length * k);
    for (let i = 0; i < list.length; i++) {
      const t = list[(start + i) % list.length];
      if (ok(t)) return t;
    }
    return undefined;
  };
  for (const floor of floors) {
    const steps = path.filter((s) => s.floor === floor.index && s.kind === "block").map((s) => byId.get(s.id)!);
    const plain = steps.filter((b) => b.kind === "normal");
    const above = (b: Block, h: number) => clear((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, b.maxY + 0.05, b.maxY + h + 0.6);
    // Alta: hay que saltar desde la plataforma.
    const high = pick(plain, 0.3, (b) => above(b, 3.4))!;
    stars.push({ id: nextId(), floor: floor.index, kind: "high", ...centerOf(high), y: high.maxY + 3.4 });
    // Afuera: sobre la pileta, delante de una plataforma del carril de afuera.
    const outer = plain.filter((b) => (b.minZ + b.maxZ) / 2 > 3);
    const outOk = (b: Block) => clear((b.minX + b.maxX) / 2, b.maxZ + 1.8, b.maxY - 2, b.maxY + 3) && b !== high;
    const out = pick(outer, 0.6, outOk) ?? pick(plain, 0.6, outOk)!;
    stars.push({ id: nextId(), floor: floor.index, kind: "out", x: (out.minX + out.maxX) / 2, y: out.maxY + 1.2, z: out.maxZ + 1.8 });
    // De destreza: arriba de una cama elástica (súper rebote) o de una cornisa.
    const tramp = steps.find((b) => b.kind === "trampoline" && above(b, 6.6));
    const ledge = blocks.find((b) => b.kind === "ledge" && b.floor === floor.index && above(b, 2.6));
    const other = pick(plain, 0.8, (b) => b !== high && b !== out && above(b, 3.4))!;
    const spot = tramp ? { ...centerOf(tramp), y: tramp.maxY + 6.6 } : ledge ? { ...centerOf(ledge), y: ledge.maxY + 2.6 } : { ...centerOf(other), y: other.maxY + 3.4 };
    stars.push({ id: nextId(), floor: floor.index, kind: "skill", ...spot });
  }
  return stars;
}

const frac = (v: number) => ((v % 1) + 1) % 1;

/** Cuánto salió el guante (0 guardado, 1 afuera): sale rápido, espera y vuelve. */
export function punch(t: number, period: number, phase: number): number {
  const u = frac(t / period + phase);
  if (u < 0.1) return u / 0.1;
  if (u < 0.3) return 1;
  if (u < 0.55) return 1 - (u - 0.3) / 0.25;
  return 0;
}

/** Desplazamiento de un móvil en el tiempo `t`. */
export function moverOffset(m: Mover, t: number): number {
  if (m.kind === "piston") return m.amplitude * punch(t, m.period, m.phase);
  return m.amplitude * Math.sin((t / m.period) * Math.PI * 2 + m.phase);
}

/** Velocidad del móvil a lo largo de su eje (para saber para dónde te tira). */
export function moverVelocity(m: Mover, t: number): number {
  const h = 1 / 240;
  return (moverOffset(m, t + h) - moverOffset(m, t - h)) / (2 * h);
}

export function moverBox(m: Mover, t: number): Box {
  const d = moverOffset(m, t);
  // El martillo es un péndulo: en las puntas sube un poco.
  const lift = m.kind === "hammer" && m.length ? m.length - Math.sqrt(Math.max(0, m.length * m.length - d * d)) : 0;
  const moved = m.axis === "x" ? { ...m.box, minX: m.box.minX + d, maxX: m.box.maxX + d } : { ...m.box, minZ: m.box.minZ + d, maxZ: m.box.maxZ + d };
  return lift ? { ...moved, minY: moved.minY + lift, maxY: moved.maxY + lift } : moved;
}

/** ¿Sopla el ventilador ahora? (ráfagas: un rato sí, un rato no). */
export function windBlowing(w: Wind, t: number): boolean {
  return Math.sin((t / w.period) * Math.PI * 2 + w.phase) > 0.15;
}

/** ¿Está la plataforma parpadeante? */
export const blinkOn = (b: Block, t: number) => frac(t / (b.period ?? 3) + (b.phase ?? 0)) < 0.68;
/** Cuánto falta para que desaparezca (0 a 1; 1 = recién apareció). */
export const blinkLeft = (b: Block, t: number) => Math.max(0, 1 - frac(t / (b.period ?? 3) + (b.phase ?? 0)) / 0.68);

/** Momento del ciclo del géiser (0 a 1): sale fuerte al principio y avisa al final. */
export const geyserPhase = (g: Geyser, t: number) => frac(t / g.period + g.phase);
export const geyserOn = (g: Geyser, t: number) => geyserPhase(g, t) < 0.42;
export const geyserWarn = (g: Geyser, t: number) => geyserPhase(g, t) > 0.8;

export const CANNON_BALL = 0.4;

/** Dónde está la pelota del cañón ahora (null si no hay ninguna en el aire). */
export function cannonBall(c: Cannon, t: number): Vec3 | null {
  const travel = frac(t / c.period + c.phase) * c.period * c.speed;
  if (travel > c.range) return null;
  return { x: c.x + c.dx * travel, y: c.y + c.dy * travel, z: c.z + c.dz * travel };
}

export function floorAt(tower: Tower, y: number): number {
  const i = tower.floors.findIndex((f) => y < f.top + 0.5);
  return i < 0 ? tower.floors.length - 1 : i;
}
