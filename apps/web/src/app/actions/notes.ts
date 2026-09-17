"use server";

import { prisma, type Prisma } from "@quizbo/db";
import { revalidatePath } from "next/cache";
import { readNoteCards } from "@/lib/coach-types";
import { getActiveSubject } from "@/lib/data/subjects";
import { getViewer } from "@/lib/session";

async function viewerOrThrow() {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Sign in first.");
  return viewer;
}

async function updateCardState(messageId: string, index: number, state: "saved" | "discarded") {
  const viewer = await viewerOrThrow();
  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, userId: viewer.id, channel: "COACH", role: "ASSISTANT" },
  });
  const cards = readNoteCards(message?.payload);
  const card = cards[index];
  if (!message || !card || card.state !== "draft") return { ok: false as const };

  if (state === "saved") {
    const { subject } = await getActiveSubject();
    const topic = card.topic && subject
      ? await prisma.topic.findFirst({ where: { subjectId: subject.id, name: { equals: card.topic, mode: "insensitive" } } })
      : null;
    await prisma.note.create({
      data: {
        userId: viewer.id,
        subjectId: subject?.id ?? null,
        topicId: topic?.id ?? null,
        kicker: `${card.topic ?? subject?.name ?? "Notes"} · ${card.source}`,
        title: card.title,
        body: card.body,
      },
    });
  }

  cards[index] = { ...card, state };
  const payload = { ...(message.payload as Record<string, unknown>), noteCards: cards } as unknown as Prisma.InputJsonValue;
  await prisma.chatMessage.update({ where: { id: message.id }, data: { payload } });
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/** The student chose to keep a card the coach drafted. Nothing is saved without this click. */
export async function saveDraftNote(messageId: string, index: number) {
  return updateCardState(messageId, index, "saved");
}

export async function discardDraftNote(messageId: string, index: number) {
  return updateCardState(messageId, index, "discarded");
}

export async function deleteNote(noteId: string) {
  const viewer = await viewerOrThrow();
  await prisma.note.deleteMany({ where: { id: noteId, userId: viewer.id } });
  revalidatePath("/dashboard");
}
