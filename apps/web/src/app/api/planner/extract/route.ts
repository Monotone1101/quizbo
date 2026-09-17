import { extractExams, isAiConfigured } from "@quizbo/ai";
import { describeExtraction } from "@quizbo/core";
import { prisma, type Prisma } from "@quizbo/db";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readPlannerPayload, type ExamDraft, type PlannerPayload } from "@/lib/planner-types";
import { getViewer, viewerToday } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

const json = (payload: PlannerPayload) => payload as unknown as Prisma.InputJsonValue;

/**
 * Planner intake: stores the student's message, asks Gemini for structured exam data (extraction
 * only), and stores the result as PENDING draft cards. No EXAM row is written here — ever.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.onboardedAt) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2_000) : "";
  if (!message) return NextResponse.json({ error: "Describe an exam first." }, { status: 400 });

  const recent = await prisma.chatMessage.count({
    where: { userId: viewer.id, channel: "PLANNER", role: "USER", createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
  if (recent >= 10) return NextResponse.json({ error: "Slow down a little — try again in a minute." }, { status: 429 });

  const [history, subjects] = await Promise.all([
    prisma.chatMessage.findMany({ where: { userId: viewer.id, channel: "PLANNER" }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.subject.findMany({ select: { name: true, level: true } }),
  ]);

  const pending: Array<{ messageId: string; draft: ExamDraft }> = [];
  for (const row of [...history].reverse()) {
    for (const draft of readPlannerPayload(row.payload).drafts) {
      if (draft.status === "pending") pending.push({ messageId: row.id, draft });
    }
  }
  const previousMessages = history
    .filter((row) => row.role === "USER")
    .slice(0, 6)
    .reverse()
    .map((row) => row.content);

  await prisma.chatMessage.create({ data: { userId: viewer.id, channel: "PLANNER", role: "USER", content: message } });

  const reply = async (content: string, payload: PlannerPayload, offsetMs = 1) =>
    prisma.chatMessage.create({
      data: {
        userId: viewer.id,
        channel: "PLANNER",
        role: "ASSISTANT",
        content,
        payload: json(payload),
        createdAt: new Date(Date.now() + offsetMs),
      },
    });

  if (!isAiConfigured()) {
    await reply("AI extraction is offline on this deployment. Use ADD EXAM to fill in a card by hand — nothing is saved until you confirm it.", {
      kind: "note",
      drafts: [],
      failed: true,
    });
    return NextResponse.json({ ok: false });
  }

  const result = await extractExams({
    message,
    today: viewerToday(viewer),
    timezone: viewer.timezone,
    knownSubjects: subjects.map((s) => (s.level ? `${s.name} (${s.level})` : s.name)),
    pendingDrafts: pending.map((p) => p.draft.exam),
    previousMessages,
    signal: request.signal,
  });

  if (!result.ok) {
    console.warn(`[planner] extraction failed: ${result.reason} ${result.detail ?? ""}`);
    await reply(result.message, { kind: "note", drafts: [], failed: true });
    return NextResponse.json({ ok: false });
  }

  const { extraction } = result;
  if (extraction.exams.length > 0 && pending.length > 0) {
    // The model returns the full updated list, so earlier unconfirmed cards are replaced, not duplicated.
    const byMessage = new Map<string, string[]>();
    for (const p of pending) byMessage.set(p.messageId, [...(byMessage.get(p.messageId) ?? []), p.draft.draftId]);
    for (const [messageId, draftIds] of byMessage) {
      const row = history.find((h) => h.id === messageId);
      if (!row) continue;
      const payload = readPlannerPayload(row.payload);
      await prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          payload: json({
            ...payload,
            drafts: payload.drafts.map((d) => (draftIds.includes(d.draftId) ? { ...d, status: "superseded" } : d)),
          }),
        },
      });
    }
  }

  const drafts: ExamDraft[] = extraction.exams.map((exam) => ({ draftId: randomUUID(), status: "pending", exam }));
  const lines = describeExtraction(extraction);
  for (const [index, line] of lines.entries()) {
    await reply(line, index === 0 ? { kind: "extraction", drafts } : { kind: "note", drafts: [] }, index + 1);
  }
  return NextResponse.json({ ok: true, drafts: drafts.length });
}
