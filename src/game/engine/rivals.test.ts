import { describe, expect, it } from "vitest";
import type { NetLink, PlayerInput, RivalSpec } from "../contract";
import { createRivals, REMOTE_DELAY_TICKS } from "./rivals";

const team = { id: "blue", color: "#00f", name: "Azul" };
const spec = (id: string, control: RivalSpec["control"]): RivalSpec => ({ id, team, name: id, control });

/** Un mundo de juguete: suma lo que se mueve. */
const toy = (specs: RivalSpec[], seed: number, net?: NetLink) =>
  createRivals({
    specs,
    seed,
    slot: 1,
    net,
    createWorld: () => ({ x: 0 }),
    createBot: (level, botSeed) => ({ input: () => ({ move: level + (botSeed % 7), jumpPressed: false }) }),
    step: (w, input: PlayerInput) => {
      w.x += input.move;
      return null;
    },
  });

describe("rivales", () => {
  it("los bots salen iguales con la misma semilla", () => {
    const specs = [spec("cpu-a", "bot"), spec("cpu-b", "bot"), spec("cpu-c", "bot")];
    const a = toy(specs, 99);
    const b = toy(specs, 99);
    for (let i = 0; i < 50; i++) {
      a.stepBots(() => {});
      b.stepBots(() => {});
    }
    expect(a.runners.map((r) => r.world.x)).toEqual(b.runners.map((r) => r.world.x));
  });

  it("los remotos avanzan con sus teclas, un poco atrás del jugador", () => {
    const keys: PlayerInput[] = Array.from({ length: 200 }, () => ({ move: 1, jumpPressed: false }));
    const net: NetLink = {
      sendInput: () => {},
      remoteInput: (_id, _slot, tick) => keys[tick],
      remoteTicks: () => keys.length,
    };
    const rivals = toy([spec("p2", "remote")], 1, net);
    rivals.stepRemotes(50, () => {});
    expect(rivals.runners[0].tick).toBe(0); // todavía dentro del atraso
    rivals.stepRemotes(REMOTE_DELAY_TICKS + 30, () => {});
    expect(rivals.runners[0].tick).toBe(30);
    expect(rivals.runners[0].world.x).toBe(30);
    rivals.stepRemotes(10_000, () => {});
    expect(rivals.runners[0].tick).toBeLessThanOrEqual(200); // no inventa teclas
  });

  it("sin red, un remoto se queda quieto", () => {
    const rivals = toy([spec("p2", "remote")], 1);
    rivals.stepBots(() => {});
    rivals.stepRemotes(500, () => {});
    expect(rivals.runners[0].world.x).toBe(0);
  });
});
