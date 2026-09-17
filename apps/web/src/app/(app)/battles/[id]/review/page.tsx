import { reviewMinutes } from "@quizbo/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OpenCoach, SetCrumb } from "@/components/shell/shell-context";
import { Blueprint } from "@/components/ui/blueprint";
import { ButtonLink } from "@/components/ui/button";
import { loadBattleForViewer } from "@/lib/data/battle";
import { requireViewer } from "@/lib/session";
import { cn, pad } from "@/lib/utils";

export const metadata: Metadata = { title: "Review" };

const LETTERS = ["A", "B", "C", "D"];

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ topic?: string; all?: string }>;
}) {
  const viewer = await requireViewer();
  const [{ id }, { topic, all }] = await Promise.all([params, searchParams]);
  const data = await loadBattleForViewer(id, viewer);
  if (!data) notFound();

  const row = data.breakdown.rows.find((r) => r.topicId === topic) ?? data.breakdown.weakSpot;
  const showAll = all === "1" || !row;
  const answers = data.answers.filter((a) => (showAll ? true : a.topicId === row?.topicId && !a.correct));
  const title = showAll ? "Every question" : row!.topicName;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-[26px]">
      <SetCrumb label={`Battles / ${pad(data.battle.number, 4)} / Review`} />
      <div className="flex flex-wrap items-end gap-x-[26px] gap-y-4 border-b border-divider pb-[18px]">
        <div>
          <div className="qz-lab text-accent-700">
            Review · Battle {pad(data.battle.number, 4)} · {data.battle.subject.name}
          </div>
          <div className="mt-1 font-heading text-[42px] font-semibold leading-none">{title}</div>
          {!showAll && row && (
            <div className="mt-1.5 text-[13px] text-neutral-600">
              {row.correct} of {row.total} correct · about {reviewMinutes(row)} minutes to work through the misses
            </div>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <ButtonLink href={`/battles/${data.battle.id}`}>BACK TO BREAKDOWN</ButtonLink>
          {row && (
            <ButtonLink href={`/play?topic=${row.topicId}`} variant="primary">
              REMATCH ON THIS TOPIC
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-[12px]">
        <Link
          href={`/battles/${data.battle.id}/review?topic=${row?.topicId ?? ""}`}
          className={cn("nav-link text-[13px]")}
          aria-current={!showAll ? "page" : undefined}
        >
          Misses on this topic
        </Link>
        <Link href={`/battles/${data.battle.id}/review?all=1`} className="nav-link text-[13px]" aria-current={showAll ? "page" : undefined}>
          Every question
        </Link>
      </div>

      {answers.length === 0 && <p className="text-neutral-700">No misses on this topic — nothing to review.</p>}

      <div className="flex flex-col gap-5">
        {answers.map((answer) => {
          const chosen = answer.selectedIndex;
          return (
            <Blueprint key={answer.id} className="p-5">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="qz-lab text-accent-700">
                  Round {pad(answer.round)} · {answer.topic.name} · {answer.question.difficulty}
                </span>
                <span className={cn("chip", answer.correct ? "chip-solid" : chosen === null ? "chip-neutral" : "chip-outline")}>
                  {answer.correct ? "CORRECT" : chosen === null ? "TIMED OUT" : "MISSED"}
                </span>
                <span className="qz-num ml-auto text-[15px] text-neutral-600">{(answer.timeTakenMs / 1000).toFixed(1)}s</span>
              </div>
              <div className="mt-2 font-heading text-[22px] font-semibold leading-tight">{answer.question.text}</div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {answer.question.options.map((option, index) => {
                  const isCorrect = index === answer.question.correctIndex;
                  const isChosen = index === chosen;
                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex items-start gap-3 border px-3 py-2.5 text-[14px]",
                        isCorrect ? "border-accent bg-accent-100" : isChosen ? "border-dashed border-neutral-600" : "border-divider",
                      )}
                    >
                      <span className="qz-num text-[17px] opacity-70">{LETTERS[index]}</span>
                      <span className="flex-1">{option}</span>
                      {isCorrect && <span className="qz-lab text-accent-700">Answer</span>}
                      {isChosen && !isCorrect && <span className="qz-lab text-neutral-600">You</span>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 border-l-2 border-accent-300 pl-3 text-[13px] text-neutral-800">{answer.question.rationale}</div>
              {!answer.correct && (
                <OpenCoach
                  prompt={`Explain this one I got wrong: "${answer.question.text}" — I picked ${chosen === null ? "nothing (ran out of time)" : `"${answer.question.options[chosen]}"`}.`}
                  className="mt-3 inline-block text-[11px] no-underline"
                >
                  ASK COACH TO EXPLAIN →
                </OpenCoach>
              )}
            </Blueprint>
          );
        })}
      </div>
    </div>
  );
}
