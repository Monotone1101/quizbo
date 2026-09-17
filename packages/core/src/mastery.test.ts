import { describe, expect, it } from "vitest";
import { priorFromConfidence, tallyByTopic, updateMastery } from "./mastery";

describe("updateMastery", () => {
  it("1/5 correct lowers mastery while 4/5 raises it", () => {
    const low = updateMastery(0.5, 1, 5);
    const high = updateMastery(0.5, 4, 5);
    expect(low).toBeCloseTo(0.32, 3);
    expect(high).toBeCloseTo(0.68, 3);
    expect(low).toBeLessThan(0.5);
    expect(high).toBeGreaterThan(0.5);
  });

  it("starts from the prior when the student has no score yet", () => {
    expect(updateMastery(null, 2, 2)).toBeCloseTo(0.65, 3);
  });

  it("stays within 0–1 and ignores empty tallies", () => {
    expect(updateMastery(0.99, 5, 5)).toBeLessThanOrEqual(1);
    expect(updateMastery(0.02, 0, 6)).toBeGreaterThanOrEqual(0);
    expect(updateMastery(0.4, 0, 0)).toBe(0.4);
  });

  it("maps onboarding confidence to a starting prior", () => {
    expect(priorFromConfidence(1)).toBe(0.3);
    expect(priorFromConfidence(5)).toBe(0.7);
    expect(priorFromConfidence(undefined)).toBe(0.5);
  });

  it("tallies answers per topic", () => {
    const tally = tallyByTopic([
      { topicId: "a", correct: true },
      { topicId: "a", correct: false },
      { topicId: "b", correct: true },
    ]);
    expect(tally.get("a")).toEqual({ correct: 1, total: 2 });
    expect(tally.get("b")).toEqual({ correct: 1, total: 1 });
  });
});
