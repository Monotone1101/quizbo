/**
 * AI touchpoint 4 — planner chat extraction (architecture.md §5.1).
 *
 * Job: turn a free-form chat message into structured exam data. EXTRACTION ONLY — the model never
 * schedules (the deterministic scheduler does) and nothing it returns is written to the database
 * until the student confirms that exam's card (§5.2).
 *
 * Prompt:        PLANNER_EXTRACTION_SYSTEM (system) + a user turn with today's date, known subjects,
 *                unconfirmed drafts and the new message.
 * Output schema: ExtractionSchema — identical to `Extraction` in @quizbo/core, plus `date_phrase`.
 * Failure path:  refusal, API error, truncation, or output that fails core `parseExtraction` →
 *                `{ ok: false, message: EXTRACTION_FAILURE_MESSAGE }`. Never guesses, never discards silently.
 */
import {
  EXTRACTION_FAILURE_MESSAGE,
  parseExtraction,
  WEEKDAY_SHORT,
  weekdayIndex,
  type ExtractedExam,
  type Extraction,
  type ISODate,
} from "@quizbo/core";
import { z } from "zod";
import type { AiFailureReason } from "./client";
import { callStructured } from "./structured";

export const PLANNER_EXTRACTION_SYSTEM = `You extract exam details from a student's chat message for a study planner. Your only job is extraction: never plan, schedule, or give study advice.

Rules:
- One entry in "exams" for each distinct exam. If the message changes exams that are already drafted, return the full updated list of drafted exams (unchanged ones included).
- subject: the school subject, written to match one of the known subjects when it clearly refers to one (for example "phys" means Physics).
- exam_name: what the exam is called, such as "Term 2" or "Unit test"; null if not stated.
- exam_date: YYYY-MM-DD, or null when no date is given. Never invent a date.
- Resolve relative phrases such as "next Friday", "in two weeks" or "the 18th" against the current date you are given. "Next <weekday>" means the first such weekday after today. "The 18th" means the next 18th on or after today.
- date_confidence: "explicit" only when the student gives a day and month (for example "18 October" or "18/10"); "inferred" when you resolved a relative phrase or supplied the month or year yourself; "missing" when there is no date.
- date_phrase: the exact words the date came from, or null.
- topics: the topics or chapters as the student wrote them, or an empty list. Never add topics they did not mention.
- priority: "high", "medium" or "low" only when the student says how important the exam is; otherwise null.
- ambiguities: one short plain-English note per unclear or missing detail, for example "No date given for Chemistry". Empty when everything is clear.`;

export const ExtractionSchema = z.object({
  exams: z.array(
    z.object({
      subject: z.string(),
      exam_name: z.string().nullable(),
      exam_date: z.string().nullable().describe("YYYY-MM-DD"),
      date_confidence: z.enum(["explicit", "inferred", "missing"]),
      date_phrase: z.string().nullable(),
      topics: z.array(z.string()),
      priority: z.enum(["high", "medium", "low"]).nullable(),
    }),
  ),
  ambiguities: z.array(z.string()),
});

export interface ExtractExamsInput {
  message: string;
  today: ISODate;
  timezone: string;
  knownSubjects: string[];
  /** Unconfirmed drafts from earlier in this intake conversation. */
  pendingDrafts?: ExtractedExam[];
  /** Earlier student messages in this intake, oldest first. */
  previousMessages?: string[];
  signal?: AbortSignal;
}

export type ExtractExamsResult =
  | { ok: true; extraction: Extraction; model: string }
  | { ok: false; reason: AiFailureReason; message: string; detail?: string };

export function buildExtractionUserTurn(input: ExtractExamsInput): string {
  const weekday = WEEKDAY_SHORT[weekdayIndex(input.today)] ?? "";
  const lines = [
    `Current date: ${input.today} (${weekday}). Student's timezone: ${input.timezone}.`,
    `Known subjects: ${input.knownSubjects.join(", ") || "none listed"}.`,
  ];
  if (input.pendingDrafts?.length) {
    lines.push(
      "Exams already drafted but not yet confirmed by the student:",
      JSON.stringify({ exams: input.pendingDrafts }, null, 2),
    );
  }
  if (input.previousMessages?.length) {
    lines.push("Earlier messages from the student in this conversation:", ...input.previousMessages.map((m) => `- ${m}`));
  }
  lines.push("New message from the student:", `"""${input.message}"""`);
  return lines.join("\n");
}

export async function extractExams(input: ExtractExamsInput): Promise<ExtractExamsResult> {
  const result = await callStructured({
    system: PLANNER_EXTRACTION_SYSTEM,
    messages: [{ role: "user", content: buildExtractionUserTurn(input) }],
    schema: ExtractionSchema,
    effort: "low",
    maxTokens: 4_000,
    signal: input.signal,
  });
  if (!result.ok) {
    return { ok: false, reason: result.reason, message: EXTRACTION_FAILURE_MESSAGE, detail: result.detail };
  }
  // Defensive parse of the raw text too (fences, shape, dates) — the schema alone is not trusted.
  const parsed = parseExtraction(result.value.text || result.value.data);
  if (!parsed.ok) {
    return { ok: false, reason: "invalid_output", message: EXTRACTION_FAILURE_MESSAGE, detail: parsed.error };
  }
  return { ok: true, extraction: parsed.value, model: result.model };
}
