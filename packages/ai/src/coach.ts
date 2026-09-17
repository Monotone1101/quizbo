/**
 * Coach chat (drawer on the dashboard). Explains, diagnoses from battle history, and summarises
 * material the student uploads into DRAFT note cards — the student decides whether to save them.
 * The coach never writes questions for the live battle bank.
 *
 * Prompt:        coachSystemPrompt(tone, level) + a <student_context> block on the latest user turn.
 * Output schema: CoachReplySchema { reply, note_cards[] }.
 * Failure path:  `{ ok: false }` with a short message the drawer shows; nothing is saved.
 */
import type { Part } from "@google/genai";
import { z } from "zod";
import type { AiFailureReason } from "./client";
import { callStructured, type ChatTurn } from "./structured";
import { cleanNoteCards, type DraftNoteCard } from "./validators";

export type CoachTone = "direct" | "encouraging" | "brief";

const TONE_GUIDE: Record<CoachTone, string> = {
  direct: "Direct: get to the point and name the mistake plainly. Competitive students want the fix, not reassurance.",
  encouraging: "Encouraging: note what is improving, then give the next step with a little more explanation.",
  brief: "Brief: one or two sentences and a concrete next action. The student wants reminders, not lectures.",
};

export function coachSystemPrompt(tone: CoachTone, level: string): string {
  return `You are Quizbo's personal study coach for a ${level} student preparing for exams. You explain concepts, diagnose mistakes from their battle history, and summarise material they share.

Voice: ${TONE_GUIDE[tone]} Keep replies under 120 words unless the student asks for more. Write plain text in short paragraphs, with no markdown headings or tables.

What you know about the student is in <student_context> on their latest message. Use it when it helps; don't recite it back.

Note cards: when the student shares a document, or asks you to summarise or save something, include up to 4 note cards. Each has a title of at most 7 words and a body of at most 2 sentences they can skim before a match. Otherwise return an empty list. Cards are drafts: the student chooses whether to save them.

Integrity: you never write, edit, or reveal questions for Quizbo's live battle question bank. If the student asks to be quizzed, you may ask conversational practice questions and say they are practice.`;
}

export const CoachReplySchema = z.object({
  reply: z.string(),
  note_cards: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
      topic: z.string().nullable(),
    }),
  ),
});

export interface CoachContext {
  studentName: string;
  subjectName: string;
  level: string;
  rating: number | null;
  matchesPlayed: number;
  weakTopics: Array<{ name: string; mastery: number }>;
  recentMisses: Array<{ topic: string; question: string; chosen: string | null; correct: string }>;
}

export interface CoachAttachment {
  name: string;
  mediaType: "application/pdf" | "text/plain";
  /** Base64 for PDFs, raw text for plain text. */
  data: string;
}

export interface CoachReplyInput {
  tone: CoachTone;
  context: CoachContext;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  message: string;
  attachment?: CoachAttachment;
  signal?: AbortSignal;
}

export type CoachReplyResult =
  | { ok: true; reply: string; noteCards: DraftNoteCard[]; model: string }
  | { ok: false; reason: AiFailureReason; message: string };

export function renderStudentContext(context: CoachContext): string {
  const lines = [
    `Name: ${context.studentName}`,
    `Subject: ${context.subjectName} (${context.level})`,
    `Battles played: ${context.matchesPlayed}${context.rating ? ` · ELO ${context.rating}` : ""}`,
  ];
  if (context.weakTopics.length) {
    lines.push(`Weakest topics (mastery 0–1): ${context.weakTopics.map((t) => `${t.name} ${t.mastery.toFixed(2)}`).join("; ")}`);
  }
  if (context.recentMisses.length) {
    lines.push("Recent misses:");
    for (const miss of context.recentMisses) {
      lines.push(`- [${miss.topic}] ${miss.question} — chose "${miss.chosen ?? "no answer"}", correct "${miss.correct}"`);
    }
  }
  return `<student_context>\n${lines.join("\n")}\n</student_context>`;
}

export async function coachReply(input: CoachReplyInput): Promise<CoachReplyResult> {
  const parts: Part[] = [];
  if (input.attachment?.mediaType === "application/pdf") {
    parts.push({ text: `Attached document: ${input.attachment.name}` });
    parts.push({ inlineData: { mimeType: "application/pdf", data: input.attachment.data } });
  } else if (input.attachment) {
    parts.push({ text: `Attached document "${input.attachment.name}":\n${input.attachment.data}` });
  }
  parts.push({ text: `${renderStudentContext(input.context)}\n\n${input.message}` });

  const history: ChatTurn[] = input.history.slice(-12).map((m) => ({ role: m.role, content: m.content }));
  // Conversations start with a student turn.
  while (history[0]?.role === "assistant") history.shift();

  const result = await callStructured({
    system: coachSystemPrompt(input.tone, input.context.level),
    messages: [...history, { role: "user", content: parts }],
    schema: CoachReplySchema,
    effort: "medium",
    maxTokens: 8_000,
    signal: input.signal,
  });

  if (!result.ok) {
    const message =
      result.reason === "unconfigured"
        ? "The coach is offline — no Gemini API key is configured for this deployment."
        : result.reason === "auth_error"
          ? "The coach can't reach Gemini — the deployment's API key was rejected."
          : result.reason === "rate_limited"
            ? "The coach is busy right now (Gemini rate limit). Try again in a minute."
            : "The coach couldn't answer that one. Try rephrasing.";
    return { ok: false, reason: result.reason, message };
  }

  const reply = result.value.data.reply.trim();
  if (!reply) return { ok: false, reason: "invalid_output", message: "The coach couldn't answer that one. Try rephrasing." };
  return { ok: true, reply, noteCards: cleanNoteCards(result.value.data.note_cards), model: result.model };
}
