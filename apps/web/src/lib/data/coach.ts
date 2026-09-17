import "server-only";
import type { CoachContext, CoachTone } from "@quizbo/ai";
import { prisma, type MotivationStyle, type User } from "@quizbo/db";
import type { SubjectOption } from "./subjects";

export function toneFor(style: MotivationStyle | null): CoachTone {
  if (style === "PROGRESS") return "encouraging";
  if (style === "REMINDER") return "brief";
  return "direct";
}

export async function buildCoachContext(viewer: User, subject: SubjectOption) {
  const [rating, weak, misses] = await Promise.all([
    prisma.eloRating.findUnique({ where: { userId_subjectId: { userId: viewer.id, subjectId: subject.id } } }),
    prisma.mastery.findMany({
      where: { userId: viewer.id, topic: { subjectId: subject.id } },
      orderBy: { score: "asc" },
      take: 3,
      include: { topic: { select: { name: true } } },
    }),
    prisma.battleAnswer.findMany({
      where: { userId: viewer.id, correct: false, battle: { subjectId: subject.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        question: { select: { text: true, options: true, correctIndex: true } },
        topic: { select: { name: true } },
      },
    }),
  ]);

  const context: CoachContext = {
    studentName: viewer.name ?? "Student",
    subjectName: subject.name,
    level: subject.level ?? "secondary school",
    rating: rating?.rating ?? null,
    matchesPlayed: rating?.matchesPlayed ?? 0,
    weakTopics: weak.map((m) => ({ name: m.topic.name, mastery: m.score })),
    recentMisses: misses.map((a) => ({
      topic: a.topic.name,
      question: a.question.text,
      chosen: a.selectedIndex === null ? null : (a.question.options[a.selectedIndex] ?? null),
      correct: a.question.options[a.question.correctIndex] ?? "",
    })),
  };
  return { context, tone: toneFor(viewer.motivationStyle), weakTopic: weak[0]?.topic.name ?? null };
}
