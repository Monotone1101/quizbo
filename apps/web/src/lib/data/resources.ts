import "server-only";
import { EXAM_RESOURCES, prisma, type ExamResource, type User } from "@quizbo/db";

/** Topics with at least this many validated questions can be battled on directly. */
export const MIN_TOPIC_QUESTIONS = 5;
/** Mastery below this is flagged as a weak spot. */
const WEAK_MASTERY = 0.5;

export interface LibraryTopic {
  id: string;
  name: string;
  questionCount: number;
  mastery: number | null;
  weak: boolean;
  resources: Array<{ id: string; title: string; url: string; source: string; ai: boolean }>;
}

export interface LibrarySubject {
  slug: string;
  name: string;
  level: string | null;
  topicCount: number;
  units: Array<{ name: string; topics: LibraryTopic[] }>;
}

export interface Library {
  subjects: Array<{ slug: string; name: string; topicCount: number }>;
  shown: LibrarySubject[];
  exam: ExamResource[];
  totals: { topics: number; links: number; matches: number };
}

const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

export async function loadLibrary(viewer: User, filter: { subject?: string; q?: string }): Promise<Library> {
  const [subjects, mastery] = await Promise.all([
    prisma.subject.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        topics: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: {
            resources: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
            _count: { select: { questions: { where: { validated: true } } } },
          },
        },
      },
    }),
    prisma.mastery.findMany({ where: { userId: viewer.id }, select: { topicId: true, score: true } }),
  ]);
  const masteryByTopic = new Map(mastery.map((m) => [m.topicId, m.score]));
  const query = normalize(filter.q?.trim() ?? "");
  const matches = (...fields: Array<string | null>) => !query || fields.some((f) => f && normalize(f).includes(query));

  let links = 0;
  let matchCount = 0;
  const shown: LibrarySubject[] = [];
  for (const subject of subjects) {
    links += subject.topics.reduce((sum, t) => sum + t.resources.length, 0);
    if (filter.subject && subject.slug !== filter.subject) continue;

    const units = new Map<string, LibraryTopic[]>();
    for (const topic of subject.topics) {
      // A topic matches on its own name or unit (all links shown), otherwise only matching links are kept.
      const topicMatches = matches(topic.name, topic.unit);
      const resources = topic.resources.filter((r) => topicMatches || matches(r.title, r.sourceLabel));
      if (!topicMatches && resources.length === 0) continue;
      const score = masteryByTopic.get(topic.id) ?? null;
      const unit = topic.unit ?? "General";
      units.set(unit, [
        ...(units.get(unit) ?? []),
        {
          id: topic.id,
          name: topic.name,
          questionCount: topic._count.questions,
          mastery: score,
          weak: score !== null && score < WEAK_MASTERY,
          resources: resources.map((r) => ({ id: r.id, title: r.title, url: r.url, source: r.sourceLabel, ai: r.origin === "AI" })),
        },
      ]);
      matchCount += 1;
    }
    if (units.size === 0) continue;
    shown.push({
      slug: subject.slug,
      name: subject.name,
      level: subject.level,
      topicCount: subject.topics.length,
      units: [...units].map(([name, topics]) => ({ name, topics })),
    });
  }

  return {
    subjects: subjects.map((s) => ({ slug: s.slug, name: s.name, topicCount: s.topics.length })),
    shown,
    exam: EXAM_RESOURCES.filter((r) => matches(r.title, r.description, r.source)),
    totals: {
      topics: subjects.reduce((sum, s) => sum + s.topics.length, 0),
      links: links + EXAM_RESOURCES.length,
      matches: matchCount,
    },
  };
}
