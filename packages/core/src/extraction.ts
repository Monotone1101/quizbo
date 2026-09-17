/**
 * Planner extraction contract (architecture.md §5.1) and its defensive parser. The LLM only turns a
 * chat message into this JSON; nothing here schedules, and nothing here writes to the database.
 *
 * Schema addition: `date_phrase` carries the words a date was read from ("next Friday") so the
 * confirmation card can show the student where an inferred date came from.
 */
import { formatDayMonth, isISODate, type ISODate } from "./dates";

export type DateConfidence = "explicit" | "inferred" | "missing";
export type ExtractedPriority = "high" | "medium" | "low";

export interface ExtractedExam {
  subject: string;
  exam_name: string | null;
  exam_date: ISODate | null;
  date_confidence: DateConfidence;
  date_phrase: string | null;
  topics: string[];
  priority: ExtractedPriority | null;
}

export interface Extraction {
  exams: ExtractedExam[];
  ambiguities: string[];
}

export type ExtractionParseResult = { ok: true; value: Extraction } | { ok: false; error: string };

export const EXTRACTION_FAILURE_MESSAGE =
  "Couldn't understand that — try rephrasing with the subject, the exam and when it is.";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cleanString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 && trimmed.toLowerCase() !== "null" ? trimmed : null;
};

function dedupeStrings(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = cleanString(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?\s*```$/.exec(trimmed);
  return fenced ? (fenced[1] ?? "").trim() : trimmed;
}

function normalizeConfidence(value: unknown): DateConfidence | null {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return text === "explicit" || text === "inferred" || text === "missing" ? text : null;
}

function normalizePriority(value: unknown): ExtractedPriority | null {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return text === "high" || text === "medium" || text === "low" ? text : null;
}

/**
 * Accepts the raw model text (or an already-parsed object). Strips fences, tolerates prose around a
 * single JSON object, and rejects anything whose shape doesn't match — the caller then shows
 * EXTRACTION_FAILURE_MESSAGE instead of guessing.
 */
export function parseExtraction(input: unknown): ExtractionParseResult {
  let data: unknown = input;
  if (typeof input === "string") {
    const cleaned = stripJsonFences(input);
    try {
      data = JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end <= start) return { ok: false, error: "not_json" };
      try {
        data = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return { ok: false, error: "not_json" };
      }
    }
  }

  if (!isRecord(data) || !Array.isArray(data.exams)) return { ok: false, error: "missing_exams_array" };

  const exams: ExtractedExam[] = [];
  for (const [index, raw] of data.exams.entries()) {
    if (!isRecord(raw)) return { ok: false, error: `exam_${index}_not_object` };
    const subject = cleanString(raw.subject);
    if (!subject) return { ok: false, error: `exam_${index}_missing_subject` };

    const examDate = isISODate(raw.exam_date) ? raw.exam_date : null;
    let confidence = normalizeConfidence(raw.date_confidence);
    // A missing date is always "missing"; a date without a stated confidence must be confirmed.
    if (examDate === null) confidence = "missing";
    else if (confidence === null || confidence === "missing") confidence = "inferred";

    exams.push({
      subject,
      exam_name: cleanString(raw.exam_name),
      exam_date: examDate,
      date_confidence: confidence,
      date_phrase: cleanString(raw.date_phrase),
      topics: dedupeStrings(Array.isArray(raw.topics) ? raw.topics : []),
      priority: normalizePriority(raw.priority),
    });
  }

  const ambiguities = dedupeStrings(Array.isArray(data.ambiguities) ? data.ambiguities : []);
  return { ok: true, value: { exams, ambiguities } };
}

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const countWord = (n: number, lower = false) => {
  const word = COUNT_WORDS[n] ?? String(n);
  return lower ? word.toLowerCase() : word;
};

export function examTitle(exam: Pick<ExtractedExam, "subject" | "exam_name">): string {
  return `${exam.subject} — ${exam.exam_name ?? "Exam"}`;
}

/**
 * The intake assistant's reply, written deterministically from the extraction so the chat never
 * says something the cards don't show.
 */
export function describeExtraction(extraction: Extraction): string[] {
  const { exams, ambiguities } = extraction;
  if (exams.length === 0) {
    return [
      "I couldn't find an exam in that. Tell me the subject and when it is — for example “Physics term 2 on 18 October, optics and wave optics”.",
    ];
  }

  const parts = exams.map((exam) => {
    const title = examTitle(exam);
    const topics = exam.topics.length
      ? `, ${countWord(exam.topics.length, true)} topic${exam.topics.length === 1 ? "" : "s"}`
      : "";
    if (!exam.exam_date) return `${title}, no date yet${topics}.`;
    if (exam.date_confidence === "inferred") {
      const source = exam.date_phrase ? `I read “${exam.date_phrase}” as` : "I inferred the date as";
      return `${title}${topics}, and ${source} ${formatDayMonth(exam.exam_date)}.`;
    }
    return `${title}, ${formatDayMonth(exam.exam_date)}${topics}.`;
  });

  const lines = [`${countWord(exams.length)} exam${exams.length === 1 ? "" : "s"} found. ${parts.join(" ")}`];

  const unclear = [...ambiguities];
  for (const exam of exams) {
    if (exam.date_confidence === "missing") unclear.push(`there is no date for ${examTitle(exam)}`);
  }
  const needsCheck = unclear.length > 0 || exams.some((e) => e.date_confidence === "inferred");
  if (unclear.length === 1) {
    lines.push(`One thing is unclear: ${unclear[0]}. Check it on the card before I save anything.`);
  } else if (unclear.length > 1) {
    lines.push(`${countWord(unclear.length)} things are unclear: ${unclear.join("; ")}. Check them on the cards before I save anything.`);
  } else if (needsCheck) {
    lines.push("One date came from a relative phrase, so confirm it on the card before I save anything.");
  } else {
    lines.push("Nothing is saved until you confirm a card.");
  }
  return lines;
}
