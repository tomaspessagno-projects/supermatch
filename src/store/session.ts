import { create } from "zustand";
import * as api from "@/lib/supabase/api";
import type { TeamId } from "@/lib/teams";

/**
 * Quién sos: el equipo (para siempre) y el apodo. Se guardan en el servidor
 * con una sesión anónima; sin conexión se juega igual, solo no suma al ranking.
 */
type SessionState = {
  team: TeamId | null;
  nickname: string | null;
  /** El perfil está guardado en el servidor. */
  online: boolean;
  profileStatus: "unknown" | "loading" | "ready";
  loadProfile: () => Promise<void>;
  chooseTeam: (team: TeamId) => Promise<void>;
};

export const useSession = create<SessionState>()((set, get) => ({
  team: null,
  nickname: null,
  online: false,
  profileStatus: "unknown",

  async loadProfile() {
    if (get().profileStatus !== "unknown") return;
    set({ profileStatus: "loading" });
    try {
      const profile = await api.loadProfile();
      if (profile) set({ team: profile.team, nickname: profile.nickname, online: true });
    } catch {
      // Sin conexión se puede jugar igual; solo no suma al ranking.
    }
    set({ profileStatus: "ready" });
  },

  async chooseTeam(team) {
    // La facción queda bloqueada una vez elegida (también en la base).
    if (get().team) return;
    try {
      const profile = await api.joinTeam(team);
      set({ team: profile.team, nickname: profile.nickname, online: true });
    } catch {
      set({ team, online: false });
    }
  },
}));
