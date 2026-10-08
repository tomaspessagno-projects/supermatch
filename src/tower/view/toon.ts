import * as THREE from "three";

/**
 * Estilo "toon con bloques": colores planos con tres tonos de luz y contorno
 * grueso violeta oscuro, como el arte 2D del programa.
 */

export const INK = "#1f1147";

export const PALETTE = {
  pink: "#f472b6",
  pinkDark: "#db2777",
  yellow: "#facc15",
  cyan: "#22d3ee",
  white: "#f8fafc",
  purple: "#8b5cf6",
  green: "#4ade80",
  red: "#ef4444",
  orange: "#fb923c",
  gold: "#fbbf24",
  skin: "#f7c19d",
  hair: "#7c4a2d",
  soap: "#e0f2fe",
  water: "#22d3ee",
  deck: "#e2e8f0",
} as const;

let gradient: THREE.DataTexture | null = null;

/** Rampa de 3 tonos para MeshToonMaterial (sombra, medio, luz). */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const cache = new Map<string, THREE.MeshToonMaterial>();

/** Material toon compartido por color (uno por color en toda la escena). */
export function toon(color: string, extra?: { emissive?: string; transparent?: boolean; opacity?: number }): THREE.MeshToonMaterial {
  const key = `${color}|${extra?.emissive ?? ""}|${extra?.opacity ?? 1}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color,
      gradientMap: toonGradient(),
      emissive: extra?.emissive ?? "#000000",
      emissiveIntensity: extra?.emissive ? 0.6 : 0,
      transparent: extra?.transparent ?? false,
      opacity: extra?.opacity ?? 1,
    });
    cache.set(key, m);
  }
  return m;
}

/** Textura de rayas horizontales (para la columna inflable). */
export function stripes(a: string, b: string, bands = 8): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = bands * 16;
  const ctx = canvas.getContext("2d")!;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fillRect(0, i * 16, 4, 16);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
