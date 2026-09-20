"use client";

import { BATTLE_RULES, BOOSTS, type BoostId, type BoostSlot, type PublicPlayer } from "@quizbo/core";
import {
  Anchor,
  Droplet,
  Flame,
  FlipHorizontal2,
  Gauge,
  HeartPulse,
  Hourglass,
  Paintbrush,
  Shield,
  Split,
  Swords,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Confetti } from "@/components/fun/confetti";
import { Corners } from "@/components/ui/blueprint";
import { triggerEgg } from "@/lib/easter-eggs";
import { cn, formatSigned, pad } from "@/lib/utils";
import { useFrameClock, useWallClock } from "./clocks";
import type { PlayState } from "./use-battle";

const LETTERS = ["A", "B", "C", "D"];
const BOOST_KEYS = ["Q", "W", "E"];
const MAGENTA = "#d8315b";
const BELL = "#3e92cc";
const GHOST = "#fffaff";
/** Answers faster than this are "lightning" (an easter egg). */
const LIGHTNING_MS = 1_000;

export const BOOST_ICON: Record<BoostId, LucideIcon> = {
  shield: Shield,
  double: Swords,
  fifty: Split,
  warp: Hourglass,
  medkit: HeartPulse,
  mirror: FlipHorizontal2,
  anchor: Anchor,
  vampire: Droplet,
  ink: Paintbrush,
  overclock: Gauge,
};

type Floater = { id: number; userId: string; text: string; color: string };
type Stamp = { key: number; text: string; color: string };
type Banner = { key: number; text: string; boostId: BoostId; mine: boolean };

// ── pieces ──────────────────────────────────────────────────────────────────────────────────

function HpBar({ player, side, hit, floaters }: { player?: PublicPlayer; side: "left" | "right"; hit: number; floaters: Floater[] }) {
  const hp = Math.max(0, Math.min(100, player?.hp ?? 100));
  const armed = (id: BoostId) => player?.boosts?.some((b) => b.id === id && b.state === "armed") ?? false;
  const mine = side === "left";
  return (
    <div className="relative mt-2">
      <div
        className={cn("qz-hp", armed("shield") && "qz-hp-shield", armed("mirror") && "qz-hp-mirror", hit > 0 && "qz-quake")}
        key={hit}
        data-low={hp > 0 && hp <= 30}
      >
        <div className="qz-hp-ghost" style={{ width: `${hp}%`, [side]: 0, background: mine ? MAGENTA : GHOST }} />
        <div
          className="qz-hp-fill"
          style={{
            width: `${hp}%`,
            [side]: 0,
            background: mine ? `linear-gradient(90deg, ${BELL}, #a9cfea)` : `linear-gradient(270deg, ${MAGENTA}, #f07a98)`,
          }}
        />
        {hit > 0 && <div className="qz-hit absolute inset-0 bg-white" />}
        <div
          className={cn("qz-num absolute top-[4px] text-[15px] text-white [text-shadow:0_1px_4px_rgba(0,0,0,.6)]", mine ? "left-[9px]" : "right-[9px]")}
        >
          {hp} HP
        </div>
      </div>
      {floaters.map((f) => (
        <span key={f.id} className={cn("qz-float -top-8", mine ? "left-[30%]" : "right-[30%]")} style={{ color: f.color }}>
          {f.text}
        </span>
      ))}
      <HandPips boosts={player?.boosts ?? []} align={side} />
    </div>
  );
}

function HandPips({ boosts, align }: { boosts: BoostSlot[]; align: "left" | "right" }) {
  if (boosts.length === 0) return null;
  return (
    <div className={cn("mt-2 flex gap-1.5", align === "right" && "justify-end")}>
      {boosts.map((slot) => {
        const Icon = BOOST_ICON[slot.id];
        return (
          <span key={slot.id} className="qz-pip" data-state={slot.state} title={`${BOOSTS[slot.id].name} · ${slot.state}`}>
            <Icon size={12} strokeWidth={1.75} aria-hidden />
            <span className="sr-only">
              {BOOSTS[slot.id].name} ({slot.state})
            </span>
          </span>
        );
      })}
    </div>
  );
}

function StreakChip({ streak, mine }: { streak: number; mine: boolean }) {
  const hot = streak >= 3;
  return (
    <span
      className={cn("tag gap-1", mine && "ml-1.5", hot && "qz-pulse")}
      style={{ background: hot ? MAGENTA : mine ? "rgba(62,146,204,.35)" : "rgba(255,250,255,.16)", color: GHOST }}
    >
      {hot && <Flame size={12} strokeWidth={2} aria-hidden />}×{streak} STREAK
    </span>
  );
}

function InkSplat() {
  return (
    <svg className="qz-ink" viewBox="0 0 400 240" preserveAspectRatio="none" aria-hidden>
      <g fill="#1e1b18">
        <circle cx="90" cy="80" r="62" />
        <circle cx="150" cy="120" r="48" />
        <circle cx="250" cy="70" r="70" />
        <circle cx="320" cy="150" r="56" />
        <circle cx="200" cy="170" r="60" />
        <circle cx="60" cy="170" r="34" />
        <rect x="236" y="120" width="10" height="90" rx="5" />
        <rect x="120" y="140" width="8" height="70" rx="4" />
        <circle cx="241" cy="212" r="9" />
        <circle cx="124" cy="212" r="7" />
      </g>
      <g fill={MAGENTA} opacity="0.85">
        <circle cx="255" cy="72" r="14" />
        <circle cx="96" cy="84" r="9" />
        <circle cx="330" cy="40" r="6" />
        <circle cx="30" cy="110" r="5" />
      </g>
      <text x="200" y="128" textAnchor="middle" fill={GHOST} fontSize="22" fontFamily="var(--font-heading)" fontWeight="600">
        SPLAT!
      </text>
    </svg>
  );
}

function Burst({ color }: { color: string }) {
  const sparks = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2;
    const reach = 120 + (i % 3) * 50;
    return { dx: Math.cos(angle) * reach, dy: Math.sin(angle) * reach, color: i % 2 ? color : GHOST };
  });
  return (
    <div className="qz-burst" aria-hidden>
      {sparks.map((s, i) => (
        <i key={i} style={{ background: s.color, "--dx": `${s.dx}px`, "--dy": `${s.dy}px` } as CSSProperties} />
      ))}
    </div>
  );
}

function Bolt() {
  return (
    <svg className="qz-bolt" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <rect width="100" height="100" fill="rgba(169,207,234,.18)" />
      <polyline points="58,0 44,38 56,40 38,100" fill="none" stroke={GHOST} strokeWidth="1.4" />
      <polyline points="58,0 44,38 56,40 38,100" fill="none" stroke={BELL} strokeWidth="4" opacity="0.5" />
    </svg>
  );
}

// ── screen ──────────────────────────────────────────────────────────────────────────────────

export function BattleScreen({
  state,
  meId,
  onAnswer,
  onBoost,
  onLeave,
}: {
  state: PlayState;
  meId: string;
  onAnswer: (optionId: number) => void;
  onBoost: (boostId: BoostId) => void;
  onLeave: () => void;
}) {
  const { question, paused, answer, picked, roundBoost } = state;
  const running = state.phase === "battle" && !paused && Boolean(question);
  const now = useFrameClock(running);
  const wall = useWallClock(Boolean(paused) || state.phase === "ended");

  const me = state.players.find((p) => p.userId === meId);
  const opponent = state.players.find((p) => p.userId !== meId);
  const limit = (question?.timeLimitMs ?? BATTLE_RULES.timeLimitMs) + (roundBoost?.extraMs ?? 0);
  const remaining = paused ? paused.frozenRemainingMs : question ? Math.max(0, limit - (now - state.receivedAt)) : 0;
  const elapsed = question ? now - state.receivedAt : 0;
  const overclocked = Boolean(roundBoost?.overclock);
  const speedBonusLive = overclocked || elapsed < BATTLE_RULES.speedBonusWindowMs;
  const locked = picked !== null || Boolean(answer) || Boolean(paused) || state.phase !== "battle";
  const boostLocked = locked || Boolean(roundBoost?.used) || Boolean(state.boostPending);
  const opponentAnswered = opponent ? state.answeredThisRound.includes(opponent.userId) : false;
  const hidden = roundBoost?.hiddenOptionIds ?? [];
  const hand = me?.boosts ?? [];

  // ── effects ──
  const [quake, setQuake] = useState(0);
  const [vignette, setVignette] = useState(0);
  const [flash, setFlash] = useState(0);
  const [bolt, setBolt] = useState(0);
  const [burst, setBurst] = useState<Stamp | null>(null);
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [inkUntil, setInkUntil] = useState(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const pickedAfter = useRef<number | null>(null);
  const floaterId = useRef(0);

  const float = (hpBefore: Record<string, number>) => {
    const next: Floater[] = [];
    for (const player of state.players) {
      const delta = player.hp - (hpBefore[player.userId] ?? player.hp);
      if (delta === 0) continue;
      next.push({
        id: ++floaterId.current,
        userId: player.userId,
        text: delta > 0 ? `+${delta}` : `−${-delta}`,
        color: delta > 0 ? "#a9cfea" : player.userId === meId ? MAGENTA : "#f07a98",
      });
    }
    if (next.length === 0) return;
    setFloaters((all) => [...all, ...next]);
    const ids = new Set(next.map((f) => f.id));
    window.setTimeout(() => setFloaters((all) => all.filter((f) => !ids.has(f.id))), 1_200);
  };

  const lastRoundSeq = state.lastRound?.seq ?? 0;
  useEffect(() => {
    const round = state.lastRound;
    if (!round) return;
    const key = round.seq;
    const { fx } = round;
    float(round.hpBefore);
    const hurt = () => {
      setQuake(key);
      setVignette(key);
    };
    if (round.playerId === meId) {
      if (round.correct) {
        const quick = pickedAfter.current !== null && pickedAfter.current < LIGHTNING_MS;
        if (fx.blocked) setStamp({ key, text: "BLOCKED!", color: BELL });
        else if (quick) {
          setBolt(key);
          setStamp({ key, text: "LIGHTNING!", color: BELL });
          triggerEgg("lightning");
        } else if (fx.doubled) setStamp({ key, text: "DOUBLE TAP ×2", color: MAGENTA });
        else if (fx.speedBonus) setStamp({ key, text: "QUICK!", color: BELL });
        else if ((me?.streak ?? 0) >= 3) setStamp({ key, text: `×${me?.streak} STREAK`, color: MAGENTA });
        if (fx.speedBonus || quick) {
          setFlash(key);
          setBurst({ key, text: "", color: fx.doubled ? MAGENTA : BELL });
        }
        if (fx.reflected > 0) {
          hurt();
          setStamp({ key, text: `MIRRORED −${fx.reflected}`, color: MAGENTA });
        }
      } else if (fx.blocked) {
        setStamp({ key, text: "SHIELDED", color: BELL });
      } else {
        hurt();
        if (fx.anchored) setStamp({ key, text: "STREAK ANCHORED", color: BELL });
      }
    } else if (round.correct) {
      if (fx.blocked) setStamp({ key, text: "BLOCKED!", color: BELL });
      else if (fx.reflected > 0) setStamp({ key, text: `MIRRORED ${fx.reflected} BACK`, color: BELL });
      if (fx.damageToOpponent > 0) hurt();
      if (fx.doubled && fx.damageToOpponent > 0) setStamp({ key, text: "OUCH ×2", color: MAGENTA });
    }
    // Effects depend only on the new round event; the other values are read from this render.
  }, [lastRoundSeq]);

  const lastBoostSeq = state.lastBoost?.seq ?? 0;
  useEffect(() => {
    const fired = state.lastBoost;
    if (!fired) return;
    const mine = fired.userId === meId;
    const who = mine ? "You" : (opponent?.name ?? "Opponent");
    setBanner({ key: fired.seq, text: `${who} fired ${BOOSTS[fired.boostId].name}`, boostId: fired.boostId, mine });
    float(fired.hpBefore);
    if (!mine && fired.boostId === "ink") setInkUntil(Date.now() + 3_000);
    // (Keyed on the event number only: everything else is read from this render.)
  }, [lastBoostSeq]);

  useEffect(() => {
    if (!question) return;
    pickedAfter.current = null;
  }, [question?.round]);

  const inked = inkUntil > 0;
  useEffect(() => {
    if (!inkUntil) return;
    const timer = window.setTimeout(() => setInkUntil(0), Math.max(0, inkUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [inkUntil]);

  const choose = (optionId: number) => {
    if (locked || hidden.includes(optionId)) return;
    pickedAfter.current = elapsed;
    onAnswer(optionId);
  };

  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});
  keyHandler.current = (event: KeyboardEvent) => {
      if (!question || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      const boostIndex = ["q", "w", "e"].indexOf(key);
      if (boostIndex >= 0) {
        const slot = hand[boostIndex];
        if (slot && slot.state === "ready" && !boostLocked) onBoost(slot.id);
        return;
      }
      if (locked) return;
      const index = ["1", "2", "3", "4"].indexOf(key) >= 0 ? ["1", "2", "3", "4"].indexOf(key) : ["a", "b", "c", "d"].indexOf(key);
      const option = index >= 0 ? question.options[index] : undefined;
      if (option) choose(option.id);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const optionState = (optionId: number) => {
    if (answer) {
      if (optionId === answer.correctOptionId) return "correct";
      if (optionId === answer.optionId) return "wrong";
      return hidden.includes(optionId) ? "gone" : "dim";
    }
    if (hidden.includes(optionId)) return "gone";
    if (picked !== null) return optionId === picked ? "picked" : "dim";
    return undefined;
  };

  let statusLine = "";
  if (answer) {
    const fx = answer.fx;
    if (answer.correct) {
      statusLine = fx.blocked
        ? "Correct — but their Bubble Shield soaked it"
        : `Correct — ${fx.damageToOpponent} damage${fx.speedBonus ? " · speed bonus" : ""}${fx.doubled ? " · doubled" : ""}${fx.healed ? ` · +${fx.healed} HP` : ""}`;
    } else if (answer.optionId === null) statusLine = fx.blocked ? "Out of time — your shield took it" : `Out of time — −${fx.damageToSelf} HP`;
    else statusLine = fx.blocked ? "Wrong — your shield took it" : `Wrong — −${fx.damageToSelf} HP`;
    if (!opponentAnswered && state.phase === "battle") statusLine += " · waiting for opponent…";
  } else if (picked !== null) {
    statusLine = "Locked in…";
  } else if (opponentAnswered) {
    statusLine = "Opponent has answered — hurry!";
  }

  const end = state.end;
  const myEnd = end?.players.find((p) => p.userId === meId);
  const outcome = !end ? null : end.winnerId === null ? "DRAW" : end.winnerId === meId ? "VICTORY" : "DEFEAT";
  const endEgg =
    !end || !myEnd || end.winnerId !== meId || end.reason === "opponent_forfeit"
      ? null
      : myEnd.hp >= BATTLE_RULES.startHp
        ? "flawless"
        : myEnd.hp <= 10
          ? "clutch"
          : null;
  useEffect(() => {
    if (endEgg) triggerEgg(endEgg);
  }, [endEgg]);

  const onFire = (me?.streak ?? 0) >= 5;
  const timeLow = remaining > 0 && remaining < 3_000 && !answer && picked === null;

  return (
    <div
      className={cn(
        "qz-arena relative flex min-h-screen flex-col overflow-hidden px-3 py-4 text-white sm:px-10 sm:py-[30px]",
        quake > 0 && (quake % 2 ? "qz-quake" : "qz-quake-b"),
      )}
      data-heat={onFire ? "fire" : undefined}
    >
      {vignette > 0 && <div key={`v${vignette}`} className="qz-vignette" aria-hidden />}
      {flash > 0 && <div key={`f${flash}`} className="qz-flashbang" aria-hidden />}
      {bolt > 0 && <Bolt key={`b${bolt}`} />}
      {burst && <Burst key={`u${burst.key}`} color={burst.color} />}
      {stamp && (
        <div key={`s${stamp.key}-${stamp.text}`} className="qz-stamp" style={{ textShadow: `0 0 24px ${stamp.color}, 0 0 60px ${stamp.color}` }} aria-hidden>
          {stamp.text}
        </div>
      )}
      {banner && (
        <div key={`n${banner.key}`} className="qz-banner" role="status">
          {(() => {
            const Icon = BOOST_ICON[banner.boostId];
            return <Icon size={18} strokeWidth={1.75} aria-hidden />;
          })()}
          <span className="font-heading text-[17px] font-semibold tracking-[.02em]">{banner.text}</span>
        </div>
      )}
      {outcome === "VICTORY" && !endEgg && <Confetti />}

      <div className="relative z-10 flex items-start gap-3 sm:gap-9">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="truncate font-heading text-[17px] font-semibold sm:text-[22px]">{me?.name ?? "You"}</span>
            <span className="qz-num hidden text-[13px] text-white/60 sm:inline">{me?.rating ?? ""}</span>
            {(me?.streak ?? 0) > 0 && <StreakChip streak={me?.streak ?? 0} mine />}
            {onFire && <span className="chip qz-pulse bg-hot text-white">ON FIRE</span>}
          </div>
          <HpBar player={me} side="left" hit={state.hits[meId] ?? 0} floaters={floaters.filter((f) => f.userId === meId)} />
        </div>
        <div className="w-[72px] flex-none text-center sm:w-[180px]">
          <div className="qz-lab text-white/60">Question</div>
          <div className="qz-num text-[20px] sm:text-[30px]">
            {pad(question?.round ?? 0)} / {pad(state.totalRounds || question?.totalRounds || 0)}
          </div>
        </div>
        <div className="min-w-0 flex-1 text-right">
          <div className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-1">
            {(opponent?.streak ?? 0) > 0 && <StreakChip streak={opponent?.streak ?? 0} mine={false} />}
            <span className="qz-num hidden text-[13px] text-white/60 sm:inline">{opponent?.rating ?? ""}</span>
            <span className="truncate font-heading text-[17px] font-semibold sm:text-[22px]">
              {opponent?.name ?? "Opponent"}
              {opponent && !opponent.connected && <span className="ml-2 text-[13px] text-white/60">(offline)</span>}
            </span>
          </div>
          <HpBar
            player={opponent}
            side="right"
            hit={opponent ? (state.hits[opponent.userId] ?? 0) : 0}
            floaters={floaters.filter((f) => f.userId !== meId)}
          />
        </div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-[22px] py-5">
        {(paused || state.offline) && state.phase !== "ended" && (
          <div className="blueprint w-[900px] max-w-full border-bell bg-[rgba(10,36,99,.7)] px-5 py-3" role="status">
            <Corners set="diagonal" color={BELL} />
            <div className="qz-lab text-[#a9cfea]">{state.offline ? "Connection lost" : "Clock paused"}</div>
            <div className="text-[14px]">
              {state.offline
                ? "Reconnecting… your answers and HP are safe."
                : `Opponent disconnected. Waiting ${Math.max(0, Math.ceil((paused!.graceEndsAt - wall) / 1000))}s for them to rejoin before it counts as a forfeit.`}
            </div>
          </div>
        )}

        {end ? (
          <div
            className={cn(
              "blueprint w-[900px] max-w-full border-white/45 bg-[rgba(10,36,99,.45)] px-4 py-6 text-center sm:px-[34px] sm:py-[30px]",
              outcome === "DEFEAT" && "grayscale-[60%]",
            )}
          >
            <Corners color="rgba(255,250,255,.7)" />
            <div className="qz-lab text-white/60">
              {end.reason === "opponent_forfeit" ? "Won by forfeit" : end.reason === "hp_depleted" ? "Knockout" : "Full distance"}
            </div>
            <div
              className="mt-1 font-heading text-[64px] font-semibold leading-none"
              style={{ color: outcome === "VICTORY" ? GHOST : outcome === "DEFEAT" ? "#f07a98" : "#a9cfea", textShadow: outcome === "VICTORY" ? `0 0 30px ${BELL}` : undefined }}
            >
              {outcome}
            </div>
            {endEgg && (
              <div className="qz-pulse mt-2 inline-flex items-center gap-1.5 bg-hot px-3 py-1 font-heading text-[18px] font-semibold tracking-[.08em]">
                <Zap size={16} aria-hidden /> {endEgg === "flawless" ? "FLAWLESS" : "CLUTCH"}
              </div>
            )}
            {myEnd && <div className="qz-num mt-3 text-[26px] text-[#a9cfea]">{formatSigned(myEnd.eloDelta)} ELO</div>}
            <div className="mt-3 text-[13px] text-white/70">
              {end.battleId ? "Opening your breakdown…" : "The result couldn't be saved. Your rating didn't change."}
            </div>
          </div>
        ) : (
          <>
            <div className="flex w-[900px] max-w-full flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-4">
              <span className="qz-lab order-1 min-w-0 flex-1 truncate text-white/60 sm:order-none sm:flex-none">
                {question?.topicName ?? "Get ready"}
              </span>
              <div className="order-3 h-1.5 w-full flex-1 overflow-hidden bg-white/16 sm:order-none sm:w-auto">
                <div
                  className={cn("h-full", roundBoost?.extraMs ? "qz-warp" : timeLow && "qz-pulse")}
                  style={{
                    width: `${question ? (remaining / limit) * 100 : 100}%`,
                    background: timeLow ? MAGENTA : `linear-gradient(90deg, ${BELL}, #a9cfea)`,
                  }}
                />
              </div>
              <span className={cn("qz-num order-2 w-[58px] flex-none text-right text-[22px] sm:order-none sm:w-[64px] sm:text-[26px]", timeLow && "text-[#f07a98]")}>
                {(remaining / 1000).toFixed(1)}s
              </span>
              <span
                className={cn("tag order-4 flex-none gap-1 sm:order-none", overclocked && "qz-pulse")}
                style={{ background: overclocked ? MAGENTA : speedBonusLive && !paused ? "rgba(62,146,204,.45)" : "rgba(255,250,255,.12)", color: GHOST }}
              >
                <Zap size={11} aria-hidden />
                <span className="sm:hidden">{overclocked ? "OVERCLOCK" : speedBonusLive && !paused ? "SPEED ON" : "SPEED GONE"}</span>
                <span className="hidden sm:inline">
                  {overclocked ? "OVERCLOCKED" : speedBonusLive && !paused ? "SPEED BONUS ON" : "SPEED BONUS GONE"}
                </span>
              </span>
            </div>

            <div className="relative w-[900px] max-w-full">
              {inked && <InkSplat key={inkUntil} />}
              <div
                key={answer ? `${question?.round}-${answer.correct}` : `q-${question?.round}`}
                className={cn(
                  "blueprint border-white/40 bg-[rgba(10,36,99,.35)] px-4 py-5 backdrop-blur-[2px] sm:px-[34px] sm:py-[30px]",
                  answer && (answer.correct ? "qz-flash-correct" : "qz-flash-wrong"),
                )}
              >
                <Corners color="rgba(255,250,255,.7)" />
                <div className="qz-lab mb-2.5 text-white/60">
                  {question ? `Q${question.round} · ${question.difficulty} · validated` : "Waiting for the first question"}
                </div>
                <div className="font-heading text-[26px] font-semibold leading-[1.15] sm:text-[34px]" data-grid-avoid>
                  {question?.text ?? "…"}
                </div>
              </div>

              <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {question?.options.map((option, index) => (
                  <button
                    key={`${question.round}-${option.id}`}
                    type="button"
                    className="qz-opt"
                    data-state={optionState(option.id)}
                    disabled={locked || hidden.includes(option.id)}
                    onClick={() => choose(option.id)}
                  >
                    <span className="qz-num flex-none text-[20px] opacity-70">{LETTERS[index]}</span>
                    <span className="text-left text-[16px] leading-[1.3]">{option.text}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-[20px] text-[14px] text-white/85" aria-live="polite">
              {statusLine}
            </div>

            {hand.length > 0 && (
              <div className="w-[900px] max-w-full">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="qz-lab text-white/60">
                    Your boosts <span className="hidden sm:inline">· one per question, before you answer</span>
                  </span>
                  <span className="qz-lab hidden text-white/40 sm:inline">Keys Q · W · E</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                  {hand.map((slot, index) => {
                    const Icon = BOOST_ICON[slot.id];
                    const fired = state.lastBoost?.userId === meId && state.lastBoost.boostId === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        className="qz-boost flex-col gap-1.5 px-2 py-2 text-center sm:flex-row sm:gap-2.5 sm:px-3 sm:py-2.5 sm:text-left"
                        data-state={slot.state}
                        data-fired={fired || undefined}
                        disabled={slot.state !== "ready" || boostLocked}
                        onClick={() => onBoost(slot.id)}
                        title={BOOSTS[slot.id].blurb}
                      >
                        <span className="qz-boost-icon">
                          <Icon size={16} strokeWidth={1.75} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-heading text-[13px] font-semibold leading-tight sm:text-[15px]">
                            {BOOSTS[slot.id].name}
                          </span>
                          {/* The blurb needs room; on a phone the card is a third of the width, so it is dropped. */}
                          <span className="hidden truncate text-[11px] leading-snug text-white/65 sm:block">
                            {slot.state === "armed" ? "Armed — waiting for its moment" : slot.state === "spent" ? "Used" : BOOSTS[slot.id].blurb}
                          </span>
                        </span>
                        <span className="qz-num hidden flex-none text-[13px] text-white/45 sm:inline">{BOOST_KEYS[index]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-x-[26px] gap-y-2 border-t border-white/22 pt-3.5 text-[12px] text-white/70">
        <span>ROOM {state.roomCode ?? question?.roomCode ?? "—"}</span>
        <span>Correct hits opponent · wrong hits you</span>
        <span className="hidden md:inline">Keys 1–4 answer · Q W E boost</span>
        {state.phase !== "ended" && (
          <button type="button" className="btn btn-on-dark ml-auto" onClick={onLeave}>
            LEAVE MATCH
          </button>
        )}
      </div>
    </div>
  );
}
