import { describe, expect, it } from "vitest";
import { applyAnswer, BATTLE_RULES, clampAnswerTime, decideWinner, initialCombatState, type CombatState } from "./battle";

describe("applyAnswer", () => {
  it("a correct answer damages the opponent and grows the streak", () => {
    const effect = applyAnswer(initialCombatState(), initialCombatState(), { kind: "correct", timeTakenMs: 6_000 });
    expect(effect.opponent.hp).toBe(90);
    expect(effect.self.hp).toBe(100);
    expect(effect.self.streak).toBe(1);
    expect(effect.speedBonus).toBe(false);
  });

  it("adds the speed bonus for answers inside the first 4 seconds", () => {
    const effect = applyAnswer(initialCombatState(), initialCombatState(), { kind: "correct", timeTakenMs: 3_200 });
    expect(effect.speedBonus).toBe(true);
    expect(effect.damageToOpponent).toBe(15);
  });

  it("adds a streak bonus from the third consecutive correct answer", () => {
    let self = initialCombatState();
    let opponent = initialCombatState();
    const damages: number[] = [];
    for (let i = 0; i < 3; i++) {
      const effect = applyAnswer(self, opponent, { kind: "correct", timeTakenMs: 5_000 });
      self = effect.self;
      opponent = effect.opponent;
      damages.push(effect.damageToOpponent);
    }
    expect(damages).toEqual([10, 10, 13]);
    expect(opponent.hp).toBe(67);
    expect(self.bestStreak).toBe(3);
  });

  it("a wrong answer damages yourself and resets the streak but keeps the best streak", () => {
    const start: CombatState = { ...initialCombatState(), streak: 4, bestStreak: 4 };
    const effect = applyAnswer(start, initialCombatState(), { kind: "wrong", timeTakenMs: 2_000 });
    expect(effect.self.hp).toBe(100 - BATTLE_RULES.wrongSelfDamage);
    expect(effect.self.streak).toBe(0);
    expect(effect.self.bestStreak).toBe(4);
    expect(effect.opponent.hp).toBe(100);
  });

  it("a timeout costs HP and is not counted as a submitted answer", () => {
    const effect = applyAnswer(initialCombatState(), initialCombatState(), { kind: "timeout" });
    expect(effect.self.hp).toBe(100 - BATTLE_RULES.timeoutSelfDamage);
    expect(effect.self.answered).toBe(0);
  });

  it("never drops HP below zero", () => {
    const low: CombatState = { ...initialCombatState(), hp: 4 };
    expect(applyAnswer(initialCombatState(), low, { kind: "correct", timeTakenMs: 1_000 }).opponent.hp).toBe(0);
  });

  it("clamps server-measured answer time to the question window", () => {
    expect(clampAnswerTime(-20)).toBe(0);
    expect(clampAnswerTime(99_999)).toBe(BATTLE_RULES.timeLimitMs);
  });
});

describe("decideWinner", () => {
  const state = (patch: Partial<CombatState>): CombatState => ({ ...initialCombatState(), ...patch });

  it("higher HP wins", () => {
    expect(decideWinner({ userId: "a", state: state({ hp: 40 }) }, { userId: "b", state: state({ hp: 30 }) }).winnerId).toBe("a");
  });

  it("breaks HP ties on correct answers, then on total answer time", () => {
    expect(
      decideWinner({ userId: "a", state: state({ hp: 50, correct: 6 }) }, { userId: "b", state: state({ hp: 50, correct: 7 }) }).winnerId,
    ).toBe("b");
    expect(
      decideWinner(
        { userId: "a", state: state({ hp: 50, correct: 6, totalAnswerMs: 40_000 }) },
        { userId: "b", state: state({ hp: 50, correct: 6, totalAnswerMs: 52_000 }) },
      ).winnerId,
    ).toBe("a");
  });

  it("declares a draw when everything is level", () => {
    expect(decideWinner({ userId: "a", state: state({}) }, { userId: "b", state: state({}) })).toEqual({ winnerId: null, loserId: null });
  });
});
