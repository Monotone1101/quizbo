import type { CoachTone } from "@quizbo/ai";

export interface CoachNoteCardView {
  title: string;
  body: string;
  topic: string | null;
  source: string;
  state: "draft" | "saved" | "discarded";
}

export interface CoachMessageView {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  noteCards: CoachNoteCardView[];
  attachment: string | null;
  failed: boolean;
}

export interface CoachThreadView {
  messages: CoachMessageView[];
  subjectName: string;
  tone: CoachTone;
  matches: number;
  aiEnabled: boolean;
  weakTopic: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readNoteCards(payload: unknown): CoachNoteCardView[] {
  if (!isRecord(payload) || !Array.isArray(payload.noteCards)) return [];
  return payload.noteCards.filter(isRecord).map((card) => ({
    title: String(card.title ?? ""),
    body: String(card.body ?? ""),
    topic: typeof card.topic === "string" ? card.topic : null,
    source: typeof card.source === "string" ? card.source : "from chat",
    state: card.state === "saved" || card.state === "discarded" ? card.state : "draft",
  }));
}

export function toMessageView(row: {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: Date;
  payload: unknown;
}): CoachMessageView {
  const payload = isRecord(row.payload) ? row.payload : {};
  const attachment = isRecord(payload.attachment) && typeof payload.attachment.name === "string" ? payload.attachment.name : null;
  return {
    id: row.id,
    role: row.role === "USER" ? "user" : "assistant",
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    noteCards: readNoteCards(row.payload),
    attachment,
    failed: payload.failed === true,
  };
}
