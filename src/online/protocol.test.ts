import { describe, expect, it } from "vitest";
import type { Member } from "./channel";
import {
  buildParticipants,
  hostOf,
  MATCH_WAIT_MS,
  normalizeCode,
  pickMatch,
  roomCode,
  slotDone,
  slotSeed,
} from "./protocol";

const member = (id: string, joinedAt: number, team: Member["team"] = "red"): Member => ({
  id,
  nickname: `Jugador ${id}`,
  team,
  joinedAt,
});

describe("salas", () => {
  it("el anfitrión es el que llegó primero (y si empatan, por id)", () => {
    expect(hostOf([member("b", 20), member("a", 30), member("c", 10)])?.id).toBe("c");
    expect(hostOf([member("b", 10), member("a", 10)])?.id).toBe("a");
    expect(hostOf([])).toBeUndefined();
  });

  it("los códigos son de 5 letras sin las que se confunden", () => {
    const values = [0, 0.2, 0.5, 0.8, 0.999];
    const code = roomCode(() => values.shift() ?? 0);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    for (let i = 0; i < 50; i++) expect(roomCode()).not.toMatch(/[01IO]/);
    expect(normalizeCode(" ab-c d9x ")).toBe("ABCD9");
  });

  it("empareja enseguida con 4, y con 2 o 3 cuando el primero esperó bastante", () => {
    const waiting = [member("a", 0), member("b", 500), member("c", 900)];
    expect(pickMatch(waiting, 1000)).toBeNull();
    expect(pickMatch(waiting, MATCH_WAIT_MS)).toEqual(["a", "b", "c"]);
    expect(pickMatch([member("a", 0)], 60_000)).toBeNull();
    const crowd = ["e", "d", "c", "b", "a"].map((id, i) => member(id, 100 - i));
    expect(pickMatch(crowd, 200)).toEqual(["a", "b", "c", "d"]);
  });

  it("completa con bots de los colores libres, igual en todas las compus", () => {
    const players = [member("x", 1, "red"), member("y", 2, "red"), member("z", 3, "blue")];
    const seenByX = buildParticipants(players, "x");
    const seenByZ = buildParticipants(players, "z");
    expect(seenByX.map((p) => p.id)).toEqual(seenByZ.map((p) => p.id));
    expect(seenByX.map((p) => p.kind)).toEqual(["me", "remote", "remote", "bot"]);
    expect(seenByZ.map((p) => p.kind)).toEqual(["remote", "remote", "me", "bot"]);
    expect(seenByX[3]).toMatchObject({ team: "yellow", name: "CPU Amarillo" });
    expect(buildParticipants([member("solo", 1, "green")], "solo").map((p) => p.team)).toEqual(["green", "red", "blue", "yellow"]);
  });

  it("la prueba está lista cuando todas las personas mandaron su resultado", () => {
    expect(slotDone(1, ["a", "b"], { a: { 1: 10 } })).toBe(false);
    expect(slotDone(1, ["a", "b"], { a: { 1: 10 }, b: { 1: 0 } })).toBe(true);
    expect(slotDone(2, ["a"], { a: { 1: 10 } })).toBe(false);
  });

  it("cada prueba tiene su propia semilla", () => {
    expect(new Set([slotSeed(7, 1), slotSeed(7, 2), slotSeed(7, 3)]).size).toBe(3);
    expect(slotSeed(7, 2)).toBe(slotSeed(7, 2));
    expect(slotSeed(7, 1)).toBeGreaterThanOrEqual(0);
  });
});
