import { describe, expect, it } from "vitest";
import { createInterpolator } from "./interpolate";

describe("interpolación de dibujo", () => {
  it("dibuja en el medio y deja el cuerpo como estaba", () => {
    const body = { x: 0, y: 10 };
    const smooth = createInterpolator();
    smooth.before(body);
    body.x = 4;
    body.y = 12;
    let seen = { x: -1, y: -1 };
    smooth.draw(body, 0.5, () => (seen = { ...body }));
    expect(seen).toEqual({ x: 2, y: 11 });
    expect(body).toEqual({ x: 4, y: 12 });
  });

  it("un salto grande (reaparecer) no se interpola", () => {
    const body = { x: 0, y: 0 };
    const smooth = createInterpolator();
    smooth.before(body);
    body.x = 900;
    let seenX = -1;
    smooth.draw(body, 0.5, () => (seenX = body.x));
    expect(seenX).toBe(900);
  });
});
