/**
 * Deterministic study scheduler (architecture.md §5.3). No LLM, no randomness, no I/O: the same
 * inputs always produce the same sessions.
 *
 *   weight(topic)  = max(0.05, 1 − mastery) × priorityMultiplier
 *   minutes(topic) = totalMinutes × weight(topic) / totalWeight
 *
 * Minutes are chunked into sessions and spread across the days before the exam, always giving the
 * next slot to the topic that is furthest behind its allocation, so no topic is dumped on one day.
 */
import { dateRange, diffDays, type ISODate } from "./dates";

export type PriorityLevel = "HIGH" | "MEDIUM" | "LOW";
export type SessionKind = "REVIEW" | "BATTLE";

export const PRIORITY_MULTIPLIER: Readonly<Record<PriorityLevel, number>> = { HIGH: 1.5, MEDIUM: 1, LOW: 0.6 };

export const SCHEDULER = {
  minSessionMinutes: 10,
  maxSessionMinutes: 45,
  stepMinutes: 5,
  minWeight: 0.05,
  defaultMastery: 0.5,
  /** Topics below this mastery get their final session marked as a 1v1 battle check-in. */
  battleBelowMastery: 0.5,
} as const;

export interface SchedulerTopic {
  topicId: string;
  /** 0–1, or null when the student has no mastery row yet. */
  masteryScore: number | null;
}

/** Either a flat daily budget or an explicit per-day budget (used when several exams share a day). */
export type DailyBudget = number | Readonly<Record<ISODate, number>>;

export interface GenerateStudySessionsInput {
  examId: string;
  examDate: ISODate;
  today: ISODate;
  dailyStudyMinutes: DailyBudget;
  topics: readonly SchedulerTopic[];
  priority: PriorityLevel | null;
}

export interface SessionDraft {
  examId: string;
  topicId: string;
  scheduledDate: ISODate;
  durationMinutes: number;
  kind: SessionKind;
}

const STEP = SCHEDULER.stepMinutes;
const MIN = SCHEDULER.minSessionMinutes;
const MAX = SCHEDULER.maxSessionMinutes;

const floorStep = (minutes: number) => Math.max(0, Math.floor(minutes / STEP) * STEP);
const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const masteryOf = (topic: SchedulerTopic) => topic.masteryScore ?? SCHEDULER.defaultMastery;

export function topicWeight(masteryScore: number | null, priority: PriorityLevel | null): number {
  const mastery = masteryScore ?? SCHEDULER.defaultMastery;
  return Math.max(SCHEDULER.minWeight, 1 - mastery) * PRIORITY_MULTIPLIER[priority ?? "MEDIUM"];
}

/** Splits `total` (in `step` units) proportionally with the largest-remainder method. */
export function apportion(total: number, weights: readonly number[], step: number = STEP): number[] {
  const units = Math.floor(total / step);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (units <= 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (units * w) / sum);
  const base = exact.map((e) => Math.floor(e));
  let left = units - base.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((e, i) => ({ i, remainder: e - Math.floor(e) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    base[i] = (base[i] ?? 0) + 1;
    left -= 1;
  }
  return base.map((u) => u * step);
}

function budgetFor(budget: DailyBudget, day: ISODate): number {
  return typeof budget === "number" ? budget : (budget[day] ?? 0);
}

export function generateStudySessions(input: GenerateStudySessionsInput): SessionDraft[] {
  const { examId, examDate, today, priority } = input;
  if (examDate <= today) return [];

  const unique = new Map<string, SchedulerTopic>();
  for (const topic of input.topics) if (!unique.has(topic.topicId)) unique.set(topic.topicId, topic);
  if (unique.size === 0) return [];

  const days = dateRange(today, examDate);
  const budgets = days.map((day) => floorStep(budgetFor(input.dailyStudyMinutes, day)));
  const totalMinutes = budgets.reduce((a, b) => a + b, 0);
  if (totalMinutes === 0) return [];

  const topics = [...unique.values()]
    .map((topic) => ({ ...topic, weight: topicWeight(topic.masteryScore, priority) }))
    .sort((a, b) => b.weight - a.weight || compareIds(a.topicId, b.topicId));

  const allocation = apportion(totalMinutes, topics.map((t) => t.weight));
  // Fold allocations too small for a real session into the heaviest topic.
  for (let i = allocation.length - 1; i > 0; i--) {
    const minutes = allocation[i] ?? 0;
    if (minutes > 0 && minutes < MIN) {
      allocation[0] = (allocation[0] ?? 0) + minutes;
      allocation[i] = 0;
    }
  }

  const state = topics.map((topic, i) => ({
    topicId: topic.topicId,
    allocated: allocation[i] ?? 0,
    remaining: allocation[i] ?? 0,
  }));
  const progress = (s: (typeof state)[number]) => (s.allocated === 0 ? 1 : 1 - s.remaining / s.allocated);
  const sessions: SessionDraft[] = [];

  days.forEach((day, dayIndex) => {
    let capacity = budgets[dayIndex] ?? 0;
    const usedToday = new Set<string>();

    while (capacity > 0) {
      const open = state.filter((s) => s.remaining > 0);
      if (open.length === 0) break;

      if (capacity < MIN) {
        // Too little left for a new block: extend today's latest session instead of wasting it.
        const last = [...sessions]
          .reverse()
          .find((s) => s.scheduledDate === day && (state.find((t) => t.topicId === s.topicId)?.remaining ?? 0) >= capacity);
        const topicState = last && state.find((t) => t.topicId === last.topicId);
        if (last && topicState) {
          last.durationMinutes += capacity;
          topicState.remaining -= capacity;
        }
        break;
      }

      const fresh = open.filter((s) => !usedToday.has(s.topicId));
      const pool = fresh.length > 0 ? fresh : open;
      // Furthest behind first; `state` is already in weight order, so reduce keeps the heavier topic on ties.
      const pick = pool.reduce((best, s) => (progress(s) < progress(best) ? s : best));

      let chunk = Math.min(pick.remaining, MAX, capacity);
      const tail = pick.remaining - chunk;
      if (tail > 0 && tail < MIN) {
        // Never strand a stub: absorb the tail today if it fits, otherwise leave a full minimum block.
        chunk = pick.remaining <= capacity && pick.remaining <= MAX + MIN ? pick.remaining : chunk - (MIN - tail);
      }
      if (chunk < MIN && pick.remaining >= MIN) {
        if (fresh.length === 0) break;
        usedToday.add(pick.topicId);
        continue;
      }

      sessions.push({ examId, topicId: pick.topicId, scheduledDate: day, durationMinutes: chunk, kind: "REVIEW" });
      pick.remaining -= chunk;
      capacity -= chunk;
      usedToday.add(pick.topicId);
    }
  });

  // Weak topics end with a battle check-in rather than one more review block.
  for (const topic of topics) {
    if (masteryOf(topic) >= SCHEDULER.battleBelowMastery) continue;
    for (let i = sessions.length - 1; i >= 0; i--) {
      const session = sessions[i];
      if (session && session.topicId === topic.topicId) {
        session.kind = "BATTLE";
        break;
      }
    }
  }

  return sessions;
}

export interface PlannerExamInput {
  examId: string;
  examDate: ISODate;
  priority: PriorityLevel | null;
  topics: readonly SchedulerTopic[];
}

/** Share of a day's budget an exam earns: priority × average topic need × urgency. */
export function examDayWeight(exam: PlannerExamInput, day: ISODate): number {
  const daysLeft = Math.max(1, diffDays(day, exam.examDate));
  const needs = exam.topics.map((t) => Math.max(SCHEDULER.minWeight, 1 - masteryOf(t)));
  const meanNeed = needs.length ? needs.reduce((a, b) => a + b, 0) / needs.length : SCHEDULER.minWeight;
  return PRIORITY_MULTIPLIER[exam.priority ?? "MEDIUM"] * meanNeed * (1 + 3 / daysLeft);
}

/**
 * Divides the student's daily budget between the exams still ahead on each day, so the caller can
 * run `generateStudySessions` once per exam without any day exceeding the budget.
 */
export function splitDailyBudget(
  exams: readonly PlannerExamInput[],
  today: ISODate,
  dailyStudyMinutes: number,
  /** Minutes already spent (done or skipped) on a day, e.g. when re-planning mid-day. */
  usedMinutes: Readonly<Record<ISODate, number>> = {},
): Map<string, Record<ISODate, number>> {
  const result = new Map<string, Record<ISODate, number>>(exams.map((e) => [e.examId, {}]));
  const active = exams
    .filter((e) => e.topics.length > 0 && e.examDate > today)
    .sort((a, b) => compareIds(a.examId, b.examId));
  if (active.length === 0) return result;

  const lastExam = active.reduce((latest, e) => (e.examDate > latest ? e.examDate : latest), today);
  for (const day of dateRange(today, lastExam)) {
    const ahead = active.filter((e) => e.examDate > day);
    if (ahead.length === 0) continue;
    const daily = floorStep(Math.max(0, dailyStudyMinutes - (usedMinutes[day] ?? 0)));
    const shares = apportion(daily, ahead.map((e) => examDayWeight(e, day)));
    ahead.forEach((exam, i) => {
      const budget = result.get(exam.examId);
      if (budget) budget[day] = shares[i] ?? 0;
    });
  }
  return result;
}

export function planAcrossExams(
  exams: readonly PlannerExamInput[],
  today: ISODate,
  dailyStudyMinutes: number,
  usedMinutes: Readonly<Record<ISODate, number>> = {},
): SessionDraft[] {
  const budgets = splitDailyBudget(exams, today, dailyStudyMinutes, usedMinutes);
  return [...exams]
    .sort((a, b) => (a.examDate < b.examDate ? -1 : a.examDate > b.examDate ? 1 : compareIds(a.examId, b.examId)))
    .flatMap((exam) =>
      generateStudySessions({
        examId: exam.examId,
        examDate: exam.examDate,
        today,
        dailyStudyMinutes: budgets.get(exam.examId) ?? {},
        topics: exam.topics,
        priority: exam.priority,
      }),
    )
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : a.scheduledDate > b.scheduledDate ? 1 : 0));
}
