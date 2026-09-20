import "server-only";
import { prisma, type User } from "@quizbo/db";
import type { ResultChip } from "./dashboard";

/** Mastery below this is flagged as a weak spot (matches the library). */
const WEAK = 0.5;
const WEEKS = 8;

export interface EloPoint {
  battleId: string;
  number: number;
  at: string;
  elo: number;
  delta: number;
  result: ResultChip;
  opponent: string;
}

export interface ProgressSubject {
  id: string;
  slug: string;
  name: string;
  rating: number;
  /** Starting rating before the first battle, then one point per battle. */
  start: number;
  timeline: EloPoint[];
}

export interface TopicProgress {
  topicId: string;
  name: string;
  unit: string | null;
  mastery: number | null;
  attempts: number;
  answered: number;
  accuracy: number | null;
  avgMs: number | null;
  weak: boolean;
}

export interface Progress {
  totals: {
    battles: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number | null;
    accuracy: number | null;
    avgAnswerMs: number | null;
    bestStreak: number;
  };
  subjects: ProgressSubject[];
  topics: Array<{ subject: string; slug: string; topics: TopicProgress[] }>;
  weeks: Array<{ start: string; battles: number; wins: number }>;
}

const resultOf = (result: "WON" | "LOST" | "DRAW", endReason: string): ResultChip =>
  endReason === "OPPONENT_FORFEIT" ? "FORFEIT" : result;

function weekStart(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday
  return d;
}

/** Everything the progress tab shows: ELO over time, totals, per-topic accuracy and mastery, weekly activity. */
export async function loadProgress(viewer: User): Promise<Progress> {
  const [played, ratings, mastery, answerStats] = await Promise.all([
    prisma.battlePlayer.findMany({
      where: { userId: viewer.id },
      orderBy: [{ createdAt: "asc" }, { battleId: "asc" }],
      include: {
        battle: {
          select: {
            id: true,
            number: true,
            endReason: true,
            playedAt: true,
            subject: { select: { id: true, slug: true, name: true } },
            players: { where: { userId: { not: viewer.id } }, select: { displayName: true } },
          },
        },
      },
    }),
    prisma.eloRating.findMany({ where: { userId: viewer.id }, include: { subject: { select: { id: true, slug: true, name: true } } } }),
    prisma.mastery.findMany({
      where: { userId: viewer.id },
      include: { topic: { select: { id: true, name: true, unit: true, sortOrder: true, subject: { select: { slug: true, name: true } } } } },
    }),
    prisma.battleAnswer.groupBy({
      by: ["topicId", "correct"],
      where: { userId: viewer.id },
      _count: { _all: true },
      _sum: { timeTakenMs: true },
    }),
  ]);

  // Totals
  const wins = played.filter((p) => p.result === "WON").length;
  const draws = played.filter((p) => p.result === "DRAW").length;
  const answered = played.reduce((sum, p) => sum + p.answered, 0);
  const correct = played.reduce((sum, p) => sum + p.correct, 0);
  const timed = played.filter((p) => p.avgAnswerMs !== null && p.answered > 0);
  const timedAnswers = timed.reduce((sum, p) => sum + p.answered, 0);

  // ELO timeline per subject
  const bySubject = new Map<string, ProgressSubject>();
  for (const p of played) {
    const s = p.battle.subject;
    const entry = bySubject.get(s.id) ?? { id: s.id, slug: s.slug, name: s.name, rating: p.eloAfter, start: p.eloBefore, timeline: [] };
    entry.timeline.push({
      battleId: p.battle.id,
      number: p.battle.number,
      at: p.battle.playedAt.toISOString(),
      elo: p.eloAfter,
      delta: p.eloDelta,
      result: resultOf(p.result, p.battle.endReason),
      opponent: p.battle.players[0]?.displayName ?? "Opponent",
    });
    entry.rating = p.eloAfter;
    bySubject.set(s.id, entry);
  }
  for (const r of ratings) {
    const entry = bySubject.get(r.subjectId);
    if (entry) entry.rating = r.rating;
  }

  // Per-topic accuracy (from every answer) joined with mastery
  const stats = new Map<string, { answered: number; correct: number; ms: number }>();
  for (const row of answerStats) {
    const s = stats.get(row.topicId) ?? { answered: 0, correct: 0, ms: 0 };
    s.answered += row._count._all;
    if (row.correct) s.correct += row._count._all;
    s.ms += row._sum.timeTakenMs ?? 0;
    stats.set(row.topicId, s);
  }
  const groups = new Map<string, { subject: string; slug: string; topics: Array<TopicProgress & { sort: number }> }>();
  for (const m of mastery) {
    const s = stats.get(m.topicId);
    const group = groups.get(m.topic.subject.slug) ?? { subject: m.topic.subject.name, slug: m.topic.subject.slug, topics: [] };
    group.topics.push({
      topicId: m.topicId,
      name: m.topic.name,
      unit: m.topic.unit,
      mastery: m.score,
      attempts: m.attempts,
      answered: s?.answered ?? 0,
      accuracy: s && s.answered ? s.correct / s.answered : null,
      avgMs: s && s.answered ? Math.round(s.ms / s.answered) : null,
      weak: m.score < WEAK,
      sort: m.topic.sortOrder,
    });
    groups.set(m.topic.subject.slug, group);
  }

  // Weekly activity, oldest first, including empty weeks
  const thisWeek = weekStart(new Date());
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(thisWeek);
    start.setUTCDate(start.getUTCDate() - 7 * (WEEKS - 1 - i));
    return { start: start.toISOString().slice(0, 10), battles: 0, wins: 0 };
  });
  for (const p of played) {
    const key = weekStart(p.battle.playedAt).toISOString().slice(0, 10);
    const week = weeks.find((w) => w.start === key);
    if (!week) continue;
    week.battles += 1;
    if (p.result === "WON") week.wins += 1;
  }

  return {
    totals: {
      battles: played.length,
      wins,
      losses: played.length - wins - draws,
      draws,
      winRate: played.length ? wins / played.length : null,
      accuracy: answered ? correct / answered : null,
      avgAnswerMs: timedAnswers ? Math.round(timed.reduce((sum, p) => sum + (p.avgAnswerMs ?? 0) * p.answered, 0) / timedAnswers) : null,
      bestStreak: played.reduce((best, p) => Math.max(best, p.bestStreak), 0),
    },
    subjects: [...bySubject.values()],
    topics: [...groups.values()].map((g) => ({
      subject: g.subject,
      slug: g.slug,
      topics: g.topics.sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0) || a.sort - b.sort).map(({ sort: _sort, ...t }) => t),
    })),
    weeks,
  };
}
