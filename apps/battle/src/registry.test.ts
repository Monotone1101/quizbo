import RedisMock from "ioredis-mock";
import type { Redis } from "ioredis";
import { describe, expect, it } from "vitest";
import { MemoryRegistry, RedisRegistry, type BattleRegistry, type QueuedPlayer } from "./registry";

const entry = (userId: string, socketId = `s-${userId}`): QueuedPlayer => ({
  userId,
  name: userId,
  rating: 1200,
  joinedAt: 0,
  matchesPlayed: 0,
  socketId,
  subjectId: "physics",
  topicId: null,
  key: "physics:*",
});

// The same contract, checked against both implementations.
const registries: Array<[string, () => BattleRegistry]> = [
  ["MemoryRegistry", () => new MemoryRegistry()],
  ["RedisRegistry", () => new RedisRegistry(new RedisMock() as unknown as Redis, `t${Math.random().toString(36).slice(2)}:`)],
];

describe.each(registries)("%s", (_name, make) => {
  it("reserves a room code for one owner only", async () => {
    const r = make();
    expect(await r.claimRoom("ABCDE", "A")).toBe(true);
    expect(await r.claimRoom("ABCDE", "B")).toBe(false);
    expect(await r.roomOwner("ABCDE")).toBe("A");
    await r.releaseRoom("ABCDE");
    expect(await r.roomOwner("ABCDE")).toBeNull();
    expect(await r.claimRoom("ABCDE", "B")).toBe(true);
  });

  it("clears a user's room only if it is still that room", async () => {
    const r = make();
    await r.setUserRoom("aria", "ROOM1");
    await r.clearUserRoom("aria", "OLDRM");
    expect(await r.userRoom("aria")).toBe("ROOM1");
    await r.clearUserRoom("aria", "ROOM1");
    expect(await r.userRoom("aria")).toBeNull();
  });

  it("keeps the queue and removes only the matching socket's entry", async () => {
    const r = make();
    await r.queuePut(entry("aria"));
    await r.queuePut(entry("ben"));
    expect((await r.queueAll()).map((e) => e.userId).sort()).toEqual(["aria", "ben"]);
    await r.queueRemove("aria", "some-other-socket");
    expect(await r.queueGet("aria")).not.toBeNull();
    await r.queueRemove("aria", "s-aria");
    expect(await r.queueGet("aria")).toBeNull();
    await r.queueRemove("ben");
    expect(await r.queueAll()).toEqual([]);
  });

  it("gives the matchmaker lease to one instance at a time", async () => {
    const r = make();
    expect(await r.lead("A", 10_000)).toBe(true);
    expect(await r.lead("B", 10_000)).toBe(false);
    expect(await r.lead("A", 10_000)).toBe(true);
  });
});
