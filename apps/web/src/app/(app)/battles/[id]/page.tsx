import { weakSpotAnalysis } from "@quizbo/ai";
import { fallbackWeakSpotAnalysis, reviewMinutes, type SubtopicRow, type Verdict } from "@quizbo/core";
import { prisma } from "@quizbo/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SetCrumb } from "@/components/shell/shell-context";
import { Blueprint } from "@/components/ui/blueprint";
import { ButtonLink } from "@/components/ui/button";
import { loadBattleForViewer } from "@/lib/data/battle";
import { toneFor } from "@/lib/data/coach";
import { requireViewer } from "@/lib/session";
import { formatSigned, pad } from "@/lib/utils";

export const metadata: Metadata = { title: "Battle breakdown" };
export const maxDuration = 60;

const VERDICT_STYLE: Record<Verdict, { bar: string; chip: string }> = {
  STRONG: { bar: "bg-accent", chip: "chip chip-solid" },
  FAIR: { bar: "bg-accent-400", chip: "chip chip-soft" },
  WEAK: { bar: "bg-accent-300", chip: "chip chip-outline" },
};

async function WeakSpotParagraph({
  battleId,
  userId,
  cached,
  row,
  misses,
  tone,
  subjectName,
}: {
  battleId: string;
  userId: string;
  cached: string | null;
  row: SubtopicRow;
  misses: Array<{ question: string; chosen: string | null; correct: string; timeTakenMs: number; timedOut: boolean }>;
  tone: ReturnType<typeof toneFor>;
  subjectName: string;
}) {
  if (cached) return <p className="m-0 text-[13px] text-neutral-800">{cached}</p>;
  const result = await weakSpotAnalysis({
    tone,
    subjectName,
    topicName: row.topicName,
    correct: row.correct,
    total: row.total,
    misses,
  });
  if (!result.ok) {
    if (result.reason !== "unconfigured") console.warn(`[analysis] fallback for battle ${battleId}: ${result.reason} ${result.detail ?? ""}`);
    return <p className="m-0 text-[13px] text-neutral-800">{fallbackWeakSpotAnalysis(row)}</p>;
  }
  await prisma.battlePlayer.update({
    where: { battleId_userId: { battleId, userId } },
    data: { analysis: result.text, analysisModel: result.model },
  });
  return <p className="m-0 text-[13px] text-neutral-800">{result.text}</p>;
}

export default async function BattleBreakdownPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const { id } = await params;
  const data = await loadBattleForViewer(id, viewer);
  if (!data) notFound();
  const { battle, me, opponent, answers, breakdown, scopeLabel } = data;

  const forfeit = battle.endReason === "OPPONENT_FORFEIT";
  const outcome = me.result === "WON" ? "VICTORY" : me.result === "LOST" ? "DEFEAT" : "DRAW";
  const weak = breakdown.weakSpot;
  const weakMisses = weak
    ? answers
        .filter((a) => a.topicId === weak.topicId && !a.correct)
        .map((a) => ({
          question: a.question.text,
          chosen: a.selectedIndex === null ? null : (a.question.options[a.selectedIndex] ?? null),
          correct: a.question.options[a.question.correctIndex] ?? "",
          timeTakenMs: a.timeTakenMs,
          timedOut: a.selectedIndex === null,
        }))
    : [];
  const number = pad(battle.number, 4);

  const stats = [
    ["ELO", formatSigned(me.eloDelta)],
    ["Accuracy", `${Math.round(breakdown.totals.accuracy * 100)}%`],
    ["Best streak", `×${me.bestStreak}`],
    ["Avg answer", breakdown.totals.avgTimeMs !== null ? `${(breakdown.totals.avgTimeMs / 1000).toFixed(1)}s` : "—"],
  ] as const;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-[26px]">
      <SetCrumb label={`Battles / ${number}`} />
      <div className="flex flex-wrap items-end gap-x-[26px] gap-y-4 border-b border-divider pb-[18px]">
        <div>
          <div className="qz-lab text-accent-700">
            Battle {number} · {battle.subject.name} · {scopeLabel}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-heading text-[56px] font-semibold leading-none">{outcome}</span>
            {forfeit && <span className="tag tag-outline">{me.result === "WON" ? "BY FORFEIT" : "FORFEITED"}</span>}
          </div>
          {opponent && (
            <div className="mt-1.5 text-[13px] text-neutral-600">
              vs {opponent.displayName} · {me.finalHp} HP to {opponent.finalHp} HP · {battle.playedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-[26px] gap-y-3 md:ml-auto md:text-right">
          {stats.map(([label, value]) => (
            <div key={label}>
              <div className="qz-lab text-neutral-600">{label}</div>
              <div className="qz-num text-[34px]">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-[22px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <h4 className="mb-3">By sub-topic</h4>
          {breakdown.rows.length === 0 ? (
            <p className="text-[13px] text-neutral-600">No answers were recorded for you in this battle.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {breakdown.rows.map((row) => {
                const style = VERDICT_STYLE[row.verdict];
                const pct = Math.round(row.accuracy * 100);
                return (
                  <div
                    key={row.topicId}
                    className="flex items-center gap-3.5 border-b border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] py-[11px]"
                  >
                    <div className="w-[120px] flex-none text-[14px] sm:w-[190px]">{row.topicName}</div>
                    <div className="relative h-3.5 flex-1 bg-neutral-200">
                      <div className={`absolute inset-y-0 left-0 ${style.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="qz-num w-14 text-right text-[17px]">{pct}%</div>
                    <div className="w-[74px] text-right">
                      <span className={style.chip}>{row.verdict}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 text-[12px] text-neutral-600">
            Aggregated from {answers.length} answer rows. Mastery updated for each topic above; the planner will read it on its next run.
          </div>
        </div>

        {weak && (
          <Blueprint className="flex flex-col gap-3 border-accent p-5">
            <div className="qz-lab text-accent-700">Weak spot</div>
            <div className="font-heading text-[30px] font-semibold leading-[1.05]">{weak.topicName}</div>
            <Suspense fallback={<p className="qz-pulse m-0 text-[13px] text-neutral-800">{fallbackWeakSpotAnalysis(weak)}</p>}>
              <WeakSpotParagraph
                battleId={battle.id}
                userId={viewer.id}
                cached={me.analysis}
                row={weak}
                misses={weakMisses}
                tone={toneFor(viewer.motivationStyle)}
                subjectName={battle.subject.name}
              />
            </Suspense>
            <ButtonLink href={`/battles/${battle.id}/review?topic=${weak.topicId}`} variant="primary" block className="justify-between">
              REVIEW THIS TOPIC <span className="text-[11px]">{reviewMinutes(weak)} MIN</span>
            </ButtonLink>
            <ButtonLink href={`/play?topic=${weak.topicId}`} block className="justify-between">
              REMATCH ON {weak.topicName.toUpperCase()} <span className="text-[11px]">±150</span>
            </ButtonLink>
            <div className="border-t border-divider pt-2.5 text-[11px] text-neutral-600">
              Multi-battle trends belong on a progress tab, not here.
            </div>
          </Blueprint>
        )}
      </div>
    </div>
  );
}
