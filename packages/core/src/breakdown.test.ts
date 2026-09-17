import { describe, expect, it } from "vitest";
import { breakdownBySubtopic, fallbackWeakSpotAnalysis, reviewMinutes, type AnswerLogRow } from "./breakdown";

let n = 0;
const answer = (topicName: string, correct: boolean, timeTakenMs = 6_000, timedOut = false): AnswerLogRow => ({
  questionId: `q${n++}`,
  topicId: topicName.toLowerCase().replace(/\W+/g, "-"),
  topicName,
  correct,
  timeTakenMs,
  timedOut,
});

describe("breakdownBySubtopic", () => {
  const log = [
    ...[true, true, true].map((c) => answer("Reflection at plane surfaces", c)),
    ...[true, true, true, true, false].map((c) => answer("Lens formula", c)),
    ...[true, true, false].map((c) => answer("Total internal reflection", c)),
    ...[true, false].map((c) => answer("Wave optics — interference", c)),
    answer("Refraction at curved surfaces", true, 7_000),
    answer("Refraction at curved surfaces", false, 2_100),
    answer("Refraction at curved surfaces", false, 3_300),
    answer("Refraction at curved surfaces", false, 12_000, true),
  ];

  it("aggregates accuracy per sub-topic, strongest first, with verdicts", () => {
    const { rows, totals } = breakdownBySubtopic(log);
    expect(rows.map((r) => [r.topicName, Math.round(r.accuracy * 100), r.verdict])).toEqual([
      ["Reflection at plane surfaces", 100, "STRONG"],
      ["Lens formula", 80, "STRONG"],
      ["Total internal reflection", 67, "FAIR"],
      ["Wave optics — interference", 50, "FAIR"],
      ["Refraction at curved surfaces", 25, "WEAK"],
    ]);
    expect(totals).toMatchObject({ correct: 11, total: 17 });
  });

  it("highlights the lowest-scoring sub-topic as the single weak spot", () => {
    const { weakSpot } = breakdownBySubtopic(log);
    expect(weakSpot?.topicName).toBe("Refraction at curved surfaces");
    expect(weakSpot?.fastMisses).toBe(2);
    expect(weakSpot?.timeouts).toBe(1);
    expect(reviewMinutes(weakSpot!)).toBe(18);
    expect(fallbackWeakSpotAnalysis(weakSpot!)).toMatch(/^1 of 4 correct\. Two of the 3 misses came in under 4 seconds/);
  });

  it("breaks accuracy ties toward the sub-topic with more evidence", () => {
    const { weakSpot } = breakdownBySubtopic([
      answer("Alpha", true),
      answer("Alpha", false),
      answer("Beta", true),
      answer("Beta", false),
      answer("Beta", true),
      answer("Beta", false),
    ]);
    expect(weakSpot?.topicName).toBe("Beta");
  });

  it("handles an empty log", () => {
    expect(breakdownBySubtopic([])).toEqual({
      rows: [],
      weakSpot: null,
      totals: { correct: 0, total: 0, accuracy: 0, avgTimeMs: null },
    });
  });
});
