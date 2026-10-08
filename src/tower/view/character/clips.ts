import { type Clip, CLIPS } from "./state";

/**
 * Cómo se llaman las animaciones dentro del GLB del personaje. Se compara sin
 * mayúsculas, espacios ni símbolos, y sin lo que va antes de "|" (Blender
 * exporta "Armature|Run"). Lo ideal es usar el primer nombre de cada lista;
 * los otros son los nombres de Mixamo para no tener que renombrar.
 */
export const CLIP_NAMES: Record<Clip, readonly string[]> = {
  idle: ["idle", "breathingidle", "happyidle", "standing"],
  run: ["run", "running", "fastrun", "jog", "jogging"],
  skate: ["skate", "slide", "skating"],
  jump: ["jump", "jumpup", "jumping"],
  fall: ["fall", "falling", "fallingidle", "fallidle"],
  flip: ["flip", "frontflip", "doublejump", "somersault"],
  glide: ["glide", "gliding", "float", "floating"],
  hang: ["hang", "hangingidle", "hanging", "bracedhang", "idlehang"],
  shimmy: ["shimmy", "bracedhangshimmy", "hangingshimmy", "leftshimmy", "rightshimmy"],
  pullUp: ["pullup", "bracedhangtocrouch", "climbingtocrouch", "freehangclimb", "climbup"],
  climb: ["climb", "climbingladder", "climbing", "climbingup", "ladder"],
  lifted: ["lifted", "flying", "fly"],
  slip: ["slip", "tired", "exhausted", "stumble", "dizzy"],
  hit: ["hit", "hurt", "knockback", "reactionhit", "bigsidehit", "fallingbackdeath"],
  swim: ["swim", "swimming", "treadingwater", "treading"],
  cheer: ["cheer", "victory", "celebrate", "wave", "dance", "thumbsup", "yes"],
  teeter: ["teeter", "balance", "losingbalance", "edge"],
};

/** Si falta una animación, cuál usar en su lugar (en orden). */
const FALLBACK: Record<Clip, readonly Clip[]> = {
  idle: [],
  run: ["idle"],
  skate: ["run", "idle"],
  jump: ["fall", "idle"],
  fall: ["jump", "idle"],
  flip: ["jump", "fall", "idle"],
  glide: ["fall", "jump", "idle"],
  hang: ["climb", "fall", "idle"],
  shimmy: ["hang", "climb", "fall", "idle"],
  pullUp: ["climb", "jump", "idle"],
  climb: ["hang", "jump", "idle"],
  lifted: ["fall", "jump", "idle"],
  slip: ["fall", "idle"],
  hit: ["fall", "idle"],
  swim: ["fall", "idle"],
  cheer: ["idle"],
  teeter: ["idle"],
};

/** Cómo se reproduce cada una: en ciclo, una vez (y queda en el último cuadro) o manejada por la simulación. */
export const CLIP_PLAY: Record<Clip, "loop" | "once" | "scrub"> = {
  idle: "loop", run: "loop", skate: "loop", jump: "once", fall: "loop", flip: "once", glide: "loop",
  hang: "loop", shimmy: "loop", pullUp: "scrub", climb: "loop", lifted: "loop",
  slip: "loop", hit: "loop", swim: "loop", cheer: "loop", teeter: "loop",
};

export const normalizeClipName = (name: string) => (name.split("|").pop() ?? name).toLowerCase().replace(/[^a-z0-9]/g, "");

/** Qué animación del archivo usar para cada estado (null si el archivo no trae ninguna). */
export function resolveClips(available: readonly string[]): Record<Clip, string | null> {
  const byName = new Map<string, string>();
  for (const name of available) if (!byName.has(normalizeClipName(name))) byName.set(normalizeClipName(name), name);
  const direct = (clip: Clip) => {
    for (const alias of CLIP_NAMES[clip]) {
      const found = byName.get(alias);
      if (found) return found;
    }
    return null;
  };
  // Si falta, la parecida (y si esa también falta, la parecida de esa).
  const resolve = (clip: Clip, seen: readonly Clip[]): string | null => {
    let name = direct(clip);
    for (const other of FALLBACK[clip]) if (!seen.includes(other)) name ??= resolve(other, [...seen, clip]);
    return name;
  };
  const out = {} as Record<Clip, string | null>;
  for (const clip of CLIPS) out[clip] = resolve(clip, []) ?? available[0] ?? null;
  return out;
}
