/**
 * Re-verifies every curated study link: the page must answer 200 and, when the resource declares a
 * `check` phrase, contain it. Entries with `check: false` are skipped (sites that block build machines).
 *
 *   npm run resources:check -w @quizbo/db
 */
import { CURRICULUM } from "../prisma/seed-data";
import { EXAM_RESOURCES, mergeCurriculum } from "../src/content/jee";

interface Entry {
  where: string;
  url: string;
  check: string | false | undefined;
}

const entries: Entry[] = [
  ...EXAM_RESOURCES.map((r) => ({ where: "Exam essentials", url: r.url, check: r.check })),
  ...mergeCurriculum(CURRICULUM).flatMap((subject) =>
    subject.topics.flatMap((topic) =>
      topic.resources.map((r) => ({ where: `${subject.name} › ${topic.name}`, url: r.url, check: r.check })),
    ),
  ),
];

const decode = (html: string) =>
  html.replace(/&#x27;|&#39;|&rsquo;|’/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").toLowerCase();

async function verify(entry: Entry, attempt = 1): Promise<string | null> {
  try {
    const res = await fetch(entry.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
      headers: { "user-agent": "Mozilla/5.0 (Quizbo resource check)" },
    });
    if (!res.ok) return `HTTP ${res.status}`;
    if (!entry.check) return null;
    const html = decode(await res.text());
    return html.includes(entry.check.toLowerCase()) ? null : `missing "${entry.check}"`;
  } catch (error) {
    // Government exam sites are slow to connect from abroad; give network errors one retry.
    if (attempt < 2) return verify(entry, attempt + 1);
    const cause = (error as { cause?: { code?: string } }).cause?.code;
    return cause ?? (error as Error).name;
  }
}

const skipped = entries.filter((e) => e.check === false);
const queue = entries.filter((e) => e.check !== false);
const failures: string[] = [];
let done = 0;

await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      const problem = await verify(entry);
      done += 1;
      if (problem) failures.push(`  ✗ ${problem.padEnd(28)} ${entry.url}  (${entry.where})`);
    }
  }),
);

console.log(`Checked ${done} links, skipped ${skipped.length}${skipped.length ? ` (${skipped.map((e) => e.url).join(", ")})` : ""}.`);
if (failures.length) {
  console.error(`${failures.length} broken:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("All links OK.");
