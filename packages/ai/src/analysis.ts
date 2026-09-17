/**
 * AI touchpoint 3 — post-battle weak-spot paragraph (features.md §2.2).
 *
 * The breakdown numbers are computed deterministically (core `breakdownBySubtopic`); the model only
 * writes one short diagnostic paragraph about the highlighted weak spot.
 *
 * Prompt:        analysisSystemPrompt(tone) + the weak spot's misses as the user turn.
 * Output schema: AnalysisSchema { paragraph }.
 * Failure path:  anything unusable (no key, refusal, error, empty, too long, wrong opening) →
 *                `{ ok: false }`; the caller shows core `fallbackWeakSpotAnalysis` instead.
 */
import { FAST_ANSWER_MS } from "@quizbo/core";
import { z } from "zod";
import type { AiFailureReason } from "./client";
import type { CoachTone } from "./coach";
import { callStructured } from "./structured";
import { acceptAnalysisParagraph } from "./validators";

const TONE: Record<CoachTone, string> = {
  direct: "direct and matter-of-fact",
  encouraging: "warm but specific",
  brief: "very brief",
};

export function analysisSystemPrompt(tone: CoachTone): string {
  return `You write the one-paragraph weak-spot diagnosis shown on a student's screen right after a 1v1 quiz battle. The scores are already computed; your job is to explain the pattern behind the misses and name one habit to change.

Constraints: at most 55 words; second person; ${TONE[tone]}; no greeting, no markdown, no filler praise. Begin with exactly the score sentence you are given (for example "1 of 4 correct."). Only mention answer speed if the misses were answered in under ${FAST_ANSWER_MS / 1000} seconds.`;
}

export const AnalysisSchema = z.object({ paragraph: z.string() });

export interface WeakSpotAnalysisInput {
  tone: CoachTone;
  subjectName: string;
  topicName: string;
  correct: number;
  total: number;
  misses: Array<{ question: string; chosen: string | null; correct: string; timeTakenMs: number; timedOut: boolean }>;
  signal?: AbortSignal;
}

export async function weakSpotAnalysis(
  input: WeakSpotAnalysisInput,
): Promise<{ ok: true; text: string; model: string } | { ok: false; reason: AiFailureReason; detail?: string }> {
  const scoreSentence = `${input.correct} of ${input.total} correct.`;
  const misses = input.misses
    .map((m, i) =>
      [
        `Miss ${i + 1}: ${m.question}`,
        `  Student chose: ${m.timedOut ? "(ran out of time)" : (m.chosen ?? "(no answer)")}`,
        `  Correct answer: ${m.correct}`,
        `  Time taken: ${(m.timeTakenMs / 1000).toFixed(1)}s`,
      ].join("\n"),
    )
    .join("\n");

  const result = await callStructured({
    system: analysisSystemPrompt(input.tone),
    messages: [
      {
        role: "user",
        content: `Subject: ${input.subjectName}\nWeak sub-topic: ${input.topicName}\nScore sentence to begin with: "${scoreSentence}"\n\n${misses || "No misses."}`,
      },
    ],
    schema: AnalysisSchema,
    effort: "low",
    maxTokens: 2_000,
    signal: input.signal,
  });
  if (!result.ok) return result;

  const text = acceptAnalysisParagraph(result.value.data.paragraph, scoreSentence);
  return text ? { ok: true, text, model: result.model } : { ok: false, reason: "invalid_output", detail: "paragraph rejected" };
}
