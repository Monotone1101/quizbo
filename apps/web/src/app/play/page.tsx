import { prisma } from "@quizbo/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlayClient } from "@/components/play/play-client";
import { loadPlayerCard } from "@/lib/data/player-card";
import { getActiveSubject } from "@/lib/data/subjects";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Matchmaking" };

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const viewer = await requireViewer();
  const { topic: topicId } = await searchParams;
  const [{ subject }, topic] = await Promise.all([
    getActiveSubject(),
    topicId ? prisma.topic.findUnique({ where: { id: topicId }, include: { subject: true } }) : Promise.resolve(null),
  ]);
  const scope = topic?.subject ?? subject;
  if (!scope) redirect("/dashboard");

  const me = await loadPlayerCard(viewer, scope.id);
  return (
    <PlayClient
      intent={{ kind: "queue", subjectId: scope.id, topicId: topic?.id ?? null }}
      me={me}
      scopeLabel={`${scope.name} · ${topic?.name ?? "Mixed topics"}`}
    />
  );
}
