/**
 * Offline question-bank pipeline (architecture.md §6) and nightly planner re-optimisation.
 * Nothing here runs inside a live battle.
 */
import { generateQuestions, isAiConfigured, suggestResources, validateQuestion } from "@quizbo/ai";
import { canonicalTopic, shuffle, todayInTimeZone } from "@quizbo/core";
import { prisma, replanUser, type Difficulty, type QuestionSource } from "@quizbo/db";
import { verifyLink } from "./links";

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

/**
 * Pause between AI calls. Gemini's free tier allows roughly 10–15 requests a minute, so batch jobs
 * pace themselves (QUIZBO_AI_PACE_MS, default 4.5 s; set 0 on a paid key).
 */
const PACE_MS = Math.max(0, Number(process.env.QUIZBO_AI_PACE_MS ?? 4_500) || 0);
const pace = () => (PACE_MS ? new Promise((resolve) => setTimeout(resolve, PACE_MS)) : Promise.resolve());

/** Waits after a busy/overloaded reply (Gemini 503 "high demand", 429 rate limits): 20 s, 40 s, 80 s. */
const BACKOFF_MS = [20_000, 40_000, 80_000];
const isTransient = (detail: string | undefined) => /\b(429|500|502|503|504)\b|high demand|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(detail ?? "");

/** Retries an AI call through temporary overloads; anything else returns straight away. */
async function withBackoff<T>(call: () => Promise<T>, transient: (result: T) => boolean, log: Log, what: string): Promise<T> {
  let result = await call();
  for (const wait of BACKOFF_MS) {
    if (!transient(result)) return result;
    log(`[ai] ${what}: Gemini is busy, retrying in ${wait / 1000}s…`);
    await new Promise((resolve) => setTimeout(resolve, wait));
    result = await call();
  }
  return result;
}

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
    const validated = await prisma.question.count({ where: { topicId: topic.id, validated: true } });
    if (!options.force && validated >= options.targetValidated) continue;
    const ids = await generateForTopic(topic, options.perTopic, options.difficulty, log);
    created += ids.length;
  }
  return { created, topics: topics.length };
}

type TopicWithSubject = Awaited<ReturnType<typeof prisma.topic.findMany<{ include: { subject: true } }>>>[number];

/** One generation call for one topic. Returns the ids of the new (unvalidated) questions. */
async function generateForTopic(topic: TopicWithSubject, count: number, forced: Difficulty | undefined, log: Log): Promise<string[]> {
  const bank = await prisma.question.findMany({ where: { topicId: topic.id }, select: { text: true, difficulty: true, validated: true } });
  const validated = bank.filter((q) => q.validated).length;
  const counts: Record<Difficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const q of bank) counts[q.difficulty] += 1;
  const difficulty = forced ?? nextDifficulty(counts);

  log(`[generate] ${topic.subject.name} · ${topic.name} — ${validated} validated, asking for ${count} ${difficulty}`);
  await pace();
  const result = await withBackoff(
    () =>
      generateQuestions({
        subject: topic.subject.name,
        level: topic.subject.level ?? "secondary school",
        topic: topic.name,
        unit: topic.unit,
        difficulty,
        count,
        avoid: bank.map((q) => q.text),
      }),
    (r) => !r.ok && (r.reason === "rate_limited" || isTransient(r.detail)),
    log,
    `generating for ${topic.name}`,
  );
  if (!result.ok) {
    log(`[generate]   skipped: ${result.reason}${result.detail ? ` (${result.detail})` : ""}`);
    return [];
  }

  const seen = new Set(bank.map((q) => normalizeStem(q.text)));
  const fresh = result.value.filter((q) => {
    const key = normalizeStem(q.text);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const rows = await prisma.question.createManyAndReturn({
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
    select: { id: true },
  });
  log(`[generate]   stored ${rows.length} unvalidated (${result.value.length - fresh.length} dropped as duplicates)`);
  return rows.map((r) => r.id);
}

export interface FillOptions {
  subjectSlug?: string;
  /** Keep going until every topic has at least this many validated questions… */
  minValidated: number;
  /** …asking for this many per generation call… */
  batch: number;
  /** …and giving up on a topic after this many rounds (the reviewer rejects some drafts). */
  maxRounds: number;
}

/**
 * Makes every topic battle-ready: generate → blind review → repeat, topic by topic, until each has
 * `minValidated` validated questions. Safe to stop and re-run; it picks up where it left off.
 */
export async function runFill(options: FillOptions, log: Log = console.info) {
  if (!isAiConfigured()) throw new Error("GEMINI_API_KEY is required to generate questions.");
  const topics = await prisma.topic.findMany({
    where: options.subjectSlug ? { subject: { slug: options.subjectSlug } } : {},
    include: { subject: true },
    orderBy: [{ subjectId: "asc" }, { sortOrder: "asc" }],
  });

  const summary = { topics: topics.length, ready: 0, short: [] as string[], generated: 0, passed: 0, failed: 0 };
  for (const topic of topics) {
    for (let round = 0; ; round++) {
      const validated = await prisma.question.count({ where: { topicId: topic.id, validated: true } });
      if (validated >= options.minValidated) {
        summary.ready += 1;
        break;
      }
      if (round >= options.maxRounds) {
        summary.short.push(`${topic.subject.name} · ${topic.name} (${validated}/${options.minValidated})`);
        break;
      }
      // Drafts left waiting (e.g. by an earlier run that hit a busy spell) are reviewed before new ones are made.
      const waiting = await prisma.question.findMany({
        where: { topicId: topic.id, validated: false, validationNotes: null },
        select: { id: true },
      });
      if (waiting.length) {
        const review = await runValidation({ limit: waiting.length, source: "ALL", ids: waiting.map((q) => q.id) }, log);
        summary.passed += review.pass;
        summary.failed += review.fail;
        continue;
      }
      // Ask for a little more than is missing: the reviewer turns some drafts down.
      const want = Math.min(options.batch, Math.ceil((options.minValidated - validated) * 1.4));
      const ids = await generateForTopic(topic, Math.max(3, want), undefined, log);
      summary.generated += ids.length;
      if (ids.length === 0) continue;
      const review = await runValidation({ limit: ids.length, source: "GENERATED", ids }, log);
      summary.passed += review.pass;
      summary.failed += review.fail;
    }
  }
  log(`[fill] ${summary.ready}/${summary.topics} topics battle-ready · ${summary.generated} generated · ${summary.passed} passed review · ${summary.failed} rejected`);
  if (summary.short.length) log(`[fill] still short (re-run to continue):\n  ${summary.short.join("\n  ")}`);
  return summary;
}

/** Validated / waiting / rejected questions per topic. Needs no API key. */
export async function coverage(subjectSlug: string | undefined, minValidated: number, log: Log = console.info) {
  const topics = await prisma.topic.findMany({
    where: subjectSlug ? { subject: { slug: subjectSlug } } : {},
    include: { subject: true },
    orderBy: [{ subjectId: "asc" }, { sortOrder: "asc" }],
  });
  const rows = await prisma.question.groupBy({
    by: ["topicId", "validated"],
    where: { topicId: { in: topics.map((t) => t.id) } },
    _count: { _all: true },
  });
  const rejected = await prisma.question.groupBy({
    by: ["topicId"],
    where: { topicId: { in: topics.map((t) => t.id) }, validated: false, validationNotes: { not: null } },
    _count: { _all: true },
  });
  let ready = 0;
  let subject = "";
  for (const topic of topics) {
    if (topic.subject.name !== subject) {
      subject = topic.subject.name;
      log(`\n${subject.toUpperCase()}`);
    }
    const valid = rows.find((r) => r.topicId === topic.id && r.validated)?._count._all ?? 0;
    const unvalidated = rows.find((r) => r.topicId === topic.id && !r.validated)?._count._all ?? 0;
    const failed = rejected.find((r) => r.topicId === topic.id)?._count._all ?? 0;
    if (valid >= minValidated) ready += 1;
    const mark = valid >= minValidated ? "✔" : valid >= 5 ? "~" : "✗";
    log(`  ${mark} ${String(valid).padStart(3)} ok  ${String(unvalidated - failed).padStart(3)} waiting  ${String(failed).padStart(3)} rejected  ${topic.name}`);
  }
  log(`\n${ready}/${topics.length} topics have ${minValidated}+ validated questions (✔). ~ = battle-able (5+), ✗ = not yet.`);
  return { ready, topics: topics.length };
}

export interface ValidationOptions {
  limit: number;
  source: QuestionSource | "ALL";
  /** Re-review questions that are already validated (e.g. the seed bank). Failures are pulled from battles. */
  revalidate?: boolean;
  /** Only these questions. */
  ids?: string[];
}

export async function runValidation(options: ValidationOptions, log: Log = console.info) {
  if (!isAiConfigured()) throw new Error("GEMINI_API_KEY is required to validate questions.");
  const questions = await prisma.question.findMany({
    where: {
      ...(options.source === "ALL" ? {} : { source: options.source }),
      ...(options.revalidate ? {} : { validated: false, validationNotes: null }),
      ...(options.ids ? { id: { in: options.ids } } : {}),
    },
    include: { topic: { include: { subject: true } } },
    orderBy: { createdAt: "asc" },
    take: options.limit,
  });

  const tally = { pass: 0, fail: 0, error: 0 };
  for (const question of questions) {
    await pace();
    const outcome = await withBackoff(
      () =>
        validateQuestion({
          subject: question.topic.subject.name,
          level: question.topic.subject.level ?? "secondary school",
          topic: question.topic.name,
          text: question.text,
          options: question.options,
          correctIndex: question.correctIndex,
          difficulty: question.difficulty,
        }),
      (o) => o.verdict === "error" && isTransient(o.notes),
      log,
      `reviewing ${question.id}`,
    );
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

export interface FinderOptions {
  subjectSlug?: string;
  /** How many topics to look at this run. */
  topics: number;
  /** Links to ask for per topic. */
  perTopic: number;
  /** Skip topics that already have this many links. */
  maxLinks: number;
}

/**
 * AI resource finder (nightly, or `questions:pipeline -- resources`). Picks the topics players are
 * weakest at (then the ones with the fewest links), asks the model for pages on trusted free sites,
 * fetches every suggestion and stores only pages that load and mention the topic, as origin = AI.
 */
export async function runResourceFinder(options: FinderOptions, log: Log = console.info) {
  if (!isAiConfigured()) throw new Error("GEMINI_API_KEY is required to find resources.");
  const topics = await prisma.topic.findMany({
    where: options.subjectSlug ? { subject: { slug: options.subjectSlug } } : {},
    include: {
      subject: true,
      resources: { select: { url: true } },
      mastery: { where: { attempts: { gt: 0 } }, select: { score: true } },
    },
  });
  const avg = (scores: Array<{ score: number }>) => (scores.length ? scores.reduce((s, m) => s + m.score, 0) / scores.length : 1);
  const queue = topics
    .filter((t) => t.resources.length < options.maxLinks)
    .sort((a, b) => avg(a.mastery) - avg(b.mastery) || a.resources.length - b.resources.length || a.sortOrder - b.sortOrder)
    .slice(0, options.topics);

  const tally = { topics: queue.length, suggested: 0, added: 0, rejected: 0 };
  for (const topic of queue) {
    await pace();
    const result = await withBackoff(
      () =>
        suggestResources({
          subject: topic.subject.name,
          level: topic.subject.level ?? "Class 11–12",
          topic: topic.name,
          unit: topic.unit,
          existing: topic.resources.map((r) => r.url),
          count: Math.min(options.perTopic, options.maxLinks - topic.resources.length),
        }),
      (r) => !r.ok && (r.reason === "rate_limited" || isTransient(r.detail)),
      log,
      `finding links for ${topic.name}`,
    );
    if (!result.ok) {
      log(`[resources] ${topic.name}: skipped — ${result.reason}${result.detail ? ` (${result.detail})` : ""}`);
      continue;
    }
    tally.suggested += result.value.length;
    for (const suggestion of result.value) {
      const verdict = await verifyLink(suggestion.url, suggestion.check);
      if (!verdict.ok) {
        tally.rejected += 1;
        log(`[resources]   ✗ ${suggestion.url} — ${verdict.reason}`);
        continue;
      }
      const url = verdict.finalUrl;
      const known = await prisma.resource.findUnique({ where: { topicId_url: { topicId: topic.id, url } }, select: { id: true } });
      if (known) continue;
      await prisma.resource.create({
        data: { topicId: topic.id, title: suggestion.title, url, sourceLabel: suggestion.source, origin: "AI" },
      });
      tally.added += 1;
      log(`[resources]   ✔ ${topic.name}: ${suggestion.title}`);
    }
  }
  log(`[resources] ${tally.topics} topics · ${tally.suggested} suggested · ${tally.added} added · ${tally.rejected} failed the link check`);
  return tally;
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
