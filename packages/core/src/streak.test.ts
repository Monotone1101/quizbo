import { describe, expect, it } from "vitest";
import { addDays, dateRange } from "./dates";
import { computeStreak, streakCopy } from "./streak";

describe("computeStreak", () => {
  // 2026-09-12 is a Saturday.
  const today = "2026-09-12";
  const thisWeek = dateRange("2026-09-07", "2026-09-12"); // Mon–Fri
  const oldRun = dateRange("2026-08-01", "2026-08-20"); // 19 days

  it("keeps an unclaimed today alive and counts back from yesterday", () => {
    const summary = computeStreak([...oldRun, ...thisWeek], today);
    expect(summary).toMatchObject({ current: 5, best: 19, todayClaimed: false });
  });

  it("marks the week: done days, today, and the rest idle", () => {
    const { week } = computeStreak(thisWeek, today);
    expect(week.map((d) => d.state)).toEqual(["done", "done", "done", "done", "done", "today", "idle"]);
    expect(week.map((d) => d.label).join("")).toBe("MTWTFSS");
  });

  it("claims today once a battle is played", () => {
    const summary = computeStreak([...thisWeek, today], today);
    expect(summary).toMatchObject({ current: 6, todayClaimed: true });
    expect(summary.week[5]?.state).toBe("done");
  });

  it("resets after a missed day", () => {
    expect(computeStreak([addDays(today, -3)], today).current).toBe(0);
  });

  it("writes the copy for the card", () => {
    expect(streakCopy(computeStreak([...oldRun, ...thisWeek], today))).toEqual({
      bestLine: "Best run: 19 days. 15 more for a personal record.",
      caption: "Today unclaimed — one battle keeps it alive.",
    });
    expect(streakCopy(computeStreak([], today)).bestLine).toMatch(/No runs yet/);
  });
});
