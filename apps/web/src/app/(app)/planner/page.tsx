import { isAiConfigured } from "@quizbo/ai";
import type { Metadata } from "next";
import Link from "next/link";
import { DraftCard } from "@/components/planner/draft-card";
import { IntakePanel } from "@/components/planner/intake-panel";
import { RemoveExamButton, ReplanButton } from "@/components/planner/planner-controls";
import { WeekGrid } from "@/components/planner/week-grid";
import { SetCrumb } from "@/components/shell/shell-context";
import { Blueprint } from "@/components/ui/blueprint";
import { ButtonLink } from "@/components/ui/button";
import { loadPlanner } from "@/lib/data/planner";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Planner" };

const PRIORITY_LABEL = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" } as const;

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const viewer = await requireViewer();
  const { week } = await searchParams;
  const offset = Math.max(-26, Math.min(26, Math.trunc(Number(week) || 0)));
  const data = await loadPlanner(viewer, offset);

  return (
    <div className="grid grid-cols-1 items-start gap-6 p-4 md:p-[26px] xl:grid-cols-[minmax(0,1fr)_380px]">
      <SetCrumb label={`Planner / ${data.weekLabel}`} />
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-divider pb-[9px]">
          <h4 className="m-0">{data.weekLabel}</h4>
          <span className="text-[12px] text-neutral-600">
            {viewer.dailyStudyMinutes} min/day budget · weighted by (1 − mastery) × priority
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Link href={`/planner?week=${offset - 1}`} className="btn btn-ghost text-[11px]" aria-label="Previous week">
              ‹ PREV
            </Link>
            {offset !== 0 && (
              <Link href="/planner" className="btn btn-ghost text-[11px]">
                THIS WEEK
              </Link>
            )}
            <Link href={`/planner?week=${offset + 1}`} className="btn btn-ghost text-[11px]" aria-label="Next week">
              NEXT ›
            </Link>
          </span>
        </div>

        {data.stale && (
          <div className="mb-4 flex flex-wrap items-center gap-3 border-l-2 border-accent pl-3 text-[13px]">
            <span>Your mastery changed after battles since this plan was made. Re-plan to weight the new scores.</span>
            <ReplanButton />
          </div>
        )}

        <WeekGrid days={data.days} />

        {data.suggestion && (
          <Blueprint corners="diagonal" className="mt-5 flex flex-wrap items-center gap-3.5 border-l-2 border-l-accent px-4 py-3.5">
            <div className="min-w-0">
              <div className="qz-lab text-accent-700">Suggestion</div>
              <div className="mt-0.5 text-[14px]">
                Mastery on <strong>{data.suggestion.topicName}</strong> is {data.suggestion.mastery.toFixed(2)} and it is scheduled{" "}
                {data.suggestion.when}. Battle someone on it today?
              </div>
            </div>
            <ButtonLink href={`/play?topic=${data.suggestion.topicId}`} className="ml-auto flex-none">
              QUEUE UP
            </ButtonLink>
          </Blueprint>
        )}

        {data.drafts.length > 0 && (
          <section className="mt-[26px]">
            <div className="mb-3.5 flex items-baseline gap-3 border-b border-divider pb-[9px]">
              <h4 className="m-0">Confirm before saving</h4>
              <span className="tag tag-outline">NOT YET WRITTEN</span>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {data.drafts.map((card, index) => (
                <DraftCard key={card.draftId} card={card} index={index} total={data.drafts.length} today={data.today} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-[26px]">
          <div className="mb-1.5 flex flex-wrap items-baseline gap-3 border-b border-divider pb-[9px]">
            <h4 className="m-0">Upcoming exams</h4>
            <span className="text-[12px] text-neutral-600">Confirmed — the scheduler plans around these</span>
            {data.exams.length > 0 && (
              <span className="ml-auto">
                <ReplanButton />
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Date</th>
                  <th>Priority</th>
                  <th>Topics</th>
                  <th className="text-right">Sessions left</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.exams.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-5 text-[13px] text-neutral-600">
                      No exams yet. Describe one in the intake panel and confirm the card.
                    </td>
                  </tr>
                ) : (
                  data.exams.map((exam) => (
                    <tr key={exam.id}>
                      <td>{exam.title}</td>
                      <td className="whitespace-nowrap text-neutral-700">
                        {exam.date} <span className="text-[12px] text-neutral-600">· {exam.daysLeft}d</span>
                      </td>
                      <td className="text-neutral-700">{PRIORITY_LABEL[exam.priority]}</td>
                      <td className="text-[13px] text-neutral-700">{exam.topics.join(", ") || "—"}</td>
                      <td className="qz-num text-right text-[15px]">{exam.pendingSessions}</td>
                      <td className="text-right">
                        <RemoveExamButton examId={exam.id} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <IntakePanel messages={data.messages} aiEnabled={isAiConfigured()} />
    </div>
  );
}
