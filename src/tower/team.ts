import { cashTower } from "@/lib/supabase/api";
import { useSession } from "@/store/session";
import { useTower } from "./store";

/**
 * Lo que subiste suma para tu equipo: manda los metros al servidor (si hay
 * conexión y perfil) y deja anotado cuánto sumó, para la tarjeta del intento.
 */
export async function cashForTeam(climbed: number) {
  if (!useSession.getState().online || climbed < 0.5) return;
  try {
    const points = await cashTower(climbed);
    useTower.getState().setTeamPoints(points);
  } catch {
    // Sin conexión, muy rápido o con el tope del día: no suma, pero el juego sigue igual.
  }
}
