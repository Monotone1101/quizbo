import "server-only";
import { computeStreak, placementRating, todayInTimeZone } from "@quizbo/core";
import { prisma, type User } from "@quizbo/db";

export interface PlayerCard {
  userId: string;
  name: string;
  rating: number;
  rank: number;
  streak: number;
}

/** "You" side of the matchmaking screen: rating, weekly rank and daily streak. */
export async function loadPlayerCard(viewer: User, subjectId: string): Promise<PlayerCard> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [rating, battles] = await Promise.all([
    prisma.eloRating.findUnique({ where: { userId_subjectId: { userId: viewer.id, subjectId } } }),
    prisma.battlePlayer.findMany({
      where: { userId: viewer.id, createdAt: { gte: new Date(Date.now() - 400 * 86_400_000) } },
      select: { createdAt: true },
    }),
  ]);
  const elo = rating?.rating ?? placementRating(viewer.confidence);
  const ahead = await prisma.eloRating.count({
    where: { subjectId, rating: { gt: elo }, updatedAt: { gte: weekAgo }, userId: { not: viewer.id } },
  });
  const today = todayInTimeZone(viewer.timezone);
  const streak = computeStreak(
    battles.map((b) => todayInTimeZone(viewer.timezone, b.createdAt)),
    today,
  );
  return { userId: viewer.id, name: viewer.name ?? "You", rating: elo, rank: ahead + 1, streak: streak.current };
}
