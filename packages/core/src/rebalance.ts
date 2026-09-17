/**
 * Skip rebalancing (architecture.md §5.4). Deterministic, no LLM: a skipped session's minutes are
 * spread evenly over the same topic's remaining pending sessions for the same exam.
 */
import type { ISODate } from "./dates";

export type StudySessionStatus = "PENDING" | "DONE" | "SKIPPED";

export interface PlannedSession {
  id: string;
  examId: string;
  topicId: string;
  scheduledDate: ISODate;
  durationMinutes: number;
  status: StudySessionStatus;
}

export interface RebalanceResult {
  updates: Array<{ id: string; durationMinutes: number }>;
  /**
   * Minutes that could not be placed because no later pending session exists for the topic. The
   * caller decides whether to append a session near the exam — never done automatically, so the
   * last days before an exam are not silently overloaded.
   */
  unallocatedMinutes: number;
}

export function rebalanceAfterSkip(
  pendingSessions: readonly PlannedSession[],
  skippedSession: PlannedSession,
  options: { today?: ISODate } = {},
): RebalanceResult {
  const from = options.today && options.today > skippedSession.scheduledDate ? options.today : skippedSession.scheduledDate;
  const targets = pendingSessions
    .filter(
      (s) =>
        s.id !== skippedSession.id &&
        s.status === "PENDING" &&
        s.topicId === skippedSession.topicId &&
        s.examId === skippedSession.examId &&
        s.scheduledDate >= from,
    )
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : a.scheduledDate > b.scheduledDate ? 1 : a.id < b.id ? -1 : 1));

  const minutes = Math.max(0, skippedSession.durationMinutes);
  if (targets.length === 0 || minutes === 0) return { updates: [], unallocatedMinutes: minutes };

  const share = Math.floor(minutes / targets.length);
  let remainder = minutes - share * targets.length;
  const updates = targets.map((session) => {
    const extra = share + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return { id: session.id, durationMinutes: session.durationMinutes + extra };
  });
  return { updates, unallocatedMinutes: 0 };
}
