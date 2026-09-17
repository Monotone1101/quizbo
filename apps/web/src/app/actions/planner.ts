"use server";

import { examTitle, isISODate } from "@quizbo/core";
import { confirmExam, PlannerError, prisma, replanUser, setSessionStatus, type Prisma } from "@quizbo/db";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { readPlannerPayload, type ExamDraft } from "@/lib/planner-types";
import { getActiveSubject } from "@/lib/data/subjects";
import { getViewer, viewerToday } from "@/lib/session";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

async function viewerOrThrow() {
  const viewer = await getViewer();
  if (!viewer?.onboardedAt) throw new Error("Sign in first.");
  return viewer;
}

function refresh() {
  revalidatePath("/planner");
  revalidatePath("/", "layout");
}

async function updateDraft(userId: string, messageId: string, draftId: string, patch: Partial<ExamDraft>) {
  const message = await prisma.chatMessage.findFirst({ where: { id: messageId, userId, channel: "PLANNER", role: "ASSISTANT" } });
  if (!message) return null;
  const payload = readPlannerPayload(message.payload);
  const draft = payload.drafts.find((d) => d.draftId === draftId);
  if (!draft) return null;
  const drafts = payload.drafts.map((d) => (d.draftId === draftId ? { ...d, ...patch } : d));
  await prisma.chatMessage.update({
    where: { id: message.id },
    data: { payload: { ...payload, drafts } as unknown as Prisma.InputJsonValue },
  });
  return draft;
}

const ConfirmSchema = z.object({
  messageId: z.string().min(1),
  draftId: z.string().min(1),
  subject: z.string().trim().min(1, "Every exam needs a subject.").max(60),
  name: z.string().trim().max(60),
  examDate: z.string().refine(isISODate, "Pick a valid exam date."),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).nullable(),
  topics: z.array(z.string().trim().min(1).max(80)).max(20),
  edited: z.boolean(),
});

/** The only path from an extracted draft to an EXAM row: an explicit tap on that card. */
export async function confirmDraftAction(input: z.input<typeof ConfirmSchema>): Promise<ActionResult> {
  const viewer = await viewerOrThrow();
  const parsed = ConfirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the card." };
  const values = parsed.data;
  const today = viewerToday(viewer);

  const message = await prisma.chatMessage.findFirst({
    where: { id: values.messageId, userId: viewer.id, channel: "PLANNER", role: "ASSISTANT" },
  });
  const draft = message ? readPlannerPayload(message.payload).drafts.find((d) => d.draftId === values.draftId) : undefined;
  if (!draft || draft.status !== "pending") return { ok: false, message: "That card was already handled." };

  const dateConfidence = values.edited
    ? "EXPLICIT"
    : draft.exam.date_confidence === "explicit"
      ? "EXPLICIT"
      : draft.exam.date_confidence === "inferred"
        ? "INFERRED"
        : "MISSING";

  try {
    const result = await confirmExam({
      userId: viewer.id,
      subject: values.subject,
      name: values.name || "Exam",
      examDate: values.examDate,
      priority: values.priority ?? "MEDIUM",
      dateConfidence,
      topics: values.topics,
      today,
    });
    await updateDraft(viewer.id, values.messageId, values.draftId, { status: "confirmed", examId: result.examId });
    const title = examTitle({ subject: values.subject, exam_name: values.name || null });
    const summary = `Saved ${title}. ${result.sessionsCreated} sessions planned across ${result.examsPlanned} upcoming exam${result.examsPlanned === 1 ? "" : "s"}, within your ${viewer.dailyStudyMinutes} minutes a day.`;
    await prisma.chatMessage.create({ data: { userId: viewer.id, channel: "PLANNER", role: "ASSISTANT", content: summary } });
    refresh();
    return { ok: true, message: summary };
  } catch (error) {
    if (error instanceof PlannerError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function discardDraftAction(messageId: string, draftId: string): Promise<ActionResult> {
  const viewer = await viewerOrThrow();
  const draft = await updateDraft(viewer.id, messageId, draftId, { status: "discarded" });
  refresh();
  return draft ? { ok: true, message: "Card discarded — nothing was saved." } : { ok: false, message: "That card no longer exists." };
}

/** A blank card for students who'd rather type the details (or when AI extraction is offline). */
export async function addManualDraftAction(): Promise<ActionResult> {
  const viewer = await viewerOrThrow();
  const { subject } = await getActiveSubject();
  const draft: ExamDraft = {
    draftId: randomUUID(),
    status: "pending",
    exam: {
      subject: subject?.name ?? "",
      exam_name: null,
      exam_date: null,
      date_confidence: "missing",
      date_phrase: null,
      topics: [],
      priority: null,
    },
  };
  await prisma.chatMessage.create({
    data: {
      userId: viewer.id,
      channel: "PLANNER",
      role: "ASSISTANT",
      content: "Fill in the card and confirm it. Nothing is saved until you do.",
      payload: { kind: "manual", drafts: [draft] } as unknown as Prisma.InputJsonValue,
    },
  });
  refresh();
  return { ok: true, message: "Blank exam card added." };
}

export async function setSessionStatusAction(sessionId: string, status: "DONE" | "SKIPPED" | "PENDING"): Promise<ActionResult> {
  const viewer = await viewerOrThrow();
  try {
    const result = await setSessionStatus(viewer.id, sessionId, status, viewerToday(viewer));
    refresh();
    if (status === "DONE") return { ok: true, message: "Marked done." };
    if (status === "PENDING") return { ok: true, message: "Marked not done." };
    const moved = result.rebalanced.length;
    return {
      ok: true,
      message:
        moved > 0
          ? `Skipped. The time moved onto ${moved} later session${moved === 1 ? "" : "s"} for the same topic.`
          : `Skipped. There's no later session for this topic, so ${result.unallocatedMinutes} minutes weren't reassigned.`,
    };
  } catch (error) {
    if (error instanceof PlannerError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function replanAction(): Promise<ActionResult> {
  const viewer = await viewerOrThrow();
  const result = await replanUser(viewer.id, viewerToday(viewer));
  refresh();
  return result.examsPlanned === 0
    ? { ok: false, message: "No upcoming exams to plan yet." }
    : { ok: true, message: `Re-planned ${result.sessionsCreated} sessions with your latest mastery.` };
}

export async function deleteExamAction(examId: string): Promise<ActionResult> {
  const viewer = await viewerOrThrow();
  const deleted = await prisma.exam.deleteMany({ where: { id: examId, userId: viewer.id } });
  if (deleted.count === 0) return { ok: false, message: "That exam no longer exists." };
  await replanUser(viewer.id, viewerToday(viewer));
  refresh();
  return { ok: true, message: "Exam removed and the plan updated." };
}
