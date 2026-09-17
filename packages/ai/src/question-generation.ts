/**
 * AI touchpoint 1 — offline question generation (architecture.md §6, step 1).
 *
 * Batch only: called from the worker/CLI, never while a battle is running. Output is written to
 * QUESTION with `validated = false`; nothing generated here can be served until the separately
 * prompted validation pass (question-validation.ts) flips it.
 *
 * Prompt:        generationSystemPrompt(subject, level) + a user turn with topic, difficulty, count
 *                and existing question stems to avoid.
 * Output schema: GenerationSchema { questions: [{ text, options[4], correct_index, rationale, difficulty }] }.
 * Failure path:  `{ ok: false }` → the batch logs and moves on; malformed items are dropped by
 *                `sanitizeGeneratedQuestion` rather than stored.
 */
import { z } from "zod";
import type { AiResult } from "./client";
import { callStructured } from "./structured";
import { sanitizeGeneratedQuestion, type GeneratedQuestion } from "./validators";

export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";

export function generationSystemPrompt(subject: string, level: string): string {
  return `You write multiple-choice questions for Quizbo's battle question bank: timed questions (12 seconds each) for ${level} ${subject} students, played head-to-head.

Every question must:
- test one idea from the requested topic and be answerable in about 10 seconds by a prepared student (short numbers, no long derivations);
- have exactly four options with exactly one correct answer, and distractors that reflect real misconceptions (sign errors, inverted ratios, wrong formula), not jokes;
- be self-contained, unambiguous and factually correct under standard ${level} syllabus conventions — state any sign convention or constant it depends on;
- avoid "all of the above", "none of the above", and "which is NOT" stems;
- come with a one- or two-sentence rationale showing why the correct option is right.

Difficulty: EASY = one recall step; MEDIUM = one calculation or two-step reasoning; HARD = several steps, still doable in about 10 seconds by a strong student.
Do not repeat or closely paraphrase any existing question you are shown.`;
}

export const GenerationSchema = z.object({
  questions: z.array(
    z.object({
      text: z.string(),
      options: z.array(z.string()).describe("Exactly four options"),
      correct_index: z.number().int().describe("0-based index of the single correct option"),
      rationale: z.string(),
      difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    }),
  ),
});

export interface GenerateQuestionsInput {
  subject: string;
  level: string;
  topic: string;
  unit: string | null;
  difficulty: QuestionDifficulty;
  count: number;
  avoid: string[];
  signal?: AbortSignal;
}

export async function generateQuestions(input: GenerateQuestionsInput): Promise<AiResult<GeneratedQuestion[]>> {
  const avoid = input.avoid.slice(0, 60);
  const result = await callStructured({
    system: generationSystemPrompt(input.subject, input.level),
    messages: [
      {
        role: "user",
        content: [
          `Topic: ${input.topic}${input.unit ? ` (chapter: ${input.unit})` : ""}`,
          `Difficulty: ${input.difficulty}`,
          `Write ${input.count} questions.`,
          avoid.length ? `Existing questions to avoid:\n${avoid.map((q) => `- ${q}`).join("\n")}` : "There are no existing questions for this topic yet.",
        ].join("\n"),
      },
    ],
    schema: GenerationSchema,
    effort: "high",
    maxTokens: 16_000,
    signal: input.signal,
  });
  if (!result.ok) return result;

  const questions = result.value.data.questions
    .map((q) => sanitizeGeneratedQuestion({ ...q, difficulty: q.difficulty ?? input.difficulty }))
    .filter((q): q is GeneratedQuestion => q !== null);
  return { ok: true, value: questions, model: result.model };
}
