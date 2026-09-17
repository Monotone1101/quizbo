import "server-only";
import { parseISODate, toISODate, WEEKDAY_SHORT, weekdayIndex } from "@quizbo/core";
import { prisma, type User } from "@quizbo/db";
import { viewerToday } from "@/lib/session";
import type { SubjectOption } from "./subjects";

export interface SidebarData {
  rankingLabel: string;
  ranking: Array<{ rank: number; userId: string; name: string; elo: number; you: boolean }>;
  myRank: number | null;
  upcoming: Array<{ id: string; day: string; topic: string; meta: string }>;
  resources: Array<{ id: string; title: string; url: string; source: string }>;
}

export async function loadSidebar(viewer: User, subject: SubjectOption): Promise<SidebarData> {
  const today = viewerToday(viewer);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [ratings, sessions, weakest] = await Promise.all([
    prisma.eloRating.findMany({
      where: { subjectId: subject.id, OR: [{ updatedAt: { gte: weekAgo } }, { userId: viewer.id }] },
      orderBy: [{ rating: "desc" }, { updatedAt: "asc" }],
      select: { userId: true, rating: true, user: { select: { name: true } } },
      take: 500,
    }),
    prisma.studySession.findMany({
      where: { status: "PENDING", exam: { userId: viewer.id }, scheduledDate: { gte: parseISODate(today) } },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take: 3,
      include: { topic: { select: { id: true, name: true, subject: { select: { name: true } } } } },
    }),
    prisma.mastery.findMany({
      where: { userId: viewer.id, topic: { subjectId: subject.id } },
      orderBy: { score: "asc" },
      take: 3,
      select: { topicId: true },
    }),
  ]);

  const ranked = ratings.map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    name: row.userId === viewer.id ? "You" : (row.user.name ?? "Player"),
    elo: row.rating,
    you: row.userId === viewer.id,
  }));
  const me = ranked.find((row) => row.you) ?? null;
  const top = ranked.slice(0, 5);
  const ranking = me && !top.some((row) => row.you) ? [...ranked.slice(0, 4), me] : top;

  const masteryRows = await prisma.mastery.findMany({
    where: { userId: viewer.id, topicId: { in: sessions.map((s) => s.topicId) } },
    select: { topicId: true, score: true },
  });
  const masteryByTopic = new Map(masteryRows.map((m) => [m.topicId, m.score]));
  const upcoming = sessions.map((session) => {
    const mastery = masteryByTopic.get(session.topicId);
    const context = mastery !== undefined ? `mastery ${mastery.toFixed(2)}` : session.topic.subject.name;
    return {
      id: session.id,
      day: WEEKDAY_SHORT[weekdayIndex(toISODate(session.scheduledDate))] ?? "",
      topic: session.topic.name,
      meta: `${session.durationMinutes} min · ${context}`,
    };
  });

  // Resources for the weakest topics (or the first topics when nothing has been played yet).
  let topicIds = weakest.map((m) => m.topicId);
  if (topicIds.length === 0) {
    const first = await prisma.topic.findMany({ where: { subjectId: subject.id }, orderBy: { sortOrder: "asc" }, take: 3, select: { id: true } });
    topicIds = first.map((t) => t.id);
  }
  const resourceRows = await prisma.resource.findMany({ where: { topicId: { in: topicIds } }, orderBy: { createdAt: "asc" } });
  const resources = topicIds
    .flatMap((id) => resourceRows.filter((r) => r.topicId === id))
    .slice(0, 3)
    .map((r) => ({ id: r.id, title: r.title, url: r.url, source: r.sourceLabel }));

  return {
    rankingLabel: `${subject.name.toUpperCase()} · WEEKLY`,
    ranking,
    myRank: me?.rank ?? null,
    upcoming,
    resources,
  };
}
