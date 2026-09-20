import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlayClient } from "@/components/play/play-client";
import { listBattleScopes, scopeLabelFor } from "@/lib/data/battle-scopes";
import { loadPlayerCard } from "@/lib/data/player-card";
import { getActiveSubject } from "@/lib/data/subjects";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Matchmaking" };

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const viewer = await requireViewer();
  const { topic: topicId } = await searchParams;
  const [{ subject }, scopes] = await Promise.all([getActiveSubject(), listBattleScopes()]);

  // `?topic=` (from a topic card) wins, then the subject switcher, then whatever can be played.
  const fromTopic = topicId ? scopes.find((s) => s.topics.some((t) => t.id === topicId)) : undefined;
  const scope = fromTopic ?? scopes.find((s) => s.id === subject?.id) ?? scopes[0];
  if (!scope) redirect("/dashboard");
  const topic = fromTopic?.topics.find((t) => t.id === topicId) ?? null;

  const me = await loadPlayerCard(viewer, scope.id);
  return (
    <PlayClient
      intent={{ kind: "queue", subjectId: scope.id, topicId: topic?.id ?? null }}
      me={me}
      scopeLabel={scopeLabelFor(scope, topic)}
      scopes={scopes}
    />
  );
}
