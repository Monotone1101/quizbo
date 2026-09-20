/**
 * Background worker (BullMQ on Redis). Two nightly job schedulers:
 *   question-bank  02:00 UTC — top up topics below the target, then run the validation pass.
 *   replan         02:30 UTC — re-run the deterministic scheduler with fresh mastery for every student.
 *   resources      03:00 UTC — AI resource finder for the weakest topics (links are fetched and checked).
 * Without REDIS_URL, run the same jobs on demand with `npm run questions:pipeline`.
 */
import "./env";
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { prisma } from "@quizbo/db";
import { replanAll, runGeneration, runResourceFinder, runValidation } from "./pipeline";

const QUEUE = "quizbo-maintenance";

function redisConnection(): ConnectionOptions | null {
  const raw = process.env.REDIS_URL;
  if (!raw) return null;
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

async function main() {
  const connection = redisConnection();
  if (!connection) {
    console.error("[worker] REDIS_URL is not set. Use `npm run questions:pipeline -- pipeline` to run jobs without Redis.");
    process.exit(1);
  }

  const queue = new Queue(QUEUE, { connection });
  await queue.upsertJobScheduler("nightly-question-bank", { pattern: "0 2 * * *", tz: "UTC" }, { name: "question-bank" });
  await queue.upsertJobScheduler("nightly-replan", { pattern: "30 2 * * *", tz: "UTC" }, { name: "replan" });
  await queue.upsertJobScheduler("nightly-resources", { pattern: "0 3 * * *", tz: "UTC" }, { name: "resources" });

  const worker = new Worker(
    QUEUE,
    async (job) => {
      switch (job.name) {
        case "question-bank": {
          const generated = await runGeneration({ perTopic: 5, targetValidated: 30 });
          const validated = await runValidation({ limit: 150, source: "GENERATED" });
          return { generated, validated };
        }
        case "replan":
          return replanAll();
        case "resources":
          return runResourceFinder({ topics: 10, perTopic: 3, maxLinks: 6 });
        default:
          throw new Error(`Unknown job ${job.name}`);
      }
    },
    { connection, concurrency: 1 },
  );

  worker.on("completed", (job, result) => console.info(`[worker] ${job.name} done`, result));
  worker.on("failed", (job, error) => console.error(`[worker] ${job?.name} failed`, error));
  console.info("[worker] listening for jobs");

  const shutdown = async () => {
    await worker.close();
    await queue.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

void main();
