import { describe, expect, it } from "vitest";
import { acceptAnalysisParagraph, cleanNoteCards, reviewPasses, sanitizeGeneratedQuestion, type QuestionReview } from "./validators";

describe("sanitizeGeneratedQuestion", () => {
  const good = {
    text: "What is the critical angle for a material of refractive index √2?",
    options: ["30°", "45°", "60°", "90°"],
    correct_index: 1,
    rationale: "sin C = 1/n = 1/√2.",
    difficulty: "MEDIUM",
  };

  it("keeps a well-formed question", () => {
    expect(sanitizeGeneratedQuestion(good)).toMatchObject({ correctIndex: 1, options: ["30°", "45°", "60°", "90°"] });
  });

  it("drops malformed output instead of storing it", () => {
    expect(sanitizeGeneratedQuestion({ ...good, options: ["30°", "45°", "60°"] })).toBeNull();
    expect(sanitizeGeneratedQuestion({ ...good, options: ["30°", "45°", "45° ", "90°"] })).toBeNull();
    expect(sanitizeGeneratedQuestion({ ...good, correct_index: 4 })).toBeNull();
    expect(sanitizeGeneratedQuestion({ ...good, rationale: "" })).toBeNull();
    expect(sanitizeGeneratedQuestion({ ...good, options: ["30°", "45°", "None of the above", "90°"] })).toBeNull();
    expect(sanitizeGeneratedQuestion({ ...good, difficulty: "EXTREME" })).toBeNull();
  });
});

describe("reviewPasses", () => {
  const review: QuestionReview = {
    solved_index: 2,
    confidence: "high",
    exactly_one_correct: true,
    ambiguous_wording: false,
    factual_issues: [],
    duplicate_options: false,
    difficulty_fit: "ok",
    notes: "",
  };

  it("passes only when the blind answer matches the key and nothing is flagged", () => {
    expect(reviewPasses(review, 2).pass).toBe(true);
    expect(reviewPasses(review, 1)).toMatchObject({ pass: false });
    expect(reviewPasses({ ...review, ambiguous_wording: true }, 2).pass).toBe(false);
    expect(reviewPasses({ ...review, factual_issues: ["n of water is 1.33"] }, 2).pass).toBe(false);
    expect(reviewPasses({ ...review, confidence: "low" }, 2).pass).toBe(false);
    expect(reviewPasses({ ...review, solved_index: null }, 2).notes).toMatch(/reviewer answered none/);
  });
});

describe("acceptAnalysisParagraph", () => {
  it("requires the score sentence, brevity and no markdown", () => {
    expect(acceptAnalysisParagraph("1 of 4 correct. You flipped the sign of R.", "1 of 4 correct.")).toBe(
      "1 of 4 correct. You flipped the sign of R.",
    );
    expect(acceptAnalysisParagraph("Great job! 1 of 4 correct.", "1 of 4 correct.")).toBeNull();
    expect(acceptAnalysisParagraph("1 of 4 correct. **Bold**", "1 of 4 correct.")).toBeNull();
    expect(acceptAnalysisParagraph(`1 of 4 correct. ${"word ".repeat(100)}`, "1 of 4 correct.")).toBeNull();
  });
});

describe("cleanNoteCards", () => {
  it("trims, drops empty cards and caps at four", () => {
    const cards = cleanNoteCards([
      { title: "  Sign convention ", body: "Distances against the light are negative.", topic: "Optics" },
      { title: "", body: "no title" },
      ...Array.from({ length: 5 }, (_, i) => ({ title: `Card ${i}`, body: "Body", topic: null })),
    ]);
    expect(cards).toHaveLength(4);
    expect(cards[0]).toEqual({ title: "Sign convention", body: "Distances against the light are negative.", topic: "Optics" });
  });
});
