/**
 * Socket.io event contract shared by the battle service and the web client (architecture.md §3).
 * The per-event documentation — who emits, who listens, when — lives next to the handlers in
 * apps/battle/src/server.ts. Identity always comes from the authenticated socket, so the `userId`
 * and `playerName` fields the spec lists on client events are accepted but ignored by the server.
 */
import type { BoostId, BoostSlot } from "./boosts";

/** Short-lived HS256 token the web app signs and the battle service verifies (shared BATTLE_JWT_SECRET). */
export const BATTLE_TOKEN = {
  issuer: "quizbo-web",
  audience: "quizbo-battle",
  ttlSeconds: 2 * 60 * 60,
} as const;

export type BattleEndReasonWire = "hp_depleted" | "max_questions" | "opponent_forfeit";

export type RoomErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_PAYLOAD"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ALREADY_IN_ROOM"
  | "NOT_IN_ROOM"
  | "NOT_ENOUGH_QUESTIONS"
  | "ROUND_CLOSED"
  | "BOOST_UNAVAILABLE"
  | "SERVER_ERROR";

export type RoomPhase = "waiting" | "countdown" | "active" | "paused" | "ended";

export interface PublicPlayer {
  userId: string;
  name: string;
  rating: number;
  hp: number;
  streak: number;
  bestStreak: number;
  correct: number;
  connected: boolean;
  /** The hand dealt for this battle. Armed boosts are visible to both players. */
  boosts: BoostSlot[];
}

export interface QuestionOption {
  /** Stable option index in the bank; display order is shuffled per player. */
  id: number;
  text: string;
}

export interface QuestionPayload {
  roomCode: string;
  round: number;
  totalRounds: number;
  questionId: string;
  text: string;
  options: QuestionOption[];
  timeLimitMs: number;
  topicName: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  /** Present when re-sent after a pause and this player had already answered the round. */
  answered?: { optionId: number | null };
  /** Boost effects already applied to this player's round (re-sent questions keep them). */
  boost?: RoundBoost;
}

export interface RoundBoost {
  /** The boost fired this round, if any (one per round). */
  used: BoostId | null;
  /** Option ids removed by Fifty-Fifty. */
  hiddenOptionIds: number[];
  /** Extra answer time from Time Warp. */
  extraMs: number;
  overclock: boolean;
}

/** What a resolved answer did, for the hit, heal and block animations. */
export interface AnswerFx {
  damageToOpponent: number;
  damageToSelf: number;
  speedBonus: boolean;
  streakBonus: boolean;
  blocked: boolean;
  reflected: number;
  healed: number;
  doubled: boolean;
  anchored: boolean;
}

export interface EndPlayer {
  userId: string;
  name: string;
  hp: number;
  correct: number;
  bestStreak: number;
  eloBefore: number;
  eloAfter: number;
  eloDelta: number;
}

export interface ClientToServerEvents {
  "room:create": (payload: { subjectId: string; topicId?: string | null; userId?: string; playerName?: string }) => void;
  "room:join": (payload: { roomCode: string; userId?: string; playerName?: string }) => void;
  "room:rejoin": (payload: { roomCode: string; userId?: string }) => void;
  "room:leave": (payload: { roomCode: string }) => void;
  "answer:submit": (payload: { roomCode: string; optionId: number; timeTakenMs?: number }) => void;
  "boost:use": (payload: { roomCode: string; boostId: BoostId }) => void;
  "queue:join": (payload: { subjectId: string; topicId?: string | null }) => void;
  "queue:leave": () => void;
}

export interface ServerToClientEvents {
  "room:created": (payload: { roomCode: string; subjectId: string; topicId: string | null; label: string }) => void;
  "room:state": (payload: {
    roomCode: string;
    phase: RoomPhase;
    label: string;
    players: PublicPlayer[];
    round: number;
    totalRounds: number;
  }) => void;
  "room:ready": (payload: {
    roomCode: string;
    players: PublicPlayer[];
    startsInMs: number;
    totalRounds: number;
    label: string;
  }) => void;
  "question:next": (payload: QuestionPayload) => void;
  /** Private to the answering player: reveals the correct option only after they have committed. */
  "answer:result": (payload: {
    round: number;
    correct: boolean;
    optionId: number | null;
    correctOptionId: number;
    speedBonus: boolean;
    damageToOpponent: number;
    damageToSelf: number;
    fx: AnswerFx;
  }) => void;
  "round:result": (payload: {
    playerId: string;
    correct: boolean;
    timedOut: boolean;
    players: PublicPlayer[];
    fx: AnswerFx;
  }) => void;
  /** A player fired a boost. Sent to the room so both screens can play it. */
  "boost:used": (payload: { userId: string; boostId: BoostId; round: number; players: PublicPlayer[] }) => void;
  /** Private to the player who fired it: what changed on their own question. */
  "boost:applied": (payload: { round: number; boost: RoundBoost }) => void;
  "question:timeout": (payload: { round: number }) => void;
  "room:opponent_disconnected": (payload: { userId: string; graceMs: number }) => void;
  "room:opponent_reconnected": (payload: { userId: string }) => void;
  "battle:end": (payload: {
    roomCode: string;
    battleId: string | null;
    winnerId: string | null;
    reason: BattleEndReasonWire;
    players: EndPlayer[];
  }) => void;
  "room:error": (payload: { code: RoomErrorCode; message: string }) => void;
  "queue:status": (payload: {
    subjectId: string;
    topicId: string | null;
    waitedMs: number;
    band: number;
    nextBandInMs: number | null;
    queueSize: number;
    rating: number;
    ratingMin: number;
    ratingMax: number;
  }) => void;
  "match:found": (payload: { roomCode: string; opponent: { name: string; rating: number } }) => void;
  "session:active_room": (payload: { roomCode: string }) => void;
}
