import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ loadProfile: vi.fn(), joinTeam: vi.fn() }));
vi.mock("@/lib/supabase/api", () => api);

import { useSession } from "./session";

const reset = () => useSession.setState({ team: null, nickname: null, online: false, profileStatus: "unknown" });

describe("perfil", () => {
  beforeEach(() => {
    reset();
    api.loadProfile.mockReset();
    api.joinTeam.mockReset();
  });

  it("carga el equipo guardado en el servidor", async () => {
    api.loadProfile.mockResolvedValue({ team: "green", nickname: "Pato Veloz" });
    await useSession.getState().loadProfile();
    expect(useSession.getState()).toMatchObject({ team: "green", nickname: "Pato Veloz", online: true, profileStatus: "ready" });
  });

  it("sin conexión queda listo igual (y sin equipo)", async () => {
    api.loadProfile.mockRejectedValue(new Error("offline"));
    await useSession.getState().loadProfile();
    expect(useSession.getState()).toMatchObject({ team: null, online: false, profileStatus: "ready" });
  });

  it("elegir equipo es para siempre", async () => {
    api.joinTeam.mockResolvedValue({ team: "red", nickname: "Sapo Torpe" });
    await useSession.getState().chooseTeam("red");
    await useSession.getState().chooseTeam("blue");
    expect(api.joinTeam).toHaveBeenCalledTimes(1);
    expect(useSession.getState()).toMatchObject({ team: "red", nickname: "Sapo Torpe", online: true });
  });

  it("sin conexión el equipo vale para esta visita", async () => {
    api.joinTeam.mockRejectedValue(new Error("offline"));
    await useSession.getState().chooseTeam("yellow");
    expect(useSession.getState()).toMatchObject({ team: "yellow", online: false });
  });
});
