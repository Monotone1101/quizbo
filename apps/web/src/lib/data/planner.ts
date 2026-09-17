import "server-only";
import {
  addDays,
  dateRange,
  diffDays,
  formatDate,
  parseISODate,
  startOfWeek,
  toISODate,
  WEEKDAY_SHORT,
} from "@quizbo/core";
import { battleSuggestion, previewTopicMatches, prisma, type User } from "@quizbo/db";
import {
  readPlannerPayload,
  type DraftCardView,
  type IntakeMessageView,
  type TopicPreview,
  type WeekDayView,
} from "@/lib/planner-types";
import { viewerToday } from "@/lib/session";
import { pad } from "@/lib/utils";

const LONG_DAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export async function loadPlanner(viewer: User, weekOffset: number) {
  const today = viewerToday(viewer);
  const monday = addDays(startOfWeek(today), weekOffset * 7);
  const sunday = addDays(monday, 7);

  const [sessions, exams, suggestion, messageRows, latestMastery] = await Promise.all([
    prisma.studySession.findMany({
      where: { exam: { userId: viewer.id }, scheduledDate: { gte: parseISODate(monday), lt: parseISODate(sunday) } },
      // Sessions from one scheduler run share a timestamp; the cuid id keeps their order stable.
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      include: {
        topic: { select: { name: true } },
        exam: { select: { name: true, subject: { select: { name: true } } } },
      },
    }),
    prisma.exam.findMany({
      where: { userId: viewer.id, examDate: { gte: parseISODate(monday < today ? monday : today) } },
      orderBy: { examDate: "asc" },
      include: {
        subject: { select: { name: true } },
        topics: { include: { topic: { select: { name: true } } } },
        _count: { select: { sessions: { where: { status: "PENDING" } } } },
      },
    }),
    battleSuggestion(viewer.id, today),
    prisma.chatMessage.findMany({ where: { userId: viewer.id, channel: "PLANNER" }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.mastery.findFirst({ where: { userId: viewer.id }, orderBy: { lastUpdated: "desc" }, select: { lastUpdated: true } }),
  ]);

  const topicIds = [...new Set(sessions.map((s) => s.topicId))];
  const playable = topicIds.length
    ? await prisma.question.groupBy({ by: ["topicId"], where: { topicId: { in: topicIds }, validated: true }, _count: { _all: true } })
    : [];
  const battleReady = new Set(playable.filter((row) => row._count._all >= 5).map((row) => row.topicId));

  const days: WeekDayView[] = dateRange(monday, sunday).map((date, index) => ({
    date,
    label: WEEKDAY_SHORT[index] ?? "",
    dayNumber: pad(parseISODate(date).getUTCDate()),
    isToday: date === today,
    isPast: date < today,
    exams: exams
      .filter((exam) => toISODate(exam.examDate) === date)
      .map((exam) => ({ id: exam.id, title: `${exam.subject.name} — ${exam.name}` })),
    sessions: sessions
      .filter((session) => toISODate(session.scheduledDate) === date)
      .map((session) => ({
        id: session.id,
        topicId: session.topicId,
        topicName: session.topic.name,
        minutes: session.durationMinutes,
        status: session.status,
        kind: session.kind,
        examTitle: `${session.exam.subject.name} — ${session.exam.name}`,
        canBattle: battleReady.has(session.topicId),
      })),
  }));

  const chronological = [...messageRows].reverse();
  const messages: IntakeMessageView[] = chronological.map((row) => ({
    id: row.id,
    role: row.role === "USER" ? "user" : "assistant",
    content: row.content,
    failed: readPlannerPayload(row.payload).failed === true,
  }));

  const drafts: DraftCardView[] = [];
  for (const row of chronological) {
    const payload = readPlannerPayload(row.payload);
    for (const draft of payload.drafts) {
      if (draft.status !== "pending") continue;
      const preview = await previewTopicMatches(draft.exam.subject, draft.exam.topics);
      drafts.push({
        messageId: row.id,
        draftId: draft.draftId,
        manual: payload.kind === "manual",
        exam: draft.exam,
        subjectMatch: preview.subject ? preview.subject.name : null,
        topicPreview: preview.matches.map((match): TopicPreview => {
          if (match.kind === "topic") {
            const same = match.topic.name.toLowerCase() === match.query.trim().toLowerCase();
            return { query: match.query, kind: "topic", detail: same ? match.topic.name : `${match.query} → ${match.topic.name}` };
          }
          if (match.kind === "group") {
            return { query: match.query, kind: "group", detail: `${match.query} → ${match.topics.length} topics` };
          }
          return { query: match.query, kind: "new", detail: `${match.query} · new topic` };
        }),
      });
    }
  }

  const upcoming = exams.filter((exam) => toISODate(exam.examDate) > today);
  const stale = Boolean(
    latestMastery && upcoming.some((exam) => exam.plannedAt && latestMastery.lastUpdated > exam.plannedAt),
  );

  let suggestionView = null;
  if (suggestion) {
    const days = diffDays(today, suggestion.scheduledDate);
    const when =
      days === 0 ? "today" : days === 1 ? "tomorrow" : LONG_DAY[(parseISODate(suggestion.scheduledDate).getUTCDay() + 6) % 7];
    suggestionView = { ...suggestion, when };
  }

  return {
    today,
    monday,
    weekOffset,
    weekLabel: weekOffset === 0 ? "This week" : `Week of ${formatDate(monday)}`,
    days,
    drafts,
    messages,
    suggestion: suggestionView,
    stale,
    exams: upcoming.map((exam) => ({
      id: exam.id,
      title: `${exam.subject.name} — ${exam.name}`,
      date: formatDate(toISODate(exam.examDate)),
      daysLeft: diffDays(today, toISODate(exam.examDate)),
      priority: exam.priority,
      topics: exam.topics.map((t) => t.topic.name),
      pendingSessions: exam._count.sessions,
    })),
  };
}
