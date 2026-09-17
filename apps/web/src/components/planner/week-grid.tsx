"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setSessionStatusAction } from "@/app/actions/planner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SessionChipView, WeekDayView } from "@/lib/planner-types";
import { cn } from "@/lib/utils";

function SessionChip({ session, onStatus, disabled }: { session: SessionChipView; onStatus: (status: "DONE" | "SKIPPED" | "PENDING") => void; disabled: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`${session.kind === "BATTLE" ? "1v1 battle on " : ""}${session.topicName}, ${session.minutes} minutes, ${session.status.toLowerCase()}`}
          className={cn(
            "w-full cursor-pointer border border-divider px-2 py-[7px] text-left hover:bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)]",
            session.kind === "BATTLE" && "border-accent border-l-[3px]",
            session.status === "SKIPPED" && "line-through opacity-50",
          )}
        >
          <div className="text-[12px] leading-tight">
            {session.status === "DONE" && <span className="text-accent-700">✓ </span>}
            {session.kind === "BATTLE" ? `1v1 · ${session.topicName}` : session.topicName}
          </div>
          <div className="qz-num mt-0.5 text-[11px] text-neutral-600">{session.minutes} min</div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[248px]">
        <DropdownMenuLabel>{session.examTitle}</DropdownMenuLabel>
        {session.status === "PENDING" && (
          <>
            <DropdownMenuItem onSelect={() => onStatus("DONE")}>Mark done</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onStatus("SKIPPED")}>
              Skip <span className="text-[11px] text-neutral-600">time moves to later sessions</span>
            </DropdownMenuItem>
          </>
        )}
        {session.status === "DONE" && <DropdownMenuItem onSelect={() => onStatus("PENDING")}>Mark not done</DropdownMenuItem>}
        {session.status === "SKIPPED" && (
          <DropdownMenuItem disabled>Skipped — minutes already moved</DropdownMenuItem>
        )}
        {session.canBattle && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/play?topic=${session.topicId}`} className="text-text no-underline">
                Battle on {session.topicName}
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WeekGrid({ days }: { days: WeekDayView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const setStatus = (sessionId: string, status: "DONE" | "SKIPPED" | "PENDING") =>
    startTransition(async () => {
      const result = await setSessionStatusAction(sessionId, status);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      router.refresh();
    });

  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[720px] grid-cols-7 gap-2">
        {days.map((day) => (
          <div
            key={day.date}
            className={cn("min-h-[150px] border p-2.5", day.isToday ? "border-accent bg-accent-100" : "border-divider", day.isPast && "opacity-80")}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <span className="qz-lab">{day.label}</span>
              <span className="qz-num text-[13px] text-neutral-600">{day.dayNumber}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {day.exams.map((exam) => (
                <div key={exam.id} className="border border-divider px-2 py-[7px]">
                  <div className="text-[12px] leading-tight">{exam.title}</div>
                  <div className="qz-num mt-0.5 text-[11px] text-accent-700">EXAM</div>
                </div>
              ))}
              {day.sessions.map((session) => (
                <SessionChip key={session.id} session={session} disabled={pending} onStatus={(status) => setStatus(session.id, status)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
