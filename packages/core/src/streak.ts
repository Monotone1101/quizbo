/** Daily battle streak, derived from the local dates on which a student finished at least one battle. */
import { addDays, startOfWeek, WEEKDAY_INITIAL, type ISODate } from "./dates";

export type StreakDayState = "done" | "today" | "idle";

export interface StreakSummary {
  current: number;
  best: number;
  todayClaimed: boolean;
  week: Array<{ date: ISODate; label: string; state: StreakDayState }>;
}

export function computeStreak(activeDates: readonly ISODate[], today: ISODate): StreakSummary {
  const active = new Set(activeDates);
  const todayClaimed = active.has(today);

  // An unclaimed today doesn't break the streak until the day is over.
  let current = 0;
  for (let day = todayClaimed ? today : addDays(today, -1); active.has(day); day = addDays(day, -1)) current++;

  let best = 0;
  let run = 0;
  let previous: ISODate | null = null;
  for (const day of [...active].filter((d) => d <= today).sort()) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  const monday = startOfWeek(today);
  const week = WEEKDAY_INITIAL.map((label, i) => {
    const date = addDays(monday, i);
    const state: StreakDayState = active.has(date) ? "done" : date === today ? "today" : "idle";
    return { date, label, state };
  });

  return { current, best: Math.max(best, current), todayClaimed, week };
}

const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export function streakCopy(summary: StreakSummary): { bestLine: string; caption: string } {
  const { current, best, todayClaimed } = summary;
  let bestLine: string;
  if (best === 0) bestLine = "No runs yet. One battle today starts your first.";
  else if (current >= best) bestLine = `Best run: ${best} day${best === 1 ? "" : "s"}. You're on it right now.`;
  else {
    const needed = best - current + 1;
    bestLine = `Best run: ${best} days. ${WORDS[needed] ?? needed} more for a personal record.`;
  }

  const caption = todayClaimed
    ? "Today claimed — the streak is safe until midnight."
    : current > 0
      ? "Today unclaimed — one battle keeps it alive."
      : "Today unclaimed — one battle starts a new streak.";

  return { bestLine, caption };
}
