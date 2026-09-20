/**
 * Shared battle state that must be the same on every battle-service instance: which instance owns
 * each room, which room each user is in, the matchmaking queue, and which instance runs matchmaking.
 *
 * `MemoryRegistry` is the single-instance default. `RedisRegistry` lets several instances share it;
 * Socket.io's Redis adapter carries the messages between them (see server.ts, "Running several
 * instances"). Entries written by an instance carry a TTL that its heartbeat refreshes, so an
 * instance that dies can't leave users stuck "already in a battle".
 */
import type { QueueEntry } from "@quizbo/core";
import type { Redis } from "ioredis";

export interface QueuedPlayer extends QueueEntry {
  socketId: string;
  name: string;
  matchesPlayed: number;
  subjectId: string;
  topicId: string | null;
  key: string;
}

export interface BattleRegistry {
  /** Reserves a room code for an instance. False if the code is taken. */
  claimRoom(code: string, owner: string): Promise<boolean>;
  roomOwner(code: string): Promise<string | null>;
  releaseRoom(code: string): Promise<void>;

  userRoom(userId: string): Promise<string | null>;
  setUserRoom(userId: string, code: string): Promise<void>;
  /** Clears the user's room, but only if it is still `code`. */
  clearUserRoom(userId: string, code: string): Promise<void>;

  queuePut(entry: QueuedPlayer): Promise<void>;
  queueGet(userId: string): Promise<QueuedPlayer | null>;
  /** Removes the user's entry (only the one made from `socketId`, when given). */
  queueRemove(userId: string, socketId?: string): Promise<void>;
  queueAll(): Promise<QueuedPlayer[]>;

  /** Holds (or renews) the matchmaker lease for `instance`. True if this instance holds it. */
  lead(instance: string, ttlMs: number): Promise<boolean>;

  /** Heartbeat: keeps this instance's rooms and user links alive. */
  refresh(owner: string, codes: string[], userIds: string[]): Promise<void>;
  close(): Promise<void>;
}

/** Everything in process memory: one battle-service instance. */
export class MemoryRegistry implements BattleRegistry {
  private rooms = new Map<string, string>();
  private users = new Map<string, string>();
  private queue = new Map<string, QueuedPlayer>();
  private leader: { instance: string; until: number } | null = null;

  async claimRoom(code: string, owner: string) {
    if (this.rooms.has(code)) return false;
    this.rooms.set(code, owner);
    return true;
  }
  async roomOwner(code: string) {
    return this.rooms.get(code) ?? null;
  }
  async releaseRoom(code: string) {
    this.rooms.delete(code);
  }
  async userRoom(userId: string) {
    return this.users.get(userId) ?? null;
  }
  async setUserRoom(userId: string, code: string) {
    this.users.set(userId, code);
  }
  async clearUserRoom(userId: string, code: string) {
    if (this.users.get(userId) === code) this.users.delete(userId);
  }
  async queuePut(entry: QueuedPlayer) {
    this.queue.set(entry.userId, entry);
  }
  async queueGet(userId: string) {
    return this.queue.get(userId) ?? null;
  }
  async queueRemove(userId: string, socketId?: string) {
    const entry = this.queue.get(userId);
    if (entry && (!socketId || entry.socketId === socketId)) this.queue.delete(userId);
  }
  async queueAll() {
    return [...this.queue.values()];
  }
  async lead(instance: string, ttlMs: number) {
    const now = Date.now();
    if (!this.leader || this.leader.until < now || this.leader.instance === instance) {
      this.leader = { instance, until: now + ttlMs };
      return true;
    }
    return false;
  }
  async refresh() {}
  async close() {}
}

const ROOM_TTL_S = 90;

/** Shared through Redis: several battle-service instances behind one load balancer. */
export class RedisRegistry implements BattleRegistry {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = "quizbo:battle:",
  ) {}

  private k(...parts: string[]) {
    return this.prefix + parts.join(":");
  }

  async claimRoom(code: string, owner: string) {
    return (await this.redis.set(this.k("room", code), owner, "EX", ROOM_TTL_S, "NX")) === "OK";
  }
  async roomOwner(code: string) {
    return this.redis.get(this.k("room", code));
  }
  async releaseRoom(code: string) {
    await this.redis.del(this.k("room", code));
  }
  async userRoom(userId: string) {
    return this.redis.get(this.k("user", userId));
  }
  async setUserRoom(userId: string, code: string) {
    await this.redis.set(this.k("user", userId), code, "EX", ROOM_TTL_S);
  }
  async clearUserRoom(userId: string, code: string) {
    // Compare-and-delete, so a newer room isn't cleared by an old one ending.
    await this.redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      this.k("user", userId),
      code,
    );
  }
  async queuePut(entry: QueuedPlayer) {
    await this.redis.hset(this.k("queue"), entry.userId, JSON.stringify(entry));
  }
  async queueGet(userId: string) {
    const raw = await this.redis.hget(this.k("queue"), userId);
    return raw ? (JSON.parse(raw) as QueuedPlayer) : null;
  }
  async queueRemove(userId: string, socketId?: string) {
    if (!socketId) {
      await this.redis.hdel(this.k("queue"), userId);
      return;
    }
    const entry = await this.queueGet(userId);
    if (entry?.socketId === socketId) await this.redis.hdel(this.k("queue"), userId);
  }
  async queueAll() {
    const all = await this.redis.hvals(this.k("queue"));
    return all.map((raw) => JSON.parse(raw) as QueuedPlayer);
  }
  async lead(instance: string, ttlMs: number) {
    const key = this.k("matchmaker");
    // Take the lease if it's free, or renew it if it's ours.
    const result = await this.redis.eval(
      "local v = redis.call('get', KEYS[1]) if v == false or v == ARGV[1] then redis.call('set', KEYS[1], ARGV[1], 'PX', ARGV[2]) return 1 end return 0",
      1,
      key,
      instance,
      String(ttlMs),
    );
    return result === 1;
  }
  async refresh(owner: string, codes: string[], userIds: string[]) {
    if (!codes.length && !userIds.length) return;
    const multi = this.redis.multi();
    for (const code of codes) multi.set(this.k("room", code), owner, "EX", ROOM_TTL_S);
    for (const userId of userIds) multi.expire(this.k("user", userId), ROOM_TTL_S);
    await multi.exec();
  }
  async close() {}
}
