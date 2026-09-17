import "server-only";
import { breakdownBySubtopic, type AnswerLogRow } from "@quizbo/core";
import { prisma, type User } from "@quizbo/db";

/** Everything the breakdown and review pages need for one battle, scoped to a participant. */
export async function loadBattleForViewer(battleId: string, viewer: User) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { subject: true, topic: true, players: true },
  });
  if (!battle) return null;
  const me = battle.players.find((p) => p.userId === viewer.id);
  if (!me) return null;
  const opponent = battle.players.find((p) => p.userId !== viewer.id) ?? null;

  const answers = await prisma.battleAnswer.findMany({
    where: { battleId, userId: viewer.id },
    orderBy: { round: "asc" },
    include: {
      topic: { select: { name: true, unit: true } },
      question: { select: { text: true, options: true, correctIndex: true, rationale: true, difficulty: true } },
    },
  });

  const log: AnswerLogRow[] = answers.map((a) => ({
    questionId: a.questionId,
    topicId: a.topicId,
    topicName: a.topic.name,
    correct: a.correct,
    timeTakenMs: a.timeTakenMs,
    timedOut: a.selectedIndex === null,
  }));

  const units = new Map<string, number>();
  for (const a of answers) {
    const unit = a.topic.unit ?? a.topic.name;
    units.set(unit, (units.get(unit) ?? 0) + 1);
  }
  const mainUnit = [...units.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;

  return {
    battle,
    me,
    opponent,
    answers,
    breakdown: breakdownBySubtopic(log),
    scopeLabel: battle.topic?.name ?? mainUnit ?? "Mixed",
  };
}
