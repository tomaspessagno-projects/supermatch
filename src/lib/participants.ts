import { getTeam, TEAMS, type TeamId } from "./teams";

/** Carrera: cada uno contra los otros tres. En equipo: los 4 juntos (El Colchón). */
export type EpisodeKind = "race" | "coop";

/** Uno de los 4 concursantes de un episodio: vos, una persona remota o un bot. */
export type Participant = {
  id: string;
  /** Lo que se lee en la tabla: el apodo de una persona, el equipo de un bot. */
  name: string;
  team: TeamId;
  kind: "me" | "remote" | "bot";
  /** Una persona que se fue de la sala a mitad del episodio. */
  left?: boolean;
};

/** Nombre corto del color: "Equipo Azul" → "Azul". */
export const shortTeamName = (team: TeamId) => getTeam(team).name.replace(/^Equipo /, "");

/** Jugando solo: vos y un bot de cada uno de los otros tres colores. */
export function soloParticipants(team: TeamId): Participant[] {
  return [
    { id: "me", name: getTeam(team).name, team, kind: "me" },
    ...TEAMS.filter((t) => t.id !== team).map((t): Participant => ({ id: `cpu-${t.id}`, name: t.name, team: t.id, kind: "bot" })),
  ];
}

/** Puntos por participante y prueba. Lo que falta todavía no llegó. */
export type Scores = Record<string, Partial<Record<1 | 2 | 3, number>>>;

export type Standing = { participant: Participant; total: number; gained?: number };

/**
 * La tabla: de más a menos puntos (a igualdad, el orden de la sala, que es el
 * mismo en todas las compus). `slot` agrega los puntos de esa prueba.
 */
export function standings(participants: readonly Participant[], scores: Scores, slot?: 1 | 2 | 3): Standing[] {
  return participants
    .map((participant, index) => {
      const mine = scores[participant.id] ?? {};
      const total = Object.values(mine).reduce<number>((sum, points) => sum + (points ?? 0), 0);
      return { participant, total, gained: slot ? mine[slot] : undefined, index };
    })
    .sort((a, b) => b.total - a.total || a.index - b.index)
    .map(({ participant, total, gained }) => ({ participant, total, gained }));
}

export type Medal = "gold" | "silver" | "bronze" | null;

/** Medalla de una ronda en equipo (0..1000 puntos). */
export function medalFor(score: number): Medal {
  if (score >= 750) return "gold";
  if (score >= 550) return "silver";
  if (score >= 350) return "bronze";
  return null;
}

export const MEDAL_LABEL: Record<NonNullable<Medal>, string> = { gold: "ORO", silver: "PLATA", bronze: "BRONCE" };
export const MEDAL_ICON: Record<NonNullable<Medal>, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" };
