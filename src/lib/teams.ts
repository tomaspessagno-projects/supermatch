// Debe coincidir con public.teams (supabase/migrations/20261007000000_init.sql)
export const TEAMS = [
  { id: "red", name: "Equipo Rojo", color: "#E63946" },
  { id: "blue", name: "Equipo Azul", color: "#1D4ED8" },
  { id: "yellow", name: "Equipo Amarillo", color: "#FACC15" },
  { id: "green", name: "Equipo Verde", color: "#16A34A" },
] as const;

export type Team = (typeof TEAMS)[number];
export type TeamId = Team["id"];

export function getTeam(id: TeamId): Team {
  return TEAMS.find((team) => team.id === id)!;
}
