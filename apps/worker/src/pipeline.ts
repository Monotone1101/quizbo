/**
 * Offline question-bank pipeline (architecture.md §6) and nightly planner re-optimisation.
 * Nothing here runs inside a live battle.
 */
import { generateQuestions, isAiConfigured, validateQuestion } from "@quizbo/ai";
import { canonicalTopic, shuffle, todayInTimeZone } from "@quizbo/core";
import { prisma, replanUser, type Difficulty, type QuestionSource } from "@quizbo/db";

type Log = (message: string) => void;

export interface GenerationOptions {
  subjectSlug?: string;
  topicName?: string;
  perTopic: number;
  /** Skip topics that already have at least this many validated questions (ignored with `force`). */
  targetValidated: number;
  difficulty?: Difficulty;
  force?: boolean;
}

const normalizeStem = (text: string) => canonicalTopic(text);

/** Rotate difficulties toward whichever the topic has least of. */
function nextDifficulty(counts: Record<Difficulty, number>): Difficulty {
  return (["MEDIUM", "EASY", "HARD"] as const).reduce((least, d) => (counts[d] < counts[least] ? d : least), "MEDIUM" as Difficulty);
}

export async function runGeneration(options: GenerationOptions, log: Log = console.info) {
  if (!isAiConfigured()) throw new Error("GEMINI_API_KEY is required to generate questions.");
  const topics = await prisma.topic.findMany({
    where: {
      ...(options.subjectSlug ? { subject: { slug: options.subjectSlug } } : {}),
      ...(options.topicName ? { name: { equals: options.topicName, mode: "insensitive" } } : {}),
    },
    include: { subject: true },
    orderBy: [{ subjectId: "asc" }, { sortOrder: "asc" }],
  });

  let created = 0;
  for (const topic of topics) {
    const bank = await prisma.question.findMany({ where: { topicId: topic.id }, select: { text: true, difficulty: true, validated: true } });
    const validated = bank.filter((q) => q.validated).length;
    if (!options.force && validated >= options.targetValidated) continue;

    const counts: Record<Difficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const q of bank) counts[q.difficulty] += 1;
    const difficulty = options.difficulty ?? nextDifficulty(counts);

    log(`[generate] ${topic.subject.name} · ${topic.name} — ${validated} validated, asking for ${options.perTopic} ${difficulty}`);
    const result = await generateQuestions({
      subject: topic.subject.name,
      level: topic.subject.level ?? "secondary school",
      topic: topic.name,
      unit: topic.unit,
      difficulty,
      count: options.perTopic,
      avoid: bank.map((q) => q.text),
    });
    if (!result.ok) {
      log(`[generate]   skipped: ${result.reason}${result.detail ? ` (${result.detail})` : ""}`);
      continue;
    }

    const seen = new Set(bank.map((q) => normalizeStem(q.text)));
    const fresh = result.value.filter((q) => {
      const key = normalizeStem(q.text);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length) {
      await prisma.question.createMany({
        data: fresh.map((q) => ({
          topicId: topic.id,
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          rationale: q.rationale,
          difficulty: q.difficulty,
          validated: false,
          source: "GENERATED" as const,
        })),
      });
    }
    created += fresh.length;
    log(`[generate]   stored ${fresh.length} unvalidated (${result.value.length - fresh.length} dropped as duplicates)`);
  }
  return { created, topics: topics.length };
}

export interface ValidationOptions {
  limit: number;
  source: QuestionSource | "ALL";
  /** Re-review questions that are already validated (e.g. the seed bank). Failures are pulled from battles. */
  revalidate?: boolean;
}

export async function runValidation(options: ValidationOptions, log: Log = console.info) {
  if (!isAiConfigured()) throw new Error("GEMINI_API_KEY is required to validate questions.");
  const questions = await prisma.question.findMany({
    where: {
      ...(options.source === "ALL" ? {} : { source: options.source }),
      ...(options.revalidate ? {} : { validated: false, validationNotes: null }),
    },
    include: { topic: { include: { subject: true } } },
    orderBy: { createdAt: "asc" },
    take: options.limit,
  });

  const tally = { pass: 0, fail: 0, error: 0 };
  for (const question of questions) {
    const outcome = await validateQuestion({
      subject: question.topic.subject.name,
      level: question.topic.subject.level ?? "secondary school",
      topic: question.topic.name,
      text: question.text,
      options: question.options,
      correctIndex: question.correctIndex,
      difficulty: question.difficulty,
    });
    tally[outcome.verdict] += 1;
    if (outcome.verdict === "error") {
      log(`[validate] ${question.id} error — left unchanged: ${outcome.notes}`);
      continue;
    }
    await prisma.question.update({
      where: { id: question.id },
      data: {
        validated: outcome.verdict === "pass",
        validatedAt: outcome.verdict === "pass" ? new Date() : null,
        validationNotes: outcome.notes.slice(0, 1_000),
      },
    });
    log(`[validate] ${question.id} ${outcome.verdict.toUpperCase()} — ${question.text.slice(0, 70)}`);
  }
  return { reviewed: questions.length, ...tally };
}

/** Prints a random sample of battle-eligible questions for a human spot-check (architecture.md §6.4). */
export async function spotCheck(sample: number, log: Log = console.info) {
  const ids = await prisma.question.findMany({ where: { validated: true }, select: { id: true } });
  const picked = shuffle(ids).slice(0, sample).map((q) => q.id);
  const questions = await prisma.question.findMany({ where: { id: { in: picked } }, include: { topic: true } });
  for (const q of questions) {
    log(`\n${q.id} · ${q.topic.name} · ${q.difficulty} · ${q.source}`);
    log(q.text);
    q.options.forEach((option, i) => log(`  ${i === q.correctIndex ? "✔" : " "} ${String.fromCharCode(65 + i)}. ${option}`));
    log(`  Rationale: ${q.rationale}`);
    if (q.validationNotes) log(`  Review: ${q.validationNotes}`);
  }
  return questions.length;
}

/** Nightly re-optimisation: picks up mastery changes from battles without any new chat input. */
export async function replanAll(log: Log = console.info) {
  const users = await prisma.user.findMany({
    where: { exams: { some: { examDate: { gt: new Date() } } } },
    select: { id: true, timezone: true },
  });
  let sessions = 0;
  for (const user of users) {
    const result = await replanUser(user.id, todayInTimeZone(user.timezone));
    sessions += result.sessionsCreated;
  }
  log(`[replan] ${users.length} students, ${sessions} sessions scheduled`);
  return { users: users.length, sessions };
}
