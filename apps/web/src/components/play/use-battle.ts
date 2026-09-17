"use client";

import type {
  AnswerFx,
  BoostId,
  ClientToServerEvents,
  PublicPlayer,
  QuestionPayload,
  RoomErrorCode,
  RoundBoost,
  ServerToClientEvents,
} from "@quizbo/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";

type BattleSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type Payload<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0];

export type PlayIntent =
  | { kind: "queue"; subjectId: string; topicId: string | null }
  | { kind: "create"; subjectId: string; topicId: string | null }
  | { kind: "join"; roomCode: string };

export type PlayPhase = "connecting" | "queue" | "waiting" | "found" | "countdown" | "battle" | "ended" | "error";

export interface PlayState {
  phase: PlayPhase;
  error: string | null;
  roomCode: string | null;
  label: string | null;
  players: PublicPlayer[];
  totalRounds: number;
  queue: Payload<"queue:status"> | null;
  opponent: { name: string; rating: number } | null;
  countdownEndsAt: number | null;
  question: QuestionPayload | null;
  /** performance.now() when the current question arrived — the client clock never trusts the server's. */
  receivedAt: number;
  picked: number | null;
  answer: Payload<"answer:result"> | null;
  answeredThisRound: string[];
  paused: { userId: string; graceEndsAt: number; frozenRemainingMs: number } | null;
  offline: boolean;
  hits: Record<string, number>;
  end: Payload<"battle:end"> | null;
  /** Boost effects on my own question this round (hidden options, extra time, overclock). */
  roundBoost: RoundBoost | null;
  /** A boost sent to the server and not yet confirmed. */
  boostPending: BoostId | null;
  /** The latest resolved answer (either player), numbered so each one plays its effects once. */
  lastRound: { seq: number; playerId: string; correct: boolean; timedOut: boolean; fx: AnswerFx; hpBefore: Record<string, number> } | null;
  /** The latest boost fired (either player). */
  lastBoost: { seq: number; userId: string; boostId: BoostId; hpBefore: Record<string, number> } | null;
}

type Action =
  | { type: "error"; message: string }
  | { type: "queue"; status: Payload<"queue:status"> }
  | { type: "created"; roomCode: string; label: string }
  | { type: "state"; payload: Payload<"room:state"> }
  | { type: "found"; payload: Payload<"match:found"> }
  | { type: "ready"; payload: Payload<"room:ready"> }
  | { type: "question"; payload: QuestionPayload }
  | { type: "picked"; optionId: number }
  | { type: "answer"; payload: Payload<"answer:result"> }
  | { type: "round"; payload: Payload<"round:result"> }
  | { type: "paused"; payload: Payload<"room:opponent_disconnected"> }
  | { type: "resumed" }
  | { type: "offline"; value: boolean }
  | { type: "end"; payload: Payload<"battle:end"> }
  | { type: "boostPending"; boostId: BoostId | null }
  | { type: "boostUsed"; payload: Payload<"boost:used"> }
  | { type: "boostApplied"; payload: Payload<"boost:applied"> };

const initialState: PlayState = {
  phase: "connecting",
  error: null,
  roomCode: null,
  label: null,
  players: [],
  totalRounds: 0,
  queue: null,
  opponent: null,
  countdownEndsAt: null,
  question: null,
  receivedAt: 0,
  picked: null,
  answer: null,
  answeredThisRound: [],
  paused: null,
  offline: false,
  hits: {},
  end: null,
  roundBoost: null,
  boostPending: null,
  lastRound: null,
  lastBoost: null,
};

const hpOf = (players: PublicPlayer[]) => Object.fromEntries(players.map((p) => [p.userId, p.hp]));

function reducer(state: PlayState, action: Action): PlayState {
  if (state.phase === "ended" && action.type !== "end") return state;
  switch (action.type) {
    case "error":
      return { ...state, phase: "error", error: action.message };
    case "queue":
      return state.roomCode ? state : { ...state, phase: "queue", queue: action.status };
    case "created":
      return { ...state, phase: "waiting", roomCode: action.roomCode, label: action.label };
    case "state": {
      const next = { ...state, roomCode: action.payload.roomCode, label: action.payload.label, players: action.payload.players, totalRounds: action.payload.totalRounds };
      if (action.payload.phase === "waiting") return { ...next, phase: "waiting" };
      return next;
    }
    case "found":
      return { ...state, phase: "found", roomCode: action.payload.roomCode, opponent: action.payload.opponent };
    case "ready":
      return {
        ...state,
        phase: state.question ? state.phase : "countdown",
        roomCode: action.payload.roomCode,
        label: action.payload.label,
        players: action.payload.players,
        totalRounds: action.payload.totalRounds,
        countdownEndsAt: Date.now() + action.payload.startsInMs,
      };
    case "question": {
      const sameRound = state.question?.round === action.payload.round;
      return {
        ...state,
        phase: "battle",
        question: action.payload,
        totalRounds: action.payload.totalRounds,
        receivedAt: performance.now(),
        picked: action.payload.answered?.optionId ?? (sameRound ? state.picked : null),
        answer: sameRound ? state.answer : null,
        answeredThisRound: sameRound ? state.answeredThisRound : [],
        paused: null,
        roundBoost: action.payload.boost ?? (sameRound ? state.roundBoost : null),
        boostPending: sameRound ? state.boostPending : null,
      };
    }
    case "boostPending":
      return { ...state, boostPending: action.boostId };
    case "boostApplied":
      return state.question?.round === action.payload.round
        ? { ...state, roundBoost: action.payload.boost, boostPending: null }
        : state;
    case "boostUsed":
      return {
        ...state,
        players: action.payload.players,
        lastBoost: {
          seq: (state.lastBoost?.seq ?? 0) + 1,
          userId: action.payload.userId,
          boostId: action.payload.boostId,
          hpBefore: hpOf(state.players),
        },
      };
    case "picked":
      return { ...state, picked: action.optionId };
    case "answer":
      return { ...state, answer: action.payload, picked: action.payload.optionId };
    case "round": {
      const hits = { ...state.hits };
      for (const player of action.payload.players) {
        const before = state.players.find((p) => p.userId === player.userId);
        if (before && player.hp < before.hp) hits[player.userId] = (hits[player.userId] ?? 0) + 1;
      }
      return {
        ...state,
        players: action.payload.players,
        hits,
        answeredThisRound: [...new Set([...state.answeredThisRound, action.payload.playerId])],
        lastRound: {
          seq: (state.lastRound?.seq ?? 0) + 1,
          playerId: action.payload.playerId,
          correct: action.payload.correct,
          timedOut: action.payload.timedOut,
          fx: action.payload.fx,
          hpBefore: hpOf(state.players),
        },
      };
    }
    case "paused": {
      const remaining = state.question
        ? Math.max(0, state.question.timeLimitMs - (performance.now() - state.receivedAt))
        : 0;
      return {
        ...state,
        paused: {
          userId: action.payload.userId,
          graceEndsAt: Date.now() + action.payload.graceMs,
          frozenRemainingMs: state.paused?.frozenRemainingMs ?? remaining,
        },
      };
    }
    case "resumed":
      return { ...state, paused: null };
    case "offline":
      return { ...state, offline: action.value };
    case "end":
      return { ...state, phase: "ended", end: action.payload, paused: null };
  }
}

const QUIET_ERRORS: RoomErrorCode[] = ["ROUND_CLOSED"];

/** Owns the Socket.io connection and turns the battle event contract into UI state. */
export function useBattle(intent: PlayIntent) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<BattleSocket | null>(null);
  const roomCodeRef = useRef<string | null>(null);
  const createdRef = useRef(false);
  const intentRef = useRef(intent);

  useEffect(() => {
    let socket: BattleSocket | null = null;
    let disposed = false;

    const start = (s: BattleSocket) => {
      const current = intentRef.current;
      if (roomCodeRef.current) {
        s.emit("room:rejoin", { roomCode: roomCodeRef.current });
      } else if (current.kind === "queue") {
        s.emit("queue:join", { subjectId: current.subjectId, topicId: current.topicId });
      } else if (current.kind === "create") {
        if (!createdRef.current) {
          createdRef.current = true;
          s.emit("room:create", { subjectId: current.subjectId, topicId: current.topicId });
        }
      } else {
        s.emit("room:join", { roomCode: current.roomCode });
      }
    };

    const rememberRoom = (roomCode: string) => {
      roomCodeRef.current = roomCode;
    };

    void (async () => {
      let response: Response;
      try {
        response = await fetch("/api/battle/token", { cache: "no-store" });
      } catch {
        if (!disposed) dispatch({ type: "error", message: "Couldn't reach Quizbo. Check your connection and try again." });
        return;
      }
      if (disposed) return;
      if (response.status === 401) return router.replace("/signin");
      if (response.status === 403) return router.replace("/onboarding");
      const body = (await response.json().catch(() => ({}))) as { token?: string; url?: string; error?: string };
      if (disposed) return;
      if (!response.ok || !body.token || !body.url) {
        dispatch({ type: "error", message: body.error ?? "The battle service is unavailable right now." });
        return;
      }

      socket = io(body.url, {
        auth: { token: body.token },
        transports: ["websocket", "polling"],
        reconnectionDelay: 400,
        reconnectionDelayMax: 2_500,
      });
      socketRef.current = socket;
      const s = socket;

      s.on("connect", () => {
        dispatch({ type: "offline", value: false });
        start(s);
      });
      s.on("disconnect", () => dispatch({ type: "offline", value: true }));
      s.on("connect_error", (error) => {
        if (error.message === "UNAUTHORIZED") {
          dispatch({ type: "error", message: "Your battle session expired. Refresh the page to reconnect." });
          s.disconnect();
        } else {
          dispatch({ type: "offline", value: true });
        }
      });
      s.on("session:active_room", ({ roomCode }) => {
        if (roomCodeRef.current === roomCode) return;
        rememberRoom(roomCode);
        s.emit("room:rejoin", { roomCode });
      });
      s.on("queue:status", (status) => dispatch({ type: "queue", status }));
      s.on("room:created", ({ roomCode, label }) => {
        rememberRoom(roomCode);
        window.history.replaceState(null, "", `/play/room/${roomCode}`);
        dispatch({ type: "created", roomCode, label });
      });
      s.on("room:state", (payload) => {
        rememberRoom(payload.roomCode);
        dispatch({ type: "state", payload });
      });
      s.on("match:found", (payload) => {
        rememberRoom(payload.roomCode);
        dispatch({ type: "found", payload });
      });
      s.on("room:ready", (payload) => dispatch({ type: "ready", payload }));
      s.on("question:next", (payload) => dispatch({ type: "question", payload }));
      s.on("answer:result", (payload) => dispatch({ type: "answer", payload }));
      s.on("round:result", (payload) => dispatch({ type: "round", payload }));
      s.on("boost:used", (payload) => dispatch({ type: "boostUsed", payload }));
      s.on("boost:applied", (payload) => dispatch({ type: "boostApplied", payload }));
      s.on("room:opponent_disconnected", (payload) => dispatch({ type: "paused", payload }));
      s.on("room:opponent_reconnected", () => dispatch({ type: "resumed" }));
      s.on("battle:end", (payload) => {
        roomCodeRef.current = null;
        dispatch({ type: "end", payload });
      });
      s.on("room:error", ({ code, message }) => {
        if (QUIET_ERRORS.includes(code)) return;
        if (code === "BOOST_UNAVAILABLE") dispatch({ type: "boostPending", boostId: null });
        if (code === "ALREADY_IN_ROOM") {
          // session:active_room already moved us back into the live battle.
          if (message.includes("another tab")) dispatch({ type: "error", message });
          return;
        }
        if (code === "ROOM_NOT_FOUND" || code === "ROOM_FULL" || code === "NOT_ENOUGH_QUESTIONS" || code === "NOT_IN_ROOM") {
          roomCodeRef.current = null;
          dispatch({ type: "error", message });
          return;
        }
        toast.error(message);
      });
    })();

    return () => {
      disposed = true;
      if (socket) {
        socket.emit("queue:leave");
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [router]);

  const answer = useCallback(
    (optionId: number) => {
      const question = state.question;
      if (!question || state.phase !== "battle" || state.picked !== null || state.paused || state.answer) return;
      dispatch({ type: "picked", optionId });
      socketRef.current?.emit("answer:submit", { roomCode: question.roomCode, optionId });
    },
    [state.question, state.phase, state.picked, state.paused, state.answer],
  );

  const fireBoost = useCallback(
    (boostId: BoostId) => {
      const question = state.question;
      if (!question || state.phase !== "battle" || state.picked !== null || state.paused || state.answer) return;
      if (state.boostPending || state.roundBoost?.used) return;
      dispatch({ type: "boostPending", boostId });
      socketRef.current?.emit("boost:use", { roomCode: question.roomCode, boostId });
    },
    [state.question, state.phase, state.picked, state.paused, state.answer, state.boostPending, state.roundBoost],
  );

  const leave = useCallback(() => {
    const socket = socketRef.current;
    if (state.phase === "queue" || state.phase === "connecting" || state.phase === "error") {
      socket?.emit("queue:leave");
      router.push("/dashboard");
      return;
    }
    if (state.roomCode && state.phase !== "ended") {
      socket?.emit("room:leave", { roomCode: state.roomCode });
      // Waiting rooms close quietly; leaving mid-battle is a forfeit and battle:end takes us to the result.
      if (state.phase === "waiting") router.push("/dashboard");
      return;
    }
    router.push("/dashboard");
  }, [state.phase, state.roomCode, router]);

  return { state, answer, fireBoost, leave };
}
