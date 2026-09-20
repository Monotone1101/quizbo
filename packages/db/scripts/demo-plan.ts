/**
 * Demo study plan: two upcoming tests in the next fortnight, with the deterministic scheduler's
 * sessions filling the days between. Used by the seed (when a student account already exists) and
 * runnable on its own:
 *
 *   npm run db:demo-plan                 the most recently created student account
 *   npm run db:demo-plan -- --user Ak    by name, email or id
 *
 * Re-running replaces the two demo exams rather than piling up duplicates.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, todayInTimeZone } from "@quizbo/core";
import { config as loadEnv } from "dotenv";
import { confirmExam, prisma } from "../src/index";

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env"), quiet: true });

export const DEMO_EXAMS = [
  {
    subject: "Physics",
    name: "Physics unit test — optics & electrostatics",
    inDays: 8,
    priority: "HIGH" as const,
    topics: ["Reflection at plane surfaces", "Refraction at plane surfaces", "Lens formula", "Coulomb's law", "Electric potential and capacitance"],
  },
  {
    subject: "Maths",
    name: "Maths class test — calculus",
    inDays: 13,
    priority: "MEDIUM" as const,
    topics: ["Limits, continuity and differentiability", "Derivatives", "Integrals", "Quadratics"],
  },
];

/** Picks the student to plan for: a real (non-opponent) account, else any onboarded account. */
async function pickUser(query?: string) {
  if (query) {
    return prisma.user.findFirst({
      where: { OR: [{ id: query }, { email: query }, { name: { equals: query, mode: "insensitive" } }] },
    });
  }
  return (
    (await prisma.user.findFirst({ where: { isDemo: false }, orderBy: { createdAt: "desc" } })) ??
    (await prisma.user.findFirst({ where: { onboardedAt: { not: null } }, orderBy: { createdAt: "desc" } }))
  );
}

export async function seedDemoPlan(query?: string, log: (message: string) => void = console.log) {
  const user = await pickUser(query);
  if (!user) {
    log("Demo plan skipped: no student account yet. Sign in once, then run `npm run db:demo-plan`.");
    return null;
  }
  const today = todayInTimeZone(user.timezone);

  // Replace any earlier copies so the script is safe to re-run.
  await prisma.exam.deleteMany({ where: { userId: user.id, name: { in: DEMO_EXAMS.map((e) => e.name) } } });

  let sessions = 0;
  for (const exam of DEMO_EXAMS) {
    const result = await confirmExam({
      userId: user.id,
      subject: exam.subject,
      name: exam.name,
      examDate: addDays(today, exam.inDays),
      priority: exam.priority,
      dateConfidence: "EXPLICIT",
      topics: exam.topics,
      today,
    });
    sessions = result.sessionsCreated;
    log(`  ${exam.name} — ${addDays(today, exam.inDays)} (${exam.priority})`);
  }
  log(`Demo plan ready for ${user.name ?? user.email}: 2 exams, ${sessions} study sessions over the next two weeks.`);
  return { userId: user.id, sessions };
}

// Run directly (not when imported by the seed).
if (process.argv[1]?.includes("demo-plan")) {
  const at = process.argv.indexOf("--user");
  try {
    await seedDemoPlan(at === -1 ? undefined : process.argv[at + 1]);
  } finally {
    await prisma.$disconnect();
  }
}
