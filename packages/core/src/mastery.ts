/**
 * Topic mastery, per (user, topic), on a 0–1 scale. Separate from ELO: it moves with accuracy on
 * that topic and feeds both the post-battle breakdown and the scheduler's weighting.
 */
export const MASTERY_PRIOR = 0.5;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Starting mastery from the onboarding self-rated confidence (1–5) → 0.3 … 0.7. */
export function priorFromConfidence(confidence: number | null | undefined): number {
  if (!confidence || confidence < 1 || confidence > 5) return MASTERY_PRIOR;
  return round3(0.3 + (Math.round(confidence) - 1) * 0.1);
}

/** More answers in one battle count as stronger evidence, capped so one battle can't erase history. */
export function masteryLearningRate(answers: number): number {
  return Math.min(0.6, 0.15 * Math.max(0, answers));
}

/** Exponential moving average toward this battle's accuracy on the topic. */
export function updateMastery(
  previous: number | null | undefined,
  correct: number,
  total: number,
  prior: number = MASTERY_PRIOR,
): number {
  const base = clamp01(previous ?? prior);
  if (total <= 0) return round3(base);
  const accuracy = clamp01(correct / total);
  return round3(clamp01(base + masteryLearningRate(total) * (accuracy - base)));
}

export function tallyByTopic<T extends { topicId: string; correct: boolean }>(
  answers: readonly T[],
): Map<string, { correct: number; total: number }> {
  const tally = new Map<string, { correct: number; total: number }>();
  for (const answer of answers) {
    const entry = tally.get(answer.topicId) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (answer.correct) entry.correct += 1;
    tally.set(answer.topicId, entry);
  }
  return tally;
}
