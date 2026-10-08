import { randomNickname } from "@/lib/nicknames";
import type { TeamId } from "@/lib/teams";
import { supabase } from "./client";

export type Profile = { nickname: string; team: TeamId };
export type TeamTotal = { team: TeamId; total: number; runs: number };

const UNIQUE_VIOLATION = "23505";

/** Perfil del jugador si ya tiene sesión y equipo; null si es la primera vez. */
export async function loadProfile(): Promise<Profile | null> {
  const db = supabase();
  const { data: auth } = await db.auth.getSession();
  if (!auth.session) return null;
  const { data, error } = await db
    .from("players")
    .select("nickname, team_id")
    .eq("id", auth.session.user.id)
    .maybeSingle();
  if (error) throw error;
  return data && { nickname: data.nickname, team: data.team_id as TeamId };
}

/**
 * Entra a un equipo con una sesión anónima. Si ya tenía equipo, la base no
 * deja cambiarlo y devuelve el que ya tenía.
 */
export async function joinTeam(team: TeamId): Promise<Profile> {
  const db = supabase();
  let { data: auth } = await db.auth.getSession();
  if (!auth.session) {
    const { data, error } = await db.auth.signInAnonymously();
    if (error) throw error;
    auth = data;
  }
  const userId = auth.session!.user.id;

  const nickname = randomNickname();
  const { error } = await db.from("players").insert({ id: userId, nickname, team_id: team });
  if (!error) return { nickname, team };
  if (error.code !== UNIQUE_VIOLATION) throw error;
  const existing = await loadProfile();
  if (!existing) throw error;
  return existing;
}

type TeamTotalRow = { team_id: string; total_score: number; runs_count: number };
const toTotal = (row: TeamTotalRow): TeamTotal => ({
  team: row.team_id as TeamId,
  total: Number(row.total_score),
  runs: row.runs_count,
});

export async function fetchTeamTotals(): Promise<TeamTotal[]> {
  const { data, error } = await supabase()
    .from("team_totals")
    .select("team_id, total_score, runs_count");
  if (error) throw error;
  return data.map(toTotal);
}

/** Escucha los cambios de puntaje por equipo. Devuelve la función para desuscribirse. */
export function subscribeTeamTotals(onChange: (total: TeamTotal) => void): () => void {
  const db = supabase();
  const channel = db
    .channel("team_totals")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "team_totals" },
      (payload) => onChange(toTotal(payload.new as TeamTotalRow)),
    )
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}

/** Misión del día de un equipo: objetivo común de todos los de ese color. */
export type Mission = { team: TeamId; progress: number; target: number; completed: boolean };

export async function fetchMissions(): Promise<Mission[]> {
  const { data, error } = await supabase().rpc("today_missions");
  if (error) throw error;
  return data.map((row) => ({
    team: row.team_id as TeamId,
    progress: row.progress,
    target: row.target,
    completed: row.completed_at !== null,
  }));
}

/** Avisa cuando cambia alguna misión (para volver a pedirlas). */
export function subscribeMissions(onChange: () => void): () => void {
  const db = supabase();
  const channel = db
    .channel("team_missions")
    .on("postgres_changes", { event: "*", schema: "public", table: "team_missions" }, () => onChange())
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}
