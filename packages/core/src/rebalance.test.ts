import { describe, expect, it } from "vitest";
import { rebalanceAfterSkip, type PlannedSession } from "./rebalance";

const session = (id: string, patch: Partial<PlannedSession>): PlannedSession => ({
  id,
  examId: "physics",
  topicId: "refraction",
  scheduledDate: "2026-09-14",
  durationMinutes: 30,
  status: "PENDING",
  ...patch,
});

describe("rebalanceAfterSkip", () => {
  const skipped = session("skip", { scheduledDate: "2026-09-12", durationMinutes: 25, status: "SKIPPED" });
  const plan = [
    skipped,
    session("s1", { scheduledDate: "2026-09-14", durationMinutes: 30 }),
    session("s2", { scheduledDate: "2026-09-16", durationMinutes: 30 }),
    session("other-topic", { topicId: "lenses", scheduledDate: "2026-09-13", durationMinutes: 40 }),
    session("already-done", { scheduledDate: "2026-09-15", status: "DONE" }),
    session("earlier", { scheduledDate: "2026-09-10" }),
  ];

  it("spreads the skipped minutes evenly over the same topic's later pending sessions", () => {
    expect(rebalanceAfterSkip(plan, skipped)).toEqual({
      updates: [
        { id: "s1", durationMinutes: 43 },
        { id: "s2", durationMinutes: 42 },
      ],
      unallocatedMinutes: 0,
    });
  });

  it("increases at least one remaining session by a proportionate amount", () => {
    const { updates } = rebalanceAfterSkip(plan, { ...skipped, durationMinutes: 30 });
    expect(updates).toEqual([
      { id: "s1", durationMinutes: 45 },
      { id: "s2", durationMinutes: 45 },
    ]);
  });

  it("reports unallocated minutes when no later session exists for the topic", () => {
    const lonely = session("lonely", { topicId: "wave-optics", durationMinutes: 35, status: "SKIPPED" });
    expect(rebalanceAfterSkip(plan, lonely)).toEqual({ updates: [], unallocatedMinutes: 35 });
  });

  it("does not move time onto sessions before today", () => {
    const { updates } = rebalanceAfterSkip(plan, skipped, { today: "2026-09-15" });
    expect(updates).toEqual([{ id: "s2", durationMinutes: 55 }]);
  });
});
