/**
 * Quizbo battle service — Socket.io handlers and in-memory room state (single instance for MVP;
 * see stack.md for the Redis-backed follow-up).
 *
 * Identity always comes from the handshake token (socket.data.user), never from payload fields,
 * and all room state is keyed by the stable userId: socket ids change on every reconnect.
 *
 * ── Event reference ─────────────────────────────────────────────────────────────────────────
 * Client → server
 *   room:create   { subjectId, topicId? }        Create an invite room (validated questions only).
 *                                                 → room:created + room:state to the creator.
 *   room:join     { roomCode }                   Join as the second player. A third player gets
 *                                                 room:error ROOM_FULL. Starts the countdown.
 *   room:rejoin   { roomCode }                   Reattach after a dropped connection (same userId).
 *   room:leave    { roomCode }                   Leave. Waiting: closes/leaves the room. Mid-battle:
 *                                                 immediate forfeit (no "are you sure" in the loop).
 *   answer:submit { roomCode, optionId }         Answer the current round. Time is measured by the
 *                                                 server; any client timeTakenMs is ignored.
 *   queue:join    { subjectId, topicId? }        ✚ Enter ELO-band matchmaking for a subject/topic.
 *   queue:leave   {}                             ✚ Leave the queue.
 *   boost:use     { roomCode, boostId }          ✚ Fire a boost from your hand: one per round, before
 *                                                 answering. Refused with BOOST_UNAVAILABLE otherwise.
 *
 * Server → client
 *   room:created               → creator   { roomCode, subjectId, topicId, label }
 *   room:state                 → room/one  ✚ { roomCode, phase, label, players, round, totalRounds }
 *                                           Sent on create/join/leave and to a socket that rejoins.
 *   room:ready                 → room      { roomCode, players, startsInMs, totalRounds, label }
 *                                           Both players present; countdown before round 1.
 *   question:next              → player    { roomCode, round, totalRounds, questionId, text, options,
 *                                             timeLimitMs, topicName, difficulty, answered? }
 *                                           Each player gets their own question for the round.
 *   answer:result              → player    ✚ { round, correct, optionId, correctOptionId, speedBonus,
 *                                             damageToOpponent, damageToSelf } — private, after commit.
 *   round:result               → room      { playerId, correct, timedOut, players }
 *                                           Live HP/streak update after every answer or timeout,
 *                                           with fx (damage, blocks, heals) for the animations.
 *   question:timeout           → player    { round } — this player's clock ran out (Time Warp can
 *                                           give one player longer than the other).
 *   boost:used                 → room      ✚ { userId, boostId, round, players } — play the effect.
 *   boost:applied              → player    ✚ { round, boost } — hidden options / extra time on your
 *                                           own question.
 *   room:opponent_disconnected → room      { userId, graceMs } — match paused; clients must freeze
 *                                           their countdown display (the server timer is stopped).
 *   room:opponent_reconnected  → room      { userId } — resumes; the current question is re-sent
 *                                           with a fresh full timer.
 *   battle:end                 → room      { roomCode, battleId, winnerId, reason, players }
 *                                           reason: hp_depleted | max_questions | opponent_forfeit.
 *   room:error                 → socket    { code, message }
 *   queue:status               → player    ✚ { subjectId, topicId, waitedMs, band, nextBandInMs,
 *                                             queueSize, rating, ratingMin, ratingMax } — every tick.
 *   match:found                → player    ✚ { roomCode, opponent: { name, rating } }
 *   session:active_room        → socket    ✚ { roomCode } — on connect, if the user is mid-battle.
 * ✚ = addition to the architecture.md §3 table.
 */
import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  applyBattleElo,
  applyBoostedAnswer,
  BATTLE_RULES,
  BOOST_TUNING,
  BOOSTS,
  bandFor,
  clampAnswerTime,
  dealBoosts,
  decideWinner,
  fiftyFifty,
  findMatches,
  generateRoomCode,
  independentOrders,
  initialCombatState,
  isBoostId,
  isKnockedOut,
  medkit,
  newHand,
  nextBandInMs,
  normalizeRoomCode,
  roundsForPool,
  shuffle,
  spend,
  type AnswerFx,
  type AnswerOutcome,
  type BattleEndReasonWire,
  type BattleRules,
  type BoostId,
  type BoostSlot,
  type ClientToServerEvents,
  type CombatState,
  type EloChange,
  type PublicPlayer,
  type QuestionPayload,
  type QueueEntry,
  type RoomErrorCode,
  type RoomPhase,
  type RoundBoost,
  type Rng,
  type ServerToClientEvents,
} from "@quizbo/core";

export interface AuthUser {
  id: string;
  name: string;
}

export interface BattleScope {
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicName: string | null;
}

export interface ServedQuestion {
  id: string;
  topicId: string;
  topicName: string;
  text: string;
  options: string[];
  correctIndex: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export interface RatingSnapshot {
  rating: number;
  matchesPlayed: number;
}

export interface AnswerRecord {
  round: number;
  questionId: string;
  topicId: string;
  selectedIndex: number | null;
  correct: boolean;
  timeTakenMs: number;
}

export interface PersistBattleInput {
  roomCode: string;
  mode: "INVITE" | "MATCHMAKING";
  subjectId: string;
  topicId: string | null;
  reason: BattleEndReasonWire;
  winnerId: string | null;
  questionCount: number;
  players: Array<{ userId: string; name: string; elo: EloChange; state: CombatState; answers: AnswerRecord[] }>;
}

export interface BattleDeps {
  verifyToken(token: string): Promise<AuthUser | null>;
  resolveScope(subjectId: string, topicId: string | null): Promise<BattleScope | null>;
  countQuestions(scope: BattleScope): Promise<number>;
  loadQuestions(scope: BattleScope, limit: number): Promise<ServedQuestion[]>;
  loadRating(userId: string, subjectId: string): Promise<RatingSnapshot>;
  persistBattle(input: PersistBattleInput): Promise<{ battleId: string }>;
  rules?: BattleRules;
  rng?: Rng;
  /** Deals a battle hand; defaults to three random boosts. */
  dealBoosts?: (rng: Rng) => BoostId[];
  now?: () => number;
  corsOrigins?: string[];
  queueTickMs?: number;
  logger?: Pick<Console, "info" | "warn" | "error">;
}

interface SocketData {
  user: AuthUser;
}

type BattleServerSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

interface PlayerSlot {
  userId: string;
  name: string;
  socketId: string | null;
  connected: boolean;
  rating: RatingSnapshot;
  state: CombatState;
  /** Question index for each round — an independent order per player. */
  order: number[];
  /** Display order of option ids for each question, shuffled per player. */
  optionOrders: number[][];
  answers: AnswerRecord[];
  roundAnswer: { optionId: number | null } | null;
  boosts: BoostSlot[];
  roundBoost: RoundBoost;
}

interface Room {
  code: string;
  mode: "INVITE" | "MATCHMAKING";
  scope: BattleScope;
  label: string;
  phase: RoomPhase;
  pausedFrom: "countdown" | "active" | null;
  players: PlayerSlot[];
  questions: ServedQuestion[];
  totalRounds: number;
  ordersAssigned: boolean;
  round: number;
  roundStartedAt: number;
  roundClosed: boolean;
  countdownEndsAt: number;
  graceEndsAt: number;
  timers: Partial<Record<"round" | "countdown" | "reveal" | "grace" | "cleanup", NodeJS.Timeout>>;
}

interface QueuedPlayer extends QueueEntry {
  socketId: string;
  name: string;
  matchesPlayed: number;
  subjectId: string;
  topicId: string | null;
  key: string;
}

/** Extra time after the visible deadline so answers sent at 0.0s aren't lost to latency. */
const LATENCY_ALLOWANCE_MS = 400;
const ENDED_ROOM_TTL_MS = 60_000;
/** Timers may fire a millisecond or two early; treat a deadline that close as passed. */
const TIMER_SLACK_MS = 5;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 64;
const channel = (code: string) => `room:${code}`;
const noBoost = (): RoundBoost => ({ used: null, hiddenOptionIds: [], extraMs: 0, overclock: false });

export function createBattleServer(httpServer: HttpServer, deps: BattleDeps) {
  const rules = deps.rules ?? BATTLE_RULES;
  const rng = deps.rng ?? Math.random;
  const now = deps.now ?? Date.now;
  const deal = deps.dealBoosts ?? dealBoosts;
  const logger = deps.logger ?? console;

  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: deps.corsOrigins ?? "*" },
    // Notice silent network drops within ~10s so the reconnect grace period starts promptly.
    pingInterval: 5_000,
    pingTimeout: 5_000,
  });

  const rooms = new Map<string, Room>();
  /** userId → roomCode for rooms that have not ended. */
  const userRooms = new Map<string, string>();
  /** socket.id → { roomCode, userId } so events resolve without scanning rooms. */
  const socketIndex = new Map<string, { userId: string; roomCode: string | null }>();
  /** userId → matchmaking entry. */
  const queue = new Map<string, QueuedPlayer>();

  // ── helpers ────────────────────────────────────────────────────────────────────────────────

  const fail = (socket: BattleServerSocket, code: RoomErrorCode, message: string) =>
    socket.emit("room:error", { code, message });

  const emitToPlayer = <E extends keyof ServerToClientEvents>(
    player: PlayerSlot,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ) => {
    if (player.socketId) io.to(player.socketId).emit(event, ...args);
  };

  const publicPlayers = (room: Room): PublicPlayer[] =>
    room.players.map((p) => ({
      userId: p.userId,
      name: p.name,
      rating: p.rating.rating,
      hp: p.state.hp,
      streak: p.state.streak,
      bestStreak: p.state.bestStreak,
      correct: p.state.correct,
      connected: p.connected,
      boosts: p.boosts,
    }));

  const emitRoomState = (room: Room, target?: BattleServerSocket) => {
    const payload = {
      roomCode: room.code,
      phase: room.phase,
      label: room.label,
      players: publicPlayers(room),
      round: Math.max(0, room.round + 1),
      totalRounds: room.totalRounds,
    };
    if (target) target.emit("room:state", payload);
    else io.to(channel(room.code)).emit("room:state", payload);
  };

  const clearTimer = (room: Room, key: keyof Room["timers"]) => {
    const timer = room.timers[key];
    if (timer) clearTimeout(timer);
    delete room.timers[key];
  };

  const clearAllTimers = (room: Room) => {
    for (const key of Object.keys(room.timers) as Array<keyof Room["timers"]>) clearTimer(room, key);
  };

  const opponentOf = (room: Room, player: PlayerSlot) => room.players.find((p) => p.userId !== player.userId);

  const currentQuestion = (room: Room, player: PlayerSlot): ServedQuestion | undefined =>
    room.questions[player.order[room.round] ?? -1];

  const questionPayload = (room: Room, player: PlayerSlot, timeLimitMs: number): QuestionPayload | null => {
    const index = player.order[room.round];
    const question = index === undefined ? undefined : room.questions[index];
    const optionOrder = index === undefined ? undefined : player.optionOrders[index];
    if (!question || !optionOrder) return null;
    return {
      roomCode: room.code,
      round: room.round + 1,
      totalRounds: room.totalRounds,
      questionId: question.id,
      text: question.text,
      options: optionOrder.map((id) => ({ id, text: question.options[id] ?? "" })),
      timeLimitMs,
      topicName: question.topicName,
      difficulty: question.difficulty,
      ...(player.roundAnswer ? { answered: { optionId: player.roundAnswer.optionId } } : {}),
      ...(player.roundBoost.used ? { boost: player.roundBoost } : {}),
    };
  };

  const sendQuestion = (room: Room, player: PlayerSlot, timeLimitMs: number) => {
    const payload = questionPayload(room, player, timeLimitMs);
    if (payload) emitToPlayer(player, "question:next", payload);
  };

  const uniqueRoomCode = () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generateRoomCode(rng);
      if (!rooms.has(code)) return code;
    }
    throw new Error("Could not allocate a room code");
  };

  const deleteRoom = (room: Room) => {
    clearAllTimers(room);
    if (rooms.get(room.code) === room) rooms.delete(room.code);
    for (const player of room.players) {
      if (userRooms.get(player.userId) === room.code) userRooms.delete(player.userId);
      if (player.socketId) {
        const entry = socketIndex.get(player.socketId);
        if (entry?.roomCode === room.code) entry.roomCode = null;
      }
    }
    io.in(channel(room.code)).socketsLeave(channel(room.code));
  };

  /** True (and tells the client) when the user is already in a live room. */
  const guardBusy = (socket: BattleServerSocket, userId: string): boolean => {
    const code = userRooms.get(userId);
    if (!code) return false;
    const room = rooms.get(code);
    if (!room || room.phase === "ended") {
      userRooms.delete(userId);
      return false;
    }
    socket.emit("session:active_room", { roomCode: code });
    fail(socket, "ALREADY_IN_ROOM", "You're already in a battle.");
    return true;
  };

  const buildRoom = async (mode: Room["mode"], scope: BattleScope): Promise<Room | null> => {
    const questions = await deps.loadQuestions(scope, rules.maxQuestions);
    if (questions.length < rules.minQuestions) return null;
    return {
      code: uniqueRoomCode(),
      mode,
      scope,
      label: `${scope.subjectName} · ${scope.topicName ?? "Mixed topics"}`,
      phase: "waiting",
      pausedFrom: null,
      players: [],
      questions,
      totalRounds: roundsForPool(questions.length, rules),
      ordersAssigned: false,
      round: -1,
      roundStartedAt: 0,
      roundClosed: true,
      countdownEndsAt: 0,
      graceEndsAt: 0,
      timers: {},
    };
  };

  const addPlayer = (room: Room, socket: BattleServerSocket, user: AuthUser, rating: RatingSnapshot) => {
    room.players.push({
      userId: user.id,
      name: user.name,
      socketId: socket.id,
      connected: true,
      rating,
      state: initialCombatState(rules),
      order: [],
      optionOrders: [],
      answers: [],
      roundAnswer: null,
      boosts: [],
      roundBoost: noBoost(),
    });
    userRooms.set(user.id, room.code);
    socketIndex.set(socket.id, { userId: user.id, roomCode: room.code });
    void socket.join(channel(room.code));
  };

  // ── battle flow ────────────────────────────────────────────────────────────────────────────

  const startCountdown = (room: Room) => {
    const [first, second] = room.players;
    if (!first || !second) return;
    if (!room.ordersAssigned) {
      const [orderA, orderB] = independentOrders(room.totalRounds, rng);
      first.order = orderA;
      second.order = orderB;
      for (const player of room.players) {
        player.optionOrders = room.questions.map(() => shuffle([0, 1, 2, 3], rng));
        player.boosts = newHand(deal(rng));
      }
      room.ordersAssigned = true;
    }
    room.phase = "countdown";
    room.countdownEndsAt = now() + rules.countdownMs;
    io.to(channel(room.code)).emit("room:ready", {
      roomCode: room.code,
      players: publicPlayers(room),
      startsInMs: rules.countdownMs,
      totalRounds: room.totalRounds,
      label: room.label,
    });
    room.timers.countdown = setTimeout(() => startRound(room, 0), rules.countdownMs);
    const absent = room.players.find((p) => !p.connected);
    if (absent) pause(room, absent.userId);
  };

  const startRound = (room: Room, index: number) => {
    clearTimer(room, "countdown");
    clearTimer(room, "reveal");
    room.round = index;
    room.phase = "active";
    room.roundClosed = false;
    room.roundStartedAt = now();
    for (const player of room.players) {
      player.roundAnswer = null;
      player.roundBoost = noBoost();
    }
    for (const player of room.players) sendQuestion(room, player, rules.timeLimitMs);
    scheduleRoundTimer(room);
  };

  /** A player's answer deadline this round, Time Warp included (latency allowance excluded). */
  const deadlineOf = (room: Room, player: PlayerSlot) => room.roundStartedAt + rules.timeLimitMs + player.roundBoost.extraMs;

  /** Arms the round timer for the earliest deadline among the players still to answer. */
  const scheduleRoundTimer = (room: Room) => {
    clearTimer(room, "round");
    const pending = room.players.filter((p) => !p.roundAnswer).map((p) => deadlineOf(room, p));
    if (pending.length === 0) return;
    const delay = Math.max(0, Math.min(...pending) + LATENCY_ALLOWANCE_MS - now());
    room.timers.round = setTimeout(() => closeRoundOnTimeout(room), delay);
  };

  /** Re-sends the current round with a fresh full timer — never a resumed partial timer. */
  const restartRound = (room: Room) => {
    room.phase = "active";
    room.roundStartedAt = now();
    for (const player of room.players) sendQuestion(room, player, rules.timeLimitMs);
    scheduleRoundTimer(room);
  };

  const scheduleNext = (room: Room) => {
    clearTimer(room, "round");
    room.roundClosed = true;
    const last = room.round + 1 >= room.totalRounds;
    // The reveal gap lets hit/miss effects resolve before the next question renders.
    room.timers.reveal = setTimeout(
      () => (last ? void endBattle(room, "max_questions") : startRound(room, room.round + 1)),
      rules.revealMs,
    );
  };

  const resolveAnswer = (
    room: Room,
    player: PlayerSlot,
    question: ServedQuestion,
    submission: { optionId: number; timeTakenMs: number } | null,
  ) => {
    const opponent = opponentOf(room, player);
    if (!opponent) return;
    const correct = submission !== null && submission.optionId === question.correctIndex;
    const outcome: AnswerOutcome =
      submission === null
        ? { kind: "timeout" }
        : correct
          ? { kind: "correct", timeTakenMs: submission.timeTakenMs }
          : { kind: "wrong", timeTakenMs: submission.timeTakenMs };
    const effect = applyBoostedAnswer(
      player.state,
      opponent.state,
      outcome,
      { self: player.boosts, opponent: opponent.boosts, overclock: player.roundBoost.overclock },
      rules,
    );
    player.state = effect.self;
    opponent.state = effect.opponent;
    player.boosts = spend(player.boosts, effect.spentBySelf);
    opponent.boosts = spend(opponent.boosts, effect.spentByOpponent);
    const fx: AnswerFx = {
      damageToOpponent: effect.damageToOpponent,
      damageToSelf: effect.damageToSelf,
      speedBonus: effect.speedBonus,
      streakBonus: effect.streakBonus,
      blocked: effect.blocked,
      reflected: effect.reflected,
      healed: effect.healed,
      doubled: effect.doubled,
      anchored: effect.anchored,
    };
    player.roundAnswer = { optionId: submission?.optionId ?? null };
    player.answers.push({
      round: room.round + 1,
      questionId: question.id,
      topicId: question.topicId,
      selectedIndex: submission?.optionId ?? null,
      correct,
      timeTakenMs: submission?.timeTakenMs ?? rules.timeLimitMs,
    });

    emitToPlayer(player, "answer:result", {
      round: room.round + 1,
      correct,
      optionId: submission?.optionId ?? null,
      correctOptionId: question.correctIndex,
      speedBonus: effect.speedBonus,
      damageToOpponent: effect.damageToOpponent,
      damageToSelf: effect.damageToSelf,
      fx,
    });
    io.to(channel(room.code)).emit("round:result", {
      playerId: player.userId,
      correct,
      timedOut: submission === null,
      players: publicPlayers(room),
      fx,
    });
  };

  const afterAnswers = (room: Room) => {
    if (room.players.some((p) => isKnockedOut(p.state))) {
      void endBattle(room, "hp_depleted");
      return;
    }
    if (room.players.every((p) => p.roundAnswer)) scheduleNext(room);
  };

  const closeRoundOnTimeout = (room: Room) => {
    delete room.timers.round;
    if (room.phase !== "active" || room.roundClosed) return;
    for (const player of room.players) {
      const question = currentQuestion(room, player);
      if (player.roundAnswer || !question || deadlineOf(room, player) + LATENCY_ALLOWANCE_MS > now() + TIMER_SLACK_MS) continue;
      emitToPlayer(player, "question:timeout", { round: room.round + 1 });
      resolveAnswer(room, player, question, null);
    }
    afterAnswers(room);
    if (room.phase === "active" && !room.roundClosed) scheduleRoundTimer(room);
  };

  const pause = (room: Room, userId: string) => {
    if (room.phase === "ended" || room.phase === "waiting") return;
    if (room.phase !== "paused") {
      room.pausedFrom = room.phase === "countdown" ? "countdown" : "active";
      room.phase = "paused";
      clearTimer(room, "round");
      clearTimer(room, "countdown");
      clearTimer(room, "reveal");
      room.graceEndsAt = now() + rules.reconnectGraceMs;
      room.timers.grace = setTimeout(() => onGraceExpired(room), rules.reconnectGraceMs);
    }
    io.to(channel(room.code)).emit("room:opponent_disconnected", {
      userId,
      graceMs: Math.max(0, room.graceEndsAt - now()),
    });
  };

  const resume = (room: Room, userId: string) => {
    if (room.phase !== "paused" || room.players.some((p) => !p.connected)) return;
    clearTimer(room, "grace");
    io.to(channel(room.code)).emit("room:opponent_reconnected", { userId });
    const from = room.pausedFrom;
    room.pausedFrom = null;
    if (from === "countdown") {
      startCountdown(room);
      return;
    }
    room.phase = "active";
    if (room.roundClosed) scheduleNext(room);
    else restartRound(room);
  };

  const onGraceExpired = (room: Room) => {
    delete room.timers.grace;
    if (room.phase !== "paused") return;
    const connected = room.players.filter((p) => p.connected);
    if (connected.length === 1 && connected[0]) {
      void endBattle(room, "opponent_forfeit", connected[0].userId);
      return;
    }
    // Nobody came back: abandon without a result or rating change.
    logger.warn(`[battle] room ${room.code} abandoned by both players`);
    room.phase = "ended";
    deleteRoom(room);
  };

  const endBattle = async (room: Room, reason: BattleEndReasonWire, forcedWinnerId?: string) => {
    if (room.phase === "ended") return;
    room.phase = "ended";
    clearAllTimers(room);
    const [a, b] = room.players;
    if (!a || !b) {
      deleteRoom(room);
      return;
    }

    const winnerId =
      forcedWinnerId ?? decideWinner({ userId: a.userId, state: a.state }, { userId: b.userId, state: b.state }).winnerId;
    const [eloA, eloB] = applyBattleElo(
      { userId: a.userId, ...a.rating },
      { userId: b.userId, ...b.rating },
      { winnerId, forfeit: reason === "opponent_forfeit" },
    );
    const eloFor = (userId: string) => (userId === a.userId ? eloA : eloB);

    let battleId: string | null = null;
    try {
      const saved = await deps.persistBattle({
        roomCode: room.code,
        mode: room.mode,
        subjectId: room.scope.subjectId,
        topicId: room.scope.topicId,
        reason,
        winnerId,
        questionCount: room.totalRounds,
        players: room.players.map((p) => ({
          userId: p.userId,
          name: p.name,
          elo: eloFor(p.userId),
          state: p.state,
          answers: p.answers,
        })),
      });
      battleId = saved.battleId;
    } catch (error) {
      logger.error(`[battle] failed to persist room ${room.code}`, error);
    }

    for (const player of room.players) {
      if (userRooms.get(player.userId) === room.code) userRooms.delete(player.userId);
    }
    io.to(channel(room.code)).emit("battle:end", {
      roomCode: room.code,
      battleId,
      winnerId,
      reason,
      players: room.players.map((p) => {
        const elo = eloFor(p.userId);
        return {
          userId: p.userId,
          name: p.name,
          hp: p.state.hp,
          correct: p.state.correct,
          bestStreak: p.state.bestStreak,
          eloBefore: elo.before,
          eloAfter: elo.after,
          eloDelta: elo.delta,
        };
      }),
    });
    room.timers.cleanup = setTimeout(() => deleteRoom(room), ENDED_ROOM_TTL_MS);
  };

  const rejoin = (socket: BattleServerSocket, room: Room) => {
    const user = socket.data.user;
    const player = room.players.find((p) => p.userId === user.id);
    if (!player) return fail(socket, "NOT_IN_ROOM", "You're not a player in that battle.");
    if (room.phase === "ended") return fail(socket, "ROOM_NOT_FOUND", "That battle has already finished.");

    if (player.socketId && player.socketId !== socket.id) {
      const previous = io.sockets.sockets.get(player.socketId);
      socketIndex.delete(player.socketId);
      if (previous) {
        void previous.leave(channel(room.code));
        previous.emit("room:error", { code: "ALREADY_IN_ROOM", message: "This battle continued in another tab." });
      }
    }
    player.socketId = socket.id;
    player.connected = true;
    socketIndex.set(socket.id, { userId: user.id, roomCode: room.code });
    void socket.join(channel(room.code));
    clearTimer(room, "cleanup");
    userRooms.set(user.id, room.code);

    emitRoomState(room, socket);
    if (room.phase === "paused") {
      resume(room, user.id);
      const stillMissing = room.players.find((p) => !p.connected);
      if (stillMissing) {
        socket.emit("room:opponent_disconnected", {
          userId: stillMissing.userId,
          graceMs: Math.max(0, room.graceEndsAt - now()),
        });
      }
    } else if (room.phase === "countdown") {
      socket.emit("room:ready", {
        roomCode: room.code,
        players: publicPlayers(room),
        startsInMs: Math.max(0, room.countdownEndsAt - now()),
        totalRounds: room.totalRounds,
        label: room.label,
      });
    } else if (room.phase === "active" && !room.roundClosed) {
      // The old connection was never noticed as dropped, so the round kept running: send what's left.
      sendQuestion(room, player, Math.max(0, rules.timeLimitMs - (now() - room.roundStartedAt)));
    } else if (room.phase === "waiting") {
      emitRoomState(room);
    }
  };

  // ── matchmaking ────────────────────────────────────────────────────────────────────────────

  const queueKey = (subjectId: string, topicId: string | null) => `${subjectId}:${topicId ?? "*"}`;

  const leaveQueue = (userId: string, socketId?: string) => {
    const entry = queue.get(userId);
    if (entry && (!socketId || entry.socketId === socketId)) queue.delete(userId);
  };

  const emitQueueStatus = (entry: QueuedPlayer) => {
    const waitedMs = Math.max(0, now() - entry.joinedAt);
    const band = bandFor(waitedMs);
    let queueSize = 0;
    for (const other of queue.values()) if (other.key === entry.key) queueSize++;
    io.to(entry.socketId).emit("queue:status", {
      subjectId: entry.subjectId,
      topicId: entry.topicId,
      waitedMs,
      band,
      nextBandInMs: nextBandInMs(waitedMs),
      queueSize,
      rating: entry.rating,
      ratingMin: entry.rating - band,
      ratingMax: entry.rating + band,
    });
  };

  const startMatchedRoom = async (x: QueuedPlayer, y: QueuedPlayer) => {
    const requeue = (entry: QueuedPlayer) => {
      if (io.sockets.sockets.has(entry.socketId) && !userRooms.has(entry.userId)) queue.set(entry.userId, entry);
    };
    try {
      const scope = await deps.resolveScope(x.subjectId, x.topicId);
      const room = scope ? await buildRoom("MATCHMAKING", scope) : null;
      const socketX = io.sockets.sockets.get(x.socketId);
      const socketY = io.sockets.sockets.get(y.socketId);
      if (!room) {
        for (const socket of [socketX, socketY]) {
          if (socket) fail(socket, "NOT_ENOUGH_QUESTIONS", "Not enough validated questions for that topic yet.");
        }
        return;
      }
      if (!socketX || !socketY || userRooms.has(x.userId) || userRooms.has(y.userId)) {
        requeue(x);
        requeue(y);
        return;
      }
      addPlayer(room, socketX, { id: x.userId, name: x.name }, { rating: x.rating, matchesPlayed: x.matchesPlayed });
      addPlayer(room, socketY, { id: y.userId, name: y.name }, { rating: y.rating, matchesPlayed: y.matchesPlayed });
      rooms.set(room.code, room);
      socketX.emit("match:found", { roomCode: room.code, opponent: { name: y.name, rating: y.rating } });
      socketY.emit("match:found", { roomCode: room.code, opponent: { name: x.name, rating: x.rating } });
      startCountdown(room);
    } catch (error) {
      logger.error("[battle] failed to start matched room", error);
      requeue(x);
      requeue(y);
    }
  };

  const matchTick = () => {
    const groups = new Map<string, QueuedPlayer[]>();
    for (const entry of queue.values()) {
      const list = groups.get(entry.key) ?? [];
      list.push(entry);
      groups.set(entry.key, list);
    }
    for (const entries of groups.values()) {
      for (const [x, y] of findMatches(entries, now()) as Array<[QueuedPlayer, QueuedPlayer]>) {
        queue.delete(x.userId);
        queue.delete(y.userId);
        void startMatchedRoom(x, y);
      }
    }
    for (const entry of queue.values()) emitQueueStatus(entry);
  };

  const tick = setInterval(matchTick, deps.queueTickMs ?? 1_000);

  // ── sockets ────────────────────────────────────────────────────────────────────────────────

  io.use(async (socket, next) => {
    const token = isRecord(socket.handshake.auth) ? socket.handshake.auth.token : undefined;
    const user = typeof token === "string" ? await deps.verifyToken(token).catch(() => null) : null;
    if (!user) return next(new Error("UNAUTHORIZED"));
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    socketIndex.set(socket.id, { userId: user.id, roomCode: null });

    const activeCode = userRooms.get(user.id);
    if (activeCode && rooms.get(activeCode)?.phase !== "ended") socket.emit("session:active_room", { roomCode: activeCode });

    const guarded =
      <A extends unknown[]>(handler: (...args: A) => Promise<void> | void) =>
      async (...args: A) => {
        try {
          await handler(...args);
        } catch (error) {
          logger.error("[battle] handler error", error);
          fail(socket, "SERVER_ERROR", "Something went wrong. Try again.");
        }
      };

    socket.on(
      "room:create",
      guarded(async (payload) => {
        if (!isRecord(payload) || !isId(payload.subjectId) || (payload.topicId != null && !isId(payload.topicId))) {
          return void fail(socket, "INVALID_PAYLOAD", "Pick a subject to battle in.");
        }
        if (guardBusy(socket, user.id)) return;
        leaveQueue(user.id);
        const scope = await deps.resolveScope(payload.subjectId, payload.topicId ?? null);
        if (!scope) return void fail(socket, "INVALID_PAYLOAD", "That subject or topic doesn't exist.");
        const [room, rating] = await Promise.all([buildRoom("INVITE", scope), deps.loadRating(user.id, scope.subjectId)]);
        if (!room) return void fail(socket, "NOT_ENOUGH_QUESTIONS", "Not enough validated questions for that topic yet.");
        if (guardBusy(socket, user.id)) return;
        addPlayer(room, socket, user, rating);
        rooms.set(room.code, room);
        socket.emit("room:created", {
          roomCode: room.code,
          subjectId: scope.subjectId,
          topicId: scope.topicId,
          label: room.label,
        });
        emitRoomState(room);
      }),
    );

    socket.on(
      "room:join",
      guarded(async (payload) => {
        const code = isRecord(payload) && typeof payload.roomCode === "string" ? normalizeRoomCode(payload.roomCode) : null;
        if (!code) return void fail(socket, "INVALID_PAYLOAD", "Room codes are five letters and numbers.");
        const room = rooms.get(code);
        if (!room || room.phase === "ended") return void fail(socket, "ROOM_NOT_FOUND", "No open room with that code.");
        if (room.players.some((p) => p.userId === user.id)) return void rejoin(socket, room);
        if (room.players.length >= 2 || room.phase !== "waiting") {
          return void fail(socket, "ROOM_FULL", "That room already has two players.");
        }
        if (guardBusy(socket, user.id)) return;
        leaveQueue(user.id);
        const rating = await deps.loadRating(user.id, room.scope.subjectId);
        if (rooms.get(code) !== room || room.players.length >= 2 || room.phase !== "waiting") {
          return void fail(socket, "ROOM_FULL", "That room already has two players.");
        }
        if (guardBusy(socket, user.id)) return;
        addPlayer(room, socket, user, rating);
        emitRoomState(room);
        startCountdown(room);
      }),
    );

    socket.on(
      "room:rejoin",
      guarded((payload) => {
        const code = isRecord(payload) && typeof payload.roomCode === "string" ? normalizeRoomCode(payload.roomCode) : null;
        const room = code ? rooms.get(code) : undefined;
        if (!room) return void fail(socket, "ROOM_NOT_FOUND", "That battle is no longer running.");
        rejoin(socket, room);
      }),
    );

    socket.on(
      "room:leave",
      guarded(() => {
        const code = socketIndex.get(socket.id)?.roomCode;
        const room = code ? rooms.get(code) : undefined;
        const player = room?.players.find((p) => p.userId === user.id);
        if (!room || !player) return;
        if (room.phase === "waiting") {
          room.players = room.players.filter((p) => p !== player);
          userRooms.delete(user.id);
          socketIndex.set(socket.id, { userId: user.id, roomCode: null });
          void socket.leave(channel(room.code));
          if (room.players.length === 0) deleteRoom(room);
          else emitRoomState(room);
          return;
        }
        if (room.phase === "ended") return;
        const opponent = opponentOf(room, player);
        if (opponent) void endBattle(room, "opponent_forfeit", opponent.userId);
      }),
    );

    socket.on(
      "answer:submit",
      guarded((payload) => {
        const code = socketIndex.get(socket.id)?.roomCode;
        const room = code ? rooms.get(code) : undefined;
        const player = room?.players.find((p) => p.userId === user.id);
        if (!room || !player || player.socketId !== socket.id) return void fail(socket, "NOT_IN_ROOM", "You're not in a battle.");
        if (!isRecord(payload) || typeof payload.roomCode !== "string" || normalizeRoomCode(payload.roomCode) !== room.code) {
          return void fail(socket, "NOT_IN_ROOM", "That answer was for a different room.");
        }
        const optionId = payload.optionId;
        if (typeof optionId !== "number" || !Number.isInteger(optionId) || optionId < 0 || optionId > 3) {
          return void fail(socket, "INVALID_PAYLOAD", "Pick one of the four options.");
        }
        if (room.phase !== "active" || room.roundClosed || player.roundAnswer) {
          return void fail(socket, "ROUND_CLOSED", "That question is closed.");
        }
        const question = currentQuestion(room, player);
        if (!question) return void fail(socket, "ROUND_CLOSED", "That question is closed.");
        const elapsed = now() - room.roundStartedAt;
        const window = rules.timeLimitMs + player.roundBoost.extraMs;
        if (elapsed > window + LATENCY_ALLOWANCE_MS) return void fail(socket, "ROUND_CLOSED", "That question is closed.");
        const timeTakenMs = clampAnswerTime(elapsed, { ...rules, timeLimitMs: window });
        resolveAnswer(room, player, question, { optionId, timeTakenMs });
        afterAnswers(room);
        if (room.phase === "active" && !room.roundClosed) scheduleRoundTimer(room);
      }),
    );

    socket.on(
      "boost:use",
      guarded((payload) => {
        const code = socketIndex.get(socket.id)?.roomCode;
        const room = code ? rooms.get(code) : undefined;
        const player = room?.players.find((p) => p.userId === user.id);
        if (!room || !player || player.socketId !== socket.id) return void fail(socket, "NOT_IN_ROOM", "You're not in a battle.");
        if (!isRecord(payload) || typeof payload.roomCode !== "string" || normalizeRoomCode(payload.roomCode) !== room.code) {
          return void fail(socket, "NOT_IN_ROOM", "That boost was for a different room.");
        }
        const boostId = payload.boostId;
        const slot = isBoostId(boostId) ? player.boosts.find((b) => b.id === boostId) : undefined;
        if (!isBoostId(boostId) || !slot || slot.state !== "ready") {
          return void fail(socket, "BOOST_UNAVAILABLE", "That boost isn't in your hand.");
        }
        const question = currentQuestion(room, player);
        if (room.phase !== "active" || room.roundClosed || player.roundAnswer || !question) {
          return void fail(socket, "BOOST_UNAVAILABLE", "Boosts can only be used before you answer.");
        }
        if (player.roundBoost.used) return void fail(socket, "BOOST_UNAVAILABLE", "One boost per question.");
        if (now() > deadlineOf(room, player)) return void fail(socket, "BOOST_UNAVAILABLE", "Out of time for that one.");

        const kind = BOOSTS[boostId].kind;
        player.boosts = player.boosts.map((b) => (b.id === boostId ? { ...b, state: kind === "armed" ? "armed" : "spent" } : b));
        const roundBoost: RoundBoost = { ...player.roundBoost, used: boostId };
        if (boostId === "medkit") player.state = medkit(player.state, rules);
        if (boostId === "fifty") roundBoost.hiddenOptionIds = fiftyFifty(question.correctIndex, question.options.length, rng);
        if (boostId === "overclock") roundBoost.overclock = true;
        if (boostId === "warp") roundBoost.extraMs = BOOST_TUNING.warpMs;
        player.roundBoost = roundBoost;
        if (boostId === "warp") scheduleRoundTimer(room);

        emitToPlayer(player, "boost:applied", { round: room.round + 1, boost: roundBoost });
        io.to(channel(room.code)).emit("boost:used", {
          userId: player.userId,
          boostId,
          round: room.round + 1,
          players: publicPlayers(room),
        });
      }),
    );

    socket.on(
      "queue:join",
      guarded(async (payload) => {
        if (!isRecord(payload) || !isId(payload.subjectId) || (payload.topicId != null && !isId(payload.topicId))) {
          return void fail(socket, "INVALID_PAYLOAD", "Pick a subject to battle in.");
        }
        if (guardBusy(socket, user.id)) return;
        const scope = await deps.resolveScope(payload.subjectId, payload.topicId ?? null);
        if (!scope) return void fail(socket, "INVALID_PAYLOAD", "That subject or topic doesn't exist.");
        const [count, rating] = await Promise.all([deps.countQuestions(scope), deps.loadRating(user.id, scope.subjectId)]);
        if (count < rules.minQuestions) {
          return void fail(socket, "NOT_ENOUGH_QUESTIONS", "Not enough validated questions for that topic yet.");
        }
        if (guardBusy(socket, user.id) || !socket.connected) return;
        const existing = queue.get(user.id);
        const key = queueKey(scope.subjectId, scope.topicId);
        const entry: QueuedPlayer = {
          userId: user.id,
          name: user.name,
          rating: rating.rating,
          matchesPlayed: rating.matchesPlayed,
          joinedAt: existing?.key === key ? existing.joinedAt : now(),
          socketId: socket.id,
          subjectId: scope.subjectId,
          topicId: scope.topicId,
          key,
        };
        queue.set(user.id, entry);
        emitQueueStatus(entry);
      }),
    );

    socket.on(
      "queue:leave",
      guarded(() => leaveQueue(user.id)),
    );

    socket.on("disconnect", () => {
      leaveQueue(user.id, socket.id);
      const entry = socketIndex.get(socket.id);
      socketIndex.delete(socket.id);
      const room = entry?.roomCode ? rooms.get(entry.roomCode) : undefined;
      const player = room?.players.find((p) => p.userId === user.id);
      if (!room || !player || player.socketId !== socket.id) return;
      player.connected = false;
      player.socketId = null;
      if (room.phase === "waiting") {
        emitRoomState(room);
        if (room.players.every((p) => !p.connected)) {
          room.timers.cleanup = setTimeout(() => deleteRoom(room), rules.reconnectGraceMs * 3);
        }
        return;
      }
      if (room.phase !== "ended") pause(room, player.userId);
    });
  });

  return {
    io,
    stats: () => ({ rooms: rooms.size, queued: queue.size }),
    async close() {
      clearInterval(tick);
      for (const room of rooms.values()) clearAllTimers(room);
      await io.close();
    },
  };
}
