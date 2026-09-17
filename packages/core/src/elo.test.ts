import { describe, expect, it } from "vitest";
import { applyBattleElo, eloDelta, expectedScore, kFactor, placementRating } from "./elo";

describe("elo", () => {
  it("expects 0.5 between equal ratings and is symmetric", () => {
    expect(expectedScore(1200, 1200)).toBe(0.5);
    expect(expectedScore(1300, 1100) + expectedScore(1100, 1300)).toBeCloseTo(1, 10);
  });

  it("uses K=40 for the first five matches in a subject, K=20 afterwards", () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(4)).toBe(40);
    expect(kFactor(5)).toBe(20);
  });

  it("follows the documented formula", () => {
    // expected = 1 / (1 + 10^((1231 − 1284) / 400)) ≈ 0.5757 → 20 × (1 − 0.5757) ≈ 8.49
    expect(eloDelta({ rating: 1284, matchesPlayed: 24 }, 1231, "win")).toBe(8);
    expect(eloDelta({ rating: 1231, matchesPlayed: 24 }, 1284, "loss")).toBe(-8);
  });

  it("is deterministic for the same ratings and outcome", () => {
    const run = () =>
      applyBattleElo(
        { userId: "a", rating: 1284, matchesPlayed: 3 },
        { userId: "b", rating: 1402, matchesPlayed: 30 },
        { winnerId: "a", forfeit: false },
      );
    expect(run()).toEqual(run());
  });

  it("gives a forfeit win a smaller gain than a played-out win of the same ratings", () => {
    const a = { userId: "a", rating: 1250, matchesPlayed: 10 };
    const b = { userId: "b", rating: 1250, matchesPlayed: 10 };
    const [played] = applyBattleElo(a, b, { winnerId: "a", forfeit: false });
    const [forfeit, dropped] = applyBattleElo(a, b, { winnerId: "a", forfeit: true });
    expect(played.delta).toBe(10);
    expect(forfeit.delta).toBe(5);
    expect(forfeit.delta).toBeLessThan(played.delta);
    // The player who dropped is not rewarded for leaving: full loss.
    expect(dropped.delta).toBe(-10);
  });

  it("splits a draw by expectation", () => {
    const [low, high] = applyBattleElo(
      { userId: "low", rating: 1100, matchesPlayed: 10 },
      { userId: "high", rating: 1300, matchesPlayed: 10 },
      { winnerId: null, forfeit: false },
    );
    expect(low.delta).toBeGreaterThan(0);
    expect(high.delta).toBeLessThan(0);
  });

  it("maps onboarding confidence to a placement band", () => {
    expect(placementRating(1)).toBe(1050);
    expect(placementRating(3)).toBe(1200);
    expect(placementRating(5)).toBe(1350);
    expect(placementRating(null)).toBe(1200);
  });
});
