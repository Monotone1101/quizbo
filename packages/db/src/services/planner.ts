/**
 * Planner persistence. Every schedule change goes through the deterministic core scheduler — no LLM
 * is involved anywhere in this file — and exams are only written from an explicit confirmation.
 * Shared by the web app (server actions) and the worker (nightly re-optimisation).
 */
import {
  addDays,
  parseISODate,
  planAcrossExams,
  priorFromConfidence,
  rebalanceAfterSkip,
  resolveTopics,
  toISODate,
  topicSimilarity,
  type ISODate,
  type PlannedSession,
  type PriorityLevel,
  type TopicMatch,
} from "@quizbo/core";
import { getPrisma } from "../client";

export class PlannerError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "INVALID",
  ) {
    super(message);
  }
}

const tidy = (value: string) => value.trim().replace(/\s+/g, " ");
const titleCase = (value: string) => tidy(value).replace(/\b\p{L}/gu, (ch) => ch.toUpperCase());
const slugify = (value: string) =>
  tidy(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "subject";

export interface SubjectRef {
  id: string;
  name: string;
  level: string | null;
}

export function matchSubject(query: string, subjects: readonly SubjectRef[]): SubjectRef | null {
  const normalized = tidy(query).toLowerCase();
  const exact = subjects.find((s) => s.name.toLowerCase() === normalized || `${s.name} ${s.level ?? ""}`.trim().toLowerCase() === normalized);
  if (exact) return exact;
  let best: { subject: SubjectRef; score: number } | null = null;
  for (const subject of subjects) {
    const score = Math.max(
      topicSimilarity(query, subject.name),
      subject.name.toLowerCase().startsWith(normalized.slice(0, 4)) && normalized.length >= 4 ? 0.85 : 0,
    );
    if (!best || score > best.score) best = { subject, score };
  }
  return best && best.score >= 0.8 ? best.subject : null;
}

/** Read-only preview for a confirmation card: which existing topics each phrase lands on. */
export async function previewTopicMatches(subjectName: string, topics: string[]) {
  const prisma = getPrisma();
  const subjects = await prisma.subject.findMany({ select: { id: true, name: true, level: true } });
  const subject = matchSubject(subjectName, subjects);
  if (!subject) return { subject: null, matches: topics.map((query): TopicMatch => ({ kind: "new", query })) };
  const existing = await prisma.topic.findMany({
    where: { subjectId: subject.id },
    select: { id: true, name: true, unit: true },
  });
  return { subject, matches: resolveTopics(topics, existing).matches };
}

export interface ConfirmExamInput {
  userId: string;
  subject: string;
  name: string;
  examDate: ISODate;
  priority: PriorityLevel;
  dateConfidence: "EXPLICIT" | "INFERRED" | "MISSING";
  topics: string[];
  today: ISODate;
}

/**
 * Writes one exam the student explicitly confirmed, resolving topics against existing TOPIC rows
 * (creating a topic only when nothing is close), then re-runs the scheduler.
 */
export async function confirmExam(input: ConfirmExamInput) {
  if (input.examDate <= input.today) throw new PlannerError("The exam date needs to be after today.", "INVALID");
  const name = tidy(input.name) || "Exam";
  const prisma = getPrisma();

  const examId = await prisma.$transaction(async (tx) => {
    const subjects = await tx.subject.findMany({ select: { id: true, name: true, level: true } });
    let subject = matchSubject(input.subject, subjects);
    if (!subject) {
      const subjectName = titleCase(input.subject);
      if (!subjectName) throw new PlannerError("Every exam needs a subject.", "INVALID");
      const baseSlug = slugify(subjectName);
      const slugTaken = await tx.subject.findUnique({ where: { slug: baseSlug } });
      subject = await tx.subject.create({
        data: { name: subjectName, slug: slugTaken ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug },
        select: { id: true, name: true, level: true },
      });
    }

    const existing = await tx.topic.findMany({ where: { subjectId: subject.id }, select: { id: true, name: true, unit: true } });
    const resolved = resolveTopics(input.topics, existing);
    const topicIds = new Set(resolved.topicIds);
    for (const newName of resolved.newNames) {
      const topic = await tx.topic.upsert({
        where: { subjectId_name: { subjectId: subject.id, name: titleCase(newName) } },
        update: {},
        create: { subjectId: subject.id, name: titleCase(newName), sortOrder: 1000 },
      });
      topicIds.add(topic.id);
    }

    const exam = await tx.exam.create({
      data: {
        userId: input.userId,
        subjectId: subject.id,
        name,
        examDate: parseISODate(input.examDate),
        priority: input.priority,
        dateConfidence: input.dateConfidence,
        topics: { create: [...topicIds].map((topicId) => ({ topicId })) },
      },
      select: { id: true },
    });
    return exam.id;
  });

  const plan = await replanUser(input.userId, input.today);
  return { examId, ...plan };
}

/**
 * Re-runs the deterministic scheduler for all of a student's upcoming exams with current mastery.
 * Pending sessions from today onward are replaced; done and skipped sessions are kept, and minutes
 * already spent today are subtracted from today's budget.
 */
export async function replanUser(userId: string, today: ISODate) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { dailyStudyMinutes: true, confidence: true } });
  if (!user) throw new PlannerError("User not found.", "NOT_FOUND");

  const exams = await prisma.exam.findMany({
    where: { userId, examDate: { gt: parseISODate(today) } },
    include: { topics: { select: { topicId: true } } },
    orderBy: { examDate: "asc" },
  });
  if (exams.length === 0) return { sessionsCreated: 0, examsPlanned: 0 };

  const examIds = exams.map((e) => e.id);
  const topicIds = [...new Set(exams.flatMap((e) => e.topics.map((t) => t.topicId)))];
  const [mastery, spentToday] = await Promise.all([
    prisma.mastery.findMany({ where: { userId, topicId: { in: topicIds } }, select: { topicId: true, score: true } }),
    prisma.studySession.aggregate({
      where: { examId: { in: examIds }, scheduledDate: parseISODate(today), status: { in: ["DONE", "SKIPPED"] } },
      _sum: { durationMinutes: true },
    }),
  ]);
  const prior = priorFromConfidence(user.confidence);
  const masteryByTopic = new Map(mastery.map((m) => [m.topicId, m.score]));

  const drafts = planAcrossExams(
    exams.map((exam) => ({
      examId: exam.id,
      examDate: toISODate(exam.examDate),
      priority: exam.priority,
      topics: exam.topics.map((t) => ({ topicId: t.topicId, masteryScore: masteryByTopic.get(t.topicId) ?? prior })),
    })),
    today,
    user.dailyStudyMinutes,
    { [today]: spentToday._sum.durationMinutes ?? 0 },
  );

  await prisma.$transaction([
    prisma.studySession.deleteMany({
      where: { examId: { in: examIds }, status: "PENDING", scheduledDate: { gte: parseISODate(today) } },
    }),
    prisma.studySession.createMany({
      data: drafts.map((draft) => ({
        examId: draft.examId,
        topicId: draft.topicId,
        scheduledDate: parseISODate(draft.scheduledDate),
        durationMinutes: draft.durationMinutes,
        kind: draft.kind,
      })),
    }),
    prisma.exam.updateMany({ where: { id: { in: examIds } }, data: { plannedAt: new Date() } }),
  ]);

  return { sessionsCreated: drafts.length, examsPlanned: exams.length };
}

const toPlanned = (row: {
  id: string;
  examId: string;
  topicId: string;
  scheduledDate: Date;
  durationMinutes: number;
  status: "PENDING" | "DONE" | "SKIPPED";
}): PlannedSession => ({ ...row, scheduledDate: toISODate(row.scheduledDate) });

/**
 * Marks a session done, skipped, or back to pending (undo for "done" only). Skipping redistributes the
 * minutes over the same topic's later pending sessions via core `rebalanceAfterSkip` — no LLM call.
 */
export async function setSessionStatus(userId: string, sessionId: string, status: "DONE" | "SKIPPED" | "PENDING", today: ISODate) {
  const prisma = getPrisma();
  const session = await prisma.studySession.findFirst({ where: { id: sessionId, exam: { userId } } });
  if (!session) throw new PlannerError("That session no longer exists.", "NOT_FOUND");

  if (status === "DONE") {
    await prisma.studySession.update({ where: { id: session.id }, data: { status: "DONE", completedAt: new Date() } });
    return { rebalanced: [], unallocatedMinutes: 0 };
  }
  if (status === "PENDING") {
    if (session.status !== "DONE") throw new PlannerError("Only a completed session can be reopened.", "INVALID");
    await prisma.studySession.update({ where: { id: session.id }, data: { status: "PENDING", completedAt: null } });
    return { rebalanced: [], unallocatedMinutes: 0 };
  }
  if (session.status !== "PENDING") throw new PlannerError("Only a pending session can be skipped.", "INVALID");

  const pending = await prisma.studySession.findMany({
    where: { examId: session.examId, topicId: session.topicId, status: "PENDING" },
  });
  const { updates, unallocatedMinutes } = rebalanceAfterSkip(pending.map(toPlanned), toPlanned(session), { today });
  await prisma.$transaction([
    prisma.studySession.update({ where: { id: session.id }, data: { status: "SKIPPED" } }),
    ...updates.map((u) => prisma.studySession.update({ where: { id: u.id }, data: { durationMinutes: u.durationMinutes } })),
  ]);
  return { rebalanced: updates, unallocatedMinutes };
}

/**
 * Read-only planner ↔ battle bridge (architecture.md §5.5): a low-mastery topic with a session in
 * the next few days, and enough validated questions to battle on it.
 */
export async function battleSuggestion(userId: string, today: ISODate, options = { withinDays: 3, below: 0.5, minQuestions: 5 }) {
  const prisma = getPrisma();
  const sessions = await prisma.studySession.findMany({
    where: {
      status: "PENDING",
      exam: { userId },
      scheduledDate: { gte: parseISODate(today), lt: parseISODate(addDays(today, options.withinDays)) },
    },
    include: { topic: { select: { id: true, name: true, subjectId: true } } },
    orderBy: { scheduledDate: "asc" },
  });
  if (sessions.length === 0) return null;

  const topicIds = [...new Set(sessions.map((s) => s.topicId))];
  const [mastery, counts] = await Promise.all([
    prisma.mastery.findMany({ where: { userId, topicId: { in: topicIds }, score: { lt: options.below } } }),
    prisma.question.groupBy({ by: ["topicId"], where: { topicId: { in: topicIds }, validated: true }, _count: { _all: true } }),
  ]);
  const playable = new Set(counts.filter((c) => c._count._all >= options.minQuestions).map((c) => c.topicId));
  const weakest = mastery.filter((m) => playable.has(m.topicId)).sort((a, b) => a.score - b.score)[0];
  if (!weakest) return null;
  const session = sessions.find((s) => s.topicId === weakest.topicId);
  if (!session) return null;
  return {
    topicId: session.topic.id,
    topicName: session.topic.name,
    subjectId: session.topic.subjectId,
    mastery: weakest.score,
    scheduledDate: toISODate(session.scheduledDate),
  };
}
