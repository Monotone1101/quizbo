import type { Metadata } from "next";
import Link from "next/link";
import { ResultBadge } from "@/components/dashboard/dashboard-sections";
import { EloChart } from "@/components/progress/elo-chart";
import { Blueprint } from "@/components/ui/blueprint";
import { ButtonLink } from "@/components/ui/button";
import { loadProgress } from "@/lib/data/progress";
import { requireViewer } from "@/lib/session";
import { formatSigned } from "@/lib/utils";

export const metadata: Metadata = { title: "Progress" };

const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
const secs = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`);

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="qz-lab text-neutral-600">{label}</div>
      <div className="qz-num mt-1 text-[34px]">{value}</div>
      {note && <div className="text-[11px] text-neutral-600">{note}</div>}
    </div>
  );
}

export default async function ProgressPage() {
  const viewer = await requireViewer();
  const { totals, subjects, topics, weeks } = await loadProgress(viewer);
  const busiest = Math.max(1, ...weeks.map((w) => w.battles));

  return (
    <div className="flex flex-col gap-8 p-4 md:p-[26px]">
      <div className="flex flex-wrap items-end gap-x-[26px] gap-y-4 border-b border-divider pb-[18px]">
        <div>
          <div className="qz-lab text-accent-700">Across every battle</div>
          <div className="mt-1 font-heading text-[56px] font-semibold leading-none">PROGRESS</div>
        </div>
        <div className="flex flex-wrap gap-x-[26px] gap-y-3 md:ml-auto md:text-right">
          <Stat label="Battles" value={String(totals.battles)} note={`${totals.wins}W · ${totals.losses}L · ${totals.draws}D`} />
          <Stat label="Win rate" value={pct(totals.winRate)} />
          <Stat label="Accuracy" value={pct(totals.accuracy)} />
          <Stat label="Avg answer" value={secs(totals.avgAnswerMs)} />
          <Stat label="Best streak" value={`×${totals.bestStreak}`} />
        </div>
      </div>

      {totals.battles === 0 ? (
        <Blueprint className="flex flex-col items-center gap-3 p-[34px] text-center">
          <div className="font-heading text-[24px] font-semibold">No battles yet</div>
          <p className="m-0 max-w-[420px] text-[13px] text-neutral-700">
            Play a match and this page starts charting your rating, your accuracy per topic and your weekly rhythm.
          </p>
          <ButtonLink href="/play" variant="primary">
            START A MATCH
          </ButtonLink>
        </Blueprint>
      ) : (
        <>
          <section className="flex flex-col gap-5">
            <h4 className="m-0 border-b border-divider pb-[9px]">Rating over time</h4>
            {subjects.map((s) => (
              <div key={s.id} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div>
                  <div className="mb-2 flex items-baseline gap-3">
                    <span className="font-heading text-[18px] font-semibold">{s.name} ELO</span>
                    <span className="text-[12px] text-neutral-600">
                      {s.start} → {s.rating} ({formatSigned(s.rating - s.start)}) over {s.timeline.length} battles
                    </span>
                  </div>
                  <EloChart start={s.start} timeline={s.timeline} />
                </div>
                <details className="self-start text-[13px]">
                  <summary className="cursor-pointer text-accent-700">Show as table</summary>
                  <div className="mt-2 max-h-[260px] overflow-y-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Battle</th>
                          <th>Result</th>
                          <th className="text-right">ELO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...s.timeline].reverse().map((p) => (
                          <tr key={p.battleId}>
                            <td>
                              <Link href={`/battles/${p.battleId}`} className="no-underline">
                                {String(p.number).padStart(4, "0")}
                              </Link>
                            </td>
                            <td>
                              <ResultBadge result={p.result} />
                            </td>
                            <td className="qz-num text-right text-[14px]">
                              {p.elo} <span className="text-neutral-600">{formatSigned(p.delta)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            ))}
          </section>

          <section>
            <h4 className="m-0 mb-4 border-b border-divider pb-[9px]">Battles per week</h4>
            <div className="flex h-[150px] items-end gap-3" role="list" aria-label="Battles per week, last 8 weeks">
              {weeks.map((w) => {
                const label = new Date(`${w.start}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
                return (
                  <div
                    key={w.start}
                    role="listitem"
                    className="flex flex-1 flex-col items-center justify-end gap-1.5"
                    title={`Week of ${label}: ${w.battles} battles, ${w.wins} won`}
                  >
                    <span className="qz-num text-[13px] text-neutral-700">{w.battles || ""}</span>
                    <div
                      className="w-full max-w-[24px] rounded-t bg-accent"
                      style={{ height: `${Math.max(w.battles ? 6 : 2, (w.battles / busiest) * 100)}px`, opacity: w.battles ? 1 : 0.25 }}
                    />
                    <span className="text-[10px] text-neutral-600">{label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-6">
            <h4 className="m-0 border-b border-divider pb-[9px]">Topics you&apos;ve battled</h4>
            {topics.map((group) => (
              <div key={group.slug}>
                <div className="qz-lab mb-2 text-accent-700">{group.subject} · weakest first</div>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th className="w-[38%]">Mastery</th>
                        <th className="text-right">Accuracy</th>
                        <th className="text-right">Avg answer</th>
                        <th className="text-right">Answers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.topics.map((t) => (
                        <tr key={t.topicId}>
                          <td>
                            {t.name}
                            {t.weak && <span className="chip ml-2 bg-hot text-white">WEAK SPOT</span>}
                          </td>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <div className="h-2 flex-1 rounded-full bg-neutral-200">
                                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((t.mastery ?? 0) * 100)}%` }} />
                              </div>
                              <span className="qz-num w-10 text-right text-[14px]">{pct(t.mastery)}</span>
                            </div>
                          </td>
                          <td className="qz-num text-right text-[14px]">{pct(t.accuracy)}</td>
                          <td className="qz-num text-right text-[14px]">{secs(t.avgMs)}</td>
                          <td className="text-right text-neutral-600">{t.answered}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.topics
                    .filter((t) => t.weak)
                    .slice(0, 3)
                    .map((t) => (
                      <ButtonLink key={t.topicId} href={`/resources?q=${encodeURIComponent(t.name)}`}>
                        Study {t.name} →
                      </ButtonLink>
                    ))}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
