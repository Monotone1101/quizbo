/** Pure checks applied to model output before anything is shown or stored. */

export interface GeneratedQuestion {
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  rationale: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

const clean = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

/** Drops anything that isn't a well-formed 4-option, single-key MCQ. */
export function sanitizeGeneratedQuestion(raw: {
  text?: unknown;
  options?: unknown;
  correct_index?: unknown;
  rationale?: unknown;
  difficulty?: unknown;
}): GeneratedQuestion | null {
  const text = clean(raw.text);
  const rationale = clean(raw.rationale);
  const options = Array.isArray(raw.options) ? raw.options.map(clean) : [];
  const index = raw.correct_index;
  const difficulty = raw.difficulty;
  if (text.length < 12 || text.length > 400 || !rationale) return null;
  if (options.length !== 4 || options.some((o) => !o || o.length > 160)) return null;
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return null;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 3) return null;
  if (difficulty !== "EASY" && difficulty !== "MEDIUM" && difficulty !== "HARD") return null;
  if (/\b(all|none) of the above\b/i.test(options.join(" "))) return null;
  return {
    text,
    options: options as [string, string, string, string],
    correctIndex: index as 0 | 1 | 2 | 3,
    rationale,
    difficulty,
  };
}

export interface QuestionReview {
  solved_index: number | null;
  confidence: "high" | "medium" | "low";
  exactly_one_correct: boolean;
  ambiguous_wording: boolean;
  factual_issues: string[];
  duplicate_options: boolean;
  difficulty_fit: "too_easy" | "ok" | "too_hard";
  notes: string;
}

/** A question passes only if the blind reviewer reached the same key and raised no issue. */
export function reviewPasses(review: QuestionReview, correctIndex: number): { pass: boolean; notes: string } {
  const problems: string[] = [];
  if (review.solved_index !== correctIndex) {
    problems.push(`reviewer answered ${review.solved_index ?? "none"}, key is ${correctIndex}`);
  }
  if (!review.exactly_one_correct) problems.push("not exactly one correct option");
  if (review.ambiguous_wording) problems.push("ambiguous wording");
  if (review.duplicate_options) problems.push("duplicate options");
  if (review.factual_issues.length) problems.push(`factual issues: ${review.factual_issues.join("; ")}`);
  if (review.difficulty_fit !== "ok") problems.push(`difficulty ${review.difficulty_fit.replace("_", " ")}`);
  if (review.confidence === "low") problems.push("low reviewer confidence");
  const pass = problems.length === 0;
  const notes = pass ? `AI review passed (${review.confidence} confidence). ${review.notes}`.trim() : `AI review failed: ${problems.join(", ")}. ${review.notes}`.trim();
  return { pass, notes };
}

/** Accepts the analysis paragraph only if it is short, non-empty and opens with the score sentence. */
export function acceptAnalysisParagraph(paragraph: string, scoreSentence: string): string | null {
  const text = paragraph.trim().replace(/\s+/g, " ");
  if (!text || !text.startsWith(scoreSentence)) return null;
  if (text.split(" ").length > 90) return null;
  if (/[#*`|]/.test(text)) return null;
  return text;
}

export interface DraftNoteCard {
  title: string;
  body: string;
  topic: string | null;
}

export function cleanNoteCards(cards: Array<{ title?: unknown; body?: unknown; topic?: unknown }>): DraftNoteCard[] {
  return cards
    .map((card) => ({
      title: clean(card.title).slice(0, 80),
      body: clean(card.body).slice(0, 400),
      topic: clean(card.topic) || null,
    }))
    .filter((card) => card.title && card.body)
    .slice(0, 4);
}
