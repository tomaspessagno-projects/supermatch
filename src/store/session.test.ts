import { beforeEach, describe, expect, it } from "vitest";
import type { MinigameResult } from "@/bridge/events";
import { standings } from "@/lib/participants";
import { nextMinigame, RUN_PLAYLIST, useSession } from "./session";

const result = (slot: 1 | 2 | 3, score: number): MinigameResult => ({
  slot,
  minigameId: "slippery_bridge",
  score,
  durationMs: 20_000,
});

describe("episodio solo", () => {
  beforeEach(() => {
    useSession.setState({ team: "red", online: false, mode: "solo" });
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
      s().recordResult(result(slot as 1 | 2 | 3, 100 * slot), [{ id: "cpu-blue", score: 50 }]);
      expect(s().phase).toBe("between");
      s().continueEpisode();
    }
    expect(s().results).toHaveLength(RUN_PLAYLIST.length);
    expect(nextMinigame(s().results, s().seed)).toBeNull();
    // Después de la última prueba no se vuelve a presentar nada.
    expect(s().phase).toBe("between");
  });

  it("el silbato no arranca nada si no hubo cuenta regresiva", () => {
    useSession.getState().go();
    expect(useSession.getState().phase).toBe("intro");
  });

  it("vos contra un bot de cada uno de los otros colores", () => {
    const { participants } = useSession.getState();
    expect(participants.map((p) => [p.team, p.kind])).toEqual([
      ["red", "me"],
      ["blue", "bot"],
      ["yellow", "bot"],
      ["green", "bot"],
    ]);
  });

  it("guarda los puntos de cada uno por prueba", () => {
    const s = useSession.getState;
    s().recordResult(result(1, 300), [{ id: "cpu-blue", score: 120 }, { id: "cpu-green", score: 500 }]);
    s().recordResult(result(2, 200), [{ id: "cpu-blue", score: 80 }, { id: "cpu-green", score: 10 }]);
    expect(s().scores).toEqual({ me: { 1: 300, 2: 200 }, "cpu-blue": { 1: 120, 2: 80 }, "cpu-green": { 1: 500, 2: 10 } });
    expect(s().liveScore).toBe(0);
    const table = standings(s().participants, s().scores);
    expect(table.map((r) => [r.participant.id, r.total])).toEqual([
      ["cpu-green", 510],
      ["me", 500],
      ["cpu-blue", 200],
      ["cpu-yellow", 0],
    ]);
  });

  it("cada prueba tiene su semilla", () => {
    const seed = useSession.getState().seed;
    const first = nextMinigame([], seed);
    const second = nextMinigame([result(1, 0)], seed);
    expect(first?.seed).not.toBe(second?.seed);
    expect(nextMinigame([], seed)?.seed).toBe(first?.seed);
  });
});

describe("episodio online", () => {
  beforeEach(() => {
    useSession.setState({ team: "red", online: false, mode: "solo" });
    useSession.getState().prepareOnline({
      seed: 42,
      participants: [
        { id: "a", name: "Pato Veloz", team: "blue", kind: "remote" },
        { id: "b", name: "Sapo Torpe", team: "red", kind: "me" },
        { id: "cpu-0-yellow", name: "CPU Amarillo", team: "yellow", kind: "bot" },
        { id: "cpu-1-green", name: "CPU Verde", team: "green", kind: "bot" },
      ],
      schedule: { slot: 1, at: 1000 },
      kind: "race",
    });
    useSession.getState().startRun();
  });

  it("mantiene lo que dejó la sala", () => {
    const s = useSession.getState();
    expect(s.seed).toBe(42);
    expect(s.schedule).toEqual({ slot: 1, at: 1000 });
    expect(s.participants).toHaveLength(4);
  });

  it("los remotos llegan por la red y el árbitro manda sobre los bots", () => {
    const s = useSession.getState;
    s().setScore("cpu-0-yellow", 1, 333); // el árbitro terminó antes
    s().recordResult(result(1, 300), [
      { id: "a", score: 999 }, // proyección local: no cuenta
      { id: "cpu-0-yellow", score: 100 },
      { id: "cpu-1-green", score: 50 },
    ]);
    expect(s().scores).toEqual({ b: { 1: 300 }, "cpu-0-yellow": { 1: 333 }, "cpu-1-green": { 1: 50 } });
    s().setScore("a", 1, 410);
    expect(s().scores.a).toEqual({ 1: 410 });
  });

  it("marca a los que se fueron", () => {
    useSession.getState().setLeft(["a"]);
    expect(useSession.getState().participants.find((p) => p.id === "a")?.left).toBe(true);
    useSession.getState().setLeft([]);
    expect(useSession.getState().participants.find((p) => p.id === "a")?.left).toBe(false);
  });

  it("jugar solo después vuelve a los bots", () => {
    useSession.getState().playSolo();
    useSession.getState().startRun();
    expect(useSession.getState().participants.filter((p) => p.kind === "bot")).toHaveLength(3);
    expect(useSession.getState().schedule).toBeNull();
  });
});

describe("episodio en equipo", () => {
  beforeEach(() => {
    useSession.setState({ team: "green", online: false, mode: "solo", kind: "coop" });
    useSession.getState().startRun();
  });

  it("son las 3 rondas de El Colchón", () => {
    const s = useSession.getState();
    expect(nextMinigame([], s.seed, "coop")).toMatchObject({ slot: 1, minigameId: "mattress" });
    expect(nextMinigame([result(1, 0), result(2, 0)], s.seed, "coop")).toMatchObject({ slot: 3, minigameId: "mattress" });
  });

  it("el puntaje de la ronda es de los 4", () => {
    const s = useSession.getState;
    s().recordResult({ slot: 1, minigameId: "mattress", score: 640, durationMs: 40_000 }, []);
    for (const p of s().participants) expect(s().scores[p.id]).toEqual({ 1: 640 });
  });

  it("online vale el del árbitro, aunque llegue antes", () => {
    useSession.getState().prepareOnline({
      seed: 1,
      participants: [
        { id: "a", name: "Pato", team: "red", kind: "remote" },
        { id: "b", name: "Sapo", team: "green", kind: "me" },
        { id: "cpu-0-blue", name: "CPU Azul", team: "blue", kind: "bot" },
        { id: "cpu-1-yellow", name: "CPU Amarillo", team: "yellow", kind: "bot" },
      ],
      schedule: { slot: 1, at: 0 },
      kind: "coop",
    });
    const s = useSession.getState;
    s().startRun();
    s().setCrewScore(1, 700);
    s().recordResult({ slot: 1, minigameId: "mattress", score: 690, durationMs: 40_000 }, []);
    expect(Object.values(s().scores).map((x) => x[1])).toEqual([700, 700, 700, 700]);
  });
});
