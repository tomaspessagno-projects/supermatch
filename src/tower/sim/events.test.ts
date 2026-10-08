import { describe, expect, it } from "vitest";
import { EVENT_EVERY_MS, EVENT_LENGTH_MS, LIVE_EVENTS, liveEventAt, nextEventAt } from "./events";

describe("eventos en vivo", () => {
  const t0 = 1_800_000_000_000 - (1_800_000_000_000 % EVENT_EVERY_MS);

  it("cada 5 minutos hay uno de 90 segundos, y después nada", () => {
    expect(liveEventAt(t0)).not.toBeNull();
    expect(liveEventAt(t0 + EVENT_LENGTH_MS - 1)?.endsAt).toBe(t0 + EVENT_LENGTH_MS);
    expect(liveEventAt(t0 + EVENT_LENGTH_MS)).toBeNull();
    expect(liveEventAt(t0 + EVENT_EVERY_MS - 1)).toBeNull();
  });

  it("van rotando y el próximo se puede anunciar", () => {
    const ids = Array.from({ length: LIVE_EVENTS.length }, (_, k) => liveEventAt(t0 + k * EVENT_EVERY_MS)!.event.id);
    expect(new Set(ids).size).toBe(LIVE_EVENTS.length);
    const next = nextEventAt(t0 + EVENT_LENGTH_MS + 10);
    expect(next.startsAt).toBe(t0 + EVENT_EVERY_MS);
    expect(next.event.id).toBe(liveEventAt(t0 + EVENT_EVERY_MS)!.event.id);
  });

  it("es el mismo para todos a la misma hora", () => {
    expect(liveEventAt(t0 + 1234)).toEqual(liveEventAt(t0 + 1234));
  });
});
