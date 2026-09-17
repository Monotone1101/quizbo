/**
 * AI touchpoint 2 — independent validation pass (architecture.md §6, step 2).
 *
 * A separately prompted reviewer that is NOT shown the answer key: it solves the question itself,
 * then checks for exactly one correct answer, ambiguous wording, factual errors, duplicate options
 * and difficulty fit. A question only passes when the reviewer's own answer matches the stored key
 * and no issue is raised (see `reviewPasses`). Only then may the caller set `validated = true`.
 *
 * Prompt:        VALIDATION_SYSTEM + the question and options (no key) as the user turn.
 * Output schema: ReviewSchema.
 * Failure path:  any API/parse failure → `{ verdict: "error" }`; the question stays unvalidated.
 */
import { z } from "zod";
import { callStructured } from "./structured";
import { reviewPasses, type QuestionReview } from "./validators";

export const VALIDATION_SYSTEM = `You are an independent reviewer for a competitive quiz's question bank. A wrong answer key in a live head-to-head battle destroys student trust, so be strict.

You get one multiple-choice question without its answer key.
1. Solve it yourself. Give the 0-based index of the single correct option, or null if you cannot identify exactly one.
2. Check it: Is there exactly one defensible correct answer? Is any wording ambiguous? Are there factual or numerical errors in the stem or options? Are any two options duplicates or near-duplicates? Does the difficulty label fit a student answering in 12 seconds?

Report issues as short phrases. Do not rewrite the question.`;

export const ReviewSchema = z.object({
  solved_index: z.number().int().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  exactly_one_correct: z.boolean(),
  ambiguous_wording: z.boolean(),
  factual_issues: z.array(z.string()),
  duplicate_options: z.boolean(),
  difficulty_fit: z.enum(["too_easy", "ok", "too_hard"]),
  notes: z.string(),
});

export interface ValidateQuestionInput {
  subject: string;
  level: string;
  topic: string;
  text: string;
  options: string[];
  correctIndex: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  signal?: AbortSignal;
}

export type ValidationOutcome =
  | { verdict: "pass" | "fail"; notes: string; review: QuestionReview; model: string }
  | { verdict: "error"; notes: string };

export async function validateQuestion(input: ValidateQuestionInput): Promise<ValidationOutcome> {
  const result = await callStructured({
    system: VALIDATION_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Subject: ${input.level} ${input.subject}`,
          `Topic: ${input.topic}`,
          `Difficulty label: ${input.difficulty}`,
          "",
          `Question: ${input.text}`,
          ...input.options.map((option, i) => `${i}. ${option}`),
        ].join("\n"),
      },
    ],
    schema: ReviewSchema,
    effort: "high",
    maxTokens: 8_000,
    signal: input.signal,
  });
  if (!result.ok) return { verdict: "error", notes: `Validation call failed: ${result.reason}${result.detail ? ` (${result.detail})` : ""}` };

  const review = result.value.data;
  const { pass, notes } = reviewPasses(review, input.correctIndex);
  return { verdict: pass ? "pass" : "fail", notes, review, model: result.model };
}
