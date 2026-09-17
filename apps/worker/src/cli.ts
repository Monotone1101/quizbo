import "./env";
import { prisma, type Difficulty, type QuestionSource } from "@quizbo/db";
import { replanAll, runGeneration, runValidation, spotCheck } from "./pipeline";

const HELP = `Quizbo question pipeline (runs without Redis)

Usage: npm run questions:pipeline -- <command> [flags]

  generate     Generate unvalidated questions for topics below the target
               --subject <slug>  --topic "<name>"  --count 6  --target 30  --difficulty EASY|MEDIUM|HARD  --force
  validate     Run the independent AI review; only passing questions become battle-eligible
               --limit 50  --source generated|seed|all  --revalidate
  pipeline     generate, then validate what was generated (same flags)
  spot-check   Print a random sample of validated questions for a human reviewer
               --sample 10
  replan       Re-run the scheduler for every student with an upcoming exam
`;

function flags(args: string[]) {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg?.startsWith("--")) continue;
    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      out[arg.slice(2)] = next;
      i++;
    } else out[arg.slice(2)] = true;
  }
  return out;
}

const str = (value: string | true | undefined) => (typeof value === "string" ? value : undefined);
const num = (value: string | true | undefined, fallback: number) => {
  const parsed = Number(str(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const f = flags(rest);
  const difficulty = str(f.difficulty)?.toUpperCase() as Difficulty | undefined;
  const source = (str(f.source)?.toUpperCase() ?? "GENERATED") as QuestionSource | "ALL";

  const generate = () =>
    runGeneration({
      subjectSlug: str(f.subject),
      topicName: str(f.topic),
      perTopic: num(f.count, 6),
      targetValidated: num(f.target, 30),
      difficulty,
      force: f.force === true,
    });
  const validate = () => runValidation({ limit: num(f.limit, 50), source, revalidate: f.revalidate === true });

  switch (command) {
    case "generate":
      console.info(await generate());
      break;
    case "validate":
      console.info(await validate());
      break;
    case "pipeline":
      console.info(await generate());
      console.info(await validate());
      break;
    case "spot-check":
      await spotCheck(num(f.sample, 10));
      break;
    case "replan":
      await replanAll();
      break;
    default:
      console.info(HELP);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
