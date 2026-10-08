import type { Modifier } from "./sim";

/**
 * Eventos en vivo: cada 5 minutos, durante 90 segundos, cambian las reglas.
 * Los elige el reloj (no hay servidor), así que son los mismos para todos los
 * que estén jugando en ese momento.
 */

export type LiveEvent = { id: Modifier; name: string; detail: string; emoji: string };

export const LIVE_EVENTS: readonly LiveEvent[] = [
  { id: "fame2", name: "¡Fama doble!", detail: "Todo lo que cobres vale el doble", emoji: "⭐" },
  { id: "lowgrav", name: "¡Gravedad lunar!", detail: "Saltás mucho más alto", emoji: "🌙" },
  { id: "chips2", name: "¡Fichas dobles!", detail: "Cada ficha vale el doble", emoji: "🪙" },
  { id: "gifts", name: "¡Lluvia de regalos!", detail: "Todas las cornisas tienen premio, y más mutaciones", emoji: "🎁" },
];

export const EVENT_EVERY_MS = 5 * 60_000;
export const EVENT_LENGTH_MS = 90_000;

const eventOf = (cycle: number) => LIVE_EVENTS[((cycle % LIVE_EVENTS.length) + LIVE_EVENTS.length) % LIVE_EVENTS.length];

/** El evento que está pasando ahora (y cuándo termina), o null. */
export function liveEventAt(now: number): { event: LiveEvent; endsAt: number } | null {
  const cycle = Math.floor(now / EVENT_EVERY_MS);
  const start = cycle * EVENT_EVERY_MS;
  if (now - start >= EVENT_LENGTH_MS) return null;
  return { event: eventOf(cycle), endsAt: start + EVENT_LENGTH_MS };
}

/** El próximo evento que empieza (después de `now`). */
export function nextEventAt(now: number): { event: LiveEvent; startsAt: number } {
  const cycle = Math.floor(now / EVENT_EVERY_MS) + 1;
  return { event: eventOf(cycle), startsAt: cycle * EVENT_EVERY_MS };
}
