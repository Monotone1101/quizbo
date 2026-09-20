import "server-only";
import { BATTLE_RULES } from "@quizbo/core";
import { prisma } from "@quizbo/db";
import { cache } from "react";

export interface ScopeTopic {
  id: string;
  name: string;
  questions: number;
}

export interface ScopeSubject {
  id: string;
  name: string;
  level: string | null;
  /** Validated questions across the whole subject — what a "Mixed topics" queue draws from. */
  questions: number;
  topics: ScopeTopic[];
}

/**
 * The subjects and topics a battle can actually run in: each needs at least `minQuestions`
 * validated questions, the same floor the battle service enforces before it lets anyone queue
 * (server.ts, `queue:join`). The play screen offers only these, so a player can never pick a scope
 * that will be rejected — and can see which ones are thin.
 */
export const listBattleScopes = cache(async (): Promise<ScopeSubject[]> => {
  const [subjects, counts] = await Promise.all([
    prisma.subject.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        level: true,
        topics: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } },
      },
    }),
    prisma.question.groupBy({ by: ["topicId"], where: { validated: true }, _count: { _all: true } }),
  ]);

  const byTopic = new Map(counts.map((row) => [row.topicId, row._count._all]));
  return subjects
    .map((subject) => ({
      id: subject.id,
      name: subject.name,
      level: subject.level,
      questions: subject.topics.reduce((sum, topic) => sum + (byTopic.get(topic.id) ?? 0), 0),
      topics: subject.topics
        .map((topic) => ({ id: topic.id, name: topic.name, questions: byTopic.get(topic.id) ?? 0 }))
        .filter((topic) => topic.questions >= BATTLE_RULES.minQuestions),
    }))
    .filter((subject) => subject.questions >= BATTLE_RULES.minQuestions);
});

export function scopeLabelFor(subject: Pick<ScopeSubject, "name">, topic: Pick<ScopeTopic, "name"> | null) {
  return `${subject.name} · ${topic?.name ?? "Mixed topics"}`;
}
