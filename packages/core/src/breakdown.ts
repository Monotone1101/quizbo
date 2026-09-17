/**
 * Post-battle sub-topic breakdown (features.md §2.2), computed deterministically from the
 * per-question answer log. The AI only writes a short paragraph on top of this.
 */
export type Verdict = "STRONG" | "FAIR" | "WEAK";

export const VERDICT_THRESHOLDS = { strong: 0.75, fair: 0.5 } as const;
export const FAST_ANSWER_MS = 4_000;
export const REVIEW_MINUTES_PER_MISS = 6;

export interface AnswerLogRow {
  questionId: string;
  topicId: string;
  topicName: string;
  correct: boolean;
  timeTakenMs: number;
  /** No option was submitted before the timer ran out. */
  timedOut?: boolean;
}

export interface SubtopicRow {
  topicId: string;
  topicName: string;
  correct: number;
  total: number;
  accuracy: number;
  verdict: Verdict;
  avgTimeMs: number | null;
  /** Misses submitted inside the speed-bonus window. */
  fastMisses: number;
  timeouts: number;
}

export interface Breakdown {
  rows: SubtopicRow[];
  weakSpot: SubtopicRow | null;
  totals: { correct: number; total: number; accuracy: number; avgTimeMs: number | null };
}

export function verdictFor(accuracy: number): Verdict {
  if (accuracy >= VERDICT_THRESHOLDS.strong) return "STRONG";
  if (accuracy >= VERDICT_THRESHOLDS.fair) return "FAIR";
  return "WEAK";
}

const average = (values: number[]) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

export function breakdownBySubtopic(answers: readonly AnswerLogRow[]): Breakdown {
  const groups = new Map<string, AnswerLogRow[]>();
  for (const answer of answers) {
    const list = groups.get(answer.topicId) ?? [];
    list.push(answer);
    groups.set(answer.topicId, list);
  }

  const rows: SubtopicRow[] = [...groups.values()].map((list) => {
    const first = list[0] as AnswerLogRow;
    const correct = list.filter((a) => a.correct).length;
    const accuracy = correct / list.length;
    const submitted = list.filter((a) => !a.timedOut);
    return {
      topicId: first.topicId,
      topicName: first.topicName,
      correct,
      total: list.length,
      accuracy,
      verdict: verdictFor(accuracy),
      avgTimeMs: average(submitted.map((a) => a.timeTakenMs)),
      fastMisses: submitted.filter((a) => !a.correct && a.timeTakenMs < FAST_ANSWER_MS).length,
      timeouts: list.length - submitted.length,
    };
  });

  // Strongest first, as on the breakdown screen.
  rows.sort(
    (a, b) => b.accuracy - a.accuracy || b.total - a.total || a.topicName.localeCompare(b.topicName),
  );

  // Exactly one weak spot: lowest accuracy; more answers (more evidence) wins a tie.
  const weakSpot =
    rows.length === 0
      ? null
      : [...rows].sort(
          (a, b) => a.accuracy - b.accuracy || b.total - a.total || a.topicName.localeCompare(b.topicName),
        )[0] ?? null;

  const correct = answers.filter((a) => a.correct).length;
  return {
    rows,
    weakSpot,
    totals: {
      correct,
      total: answers.length,
      accuracy: answers.length ? correct / answers.length : 0,
      avgTimeMs: average(answers.filter((a) => !a.timedOut).map((a) => a.timeTakenMs)),
    },
  };
}

export function reviewMinutes(row: Pick<SubtopicRow, "correct" | "total">): number {
  return Math.max(REVIEW_MINUTES_PER_MISS, (row.total - row.correct) * REVIEW_MINUTES_PER_MISS);
}

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/** Deterministic weak-spot paragraph used when the AI is unavailable or returns something unusable. */
export function fallbackWeakSpotAnalysis(row: SubtopicRow): string {
  const misses = row.total - row.correct;
  const head = `${row.correct} of ${row.total} correct.`;
  if (misses === 0) return `${head} Clean sheet on this sub-topic — a quick rematch keeps it warm.`;
  if (row.fastMisses > 0) {
    const who =
      row.fastMisses === misses
        ? misses === 1
          ? "Your miss came"
          : `All ${misses} misses came`
        : `${NUMBER_WORDS[row.fastMisses] ?? row.fastMisses} of the ${misses} misses came`;
    return `${head} ${who} in under 4 seconds — the speed bonus is costing you here, so read the whole question first.`;
  }
  if (row.timeouts > 0) {
    return `${head} ${row.timeouts === 1 ? "One question" : `${row.timeouts} questions`} ran out of time — practise the setup steps until they are automatic.`;
  }
  return `${head} Go through the worked rationale for each miss, then rematch on this topic to lock it in.`;
}
