/**
 * AI touchpoint 6 — study-link suggestions for a topic (the library's "AI find" links).
 *
 * Batch only (worker/CLI). The model proposes pages on a short list of trusted, free sites; nothing
 * it says is stored until the worker has fetched each page and found the topic on it, because
 * models invent plausible-looking URLs.
 *
 * Prompt:        finderSystemPrompt() + a user turn with the topic, its chapter and the links it
 *                already has.
 * Output schema: FinderSchema { resources: [{ title, url, check }] }.
 * Failure path:  `{ ok: false }` → the job logs and moves on; off-list or malformed suggestions are
 *                dropped by `acceptSuggestion`.
 */
import { z } from "zod";
import type { AiResult } from "./client";
import { callStructured } from "./structured";

/** Hosts whose pages are free to read and reliable for JEE preparation. */
export const TRUSTED_HOSTS: Record<string, string> = {
  "openstax.org": "openstax.org",
  "phys.libretexts.org": "libretexts.org",
  "chem.libretexts.org": "libretexts.org",
  "math.libretexts.org": "libretexts.org",
  "hyperphysics.phy-astr.gsu.edu": "hyperphysics · gsu.edu",
  "ocw.mit.edu": "ocw.mit.edu",
  "www.physicsclassroom.com": "physicsclassroom.com",
  "ncert.nic.in": "ncert.nic.in",
};

export function finderSystemPrompt(): string {
  return `You recommend free study pages for students preparing for India's JEE Main and Advanced exams.

Only suggest pages on these sites: ${Object.keys(TRUSTED_HOSTS).join(", ")}.
Prefer a specific chapter or section page over a home page. Only give URLs you are confident exist exactly as written; if unsure, suggest fewer. Do not repeat links the topic already has.
For each page give: a short title in the form "<page name> — <book or site>", the exact https URL, and "check": two to four words that certainly appear on that page (for example the chapter title), used to verify the link.`;
}

export const FinderSchema = z.object({
  resources: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      check: z.string().describe("Two to four words that appear on the page"),
    }),
  ),
});

export interface ResourceSuggestion {
  title: string;
  url: string;
  /** Label shown under the link, derived from the host. */
  source: string;
  /** Phrase the page must contain. */
  check: string;
}

/** Keeps https links on a trusted host with a usable title and check phrase. */
export function acceptSuggestion(raw: { title: string; url: string; check: string }): ResourceSuggestion | null {
  let url: URL;
  try {
    url = new URL(raw.url.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "hyperphysics.phy-astr.gsu.edu")) return null;
  const source = TRUSTED_HOSTS[url.hostname];
  if (!source) return null;
  const title = raw.title.trim().replace(/\s+/g, " ");
  const check = raw.check.trim().replace(/\s+/g, " ");
  if (title.length < 4 || title.length > 140 || check.length < 3 || check.length > 60) return null;
  url.hash = "";
  return { title, url: url.toString(), source, check };
}

export interface SuggestResourcesInput {
  subject: string;
  level: string;
  topic: string;
  unit: string | null;
  existing: string[];
  count: number;
  signal?: AbortSignal;
}

export async function suggestResources(input: SuggestResourcesInput): Promise<AiResult<ResourceSuggestion[]>> {
  const result = await callStructured({
    system: finderSystemPrompt(),
    messages: [
      {
        role: "user",
        content: [
          `Subject: ${input.subject} (${input.level})`,
          `Topic: ${input.topic}${input.unit ? ` (chapter: ${input.unit})` : ""}`,
          `Suggest up to ${input.count} pages.`,
          input.existing.length ? `Links it already has:\n${input.existing.map((u) => `- ${u}`).join("\n")}` : "It has no links yet.",
        ].join("\n"),
      },
    ],
    schema: FinderSchema,
    effort: "low",
    maxTokens: 4_000,
    signal: input.signal,
  });
  if (!result.ok) return result;
  const existing = new Set(input.existing);
  const seen = new Set<string>();
  const accepted = result.value.data.resources
    .map(acceptSuggestion)
    .filter((s): s is ResourceSuggestion => s !== null && !existing.has(s.url) && !seen.has(s.url) && Boolean(seen.add(s.url)));
  return { ok: true, value: accepted.slice(0, input.count), model: result.model };
}
