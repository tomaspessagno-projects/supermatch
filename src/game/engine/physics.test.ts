import { describe, expect, it } from "vitest";
import { approach, circleIntersectsRect, spring, wrapDegrees } from "./physics";

describe("physics", () => {
  it("approach no se pasa del objetivo", () => {
    expect(approach(10, 0, 3)).toBe(7);
    expect(approach(2, 0, 3)).toBe(0);
    expect(approach(-2, 0, 3)).toBe(0);
  });

  it("spring oscila y se asienta en el objetivo", () => {
    let value = 0;
    let velocity = 0;
    let overshoot = false;
    for (let i = 0; i < 600; i++) {
      [value, velocity] = spring(value, velocity, 10, 90, 9, 1 / 120);
      if (value > 10.5) overshoot = true;
    }
    expect(overshoot).toBe(true);
    expect(value).toBeCloseTo(10, 2);
  });

  it("spring no se dispara con frames lentos (10 fps)", () => {
    let [value, velocity] = [1.5, 0];
    for (let i = 0; i < 100; i++) [value, velocity] = spring(value, velocity, 1, 320, 12, 0.1);
    expect(value).toBeCloseTo(1, 3);
  });

  it("spring con el paso fijo de la simulación es un paso simple (no cambia los resultados)", () => {
    const dt = 1 / 120;
    const [value, velocity] = spring(2, 3, 0, 90, 9, dt);
    const accel = -90 * 2 - 9 * 3;
    expect(velocity).toBe(3 + accel * dt);
    expect(value).toBe(2 + (3 + accel * dt) * dt);
  });

  it("wrapDegrees deja el ángulo en (-180, 180]", () => {
    expect(wrapDegrees(370)).toBeCloseTo(10);
    expect(wrapDegrees(-190)).toBeCloseTo(170);
    expect(wrapDegrees(180)).toBe(180);
    expect(wrapDegrees(-180)).toBe(180);
  });

  it("circleIntersectsRect", () => {
    expect(circleIntersectsRect(0, 0, 10, 5, -5, 20, 5)).toBe(true);
    expect(circleIntersectsRect(0, 0, 10, 11, -5, 20, 5)).toBe(false);
    expect(circleIntersectsRect(0, 0, 10, 8, 8, 20, 20)).toBe(false); // esquina
  });
});
