import type { MinigameId } from "@/bridge/events";
import { type Medal, medalFor, type Standing } from "./participants";

/** Lo que dice el presentador al presentar cada prueba. */
const INTRO: Record<MinigameId, string> = {
  slippery_bridge: "¡Arrancamos con el Puente Resbaladizo! Le pusimos jabón de más... sin querer.",
  rolling_log: "¡Llegó El Tronco Loco! Atentos al crujido: cuando cruje, cambia de lado.",
  mattress: "¡Llegó El Colchón! Atajen a los que se tiran de la torre... y salten juntos, que rebota el doble.",
};

/** El Colchón: cada ronda tiene su presentación. */
const MATTRESS_INTRO: Record<number, string> = {
  1: INTRO.mattress,
  2: "¡Ronda dos: lluvia de globos! El que se empapa se pone lento... cuidado con la cabeza.",
  3: "¡Última ronda: la barrera! Salten los rodillos sin soltar el colchón. ¡Y hay jabón!",
};

const LAST = "¡Última prueba! Ya saben: el que se cae, se moja.";

export function introLine(minigameId: MinigameId, slot: number, total: number): string {
  if (minigameId === "mattress") return MATTRESS_INTRO[slot] ?? INTRO.mattress;
  return slot === total && slot > 1 ? `${LAST} ${INTRO[minigameId]}` : INTRO[minigameId];
}

const MEDAL_LINE: Record<NonNullable<Medal> | "none", string> = {
  gold: "¡Medalla de oro! Este equipo es una máquina de rebotar.",
  silver: "¡Plata! Un par de chapuzones nomás. Se puede más.",
  bronze: "Bronce... hay que saltar más juntos, eh.",
  none: "Uy, hubo más agua que rebotes. ¡A remontar en la que viene!",
};

/** El comentario de la tabla en equipo: según la medalla de la ronda. */
export function teamLine(roundScore: number, total: number, isLast: boolean): string {
  if (isLast) {
    return total >= 2100
      ? `¡${total} puntos entre todos! ¡Qué equipazo, señoras y señores!`
      : `¡Terminamos! ${total} puntos entre todos. Mañana, revancha.`;
  }
  return MEDAL_LINE[medalFor(roundScore) ?? "none"];
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
