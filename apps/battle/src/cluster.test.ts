/**
 * Two battle-service instances in one process, sharing a registry and an in-memory message bus
 * (a ClusterAdapter, the same base the Redis adapter builds on). Players connect to different
 * instances and must still play one battle together.
 */
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { BATTLE_RULES, type ClientToServerEvents, type ServerToClientEvents } from "@quizbo/core";
import type { Namespace } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { ClusterAdapterWithHeartbeat } from "socket.io-adapter";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRegistry } from "./registry";
import { createBattleServer, type PersistBattleInput, type ServedQuestion } from "./server";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type Payload<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0];
type Message = Parameters<ClusterAdapterWithHeartbeat["onMessage"]>[0];
type Response = Parameters<ClusterAdapterWithHeartbeat["onResponse"]>[0];

/** In-process stand-in for Redis pub/sub: every adapter sees every message, like separate servers would. */
class BusAdapter extends ClusterAdapterWithHeartbeat {
  private readonly onBusMessage = (message: Message) => this.onMessage(structuredClone(message));
  private readonly onBusResponse = ({ to, response }: { to: string; response: Response }) => {
    if (to === this.uid) this.onResponse(structuredClone(response));
  };

  constructor(
    nsp: Namespace,
    private readonly bus: EventEmitter,
  ) {
    super(nsp, { heartbeatInterval: 200, heartbeatTimeout: 2_000 });
    bus.on("message", this.onBusMessage);
    bus.on("response", this.onBusResponse);
  }

  protected override async doPublish(message: Message) {
    setImmediate(() => this.bus.emit("message", message));
    return "";
  }

  protected override async doPublishResponse(to: string, response: Response) {
    setImmediate(() => this.bus.emit("response", { to, response }));
  }

  override close() {
    super.close();
    this.bus.off("message", this.onBusMessage);
    this.bus.off("response", this.onBusResponse);
  }
}

const questions: ServedQuestion[] = Array.from({ length: 5 }, (_, i) => ({
  id: `q${i}`,
  topicId: "lenses",
  topicName: "Lens formula",
  text: `Question ${i}`,
  options: ["A", "B", "C", "D"],
  correctIndex: i % 4,
  difficulty: "MEDIUM",
}));
const correctFor = (questionId: string) => questions.find((q) => q.id === questionId)?.correctIndex ?? 0;

let teardown: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const fn of teardown.reverse()) await fn();
  teardown = [];
});

async function cluster() {
  const bus = new EventEmitter();
  bus.setMaxListeners(50);
  const registry = new MemoryRegistry();
  const persisted: PersistBattleInput[] = [];
  const clients: Client[] = [];

  const instance = async (name: string) => {
    const http = createServer();
    const battle = createBattleServer(http, {
      verifyToken: async (token) => {
        const [kind, id, display] = token.split(":");
        return kind === "user" && id ? { id, name: display ?? id } : null;
      },
      resolveScope: async (subjectId, topicId) => ({ subjectId, subjectName: "Physics", topicId, topicName: null }),
      countQuestions: async () => questions.length,
      loadQuestions: async (_scope, limit) => questions.slice(0, limit),
      loadRating: async (userId) => ({ rating: userId === "ben" ? 1250 : 1200, matchesPlayed: 3 }),
      persistBattle: async (input) => {
        persisted.push(input);
        return { battleId: `battle-${persisted.length}` };
      },
      rules: { ...BATTLE_RULES, timeLimitMs: 800, countdownMs: 60, revealMs: 60, reconnectGraceMs: 3_000 },
      queueTickMs: 50,
      registry,
      instanceId: name,
      // Socket.io calls the factory with `new`, so it must be a plain function (as the Redis adapter's is).
      adapter: function (nsp: Namespace) {
        return new BusAdapter(nsp, bus);
      } as never,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });
    await new Promise<void>((resolve) => http.listen(0, resolve));
    teardown.push(() => battle.close());
    return `http://localhost:${(http.address() as AddressInfo).port}`;
  };

  const [urlA, urlB] = await Promise.all([instance("A"), instance("B")]);
  teardown.push(async () => clients.forEach((c) => c.disconnect()));
  // Give the adapters a heartbeat to discover each other.
  await new Promise((resolve) => setTimeout(resolve, 300));

  const client = (url: string, token: string): Client => {
    const socket: Client = connect(url, { auth: { token }, transports: ["websocket"], forceNew: true, reconnection: false });
    clients.push(socket);
    return socket;
  };
  return { onA: (token: string) => client(urlA, token), onB: (token: string) => client(urlB, token), persisted, registry };
}

function next<E extends keyof ServerToClientEvents>(socket: Client, event: E, timeoutMs = 4_000): Promise<Payload<E>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${String(event)}`)), timeoutMs);
    socket.once(event, ((payload: Payload<E>) => {
      clearTimeout(timer);
      resolve(payload);
    }) as never);
  });
}

describe("several battle-service instances", () => {
  it("plays a full invite battle between players connected to different instances", async () => {
    const { onA, onB, persisted, registry } = await cluster();
    const aria = onA("user:aria:Aria");
    const ben = onB("user:ben:Ben");

    aria.on("question:next", (q) => aria.emit("answer:submit", { roomCode: q.roomCode, optionId: correctFor(q.questionId) }));
    // Ben's answers arrive at instance B and must be forwarded to A, which owns the room.
    ben.on("question:next", (q) => ben.emit("answer:submit", { roomCode: q.roomCode, optionId: (correctFor(q.questionId) + 1) % 4 }));

    const created = next(aria, "room:created");
    aria.emit("room:create", { subjectId: "physics" });
    const { roomCode } = await created;
    expect(await registry.roomOwner(roomCode)).toBe("A");

    const readyForBen = next(ben, "room:ready");
    const endForAria = next(aria, "battle:end", 15_000);
    const endForBen = next(ben, "battle:end", 15_000);
    ben.emit("room:join", { roomCode });
    expect((await readyForBen).players.map((p) => p.userId)).toEqual(["aria", "ben"]);

    const [endA, endB] = await Promise.all([endForAria, endForBen]);
    expect(endA.winnerId).toBe("aria");
    expect(endB.battleId).toBe("battle-1");
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.players.find((p) => p.userId === "ben")!.answers.length).toBeGreaterThan(0);
    // Room links are cleared everywhere once it ends.
    expect(await registry.userRoom("ben")).toBeNull();
  }, 20_000);

  it("matches players queued on different instances", async () => {
    const { onA, onB } = await cluster();
    const aria = onA("user:aria:Aria");
    const ben = onB("user:ben:Ben");

    const foundAria = next(aria, "match:found");
    const foundBen = next(ben, "match:found");
    const readyBen = next(ben, "room:ready");
    aria.emit("queue:join", { subjectId: "physics" });
    ben.emit("queue:join", { subjectId: "physics" });

    const [a, b] = await Promise.all([foundAria, foundBen]);
    expect(a.roomCode).toBe(b.roomCode);
    expect(a.opponent).toEqual({ name: "Ben", rating: 1250 });
    expect((await readyBen).players).toHaveLength(2);
  });

  it("pauses the room when a player on the other instance drops, and resumes on rejoin", async () => {
    const { onA, onB } = await cluster();
    const aria = onA("user:aria:Aria");
    let ben = onB("user:ben:Ben");

    const created = next(aria, "room:created");
    aria.emit("room:create", { subjectId: "physics" });
    const { roomCode } = await created;
    const first = next(aria, "question:next");
    ben.emit("room:join", { roomCode });
    await first;

    const paused = next(aria, "room:opponent_disconnected");
    ben.disconnect();
    expect((await paused).userId).toBe("ben");

    // Ben comes back through instance B again; the owner (A) resumes the round.
    const resumed = next(aria, "room:opponent_reconnected");
    ben = onB("user:ben:Ben");
    const again = next(ben, "question:next");
    ben.emit("room:rejoin", { roomCode });
    await resumed;
    expect((await again).round).toBe(1);
  });

  it("tells a player who is mid-battle on another instance that they are busy", async () => {
    const { onA, onB } = await cluster();
    const aria = onA("user:aria:Aria");
    const created = next(aria, "room:created");
    aria.emit("room:create", { subjectId: "physics" });
    const { roomCode } = await created;

    const secondTab = onB("user:aria:Aria");
    const active = next(secondTab, "session:active_room");
    expect((await active).roomCode).toBe(roomCode);
    const refused = next(secondTab, "room:error");
    secondTab.emit("queue:join", { subjectId: "physics" });
    expect((await refused).code).toBe("ALREADY_IN_ROOM");
  });
});
