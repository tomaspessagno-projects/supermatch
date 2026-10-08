import { describe, expect, it } from "vitest";
import { ITEMS, makeItem, MUTATION, RARITY_VALUE, rollItem } from "./items";
import { jumpHeight, NO_UPGRADES, statsFor, upgradeCost, UPGRADES } from "./progression";
import { mulberry32 } from "./random";

describe("mejoras", () => {
  it("cada nivel cuesta más y tienen tope", () => {
    for (const u of UPGRADES) {
      const costs = Array.from({ length: u.max }, (_, l) => upgradeCost(u.id, l)!);
      if (u.max > 1) for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]);
      expect(upgradeCost(u.id, u.max)).toBeNull();
    }
    expect(upgradeCost("energy", 0)).toBe(15);
  });

  it("las mejoras cambian lo que puede hacer el personaje", () => {
    const base = statsFor(NO_UPGRADES);
    const pro = statsFor({ ...NO_UPGRADES, energy: 3, jump: 2, bag: 1, double: 1 });
    expect(pro.energy).toBe(base.energy + 24);
    expect(jumpHeight(pro.jumpSpeed)).toBeGreaterThan(jumpHeight(base.jumpSpeed) + 0.3);
    expect(pro.bag).toBe(base.bag + 2);
    expect(pro.doubleJump).toBe(true);
    expect(base.doubleJump).toBe(false);
  });
});

describe("objetos", () => {
  it("más arriba, más raros", () => {
    const rare = (floor: number) => {
      const random = mulberry32(floor + 1);
      let value = 0;
      for (let i = 0; i < 2000; i++) value += rollItem(random, floor).value;
      return value / 2000;
    };
    expect(rare(5)).toBeGreaterThan(rare(0) * 3);
  });

  it("las mutaciones multiplican el valor", () => {
    expect(makeItem("duck", "none", 0).value).toBe(RARITY_VALUE.common);
    expect(makeItem("duck", "gold", 0).value).toBe(RARITY_VALUE.common * MUTATION.gold.multiplier);
    expect(makeItem("duck", "rainbow", 0).value).toBe(RARITY_VALUE.common * MUTATION.rainbow.multiplier);
    expect(ITEMS.filter((i) => i.rarity === "mythic").map((i) => i.id)).toEqual(["cup"]);
  });
});
