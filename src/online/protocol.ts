import type { RunSlot } from "@/bridge/events";
import type { EpisodeKind, Participant } from "@/lib/participants";
import { TEAMS } from "@/lib/teams";
import type { Member } from "./channel";

/**
 * Mensajes de una sala. Pocos y chicos: el plan gratis de Supabase deja 100
 * mensajes por segundo en todo el proyecto (enviados + recibidos).
 */
export type NetMessage =
  /** El anfitrión arranca el episodio: quiénes juegan, semilla y largada de la prueba 1. */
  | { t: "start"; seed: number; players: Member[]; startIn: number; kind: EpisodeKind }
  /** El anfitrión programa la prueba `slot` dentro de `startIn` ms. */
  | { t: "go"; slot: RunSlot; startIn: number }
  /** Teclas de los ticks [from, from + n) de la prueba `slot`. */
  | { t: "in"; slot: RunSlot; from: number; data: string }
  /** Resultado propio de una prueba (el árbitro manda también el de los bots). */
  | { t: "res"; slot: RunSlot; score: number; durationMs: number; bots?: Record<string, number> }
  /** Emparejamiento: el que más esperaba armó una sala con estos jugadores. */
  | { t: "match"; code: string; ids: string[] };

export const MAX_PLAYERS = 4;
/** Cuenta regresiva 3, 2, 1 antes del silbato. */
export const COUNTDOWN_MS = 2100;
/** La presentación de la prueba arranca esto antes del silbato (cartel + cuenta). */
export const INTRO_LEAD_MS = 5500;
/** Cargar el juego + presentación + cuenta antes de la primera prueba. */
export const FIRST_START_IN_MS = 8000;
/** Tabla (~4 s) + presentación + cuenta antes de las siguientes. */
export const NEXT_START_IN_MS = 9500;
/**
 * Si alguien no manda su resultado, pasado este tiempo desde la largada queda
 * con 0 y la sala sigue. Una prueba dura 45 s más las cámaras lentas.
 */
export const SLOT_DEADLINE_MS = 75_000;
/** Cada cuánto se mandan las teclas juntadas (4 paquetes por segundo). */
export const INPUT_FLUSH_MS = 250;
/** Emparejamiento: con menos de 4, el más antiguo arma la sala pasado este tiempo. */
export const MATCH_WAIT_MS = 10_000;
/** Si nadie más aparece, se ofrece jugar contra la computadora. */
export const MATCH_GIVE_UP_MS = 15_000;
/** Carrera rápida: en la sala nueva se espera a los emparejados a lo sumo esto. */
export const QUICK_START_WAIT_MS = 4000;

/** El anfitrión es el que está hace más tiempo (si se va, toma la posta el siguiente). */
export function hostOf(members: readonly Member[]): Member | undefined {
  return [...members].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))[0];
}

/** Semilla de cada prueba a partir de la del episodio: igual en todas las compus. */
export function slotSeed(seed: number, slot: RunSlot): number {
  return (seed ^ Math.imul(slot, 0x9e3779b1)) >>> 0;
}

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I

export function roomCode(random: () => number = Math.random): string {
  return Array.from({ length: 5 }, () => CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)]).join("");
}

export function normalizeCode(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

/**
 * Decide el emparejamiento desde el punto de vista del que más espera:
 * con 4 arma ya; con 2 o 3, después de MATCH_WAIT_MS. Devuelve los ids o null.
 */
export function pickMatch(waiting: readonly Member[], now: number): string[] | null {
  const queue = [...waiting].sort((a, b) => a.joinedAt - b.joinedAt);
  if (queue.length >= MAX_PLAYERS) return queue.slice(0, MAX_PLAYERS).map((m) => m.id);
  const oldest = queue[0];
  if (queue.length >= 2 && oldest && now - oldest.joinedAt >= MATCH_WAIT_MS) return queue.map((m) => m.id);
  return null;
}

/**
 * Los 4 del episodio: las personas de la sala y, si faltan, bots de los
 * colores que no están (si están todos, de cualquiera). El orden es el mismo
 * en todas las compus.
 */
export function buildParticipants(players: readonly Member[], meId: string): Participant[] {
  const people: Participant[] = players.slice(0, MAX_PLAYERS).map((p) => ({
    id: p.id,
    name: p.nickname,
    team: p.team,
    kind: p.id === meId ? "me" : "remote",
  }));
  const used = new Set(people.map((p) => p.team));
  const free = TEAMS.filter((t) => !used.has(t.id));
  const pool = [...free, ...TEAMS];
  const bots: Participant[] = [];
  for (let i = 0; people.length + bots.length < MAX_PLAYERS; i++) {
    const team = pool[i % pool.length];
    bots.push({ id: `cpu-${i}-${team.id}`, name: `CPU ${team.name.replace(/^Equipo /, "")}`, team: team.id, kind: "bot" });
  }
  return [...people, ...bots];
}

/** ¿Ya se puede programar la prueba siguiente? Cuando todas las personas mandaron su resultado. */
export function slotDone(
  slot: RunSlot,
  humans: readonly string[],
  results: Readonly<Record<string, Partial<Record<RunSlot, unknown>>>>,
): boolean {
  return humans.every((id) => results[id]?.[slot] !== undefined);
}
