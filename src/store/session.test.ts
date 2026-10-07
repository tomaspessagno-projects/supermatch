import { beforeEach, describe, expect, it } from "vitest";
import type { MinigameResult } from "@/bridge/events";
import { episodeTotals, nextMinigame, RUN_PLAYLIST, useSession } from "./session";

const result = (slot: 1 | 2 | 3, score: number): MinigameResult => ({
  slot,
  minigameId: "slippery_bridge",
  score,
  durationMs: 20_000,
});

describe("episodio", () => {
  beforeEach(() => {
    useSession.setState({ team: "red", online: false });
    useSession.getState().startRun();
  });

  it("recorre presentación → cuenta → juego → tabla por cada prueba", () => {
    const s = useSession.getState;
    for (let slot = 1; slot <= RUN_PLAYLIST.length; slot++) {
      expect(s().phase).toBe("intro");
      s().startCountdown();
      expect(s().phase).toBe("countdown");
      s().go();
      expect(s().phase).toBe("playing");
      s().recordResult(result(slot as 1 | 2 | 3, 100 * slot), [{ teamId: "blue", score: 50 }]);
      expect(s().phase).toBe("between");
      s().continueEpisode();
    }
    expect(s().results).toHaveLength(RUN_PLAYLIST.length);
    expect(nextMinigame(s().results)).toBeNull();
  });

  it("el silbato no arranca nada si no hubo cuenta regresiva", () => {
    useSession.getState().go();
    expect(useSession.getState().phase).toBe("intro");
  });

  it("guarda los puntos de los rivales por prueba", () => {
    const s = useSession.getState;
    s().recordResult(result(1, 300), [{ teamId: "blue", score: 120 }, { teamId: "green", score: 500 }]);
    s().recordResult(result(2, 200), [{ teamId: "blue", score: 80 }, { teamId: "green", score: 10 }]);
    expect(s().rivalScores).toEqual({ blue: [120, 80], green: [500, 10] });
    expect(s().liveScore).toBe(0);
  });
});

describe("episodeTotals", () => {
  it("suma tus pruebas para tu equipo y las de los bots para los demás", () => {
    const totals = episodeTotals("red", [result(1, 300), result(2, 250)], { blue: [100, 400], yellow: [0] });
    expect(totals).toEqual({ red: 550, blue: 500, yellow: 0 });
  });
});
