import { ExternalLink, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LootLink } from "@/components/fun/loot";
import { Blueprint } from "@/components/ui/blueprint";
import { loadLibrary, MIN_TOPIC_QUESTIONS, type LibraryTopic } from "@/lib/data/resources";
import { requireViewer } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Resources" };

function href(params: { subject?: string; q?: string }) {
  const search = new URLSearchParams();
  if (params.subject) search.set("subject", params.subject);
  if (params.q) search.set("q", params.q);
  const query = search.toString();
  return query ? `/resources?${query}` : "/resources";
}

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ subject?: string; q?: string }> }) {
  const viewer = await requireViewer();
  const { subject, q } = await searchParams;
  const library = await loadLibrary(viewer, { subject, q });
  const query = q?.trim() ?? "";
  const nothing = library.shown.length === 0 && library.exam.length === 0;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-[26px]">
      <div className="flex flex-wrap items-end gap-x-[26px] gap-y-4 border-b border-divider pb-[18px]">
        <div>
          <div className="qz-lab text-accent-700">Library · JEE Main &amp; Advanced</div>
          <div className="mt-1 font-heading text-[56px] font-semibold leading-none">RESOURCES</div>
        </div>
        <div className="flex flex-wrap gap-x-[26px] gap-y-3 md:ml-auto md:text-right">
          <div>
            <div className="qz-lab text-neutral-600">Subjects</div>
            <div className="qz-num text-[34px]">{library.subjects.length}</div>
          </div>
          <div>
            <div className="qz-lab text-neutral-600">Topics</div>
            <div className="qz-num text-[34px]">{library.totals.topics}</div>
          </div>
          <div>
            <div className="qz-lab text-neutral-600">Free links</div>
            <div className="qz-num text-[34px]">{library.totals.links}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex flex-wrap gap-[22px]" aria-label="Subjects">
          <Link href={href({ q: query })} className="nav-link" aria-current={!subject ? "page" : undefined}>
            All
          </Link>
          {library.subjects.map((s) => (
            <Link
              key={s.slug}
              href={href({ subject: s.slug, q: query })}
              className="nav-link"
              aria-current={subject === s.slug ? "page" : undefined}
            >
              {s.name} <span className="qz-num text-neutral-600">{s.topicCount}</span>
            </Link>
          ))}
        </nav>
        <form action="/resources" method="get" role="search" className="qz-glow-field ml-auto w-full max-w-[400px]">
          {subject && <input type="hidden" name="subject" value={subject} />}
          <Search size={18} strokeWidth={1.75} className="flex-none text-neutral-500" aria-hidden="true" />
          <input type="search" name="q" defaultValue={query} placeholder="Search" aria-label="Search topics, chapters and sources" />
          <button type="submit" className="btn btn-ghost flex-none rounded-full px-3 text-[11px] tracking-[.08em]">
            GO
          </button>
        </form>
      </div>

      {query && (
        <div className="flex items-center gap-3 text-[13px] text-neutral-600">
          <span>
            {library.totals.matches} topic{library.totals.matches === 1 ? "" : "s"} match “{query}”
          </span>
          <Link href={href({ subject })} className="btn btn-ghost text-[11px]">
            CLEAR
          </Link>
        </div>
      )}

      {library.exam.length > 0 && !subject && (
        <section>
          <div className="qz-lab mb-3">Exam essentials · official</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {library.exam.map((r) => (
              <LootLink
                key={r.url}
                loot={{ url: r.url, title: r.title, source: r.source }}
                className="blueprint group block p-4 text-text no-underline transition-[border-color,transform] hover:-translate-y-0.5 hover:border-hot"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-heading text-[16px] font-semibold leading-tight group-hover:text-accent-700">{r.title}</div>
                  <ExternalLink size={14} strokeWidth={1.5} className="mt-0.5 flex-none text-neutral-600" aria-hidden="true" />
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-neutral-700">{r.description}</p>
                <div className="qz-lab mt-2 text-neutral-600">{r.source}</div>
              </LootLink>
            ))}
          </div>
        </section>
      )}

      {library.shown.map((s) => (
        <section key={s.slug} className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3 border-b border-divider pb-2">
            <h2 className="font-heading text-[28px] font-semibold leading-none">{s.name.toUpperCase()}</h2>
            <span className="text-[12px] text-neutral-600">
              {s.level ? `${s.level} · ` : ""}
              {s.topicCount} topics
            </span>
          </div>
          {s.units.map((unit) => (
            <div key={unit.name}>
              <div className="qz-lab mb-2.5 text-accent-700">{unit.name}</div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {unit.topics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      {nothing && (
        <Blueprint className="p-6 text-center text-[13px] text-neutral-600">
          {query ? (
            <>
              Nothing matches “{query}”. <Link href={href({ subject })}>Clear the search</Link>
            </>
          ) : (
            <>No study material yet. Run <code>npm run db:seed</code> to load the JEE library.</>
          )}
        </Blueprint>
      )}
    </div>
  );
}

function TopicCard({ topic }: { topic: LibraryTopic }) {
  return (
    <Blueprint corners="diagonal" className={cn("flex flex-col gap-2.5 p-4", topic.weak && "border-accent-300")}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-heading text-[16px] font-semibold leading-tight">{topic.name}</div>
        <div className="flex flex-none gap-1.5">
          {topic.weak && <span className="chip bg-hot text-white">WEAK SPOT</span>}
          {topic.mastery !== null && !topic.weak && <span className="chip chip-soft">{Math.round(topic.mastery * 100)}%</span>}
        </div>
      </div>
      {topic.resources.length ? (
        <ul className="flex flex-col gap-2">
          {topic.resources.map((r) => (
            <li key={r.id}>
              <LootLink
                loot={{ url: r.url, title: r.title, source: r.source }}
                className="block border-l-2 border-accent-300 pl-[9px] text-text no-underline hover:border-hot hover:text-accent-700"
              >
                <div className="text-[13px] leading-[1.3]">{r.title}</div>
                <div className="qz-lab mt-0.5 flex items-center gap-1.5 text-neutral-600">
                  {r.source}
                  {r.ai && (
                    <span className="chip chip-outline px-1 py-0 text-[9px]" title="Suggested by the AI resource finder and link-checked">
                      AI FIND
                    </span>
                  )}
                </div>
              </LootLink>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-[12px] text-neutral-600">No links yet.</div>
      )}
      <div className="mt-auto flex items-center justify-between border-t border-divider pt-2 text-[11px] text-neutral-600">
        <span>{topic.questionCount ? `${topic.questionCount} battle questions` : "No battle questions yet"}</span>
        {topic.questionCount >= MIN_TOPIC_QUESTIONS && (
          <Link href={`/play?topic=${topic.id}`} className="btn btn-ghost text-[11px]">
            BATTLE THIS →
          </Link>
        )}
      </div>
    </Blueprint>
  );
}
