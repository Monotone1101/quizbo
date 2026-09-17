/**
 * Fuzzy topic resolution for planner intake (architecture.md §5.2): "Optics", "optics" and
 * "light" should land on existing topics instead of creating duplicates. A new TOPIC row is only
 * created when nothing is close enough — and the confirmation card shows every match first.
 */
export interface TopicRef {
  id: string;
  name: string;
  /** Chapter grouping, e.g. "Optics" for "Refraction at curved surfaces". */
  unit: string | null;
}

export type TopicMatch =
  | { kind: "topic"; query: string; topic: TopicRef; score: number }
  | { kind: "group"; query: string; label: string; topics: TopicRef[] }
  | { kind: "new"; query: string };

const STOPWORDS = new Set([
  "the", "and", "of", "a", "an", "in", "on", "at", "to", "for", "with",
  "chapter", "ch", "unit", "topic", "topics", "basics", "intro", "introduction", "mostly",
]);

/** Common student phrasings mapped to the names used in the question bank. */
const ALIASES: Readonly<Record<string, string>> = {
  light: "optics",
  "ray optics": "optics",
  tir: "total internal reflection",
  "snell law": "refraction at plane surfaces",
  "snells law": "refraction at plane surfaces",
  lens: "lens formula",
  lenses: "lens formula",
  "quadratic equation": "quadratics",
  "quadratic equations": "quadratics",
  "linear inequality": "inequalities",
  "linear inequalities": "inequalities",
  differentiation: "derivatives",
  integration: "integrals",
};

const IRREGULAR_PLURALS: Readonly<Record<string, string>> = {
  lenses: "lens",
  axes: "axis",
  indices: "index",
  matrices: "matrix",
  vertices: "vertex",
};
const NEVER_PLURAL = new Set(["lens", "gas", "mass", "basis", "analysis", "axis"]);

export function normalizeTopicName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Crude but consistent singulariser — both sides of every comparison go through it. */
function singular(word: string): string {
  const irregular = IRREGULAR_PLURALS[word];
  if (irregular) return irregular;
  if (word.length <= 3 || NEVER_PLURAL.has(word) || /(ss|us|is|ics)$/.test(word)) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  return word.endsWith("s") ? word.slice(0, -1) : word;
}

/** Stopword-free, singularised, alias-resolved form used for every comparison. */
export function canonicalTopic(name: string): string {
  const normalized = normalizeTopicName(name);
  const aliased = ALIASES[normalized] ?? normalized;
  return aliased
    .split(" ")
    .filter((token) => token && !STOPWORDS.has(token))
    .map(singular)
    .join(" ");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min((current[j - 1] ?? 0) + 1, (previous[j] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

export function topicSimilarity(a: string, b: string): number {
  const ca = canonicalTopic(a);
  const cb = canonicalTopic(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 1;
  const edit = 1 - levenshtein(ca, cb) / Math.max(ca.length, cb.length);
  const ta = new Set(ca.split(" "));
  const tb = new Set(cb.split(" "));
  const shared = [...ta].filter((token) => tb.has(token)).length;
  const jaccard = shared / new Set([...ta, ...tb]).size;
  return Math.max(edit, jaccard);
}

const byName = (a: TopicRef, b: TopicRef) => a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1);

export function matchTopic(query: string, existing: readonly TopicRef[], threshold = 0.82): TopicMatch {
  const q = canonicalTopic(query);
  if (!q) return { kind: "new", query };

  const exact = existing.filter((t) => canonicalTopic(t.name) === q).sort(byName);
  if (exact[0]) return { kind: "topic", query, topic: exact[0], score: 1 };

  const unitTopics = existing.filter((t) => t.unit && canonicalTopic(t.unit) === q).sort(byName);
  if (unitTopics[0]) return { kind: "group", query, label: unitTopics[0].unit ?? query, topics: unitTopics };

  const queryTokens = q.split(" ");
  const containing = existing
    .filter((t) => {
      const tokens = new Set(canonicalTopic(t.name).split(" "));
      return queryTokens.every((token) => tokens.has(token));
    })
    .sort(byName);
  if (containing.length === 1 && containing[0]) return { kind: "topic", query, topic: containing[0], score: 0.9 };
  if (containing.length > 1) return { kind: "group", query, label: query.trim(), topics: containing };

  let best: { topic: TopicRef; score: number } | null = null;
  for (const topic of [...existing].sort(byName)) {
    const score = topicSimilarity(query, topic.name);
    if (!best || score > best.score) best = { topic, score };
  }
  if (best && best.score >= threshold) return { kind: "topic", query, topic: best.topic, score: best.score };
  return { kind: "new", query };
}

/** Resolves every requested topic; returns the matches plus the de-duplicated ids and new names. */
export function resolveTopics(queries: readonly string[], existing: readonly TopicRef[]) {
  const matches = queries.map((q) => matchTopic(q, existing));
  const topicIds = new Set<string>();
  const newNames: string[] = [];
  for (const match of matches) {
    if (match.kind === "topic") topicIds.add(match.topic.id);
    else if (match.kind === "group") match.topics.forEach((t) => topicIds.add(t.id));
    else if (!newNames.some((name) => canonicalTopic(name) === canonicalTopic(match.query))) newNames.push(match.query.trim());
  }
  return { matches, topicIds: [...topicIds], newNames };
}
