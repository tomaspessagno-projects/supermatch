import type { MinigameId } from "@/bridge/events";
import type { Standing } from "./participants";

/** Lo que dice el presentador al presentar cada prueba. */
const INTRO: Record<MinigameId, string> = {
  slippery_bridge: "¡Arrancamos con el Puente Resbaladizo! Le pusimos jabón de más... sin querer.",
  rolling_log: "¡Llegó El Tronco Loco! Atentos al crujido: cuando cruje, cambia de lado.",
};

const LAST = "¡Última prueba! Ya saben: el que se cae, se moja.";

export function introLine(minigameId: MinigameId, slot: number, total: number): string {
  return slot === total && slot > 1 ? `${LAST} ${INTRO[minigameId]}` : INTRO[minigameId];
}

/**
 * El comentario de la tabla, según cómo venís. `table` va ordenada (primero
 * el que más tiene). Jugando solo los nombres son de equipos; online, apodos.
 */
export function tableLine(table: readonly Standing[], isLast: boolean): string {
  const leader = table[0];
  const mine = table.find((row) => row.participant.kind === "me") ?? leader;
  if (!leader || !mine) return "";
  const leaderName = leader.participant.name;
  const mineName = mine.participant.name;
  const gap = leader.total - mine.total;
  const first = leader === mine;

  if (isLast) {
    return first
      ? `¡Ganó ${mineName}! ¡Un aplauso enorme, señoras y señores!`
      : `¡Ganó ${leaderName}! Aplausos para ${mineName}... y revancha mañana.`;
  }
  if (first) return `¡${mineName} va primero! ¿Quién lo frena?`;
  if (gap <= 150) return `¡Peleadísimo! ${leaderName} arriba por apenas ${gap} puntos.`;
  return `¡${leaderName} se escapa! A remontar, ${mineName}.`;
}
