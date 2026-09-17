import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  BATTLE_RULES,
  type BattleRules,
  type BoostId,
  type ClientToServerEvents,
  type QuestionPayload,
  type ServerToClientEvents,
} from "@quizbo/core";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { createBattleServer, type PersistBattleInput, type ServedQuestion } from "./server";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type Payload<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0];

const questions: ServedQuestion[] = Array.from({ length: 5 }, (_, i) => ({
  id: `q${i}`,
  topicId: i % 2 ? "curved" : "lenses",
  topicName: i % 2 ? "Refraction at curved surfaces" : "Lens formula",
  text: `Question ${i}`,
  options: ["A", "B", "C", "D"],
  correctIndex: i % 4,
  difficulty: "MEDIUM",
}));
const correctFor = (questionId: string) => questions.find((q) => q.id === questionId)?.correctIndex ?? 0;

let teardown: (() => Promise<void>) | null = null;
afterEach(async () => {
  await teardown?.();
  teardown = null;
});

async function setup(rules: Partial<BattleRules> = {}, hand?: BoostId[]) {
  const http = createServer();
  const persisted: PersistBattleInput[] = [];
  const battle = createBattleServer(http, {
    verifyToken: async (token) => {
      const [kind, id, name] = token.split(":");
      return kind === "user" && id ? { id, name: name ?? id } : null;
    },
    resolveScope: async (subjectId, topicId) =>
      subjectId === "physics" ? { subjectId, subjectName: "Physics", topicId, topicName: topicId ? "Optics" : null } : null,
    countQuestions: async () => questions.length,
    loadQuestions: async (_scope, limit) => questions.slice(0, limit),
    loadRating: async (userId) => ({ rating: userId === "ben" ? 1250 : 1200, matchesPlayed: 3 }),
    persistBattle: async (input) => {
      persisted.push(input);
      return { battleId: `battle-${persisted.length}` };
    },
    rules: { ...BATTLE_RULES, timeLimitMs: 600, countdownMs: 40, revealMs: 40, reconnectGraceMs: 400, ...rules },
    queueTickMs: 40,
    ...(hand ? { dealBoosts: () => [...hand] } : {}),
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  });
  await new Promise<void>((resolve) => http.listen(0, resolve));
  const url = `http://localhost:${(http.address() as AddressInfo).port}`;
  const clients: Client[] = [];
  const client = (token: string): Client => {
    const socket: Client = connect(url, { auth: { token }, transports: ["websocket"], forceNew: true, reconnection: false });
    clients.push(socket);
    return socket;
  };
  teardown = async () => {
    clients.forEach((c) => c.disconnect());
    await battle.close();
  };
  return { client, persisted };
}

function next<E extends keyof ServerToClientEvents>(socket: Client, event: E, timeoutMs = 3_000): Promise<Payload<E>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${String(event)}`)), timeoutMs);
    const listener = (payload: Payload<E>) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, listener as never);
  });
}

const never = <E extends keyof ServerToClientEvents>(socket: Client, event: E, withinMs: number) =>
  new Promise<void>((resolve, reject) => {
    const listener = () => reject(new Error(`unexpected ${String(event)}`));
    socket.once(event, listener as never);
    setTimeout(() => {
      socket.off(event, listener as never);
      resolve();
    }, withinMs);
  });

async function createRoom(host: Client) {
  const created = next(host, "room:created");
  host.emit("room:create", { subjectId: "physics" });
  return (await created).roomCode;
}

describe("rooms", () => {
  it("creates a room, lets a second player join, and rejects a third", async () => {
    const { client } = await setup();
    const aria = client("user:aria:Aria");
    const ben = client("user:ben:Ben");
    const cy = client("user:cy:Cy");

    const roomCode = await createRoom(aria);
    expect(roomCode).toMatch(/^[A-Z2-9]{5}$/);

    const readyForAria = next(aria, "room:ready");
    ben.emit("room:join", { roomCode: roomCode.toLowerCase() });
    const ready = await readyForAria;
    expect(ready.players.map((p) => p.userId)).toEqual(["aria", "ben"]);
    expect(ready.totalRounds).toBe(5);

    const rejected = next(cy, "room:error");
    cy.emit("room:join", { roomCode });
    expect((await rejected).code).toBe("ROOM_FULL");
  });

  it("rejects sockets without a valid token", async () => {
    const { client } = await setup();
    const intruder = client("nope");
    const error = await new Promise<Error>((resolve) => intruder.once("connect_error", resolve));
    expect(error.message).toBe("UNAUTHORIZED");
  });
});

describe("a full battle", () => {
  it("plays to the end with live HP updates, independent question orders and a persisted result", async () => {
    const { client, persisted } = await setup();
    const aria = client("user:aria:Aria");
    const ben = client("user:ben:Ben");
    const seen: Record<string, Map<number, string>> = { aria: new Map(), ben: new Map() };
    const results: Array<Payload<"round:result">> = [];

    aria.on("question:next", (q: QuestionPayload) => {
      seen.aria!.set(q.round, q.questionId);
      aria.emit("answer:submit", { roomCode: q.roomCode, optionId: correctFor(q.questionId) });
    });
    ben.on("question:next", (q: QuestionPayload) => {
      seen.ben!.set(q.round, q.questionId);
      ben.emit("answer:submit", { roomCode: q.roomCode, optionId: (correctFor(q.questionId) + 1) % 4 });
    });
    aria.on("round:result", (r) => results.push(r));

    const roomCode = await createRoom(aria);
    const ended = next(aria, "battle:end", 8_000);
    ben.emit("room:join", { roomCode });
    const end = await ended;

    expect(end.winnerId).toBe("aria");
    expect(["hp_depleted", "max_questions"]).toContain(end.reason);
    expect(end.battleId).toBe("battle-1");
    expect(end.players.find((p) => p.userId === "aria")!.eloDelta).toBeGreaterThan(0);

    // Every round, the two players were looking at different questions.
    for (const [round, questionId] of seen.aria!) expect(seen.ben!.get(round)).not.toBe(questionId);

    // HP moved in real time and never went up.
    const benHp = results.map((r) => r.players.find((p) => p.userId === "ben")!.hp);
    expect(benHp.at(-1)).toBeLessThan(100);
    expect(benHp.every((hp, i) => i === 0 || hp <= benHp[i - 1]!)).toBe(true);

    expect(persisted).toHaveLength(1);
    const saved = persisted[0]!;
    expect(saved.players.find((p) => p.userId === "aria")!.answers.every((a) => a.correct)).toBe(true);
    expect(saved.players.find((p) => p.userId === "ben")!.answers.every((a) => !a.correct)).toBe(true);
  });
});

describe("reconnect handling", () => {
  it("pauses on disconnect, stops the clock, and resumes the same round with a fresh timer", async () => {
    const { client } = await setup({ reconnectGraceMs: 3_000 });
    const aria = client("user:aria:Aria");
    let ben = client("user:ben:Ben");

    const roomCode = await createRoom(aria);
    const firstQuestion = next(aria, "question:next");
    ben.emit("room:join", { roomCode });
    expect((await firstQuestion).round).toBe(1);

    const paused = next(aria, "room:opponent_disconnected");
    ben.disconnect();
    expect(await paused).toMatchObject({ userId: "ben" });

    // The 600 ms question window passes while paused: no timeout fires.
    await never(aria, "question:timeout", 1_200);

    const resumed = next(aria, "room:opponent_reconnected");
    const againForAria = next(aria, "question:next");
    ben = client("user:ben:Ben");
    const againForBen = next(ben, "question:next");
    ben.emit("room:rejoin", { roomCode });

    await resumed;
    const [a, b] = await Promise.all([againForAria, againForBen]);
    expect(a.round).toBe(1);
    expect(b.round).toBe(1);
    expect(a.timeLimitMs).toBe(600);
    expect(b.timeLimitMs).toBe(600);
  });

  it("awards a forfeit win when the grace period lapses", async () => {
    const { client, persisted } = await setup({ reconnectGraceMs: 300 });
    const aria = client("user:aria:Aria");
    const ben = client("user:ben:Ben");

    const roomCode = await createRoom(aria);
    const firstQuestion = next(aria, "question:next");
    ben.emit("room:join", { roomCode });
    await firstQuestion;

    const ended = next(aria, "battle:end");
    ben.disconnect();
    const end = await ended;
    expect(end).toMatchObject({ winnerId: "aria", reason: "opponent_forfeit" });
    expect(persisted[0]?.reason).toBe("opponent_forfeit");
  });
});

describe("matchmaking", () => {
  it("pairs two queued players within the band and starts a room", async () => {
    const { client } = await setup();
    const aria = client("user:aria:Aria");
    const ben = client("user:ben:Ben");

    const status = next(aria, "queue:status");
    aria.emit("queue:join", { subjectId: "physics" });
    expect(await status).toMatchObject({ band: 150, rating: 1200, ratingMin: 1050, ratingMax: 1350 });

    const foundForAria = next(aria, "match:found");
    const readyForBen = next(ben, "room:ready");
    ben.emit("queue:join", { subjectId: "physics" });

    expect((await foundForAria).opponent).toEqual({ name: "Ben", rating: 1250 });
    expect((await readyForBen).players).toHaveLength(2);
  });
});

describe("boosts", () => {
  async function startBattle(hand: BoostId[], rules: Partial<BattleRules> = {}) {
    const { client } = await setup(rules, hand);
    const aria = client("user:aria:Aria");
    const ben = client("user:ben:Ben");
    const roomCode = await createRoom(aria);
    const ready = next(aria, "room:ready");
    const firstForAria = next(aria, "question:next");
    const firstForBen = next(ben, "question:next");
    ben.emit("room:join", { roomCode });
    const [readyPayload, qa, qb] = await Promise.all([ready, firstForAria, firstForBen]);
    return { aria, ben, roomCode, ready: readyPayload, qa, qb };
  }

  it("deals each player a hand and allows one boost per question, before answering", async () => {
    const { aria, ben, roomCode, ready, qa } = await startBattle(["fifty", "shield", "ink"]);
    for (const player of ready.players) {
      expect(player.boosts.map((b) => b.state)).toEqual(["ready", "ready", "ready"]);
    }

    const applied = next(aria, "boost:applied");
    const seenByBen = next(ben, "boost:used");
    aria.emit("boost:use", { roomCode, boostId: "fifty" });
    const { boost } = await applied;
    expect(boost.used).toBe("fifty");
    expect(boost.hiddenOptionIds).toHaveLength(2);
    expect(boost.hiddenOptionIds).not.toContain(correctFor(qa.questionId));
    const used = await seenByBen;
    expect(used).toMatchObject({ userId: "aria", boostId: "fifty", round: 1 });
    expect(used.players.find((p) => p.userId === "aria")!.boosts[0]).toEqual({ id: "fifty", state: "spent" });

    const secondBoost = next(aria, "room:error");
    aria.emit("boost:use", { roomCode, boostId: "shield" });
    expect((await secondBoost).code).toBe("BOOST_UNAVAILABLE");

    const answered = next(ben, "answer:result");
    ben.emit("answer:submit", { roomCode, optionId: 0 });
    await answered;
    const afterAnswer = next(ben, "room:error");
    ben.emit("boost:use", { roomCode, boostId: "ink" });
    expect((await afterAnswer).code).toBe("BOOST_UNAVAILABLE");

    const notInHand = next(aria, "room:error");
    aria.emit("boost:use", { roomCode, boostId: "medkit" });
    expect((await notInHand).code).toBe("BOOST_UNAVAILABLE");
  });

  it("a bubble shield soaks the next hit and is spent", async () => {
    const { aria, ben, roomCode, qa } = await startBattle(["shield", "double", "medkit"], { timeLimitMs: 2_000 });
    const armed = next(aria, "boost:used");
    ben.emit("boost:use", { roomCode, boostId: "shield" });
    expect((await armed).players.find((p) => p.userId === "ben")!.boosts[0]!.state).toBe("armed");

    const result = next(ben, "round:result");
    aria.emit("answer:submit", { roomCode, optionId: correctFor(qa.questionId) });
    const { fx, players } = await result;
    expect(fx).toMatchObject({ blocked: true, damageToOpponent: 0 });
    const benAfter = players.find((p) => p.userId === "ben")!;
    expect(benAfter.hp).toBe(100);
    expect(benAfter.boosts[0]!.state).toBe("spent");
  });

  it("time warp keeps only that player's question open for longer", async () => {
    const { aria, ben, roomCode, qa } = await startBattle(["warp", "shield", "ink"]);
    const applied = next(aria, "boost:applied");
    aria.emit("boost:use", { roomCode, boostId: "warp" });
    expect((await applied).boost.extraMs).toBe(5_000);

    // Ben's 600 ms clock runs out; Aria's doesn't.
    const benTimedOut = next(ben, "question:timeout", 2_000);
    const ariaQuiet = never(aria, "question:timeout", 1_300);
    await benTimedOut;
    await ariaQuiet;

    const result = next(aria, "answer:result");
    aria.emit("answer:submit", { roomCode, optionId: correctFor(qa.questionId) });
    expect(await result).toMatchObject({ correct: true });
  });
});
