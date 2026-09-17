import Link from "next/link";
import { OpenCoach } from "@/components/shell/shell-context";
import { Blueprint } from "@/components/ui/blueprint";
import { ButtonLink } from "@/components/ui/button";
import type { ResultChip } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";
import { DigitRain } from "./digit-rain";
import { FireCard } from "./fire-card";

export function EloCard({
  subjectName,
  rating,
  played,
  lastDelta,
  scaleMin,
  scaleMax,
  bandLeft,
  bandWidth,
  marker,
  kLine,
}: {
  subjectName: string;
  rating: number;
  played: number;
  lastDelta: string | null;
  scaleMin: number;
  scaleMax: number;
  bandLeft: number;
  bandWidth: number;
  marker: number;
  kLine: string;
}) {
  return (
    <Blueprint className="card justify-between gap-0 p-5">
      <DigitRain />
      <div className="relative z-[1]">
        <div className="card-kicker">ELO · {subjectName}</div>
        <div className="qz-num mb-0.5 mt-1.5 text-[82px]">{rating}</div>
        <div className="flex items-center gap-2">
          <span className="tag tag-accent">{lastDelta ? `${lastDelta} LAST MATCH` : "NO MATCHES YET"}</span>
          <span className="text-[12px] text-neutral-600">{played} played</span>
        </div>
      </div>
      <div className="relative z-[1] mt-[22px]">
        <div className="mb-[5px] flex justify-between text-[11px] text-neutral-600">
          <span>{scaleMin}</span>
          <span>MATCH BAND ±150</span>
          <span>{scaleMax}</span>
        </div>
        <div className="relative h-2 bg-neutral-200">
          <div className="absolute inset-y-0 bg-accent-300" style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }} />
          <div className="absolute -inset-y-[3px] w-0.5 bg-accent-800" style={{ left: `${marker}%` }} />
        </div>
        <div className="mt-[9px] text-[12px] text-neutral-700">{kLine}</div>
      </div>
    </Blueprint>
  );
}

export function StreakCard({
  current,
  bestLine,
  caption,
  week,
}: {
  current: number;
  bestLine: string;
  caption: string;
  week: Array<{ date: string; label: string; state: "done" | "today" | "idle" }>;
}) {
  return (
    <FireCard className="justify-between gap-0 p-5">
      <div className="relative z-[1]">
        <div className="card-kicker">Streak</div>
        <div className="mb-0.5 mt-1.5 flex items-end gap-2">
          <div className="qz-num text-[82px]">{current}</div>
          <div className="qz-lab pb-3.5 text-neutral-600">{current === 1 ? "day" : "days"}</div>
        </div>
        <div className="text-[12px] text-neutral-700">{bestLine}</div>
      </div>
      <div className="relative z-[1] mt-[22px]">
        <div className="qz-lab mb-[7px] text-neutral-600">This week</div>
        <div className="flex gap-1.5">
          {week.map((day) => (
            <div key={day.date} className="flex-1 text-center">
              <div
                className={cn(
                  "h-[26px] border",
                  day.state === "done" && "border-divider bg-accent",
                  day.state === "today" && "border-dashed border-accent bg-transparent",
                  day.state === "idle" && "border-divider bg-neutral-200",
                )}
              />
              <div className="mt-[5px] text-[10px] text-neutral-600">{day.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-[11px] text-[12px] text-neutral-700">{caption}</div>
      </div>
    </FireCard>
  );
}

function SectionTitle({ title, note, action }: { title: string; note?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-divider pb-[9px]">
      <h4 className="m-0">{title}</h4>
      {note && <span className="text-[12px] text-neutral-600">{note}</span>}
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}

export function QuickNotes({ notes }: { notes: Array<{ id: string; kicker: string; title: string; body: string; meta: string }> }) {
  return (
    <section>
      <SectionTitle
        title="Quick notes"
        note="Summarised by your coach from what you uploaded"
        action={
          <OpenCoach className="text-[11px] no-underline">
            OPEN COACH →
          </OpenCoach>
        }
      />
      {notes.length === 0 ? (
        <Blueprint className="qz-hatch flex flex-col items-center gap-3 p-[34px] text-center">
          <div className="bg-bg px-4 py-2.5">
            <div className="qz-lab text-neutral-600">Empty state</div>
            <div className="mt-1 font-heading text-[24px] font-semibold">Nothing to summarise yet</div>
            <p className="mx-auto mb-3 mt-1.5 max-w-[420px] text-[13px] text-neutral-700">
              Drop a chapter, a PDF or your class notes in the coach panel. It comes back as short cards you can skim before a match.
            </p>
            <OpenCoach as="button" className="btn btn-primary">
              UPLOAD NOTES
            </OpenCoach>
          </div>
        </Blueprint>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {notes.map((note) => (
            <Blueprint key={note.id} className="card p-4">
              <div className="card-kicker">{note.kicker}</div>
              <div className="card-title">{note.title}</div>
              <p className="card-body">{note.body}</p>
              <div className="card-meta">{note.meta}</div>
            </Blueprint>
          ))}
          <OpenCoach as="button" className="blueprint qz-hatch grid min-h-[170px] cursor-pointer place-items-center text-center">
            <span className="bg-bg px-3 py-2">
              <span className="qz-lab block text-neutral-600">Add source</span>
              <span className="mt-1 block max-w-[150px] text-[12px] text-neutral-700">Upload a chapter and the coach writes the card</span>
            </span>
          </OpenCoach>
        </div>
      )}
    </section>
  );
}

const RESULT_CHIP: Record<ResultChip, string> = {
  WON: "chip chip-solid",
  LOST: "chip chip-neutral",
  DRAW: "chip chip-neutral",
  FORFEIT: "chip chip-outline",
};

export function ResultBadge({ result }: { result: ResultChip }) {
  return <span className={RESULT_CHIP[result]}>{result}</span>;
}

export function RecentBattles({
  rows,
  title = "Recent battles",
  showAll = true,
}: {
  rows: Array<{ battleId: string; opponent: string; topic: string; result: ResultChip; delta: string; streak: string; when: string }>;
  title?: string;
  showAll?: boolean;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline gap-3 border-b border-divider pb-[9px]">
        <h4 className="m-0">{title}</h4>
        {showAll && rows[0] && (
          <Link href={`/battles/${rows[0].battleId}`} className="ml-auto text-[11px] no-underline">
            FULL BREAKDOWN →
          </Link>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Opponent</th>
              <th>Topic</th>
              <th>Result</th>
              <th>ELO</th>
              <th>Streak</th>
              <th className="text-right">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-5 text-[13px] text-neutral-600">
                  No battles yet — start a match and your results land here.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.battleId}>
                  <td>
                    <Link href={`/battles/${row.battleId}`} className="text-text no-underline hover:text-accent">
                      {row.opponent}
                    </Link>
                  </td>
                  <td className="text-neutral-700">{row.topic}</td>
                  <td>
                    <ResultBadge result={row.result} />
                  </td>
                  <td className="qz-num text-[15px]">{row.delta}</td>
                  <td className="text-neutral-700">{row.streak}</td>
                  <td className="text-right text-[13px] text-neutral-600">{row.when}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TodayPlan({ sessions }: { sessions: Array<{ id: string; topic: string; minutes: number; status: string; kind: string }> }) {
  const pending = sessions.filter((s) => s.status === "PENDING");
  return (
    <Blueprint corners="diagonal" className="flex flex-wrap items-center gap-4 border-l-2 border-l-accent px-4 py-3.5">
      <div className="min-w-0">
        <div className="qz-lab text-accent-700">Today&apos;s plan</div>
        <div className="mt-0.5 text-[14px]">
          {sessions.length === 0
            ? "Nothing scheduled today. Describe your next exam in the planner and it lays out the sessions."
            : pending.length === 0
              ? "Everything for today is done."
              : pending.map((s) => `${s.kind === "BATTLE" ? "1v1 · " : ""}${s.topic} (${s.minutes} min)`).join(" · ")}
        </div>
      </div>
      <ButtonLink href="/planner" className="ml-auto flex-none">
        OPEN PLANNER
      </ButtonLink>
    </Blueprint>
  );
}
