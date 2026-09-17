import { randomInt } from "node:crypto";
import { placementRating, priorFromConfidence, shuffle, tallyByTopic, updateMastery } from "@quizbo/core";
import { prisma } from "@quizbo/db";
import type { BattleDeps, BattleScope, PersistBattleInput } from "./server";

const secureRng = () => randomInt(0, 2 ** 32) / 2 ** 32;

/** Battles only ever read validated questions (agent.md: never serve unvalidated or live-generated questions). */
function questionWhere(scope: BattleScope) {
  return {
    validated: true,
    topic: { subjectId: scope.subjectId },
    ...(scope.topicId ? { topicId: scope.topicId } : {}),
  };
}

const END_REASON = {
  hp_depleted: "HP_DEPLETED",
  max_questions: "MAX_QUESTIONS",
  opponent_forfeit: "OPPONENT_FORFEIT",
} as const;

export const dbDeps: Omit<BattleDeps, "verifyToken"> = {
  async resolveScope(subjectId, topicId) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true, name: true } });
    if (!subject) return null;
    if (!topicId) return { subjectId: subject.id, subjectName: subject.name, topicId: null, topicName: null };
    const topic = await prisma.topic.findFirst({ where: { id: topicId, subjectId }, select: { id: true, name: true } });
    return topic ? { subjectId: subject.id, subjectName: subject.name, topicId: topic.id, topicName: topic.name } : null;
  },

  async countQuestions(scope) {
    return prisma.question.count({ where: questionWhere(scope) });
  },

  async loadQuestions(scope, limit) {
    const candidates = await prisma.question.findMany({ where: questionWhere(scope), select: { id: true } });
    const picked = shuffle(candidates, secureRng)
      .slice(0, limit)
      .map((row) => row.id);
    const rows = await prisma.question.findMany({
      where: { id: { in: picked }, validated: true },
      include: { topic: { select: { name: true } } },
    });
    return rows
      .filter((row) => row.options.length === 4 && row.correctIndex >= 0 && row.correctIndex <= 3)
      .map((row) => ({
        id: row.id,
        topicId: row.topicId,
        topicName: row.topic.name,
        text: row.text,
        options: row.options,
        correctIndex: row.correctIndex,
        difficulty: row.difficulty,
      }));
  },

  async loadRating(userId, subjectId) {
    const existing = await prisma.eloRating.findUnique({ where: { userId_subjectId: { userId, subjectId } } });
    if (existing) return { rating: existing.rating, matchesPlayed: existing.matchesPlayed };
    // First battle in this subject: start from the onboarding placement band.
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { confidence: true } });
    const created = await prisma.eloRating.upsert({
      where: { userId_subjectId: { userId, subjectId } },
      update: {},
      create: { userId, subjectId, rating: placementRating(user?.confidence), matchesPlayed: 0 },
    });
    return { rating: created.rating, matchesPlayed: created.matchesPlayed };
  },

  async persistBattle(input: PersistBattleInput) {
    return prisma.$transaction(
      async (tx) => {
        const battle = await tx.battle.create({
          data: {
            subjectId: input.subjectId,
            topicId: input.topicId,
            winnerId: input.winnerId,
            mode: input.mode,
            endReason: END_REASON[input.reason],
            roomCode: input.roomCode,
            questionCount: input.questionCount,
            players: {
              create: input.players.map((player) => ({
                userId: player.userId,
                displayName: player.name,
                result: input.winnerId === null ? "DRAW" : input.winnerId === player.userId ? "WON" : "LOST",
                eloBefore: player.elo.before,
                eloAfter: player.elo.after,
                eloDelta: player.elo.delta,
                finalHp: player.state.hp,
                correct: player.state.correct,
                answered: player.state.answered,
                bestStreak: player.state.bestStreak,
                avgAnswerMs: player.state.answered ? Math.round(player.state.totalAnswerMs / player.state.answered) : null,
              })),
            },
          },
          select: { id: true },
        });

        await tx.battleAnswer.createMany({
          data: input.players.flatMap((player) =>
            player.answers.map((answer) => ({
              battleId: battle.id,
              userId: player.userId,
              questionId: answer.questionId,
              topicId: answer.topicId,
              round: answer.round,
              selectedIndex: answer.selectedIndex,
              correct: answer.correct,
              timeTakenMs: answer.timeTakenMs,
            })),
          ),
        });

        for (const player of input.players) {
          // ELO: per (user, subject), drives matchmaking.
          await tx.eloRating.upsert({
            where: { userId_subjectId: { userId: player.userId, subjectId: input.subjectId } },
            update: { rating: player.elo.after, matchesPlayed: { increment: 1 } },
            create: { userId: player.userId, subjectId: input.subjectId, rating: player.elo.after, matchesPlayed: 1 },
          });

          // Mastery: per (user, topic), read by the breakdown and the planner — never merged with ELO.
          const tally = tallyByTopic(player.answers);
          if (tally.size === 0) continue;
          const user = await tx.user.findUnique({ where: { id: player.userId }, select: { confidence: true } });
          const prior = priorFromConfidence(user?.confidence);
          const current = await tx.mastery.findMany({
            where: { userId: player.userId, topicId: { in: [...tally.keys()] } },
          });
          for (const [topicId, { correct, total }] of tally) {
            const previous = current.find((row) => row.topicId === topicId)?.score ?? null;
            const score = updateMastery(previous, correct, total, prior);
            await tx.mastery.upsert({
              where: { userId_topicId: { userId: player.userId, topicId } },
              update: { score, attempts: { increment: total } },
              create: { userId: player.userId, topicId, score, attempts: total },
            });
          }
        }

        return { battleId: battle.id };
      },
      { timeout: 20_000 },
    );
  },
};
