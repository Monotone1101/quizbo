import { describe, expect, it } from "vitest";
import { bandFor, findMatches, MATCHMAKING, nextBandInMs, ratingWindow } from "./matchmaking";

const t0 = 1_000_000;
const ids = (pairs: ReturnType<typeof findMatches>) => pairs.map(([a, b]) => [a.userId, b.userId]);

describe("matchmaking bands", () => {
  it("starts at ±150 and widens by 50 every 5 seconds, capped at ±500", () => {
    expect(bandFor(0)).toBe(150);
    expect(bandFor(4_999)).toBe(150);
    expect(bandFor(5_000)).toBe(200);
    expect(bandFor(14_000)).toBe(250);
    expect(bandFor(10 * 60_000)).toBe(500);
  });

  it("reports when the band next widens and the rating window", () => {
    expect(nextBandInMs(1_000)).toBe(4_000);
    expect(nextBandInMs(70_000)).toBeNull();
    expect(ratingWindow(1290, 0)).toEqual({ min: 1140, max: 1440 });
  });
});

describe("findMatches", () => {
  it("pairs players inside the band", () => {
    const pairs = findMatches(
      [
        { userId: "a", rating: 1200, joinedAt: t0 },
        { userId: "b", rating: 1340, joinedAt: t0 + 10 },
      ],
      t0 + 20,
    );
    expect(ids(pairs)).toEqual([["a", "b"]]);
  });

  it("waits for the band to widen before pairing a wider gap", () => {
    const queue = [
      { userId: "a", rating: 1200, joinedAt: t0 },
      { userId: "b", rating: 1400, joinedAt: t0 },
    ];
    expect(findMatches(queue, t0 + 1_000)).toHaveLength(0);
    expect(findMatches(queue, t0 + 5_000)).toHaveLength(1);
  });

  it("prefers the closest rating", () => {
    const pairs = findMatches(
      [
        { userId: "seeker", rating: 1250, joinedAt: t0 },
        { userId: "far", rating: 1380, joinedAt: t0 + 1 },
        { userId: "near", rating: 1270, joinedAt: t0 + 2 },
      ],
      t0 + 3,
    );
    expect(ids(pairs)).toEqual([["seeker", "near"]]);
  });

  it("falls back to the closest player once the maximum wait is reached", () => {
    const queue = [
      { userId: "a", rating: 1000, joinedAt: t0 },
      { userId: "b", rating: 1900, joinedAt: t0 + 1 },
    ];
    expect(findMatches(queue, t0 + 30_000)).toHaveLength(0);
    expect(ids(findMatches(queue, t0 + MATCHMAKING.maxWaitMs))).toEqual([["a", "b"]]);
  });

  it("never uses a player twice and leaves the odd one queued", () => {
    const pairs = findMatches(
      [
        { userId: "a", rating: 1200, joinedAt: t0 },
        { userId: "b", rating: 1210, joinedAt: t0 + 1 },
        { userId: "c", rating: 1220, joinedAt: t0 + 2 },
      ],
      t0 + 3,
    );
    expect(pairs).toHaveLength(1);
    const used = pairs.flat().map((e) => e.userId);
    expect(new Set(used).size).toBe(used.length);
  });
});
