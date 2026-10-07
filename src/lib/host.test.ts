import { describe, expect, it } from "vitest";
import { introLine, tableLine } from "./host";

describe("presentador", () => {
  it("avisa cuando es la última prueba", () => {
    expect(introLine("slippery_bridge", 3, 3)).toMatch(/^¡Última prueba!/);
    expect(introLine("slippery_bridge", 1, 3)).not.toMatch(/Última/);
  });

  it("comenta la tabla según cómo viene tu equipo", () => {
    expect(tableLine("red", { red: 900, blue: 500 }, false)).toContain("Equipo Rojo va primero");
    expect(tableLine("red", { red: 800, blue: 900 }, false)).toContain("apenas 100 puntos");
    expect(tableLine("red", { red: 200, blue: 900 }, false)).toContain("Equipo Azul se escapa");
  });

  it("en la tabla final dice quién ganó", () => {
    expect(tableLine("green", { green: 2000, red: 100 }, true)).toContain("¡Ganó Equipo Verde!");
    expect(tableLine("green", { green: 100, red: 2000 }, true)).toContain("¡Ganó Equipo Rojo!");
  });
});
