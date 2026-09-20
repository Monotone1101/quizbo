/**
 * Link verification for AI-suggested study pages: the page must answer 200 (after redirects) and
 * contain the check phrase. Mirrors `npm run resources:check` for the curated library.
 */
const decode = (html: string) =>
  html.replace(/&#x27;|&#39;|&rsquo;|’/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").toLowerCase();

export type LinkVerdict = { ok: true; finalUrl: string } | { ok: false; reason: string };

export async function verifyLink(url: string, phrase: string, timeoutMs = 20_000): Promise<LinkVerdict> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": "Mozilla/5.0 (Quizbo resource check)" },
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
      const type = res.headers.get("content-type") ?? "";
      if (!type.includes("html")) return { ok: false, reason: `not a web page (${type || "unknown type"})` };
      const html = decode(await res.text());
      if (/page not found|404 not found/.test(html.slice(0, 4_000))) return { ok: false, reason: "soft 404" };
      if (!html.includes(phrase.toLowerCase())) return { ok: false, reason: `missing "${phrase}"` };
      return { ok: true, finalUrl: res.url || url };
    } catch (error) {
      if (attempt === 2) return { ok: false, reason: (error as { cause?: { code?: string } }).cause?.code ?? (error as Error).name };
    }
  }
  return { ok: false, reason: "unreachable" };
}
