"use client";

import { MATCHMAKING } from "@quizbo/core";
import { toast } from "sonner";
import { AsciiVideo } from "@/components/dashboard/ascii-video";
import { Corners } from "@/components/ui/blueprint";
import { BreathingGradient } from "./breathing-gradient";
import { useWallClock } from "./clocks";
import type { PlayIntent, PlayState } from "./use-battle";

const WHITE_MARK = "rgba(255,255,255,.6)";

function formatWait(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function MatchmakingScreen({
  state,
  intent,
  me,
  scopeLabel,
  onLeave,
}: {
  state: PlayState;
  intent: PlayIntent;
  me: { name: string; rating: number; rank: number; streak: number };
  scopeLabel: string | null;
  onLeave: () => void;
}) {
  const now = useWallClock(state.phase === "countdown");
  const invite = intent.kind !== "queue";
  const opponent =
    state.opponent ??
    (() => {
      const other = state.players.find((p) => p.name !== me.name && state.players.length > 1) ?? (state.players.length > 1 ? state.players[1] : undefined);
      return other ? { name: other.name, rating: other.rating } : null;
    })();
  const countdown = state.countdownEndsAt ? Math.max(0, Math.ceil((state.countdownEndsAt - now) / 1000)) : null;
  const queue = state.queue;

  let status = "CONNECTING…";
  if (state.phase === "queue") status = "SEARCHING…";
  if (state.phase === "waiting") status = "WAITING FOR OPPONENT";
  if (state.phase === "found") status = "MATCH FOUND";
  if (state.phase === "countdown") status = countdown ? `STARTING IN ${countdown}` : "GET READY";

  const searching = state.phase === "connecting" || state.phase === "queue" || state.phase === "waiting";
  const label = scopeLabel ?? state.label ?? "Physics";
  const shareUrl = state.roomCode && typeof window !== "undefined" ? `${window.location.origin}/play/room/${state.roomCode}` : null;

  let meta: string[] = [];
  if (state.phase === "queue" && queue) {
    const next = queue.nextBandInMs === null ? `BAND ±${queue.band} (MAX)` : `BAND ±${queue.band} → ±${queue.band + MATCHMAKING.bandStep}`;
    meta = [`WAITED ${formatWait(queue.waitedMs)}`, next, `${queue.queueSize} IN QUEUE`];
  } else if (state.phase === "waiting" && state.roomCode) {
    meta = [`ROOM ${state.roomCode}`, "SHARE THE CODE", "1V1 ONLY"];
  } else if (state.phase === "found" || state.phase === "countdown") {
    meta = ["BOTH PLAYERS IN", "INDEPENDENT QUESTION ORDER", "12S EACH"];
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b1a45] text-white">
      <BreathingGradient />
      <div className="qz-hatch-rev absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="relative flex min-h-screen flex-col px-6 py-[34px] sm:px-10">
        <div className="flex items-center gap-3.5">
          <div className="font-heading text-[19px] font-semibold tracking-[.02em]">QUIZBO</div>
          <span className="qz-lab text-white/60">
            {invite ? "Invite room" : "Matchmaking"} · {label}
          </span>
          <button type="button" className="btn btn-on-dark ml-auto" onClick={onLeave}>
            {state.phase === "found" || state.phase === "countdown" ? "LEAVE" : "CANCEL"}
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 items-center gap-7 py-10 lg:grid-cols-[minmax(0,1fr)_420px_minmax(0,1fr)] lg:py-0">
          <div className="text-center lg:text-right">
            <div className="qz-lab text-white/60">You</div>
            <div className="font-heading text-[40px] font-semibold leading-[1.05]">{me.name}</div>
            <div className="qz-num text-[62px] text-[#a9cfea]">{me.rating}</div>
            <div className="text-[13px] text-white/70">
              Rank {me.rank} weekly · {me.streak}-day streak
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="blueprint relative h-[300px] w-full border-white/40">
              <Corners color={WHITE_MARK} />
              <AsciiVideo />
              <div className="qz-lab absolute bottom-0 left-0 z-[2] bg-[rgba(14,21,29,.85)] px-[7px] py-[3px] text-white/80">ASCII · loop</div>
            </div>
            <div className={`font-heading text-[22px] font-semibold tracking-[.16em] ${searching ? "qz-pulse" : ""}`} aria-live="polite">
              {status}
            </div>
            <div className="h-[3px] w-full overflow-hidden bg-white/20">
              {searching ? <div className="qz-sweep h-full w-[40%] bg-[#3e92cc]" /> : <div className="h-full w-full bg-[#3e92cc]" />}
            </div>
            <div className="flex min-h-[18px] flex-wrap justify-center gap-5 text-[12px] text-white/75">
              {meta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <div className="text-center lg:text-left">
            <div className="qz-lab text-white/60">Opponent</div>
            {opponent ? (
              <>
                <div className="font-heading text-[40px] font-semibold leading-[1.05]">{opponent.name}</div>
                <div className="qz-num text-[62px] text-[#f07a98]">{opponent.rating}</div>
                <div className="text-[13px] text-white/70">Ready</div>
              </>
            ) : (
              <>
                <div className="font-heading text-[40px] font-semibold leading-[1.05] text-white/55">
                  {state.phase === "waiting" ? "Waiting…" : "Matching…"}
                </div>
                <div className="qz-num text-[62px] text-white/35">
                  {queue ? `${queue.ratingMin}–${queue.ratingMax}` : state.phase === "waiting" ? "——" : `${me.rating - 150}–${me.rating + 150}`}
                </div>
                <div className="text-[13px] text-white/70">
                  {state.phase === "waiting"
                    ? "Starts as soon as they join"
                    : queue?.nextBandInMs === null
                      ? "Band at maximum — closest player after 60s"
                      : "Band widens +50 every 5s"}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-[26px] gap-y-2 border-t border-white/20 pt-4 text-[12px] text-white/70">
          <span>15 questions max</span>
          <span>12s each</span>
          <span>Speed bonus under 4s</span>
          <span>Disconnect pauses the match for 20s</span>
          {state.roomCode && invite ? (
            <span className="ml-auto flex items-center gap-3">
              <span className="qz-num text-[18px] tracking-[.12em] text-white">ROOM {state.roomCode}</span>
              {shareUrl && (
                <button
                  type="button"
                  className="btn btn-on-dark text-[11px]"
                  onClick={() => {
                    void navigator.clipboard?.writeText(shareUrl).then(
                      () => toast.success("Invite link copied"),
                      () => toast.error("Copy failed — share the code instead"),
                    );
                  }}
                >
                  COPY LINK
                </button>
              )}
            </span>
          ) : (
            <span className="ml-auto">Room code will appear here for invite matches</span>
          )}
        </div>
      </div>
    </div>
  );
}
