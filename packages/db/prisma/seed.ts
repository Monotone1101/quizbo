import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { prisma } from "../src/index";
import { mergeCurriculum } from "../src/content/jee";
import { seedDemoPlan } from "../scripts/demo-plan";
import { CURRICULUM, DEMO_PLAYERS, type SeedQuestion } from "./seed-data";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../.env"), quiet: true });

const SEED_NOTE =
  "Seed bank: hand-written with a worked answer key; awaiting educator spot-check before launch.";

function assertWellFormed(question: SeedQuestion, topic: string) {
  const unique = new Set(question.options.map((o) => o.trim().toLowerCase()));
  if (unique.size !== 4) throw new Error(`Duplicate options in "${topic}": ${question.text}`);
  if (question.correct < 0 || question.correct > 3) throw new Error(`Bad answer key in "${topic}": ${question.text}`);
}

async function seedCurriculum() {
  let created = 0;
  let total = 0;
  const curriculum = mergeCurriculum(CURRICULUM);
  for (const subject of curriculum) {
    const subjectRow = await prisma.subject.upsert({
      where: { slug: subject.slug },
      update: { name: subject.name, level: subject.level },
      create: { slug: subject.slug, name: subject.name, level: subject.level },
    });

    for (const [sortOrder, topic] of subject.topics.entries()) {
      const topicRow = await prisma.topic.upsert({
        where: { subjectId_name: { subjectId: subjectRow.id, name: topic.name } },
        update: { unit: topic.unit, sortOrder },
        create: { subjectId: subjectRow.id, name: topic.name, unit: topic.unit, sortOrder },
      });

      for (const question of topic.questions) {
        assertWellFormed(question, topic.name);
        total += 1;
        const existing = await prisma.question.findFirst({
          where: { topicId: topicRow.id, text: question.text },
          select: { id: true },
        });
        if (existing) continue;
        await prisma.question.create({
          data: {
            topicId: topicRow.id,
            text: question.text,
            options: question.options,
            correctIndex: question.correct,
            rationale: question.rationale,
            difficulty: question.difficulty,
            validated: true,
            validatedAt: new Date(),
            source: "SEED",
            validationNotes: SEED_NOTE,
          },
        });
        created += 1;
      }

      for (const resource of topic.resources) {
        await prisma.resource.upsert({
          where: { topicId_url: { topicId: topicRow.id, url: resource.url } },
          update: { title: resource.title, sourceLabel: resource.source },
          create: {
            topicId: topicRow.id,
            title: resource.title,
            url: resource.url,
            sourceLabel: resource.source,
            origin: "CURATED",
          },
        });
      }
    }
  }
  console.log(`Curriculum ready: ${curriculum.length} subjects, ${created} new of ${total} seed questions.`);
}

async function seedDemoPlayers() {
  const physics = await prisma.subject.findUnique({ where: { slug: "physics-12" } });
  if (!physics) return;
  for (const player of DEMO_PLAYERS) {
    const user = await prisma.user.upsert({
      where: { email: player.email },
      update: {},
      create: {
        email: player.email,
        name: player.name,
        isDemo: true,
        motivationStyle: "COMPETITIVE",
        dailyStudyMinutes: 60,
        onboardedAt: new Date(),
      },
    });
    await prisma.eloRating.upsert({
      where: { userId_subjectId: { userId: user.id, subjectId: physics.id } },
      update: { rating: player.rating, matchesPlayed: player.matchesPlayed },
      create: { userId: user.id, subjectId: physics.id, rating: player.rating, matchesPlayed: player.matchesPlayed },
    });
  }
  console.log(`Demo opponents ready: ${DEMO_PLAYERS.length} (isDemo = true).`);
}

try {
  await seedCurriculum();
  if (process.env.SEED_DEMO_DATA === "true") {
    await seedDemoPlayers();
    // Two upcoming tests and a fortnight of sessions, for whichever student account exists.
    await seedDemoPlan();
  }
} finally {
  await prisma.$disconnect();
}
