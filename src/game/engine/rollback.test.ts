import { describe, expect, it } from "vitest";
import type { NetLink, PlayerInput } from "../contract";
import { createShared, MAX_ROLLBACK_TICKS, type Seat } from "./rollback";

/** Mundo de juguete: cada uno suma su movimiento; un evento por salto. */
type Toy = { pos: number[]; tick: number };
const stepToy = (w: Toy, inputs: readonly PlayerInput[]) => {
  inputs.forEach((input, i) => (w.pos[i] += input.move));
  const events = inputs.flatMap((input, i) => (input.jumpPressed ? [`salto-${i}-${w.tick}`] : []));
  w.tick++;
  return events;
};
const cloneToy = (w: Toy): Toy => ({ pos: [...w.pos], tick: w.tick });

/** Red falsa: las teclas del remoto "llegan" cuando el test las libera. */
function fakeNet(remote: PlayerInput[]) {
  let arrived = 0;
  const net: NetLink = {
    sendInput: () => {},
    remoteInput: (_id, _slot, tick) => (tick < arrived ? remote[tick] : undefined),
    remoteTicks: () => arrived,
  };
  return { net, arrive: (n: number) => (arrived = Math.min(remote.length, n)) };
}

const seats: Seat[] = [
  { id: "yo", control: "me" },
  { id: "otro", control: "remote" },
];
const I = (move: number, jumpPressed = false): PlayerInput => ({ move, jumpPressed });

describe("mundo compartido (rollback)", () => {
  it("lo propio responde al instante y lo remoto se adivina con su última tecla", () => {
    const remote = [...Array(10).fill(I(1)), ...Array(10).fill(I(-1))];
    const { net, arrive } = fakeNet(remote);
    const shared = createShared({ seats, slot: 1, net, world: { pos: [0, 0], tick: 0 }, clone: cloneToy, step: stepToy });

    arrive(5);
    for (let t = 0; t < 8; t++) shared.push(I(1));
    shared.sync();
    expect(shared.world.pos[0]).toBe(8); // yo, sin esperar a nadie
    expect(shared.world.pos[1]).toBe(8); // 5 conocidas + 3 adivinadas (sigue con 1)
    expect(shared.confirmedTick).toBe(5);

    // Llegan las de verdad: a partir del tick 10 iba para el otro lado.
    for (let t = 8; t < 20; t++) shared.push(I(0));
    arrive(20);
    shared.sync();
    expect(shared.world.pos).toEqual([8, 0]);
    expect(shared.confirmedTick).toBe(20);
    expect(shared.world).toBe(shared.confirmed);
  });

  it("al final da lo mismo que si se hubiera sabido todo desde el principio", () => {
    const mine = Array.from({ length: 300 }, (_, t) => I(t % 50 < 20 ? 1 : -1, t % 37 === 0));
    const theirs = Array.from({ length: 300 }, (_, t) => I(t % 70 < 30 ? -1 : 1, t % 41 === 0));
    const { net, arrive } = fakeNet(theirs);
    const shared = createShared({ seats, slot: 1, net, world: { pos: [0, 0], tick: 0 }, clone: cloneToy, step: stepToy });
    for (let t = 0; t < 300; t++) {
      shared.push(mine[t]);
      if (t % 30 === 0) arrive(t - 40); // llegan a los saltos y con atraso
      if (t % 3 === 0) shared.sync();
    }
    arrive(300);
    shared.sync();

    const truth: Toy = { pos: [0, 0], tick: 0 };
    for (let t = 0; t < 300; t++) stepToy(truth, [mine[t], theirs[t]]);
    expect(shared.confirmed).toEqual(truth);
  });

  it("cada evento se avisa una sola vez aunque se re-simule", () => {
    const { net, arrive } = fakeNet(Array(60).fill(I(0)));
    const shared = createShared({ seats, slot: 1, net, world: { pos: [0, 0], tick: 0 }, clone: cloneToy, step: stepToy });
    const seen: string[] = [];
    for (let t = 0; t < 60; t++) {
      shared.push(I(0, t === 10 || t === 30));
      if (t % 5 === 0) arrive(t - 8);
      seen.push(...shared.sync());
    }
    arrive(60);
    seen.push(...shared.sync());
    expect(seen).toEqual(["salto-0-10", "salto-0-30"]);
  });

  it("si un remoto deja de mandar, se confirma igual pasado el máximo", () => {
    const { net } = fakeNet([]);
    const shared = createShared({ seats, slot: 1, net, world: { pos: [0, 0], tick: 0 }, clone: cloneToy, step: stepToy });
    for (let t = 0; t < MAX_ROLLBACK_TICKS + 100; t++) shared.push(I(1));
    shared.sync();
    expect(shared.confirmedTick).toBe(100);
    expect(shared.world.pos[0]).toBe(MAX_ROLLBACK_TICKS + 100);
  });

  it("sin remotos (solo con bots) no adivina nada", () => {
    const shared = createShared({
      seats: [{ id: "yo", control: "me" }, { id: "cpu", control: "bot" }],
      slot: 1,
      world: { pos: [0, 0], tick: 0 },
      clone: cloneToy,
      step: stepToy,
    });
    for (let t = 0; t < 10; t++) shared.push(I(1, t === 4));
    expect(shared.sync()).toEqual(["salto-0-4"]);
    expect(shared.confirmedTick).toBe(10);
    expect(shared.world.pos).toEqual([10, 0]);
  });
});

describe("sincronía", () => {
  it("dice hasta dónde llegaron las teclas del más atrasado", () => {
    const { net, arrive } = fakeNet(Array(50).fill({ move: 0, jumpPressed: false }));
    const shared = createShared({ seats, slot: 1, net, world: { pos: [0, 0], tick: 0 }, clone: cloneToy, step: stepToy });
    arrive(12);
    expect(shared.remoteTicks()).toBe(12);
    const solo = createShared({ seats: [{ id: "yo", control: "me" }], slot: 1, world: { pos: [0], tick: 0 }, clone: cloneToy, step: stepToy });
    expect(solo.remoteTicks()).toBe(Infinity);
  });
});
