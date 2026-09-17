import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import {
  apportion,
  generateStudySessions,
  planAcrossExams,
  SCHEDULER,
  type GenerateStudySessionsInput,
  type SessionDraft,
} from "./scheduler";

const today = "2026-09-11";
const minutesBy = (sessions: SessionDraft[], key: (s: SessionDraft) => string) => {
  const totals = new Map<string, number>();
  for (const s of sessions) totals.set(key(s), (totals.get(key(s)) ?? 0) + s.durationMinutes);
  return totals;
};

const input: GenerateStudySessionsInput = {
  examId: "physics-term-2",
  examDate: addDays(today, 7),
  today,
  dailyStudyMinutes: 90,
  priority: "HIGH",
  topics: [
    { topicId: "refraction", masteryScore: 0.2 },
    { topicId: "lenses", masteryScore: 0.5 },
    { topicId: "reflection", masteryScore: 0.9 },
  ],
};

describe("apportion", () => {
  it("splits in 5-minute steps with the largest remainder", () => {
    expect(apportion(90, [1, 1, 1])).toEqual([30, 30, 30]);
    expect(apportion(100, [2, 1])).toEqual([65, 35]);
    expect(apportion(0, [1, 2])).toEqual([0, 0]);
  });
});

describe("generateStudySessions", () => {
  it("produces the same session set on every run, whatever the input order", () => {
    const again = generateStudySessions({ ...input, topics: [...input.topics].reverse() });
    expect(generateStudySessions(input)).toEqual(generateStudySessions(input));
    expect(again).toEqual(generateStudySessions(input));
  });

  it("never exceeds daily budget × days remaining, and never exceeds a single day's budget", () => {
    const sessions = generateStudySessions(input);
    const total = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    expect(total).toBeLessThanOrEqual(90 * 7);
    expect(total).toBeGreaterThanOrEqual(90 * 7 * 0.9);
    for (const minutes of minutesBy(sessions, (s) => s.scheduledDate).values()) expect(minutes).toBeLessThanOrEqual(90);
  });

  it("only schedules from today up to the day before the exam", () => {
    for (const s of generateStudySessions(input)) {
      expect(s.scheduledDate >= today).toBe(true);
      expect(s.scheduledDate < input.examDate).toBe(true);
    }
  });

  it("weights time by (1 − mastery): weaker topics get more minutes", () => {
    const totals = minutesBy(generateStudySessions(input), (s) => s.topicId);
    expect(totals.get("refraction")!).toBeGreaterThan(totals.get("lenses")!);
    expect(totals.get("lenses")!).toBeGreaterThan(totals.get("reflection")!);
  });

  it("chunks sessions instead of dumping a topic on one day", () => {
    const sessions = generateStudySessions(input);
    expect(Math.max(...sessions.map((s) => s.durationMinutes))).toBeLessThanOrEqual(
      SCHEDULER.maxSessionMinutes + SCHEDULER.stepMinutes,
    );
    const refractionDays = new Set(sessions.filter((s) => s.topicId === "refraction").map((s) => s.scheduledDate));
    expect(refractionDays.size).toBeGreaterThanOrEqual(5);
  });

  it("ends weak topics with a battle check-in", () => {
    const sessions = generateStudySessions(input);
    const refraction = sessions.filter((s) => s.topicId === "refraction");
    expect(refraction.at(-1)?.kind).toBe("BATTLE");
    expect(refraction.slice(0, -1).every((s) => s.kind === "REVIEW")).toBe(true);
    expect(sessions.filter((s) => s.topicId !== "refraction").every((s) => s.kind === "REVIEW")).toBe(true);
  });

  it("reflects a mastery change on the next run without any other input", () => {
    const before = minutesBy(generateStudySessions(input), (s) => s.topicId).get("reflection")!;
    const improvedElsewhere = generateStudySessions({
      ...input,
      topics: input.topics.map((t) => (t.topicId === "reflection" ? { ...t, masteryScore: 0.25 } : t)),
    });
    expect(minutesBy(improvedElsewhere, (s) => s.topicId).get("reflection")!).toBeGreaterThan(before);
  });

  it("returns nothing when the exam is today or already past", () => {
    expect(generateStudySessions({ ...input, examDate: today })).toEqual([]);
    expect(generateStudySessions({ ...input, examDate: addDays(today, -3) })).toEqual([]);
  });
});

describe("planAcrossExams", () => {
  const exams = [
    { examId: "maths-unit", examDate: addDays(today, 3), priority: "HIGH" as const, topics: [{ topicId: "inequalities", masteryScore: 0.3 }] },
    {
      examId: "physics-term",
      examDate: addDays(today, 10),
      priority: "MEDIUM" as const,
      topics: [
        { topicId: "refraction", masteryScore: 0.3 },
        { topicId: "lenses", masteryScore: 0.6 },
      ],
    },
  ];

  it("keeps every day within the shared daily budget", () => {
    const sessions = planAcrossExams(exams, today, 90);
    for (const minutes of minutesBy(sessions, (s) => s.scheduledDate).values()) expect(minutes).toBeLessThanOrEqual(90);
  });

  it("subtracts minutes already spent today when re-planning mid-day", () => {
    const sessions = planAcrossExams(exams, today, 90, { [today]: 60 });
    const todayTotal = sessions.filter((s) => s.scheduledDate === today).reduce((sum, s) => sum + s.durationMinutes, 0);
    expect(todayTotal).toBeLessThanOrEqual(30);
  });

  it("gives the later exam the whole budget once the earlier exam has passed", () => {
    const sessions = planAcrossExams(exams, today, 90);
    expect(sessions.filter((s) => s.examId === "maths-unit").every((s) => s.scheduledDate < addDays(today, 3))).toBe(true);
    const lateDay = addDays(today, 5);
    const late = sessions.filter((s) => s.scheduledDate === lateDay);
    expect(late.every((s) => s.examId === "physics-term")).toBe(true);
    expect(late.reduce((sum, s) => sum + s.durationMinutes, 0)).toBeGreaterThanOrEqual(80);
  });
});
