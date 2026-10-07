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
