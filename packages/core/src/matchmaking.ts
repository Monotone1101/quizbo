/**
 * ELO-band matchmaking (architecture.md §4). The queue itself lives in the battle service; these
 * functions only decide bands and pairings so they can be tested without sockets or timers.
 */
export const MATCHMAKING = {
  initialBand: 150,
  bandStep: 50,
  bandStepMs: 5_000,
  maxBand: 500,
  /** After this long a player is paired with the closest available opponent regardless of band. */
  maxWaitMs: 60_000,
} as const;

export interface QueueEntry {
  userId: string;
  rating: number;
  joinedAt: number;
}

export function bandFor(waitedMs: number): number {
  const steps = Math.floor(Math.max(0, waitedMs) / MATCHMAKING.bandStepMs);
  return Math.min(MATCHMAKING.maxBand, MATCHMAKING.initialBand + steps * MATCHMAKING.bandStep);
}

/** Milliseconds until the band next widens, or null once it is capped. */
export function nextBandInMs(waitedMs: number): number | null {
  if (bandFor(waitedMs) >= MATCHMAKING.maxBand) return null;
  return MATCHMAKING.bandStepMs - (Math.max(0, waitedMs) % MATCHMAKING.bandStepMs);
}

export function ratingWindow(rating: number, waitedMs: number): { min: number; max: number } {
  const band = bandFor(waitedMs);
  return { min: rating - band, max: rating + band };
}

/** Two players may pair when their gap fits the wider of their two bands. */
export function withinBand(a: QueueEntry, b: QueueEntry, now: number): boolean {
  const allowed = Math.max(bandFor(now - a.joinedAt), bandFor(now - b.joinedAt));
  return Math.abs(a.rating - b.rating) <= allowed;
}

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function isCloser(seeker: QueueEntry, candidate: QueueEntry, current: QueueEntry): boolean {
  const candidateGap = Math.abs(seeker.rating - candidate.rating);
  const currentGap = Math.abs(seeker.rating - current.rating);
  if (candidateGap !== currentGap) return candidateGap < currentGap;
  if (candidate.joinedAt !== current.joinedAt) return candidate.joinedAt < current.joinedAt;
  return compareIds(candidate.userId, current.userId) < 0;
}

/**
 * Pairs the queue deterministically: longest-waiting players choose first and take the closest
 * rating that fits the band (or the closest overall once they have waited `maxWaitMs`).
 */
export function findMatches(entries: readonly QueueEntry[], now: number): Array<[QueueEntry, QueueEntry]> {
  const queue = [...entries].sort((x, y) => x.joinedAt - y.joinedAt || compareIds(x.userId, y.userId));
  const taken = new Set<string>();
  const pairs: Array<[QueueEntry, QueueEntry]> = [];

  for (const seeker of queue) {
    if (taken.has(seeker.userId)) continue;
    const fallback = now - seeker.joinedAt >= MATCHMAKING.maxWaitMs;
    let best: QueueEntry | null = null;
    for (const candidate of queue) {
      if (candidate.userId === seeker.userId || taken.has(candidate.userId)) continue;
      if (!fallback && !withinBand(seeker, candidate, now)) continue;
      if (!best || isCloser(seeker, candidate, best)) best = candidate;
    }
    if (best) {
      taken.add(seeker.userId);
      taken.add(best.userId);
      pairs.push([seeker, best]);
    }
  }
  return pairs;
}
