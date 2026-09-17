import { describe, expect, it } from "vitest";
import { initialCombatState } from "./battle";
import {
  applyBoostedAnswer,
  BOOST_IDS,
  BOOSTS,
  dealBoosts,
  fiftyFifty,
  medkit,
  newHand,
  spend,
  type BoostId,
  type BoostSlot,
} from "./boosts";

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};
const armed = (...ids: BoostId[]): BoostSlot[] => ids.map((id) => ({ id, state: "armed" }));
const fresh = initialCombatState;
const slow = { kind: "correct", timeTakenMs: 6_000 } as const;

describe("boost catalogue", () => {
  it("has ten boosts, each described", () => {
    expect(BOOST_IDS).toHaveLength(10);
    for (const id of BOOST_IDS) expect(BOOSTS[id].name.length).toBeGreaterThan(0);
  });

  it("deals three distinct boosts", () => {
    for (let run = 0; run < 50; run++) {
      const hand = dealBoosts(Math.random);
      expect(hand).toHaveLength(3);
      expect(new Set(hand).size).toBe(3);
    }
    expect(dealBoosts(seq(0, 0, 0))).toEqual(["shield", "double", "fifty"]);
  });

  it("fifty-fifty hides two wrong options and never the answer", () => {
    for (let correct = 0; correct < 4; correct++) {
      const hidden = fiftyFifty(correct, 4, Math.random);
      expect(hidden).toHaveLength(2);
      expect(hidden).not.toContain(correct);
    }
  });

  it("med kit heals 15 without passing full HP", () => {
    expect(medkit({ ...fresh(), hp: 50 }).hp).toBe(65);
    expect(medkit({ ...fresh(), hp: 95 }).hp).toBe(100);
  });

  it("spends only the armed boosts that were used", () => {
    const hand = spend([...armed("shield", "double"), { id: "ink", state: "ready" }], ["double"]);
    expect(hand.map((s) => s.state)).toEqual(["armed", "spent", "ready"]);
    expect(newHand(["ink"])).toEqual([{ id: "ink", state: "ready" }]);
  });
});

describe("applyBoostedAnswer", () => {
  it("without boosts it matches the base rules", () => {
    const effect = applyBoostedAnswer(fresh(), fresh(), slow, { self: [], opponent: [] });
    expect(effect.damageToOpponent).toBe(10);
    expect(effect.opponent.hp).toBe(90);
    expect(effect.spentBySelf).toEqual([]);
  });

  it("double tap doubles the hit, overclock adds the speed bonus", () => {
    const effect = applyBoostedAnswer(fresh(), fresh(), slow, { self: armed("double"), opponent: [], overclock: true });
    expect(effect.speedBonus).toBe(true);
    expect(effect.damageToOpponent).toBe(30);
    expect(effect.opponent.hp).toBe(70);
    expect(effect.spentBySelf).toEqual(["double"]);
  });

  it("the defender's shield soaks the hit and is spent", () => {
    const effect = applyBoostedAnswer(fresh(), fresh(), slow, { self: armed("double"), opponent: armed("shield", "mirror") });
    expect(effect.blocked).toBe(true);
    expect(effect.opponent.hp).toBe(100);
    expect(effect.spentByOpponent).toEqual(["shield"]);
    expect(effect.spentBySelf).toEqual(["double"]);
  });

  it("mirror coat sends half the hit back", () => {
    const effect = applyBoostedAnswer(fresh(), fresh(), { kind: "correct", timeTakenMs: 1_000 }, { self: [], opponent: armed("mirror") });
    expect(effect.reflected).toBe(7);
    expect(effect.opponent.hp).toBe(92);
    expect(effect.self.hp).toBe(93);
    expect(effect.damageToSelf).toBe(7);
  });

  it("vampire bite heals half the damage dealt, up to full HP", () => {
    const hurt = { ...fresh(), hp: 60 };
    const effect = applyBoostedAnswer(hurt, fresh(), slow, { self: armed("vampire"), opponent: [] });
    expect(effect.healed).toBe(5);
    expect(effect.self.hp).toBe(65);
    const full = applyBoostedAnswer(fresh(), fresh(), slow, { self: armed("vampire"), opponent: [] });
    expect(full.healed).toBe(0);
    expect(full.spentBySelf).toEqual(["vampire"]);
  });

  it("your own shield blocks self-damage and the anchor keeps the streak", () => {
    const streaky = { ...fresh(), streak: 4 };
    const effect = applyBoostedAnswer(streaky, fresh(), { kind: "wrong", timeTakenMs: 2_000 }, {
      self: armed("shield", "anchor"),
      opponent: [],
    });
    expect(effect.self.hp).toBe(100);
    expect(effect.damageToSelf).toBe(0);
    expect(effect.self.streak).toBe(4);
    expect(effect.anchored).toBe(true);
    expect(effect.spentBySelf).toEqual(["shield", "anchor"]);
  });

  it("a timeout without boosts still hurts and resets the streak", () => {
    const effect = applyBoostedAnswer({ ...fresh(), streak: 2 }, fresh(), { kind: "timeout" }, { self: armed("double"), opponent: [] });
    expect(effect.self.hp).toBe(95);
    expect(effect.self.streak).toBe(0);
    expect(effect.spentBySelf).toEqual([]);
  });
});
