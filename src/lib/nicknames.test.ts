import { describe, expect, it } from "vitest";
import { NICKNAME_MAX, randomNickname } from "./nicknames";

describe("randomNickname", () => {
  it("siempre respeta el largo que acepta la base", () => {
    for (let i = 0; i < 2000; i++) {
      const name = randomNickname();
      expect(name.length).toBeGreaterThanOrEqual(2);
      expect(name.length).toBeLessThanOrEqual(NICKNAME_MAX);
    }
  });
});
