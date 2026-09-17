import "server-only";
import { prisma } from "@quizbo/db";
import { cookies } from "next/headers";
import { cache } from "react";

export const SUBJECT_COOKIE = "qz-subject";

export type SubjectOption = { id: string; name: string; level: string | null; slug: string };

/** Subjects that have a battle-ready question bank. */
export const listBattleSubjects = cache(async (): Promise<SubjectOption[]> =>
  prisma.subject.findMany({
    where: { topics: { some: { questions: { some: { validated: true } } } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, level: true, slug: true },
  }),
);

export const getActiveSubject = cache(async () => {
  const subjects = await listBattleSubjects();
  const chosen = (await cookies()).get(SUBJECT_COOKIE)?.value;
  const subject =
    subjects.find((s) => s.id === chosen) ?? subjects.find((s) => s.slug === "physics-12") ?? subjects[0] ?? null;
  return { subject, subjects };
});

export function subjectLabel(subject: Pick<SubjectOption, "name" | "level">) {
  return subject.level ? `${subject.name} · ${subject.level}` : subject.name;
}
