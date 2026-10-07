import type { MinigameId } from "@/bridge/events";
import { getTeam, type TeamId } from "./teams";

/** Lo que dice el presentador al presentar cada prueba. */
const INTRO: Record<MinigameId, string> = {
  slippery_bridge: "¡Arrancamos con el Puente Resbaladizo! Le pusimos jabón de más... sin querer.",
  rolling_log: "¡Llegó El Tronco Loco! Atentos al crujido: cuando cruje, cambia de lado.",
};

const LAST = "¡Última prueba! Ya saben: el que se cae, se moja.";

export function introLine(minigameId: MinigameId, slot: number, total: number): string {
  return slot === total && slot > 1 ? `${LAST} ${INTRO[minigameId]}` : INTRO[minigameId];
}

/** El comentario de la tabla, según cómo viene tu equipo. */
export function tableLine(mine: TeamId, totals: Record<string, number>, isLast: boolean): string {
  const ranked = (Object.keys(totals) as TeamId[]).sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));
  const leader = ranked[0] ?? mine;
  const leaderName = getTeam(leader).name;
  const mineName = getTeam(mine).name;
  const gap = (totals[leader] ?? 0) - (totals[mine] ?? 0);

  if (isLast) {
    return leader === mine
      ? `¡Ganó ${mineName}! ¡Qué equipazo, señoras y señores!`
      : `¡Ganó ${leaderName}! Aplausos para ${mineName}... y revancha mañana.`;
  }
  if (leader === mine) return `¡${mineName} va primero! ¿Alguien los para?`;
  if (gap <= 150) return `¡Peleadísimo! ${leaderName} arriba por apenas ${gap} puntos.`;
  return `¡${leaderName} se escapa! A remontar, ${mineName}.`;
}
