import "server-only";
import { computeStreak, parseISODate, placementRating, PLACEMENT_MATCHES, streakCopy, todayInTimeZone } from "@quizbo/core";
import { prisma, type User } from "@quizbo/db";
import { battleServiceStats } from "@/lib/battle-service";
import { viewerToday } from "@/lib/session";
import { formatSigned, relativeTime } from "@/lib/utils";
import type { SubjectOption } from "./subjects";

export type ResultChip = "WON" | "LOST" | "DRAW" | "FORFEIT";

export interface RecentBattleRow {
  battleId: string;
  opponent: string;
  topic: string;
  result: ResultChip;
  delta: string;
  streak: string;
  when: string;
}

function modeOf(values: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | null = null;
  for (const [value, count] of counts) if (!best || count > (counts.get(best) ?? 0)) best = value;
  return best;
}

export async function loadRecentBattles(viewer: User, options: { subjectId?: string; take: number }) {
  const rows = await prisma.battlePlayer.findMany({
    where: { userId: viewer.id, ...(options.subjectId ? { battle: { subjectId: options.subjectId } } : {}) },
    orderBy: { createdAt: "desc" },
    take: options.take,
    include: {
      battle: {
        select: {
          id: true,
          number: true,
          endReason: true,
          topic: { select: { name: true } },
          subject: { select: { name: true } },
          players: { select: { userId: true, displayName: true } },
        },
      },
    },
  });
  const answers = await prisma.battleAnswer.findMany({
    where: { battleId: { in: rows.map((r) => r.battleId) }, userId: viewer.id },
    select: { battleId: true, topic: { select: { unit: true, name: true } } },
  });

  return rows.map((row) => {
    const mine = answers.filter((a) => a.battleId === row.battleId);
    const topic = row.battle.topic?.name ?? modeOf(mine.map((a) => a.topic.unit ?? a.topic.name)) ?? row.battle.subject.name;
    const result: ResultChip = row.battle.endReason === "OPPONENT_FORFEIT" ? "FORFEIT" : row.result;
    return {
      battleId: row.battleId,
      number: row.battle.number,
      opponent: row.battle.players.find((p) => p.userId !== viewer.id)?.displayName ?? "Opponent",
      topic,
      subject: row.battle.subject.name,
      result,
      won: row.result === "WON",
      delta: formatSigned(row.eloDelta),
      streak: `×${row.bestStreak}`,
      when: relativeTime(row.createdAt),
      playedAt: row.createdAt,
    };
  });
}

export async function loadDashboard(viewer: User, subject: SubjectOption) {
  const today = viewerToday(viewer);
  const since = new Date(Date.now() - 400 * 86_400_000);

  const [rating, lastMatch, battleTimes, notes, recent, todaysSessions, stats] = await Promise.all([
    prisma.eloRating.findUnique({ where: { userId_subjectId: { userId: viewer.id, subjectId: subject.id } } }),
    prisma.battlePlayer.findFirst({
      where: { userId: viewer.id, battle: { subjectId: subject.id } },
      orderBy: { createdAt: "desc" },
      select: { eloDelta: true },
    }),
    prisma.battlePlayer.findMany({ where: { userId: viewer.id, createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.note.findMany({
      where: { userId: viewer.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, kicker: true, title: true, body: true, createdAt: true },
    }),
    loadRecentBattles(viewer, { subjectId: subject.id, take: 5 }),
    prisma.studySession.findMany({
      where: { exam: { userId: viewer.id }, scheduledDate: parseISODate(today) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { topic: { select: { name: true } } },
    }),
    battleServiceStats(),
  ]);

  const elo = rating?.rating ?? placementRating(viewer.confidence);
  const played = rating?.matchesPlayed ?? 0;
  const scaleMin = Math.floor((elo - 300) / 50) * 50;
  const scaleMax = scaleMin + 600;
  const pct = (value: number) => Math.min(100, Math.max(0, ((value - scaleMin) / 600) * 100));

  const streak = computeStreak(
    battleTimes.map((b) => todayInTimeZone(viewer.timezone, b.createdAt)),
    today,
  );

  return {
    emphasis: viewer.motivationStyle === "COMPETITIVE" || !viewer.motivationStyle ? ("battle" as const) : ("planner" as const),
    elo: {
      rating: elo,
      played,
      lastDelta: lastMatch ? formatSigned(lastMatch.eloDelta) : null,
      scaleMin,
      scaleMax,
      bandLeft: pct(elo - 150),
      bandWidth: pct(elo + 150) - pct(elo - 150),
      marker: pct(elo),
      kLine:
        played >= PLACEMENT_MATCHES
          ? "Placement done. K-factor now 20."
          : `Placement: ${PLACEMENT_MATCHES - played} of ${PLACEMENT_MATCHES} matches left at K-factor 40.`,
    },
    streak: { ...streak, ...streakCopy(streak) },
    notes: notes.map((n) => ({ ...n, meta: `Coach · ${relativeTime(n.createdAt).toLowerCase()}` })),
    recent,
    today: todaysSessions.map((s) => ({ id: s.id, topic: s.topic.name, minutes: s.durationMinutes, status: s.status, kind: s.kind })),
    queueLine: stats.online ? `${stats.queued} in queue now` : "queue offline",
  };
}
