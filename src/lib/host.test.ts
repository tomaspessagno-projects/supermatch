import { describe, expect, it } from "vitest";
import { introLine, tableLine } from "./host";
import { soloParticipants, standings } from "./participants";
import type { TeamId } from "./teams";

/** Tabla jugando solo con estos totales (una sola prueba). */
const table = (mine: TeamId, totals: Partial<Record<TeamId, number>>) => {
  const participants = soloParticipants(mine);
  const scores = Object.fromEntries(
    participants.map((p) => [p.id, { 1: totals[p.team] ?? 0 }]),
  );
  return standings(participants, scores);
};

describe("presentador", () => {
  it("avisa cuando es la última prueba", () => {
    expect(introLine("slippery_bridge", 3, 3)).toMatch(/^¡Última prueba!/);
    expect(introLine("slippery_bridge", 1, 3)).not.toMatch(/Última/);
  });

  it("comenta la tabla según cómo viene tu equipo", () => {
    expect(tableLine(table("red", { red: 900, blue: 500 }), false)).toContain("Equipo Rojo va primero");
    expect(tableLine(table("red", { red: 800, blue: 900 }), false)).toContain("apenas 100 puntos");
    expect(tableLine(table("red", { red: 200, blue: 900 }), false)).toContain("Equipo Azul se escapa");
  });

  it("en la tabla final dice quién ganó", () => {
    expect(tableLine(table("green", { green: 2000, red: 100 }), true)).toContain("¡Ganó Equipo Verde!");
    expect(tableLine(table("green", { green: 100, red: 2000 }), true)).toContain("¡Ganó Equipo Rojo!");
  });

  it("online nombra a las personas por su apodo", () => {
    const rows = standings(
      [
        { id: "a", name: "Pato Veloz", team: "red", kind: "remote" },
        { id: "b", name: "Sapo Torpe", team: "red", kind: "me" },
      ],
      { a: { 1: 900 }, b: { 1: 100 } },
    );
    expect(tableLine(rows, false)).toBe("¡Pato Veloz se escapa! A remontar, Sapo Torpe.");
  });
});
