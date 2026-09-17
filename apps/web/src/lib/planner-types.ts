import { isISODate, type ExtractedExam } from "@quizbo/core";

/**
 * Planner intake drafts live in ChatMessage.payload — never in EXAM. A draft becomes an exam only
 * when the student confirms that specific card (architecture.md §5.2).
 */
export type DraftStatus = "pending" | "confirmed" | "discarded" | "superseded";

export interface ExamDraft {
  draftId: string;
  status: DraftStatus;
  exam: ExtractedExam;
  examId?: string;
}

export interface PlannerPayload {
  kind: "extraction" | "manual" | "note";
  drafts: ExamDraft[];
  failed?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function readExam(value: unknown): ExtractedExam | null {
  if (!isRecord(value) || typeof value.subject !== "string") return null;
  const confidence = value.date_confidence;
  const priority = value.priority;
  return {
    subject: value.subject,
    exam_name: typeof value.exam_name === "string" ? value.exam_name : null,
    exam_date: isISODate(value.exam_date) ? value.exam_date : null,
    date_confidence: confidence === "explicit" || confidence === "inferred" ? confidence : "missing",
    date_phrase: typeof value.date_phrase === "string" ? value.date_phrase : null,
    topics: Array.isArray(value.topics) ? value.topics.filter((t): t is string => typeof t === "string") : [],
    priority: priority === "high" || priority === "medium" || priority === "low" ? priority : null,
  };
}

export function readPlannerPayload(payload: unknown): PlannerPayload {
  if (!isRecord(payload)) return { kind: "note", drafts: [] };
  const drafts = Array.isArray(payload.drafts)
    ? payload.drafts.flatMap((raw): ExamDraft[] => {
        if (!isRecord(raw) || typeof raw.draftId !== "string") return [];
        const exam = readExam(raw.exam);
        if (!exam) return [];
        const status = raw.status;
        return [
          {
            draftId: raw.draftId,
            status: status === "confirmed" || status === "discarded" || status === "superseded" ? status : "pending",
            exam,
            ...(typeof raw.examId === "string" ? { examId: raw.examId } : {}),
          },
        ];
      })
    : [];
  const kind = payload.kind === "extraction" || payload.kind === "manual" ? payload.kind : "note";
  return { kind, drafts, ...(payload.failed === true ? { failed: true } : {}) };
}

export interface TopicPreview {
  query: string;
  detail: string;
  kind: "topic" | "group" | "new";
}

export interface DraftCardView {
  messageId: string;
  draftId: string;
  manual: boolean;
  exam: ExtractedExam;
  subjectMatch: string | null;
  topicPreview: TopicPreview[];
}

export interface IntakeMessageView {
  id: string;
  role: "user" | "assistant";
  content: string;
  failed: boolean;
}

export interface SessionChipView {
  id: string;
  topicId: string;
  topicName: string;
  minutes: number;
  status: "PENDING" | "DONE" | "SKIPPED";
  kind: "REVIEW" | "BATTLE";
  examTitle: string;
  canBattle: boolean;
}

export interface WeekDayView {
  date: string;
  label: string;
  dayNumber: string;
  isToday: boolean;
  isPast: boolean;
  sessions: SessionChipView[];
  exams: Array<{ id: string; title: string }>;
}
