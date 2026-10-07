import { describe, expect, it } from "vitest";
import type { PlayerInput } from "@/bridge/events";
import { createInputRecorder, createRemoteInputs, decodeInputs, encodeInputs } from "./inputs";

const I = (move: number, jumpPressed = false): PlayerInput => ({ move, jumpPressed });

describe("teclas por la red", () => {
  it("comprime las repeticiones y vuelve igual", () => {
    const inputs = [...Array(40).fill(I(1)), I(1, true), I(0), I(0), I(-1)];
    const data = encodeInputs(inputs);
    expect(data).toBe("4*40,5,2*2,0");
    expect(decodeInputs(data)).toEqual(inputs);
    expect(decodeInputs("")).toEqual([]);
  });

  it("medio segundo apretando una flecha ocupa pocos caracteres", () => {
    expect(encodeInputs(Array(60).fill(I(-1))).length).toBeLessThanOrEqual(4);
  });

  it("el grabador entrega solo lo nuevo", () => {
    const rec = createInputRecorder();
    expect(rec.flush()).toBeNull();
    rec.record(0, I(1));
    rec.record(1, I(1));
    rec.record(1, I(-1)); // repetido: se ignora
    expect(rec.flush()).toEqual({ from: 0, data: "4*2" });
    expect(rec.flush()).toBeNull();
    rec.record(2, I(0, true));
    expect(rec.flush()).toEqual({ from: 2, data: "3" });
  });

  it("del otro lado arma la secuencia, sin duplicar lo repetido", () => {
    const remote = createRemoteInputs();
    remote.add(0, "4*3");
    remote.add(0, "4*3"); // llegó dos veces
    remote.add(3, "1,0");
    expect(remote.length).toBe(5);
    expect(remote.at(3)).toEqual(I(-1, true));
    expect(remote.at(9)).toBeUndefined();
  });

  it("si se pierde un paquete, el hueco sigue con la última tecla (sin saltos)", () => {
    const remote = createRemoteInputs();
    remote.add(0, "5,4");
    remote.add(4, "2");
    expect(remote.length).toBe(5);
    expect(remote.at(2)).toEqual(I(1));
    expect(remote.at(3)).toEqual(I(1));
    expect(remote.at(4)).toEqual(I(0));
  });

  it("acepta un paquete que se superpone en parte", () => {
    const remote = createRemoteInputs();
    remote.add(0, "4*3");
    remote.add(2, "4,0*2");
    expect(remote.length).toBe(5);
    expect(remote.at(4)).toEqual(I(-1));
  });
});
