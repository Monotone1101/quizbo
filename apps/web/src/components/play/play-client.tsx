"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ScopeSubject } from "@/lib/data/battle-scopes";
import { BattleScreen } from "./battle-screen";
import { MatchmakingScreen } from "./matchmaking-screen";
import { useBattle, type PlayIntent } from "./use-battle";

export interface PlayClientProps {
  intent: PlayIntent;
  me: { userId: string; name: string; rating: number; rank: number; streak: number };
  scopeLabel: string | null;
  /** Queues a player may switch to while searching. Empty for invite rooms, whose scope is fixed. */
  scopes?: ScopeSubject[];
}

export function PlayClient({ intent, me, scopeLabel, scopes = [] }: PlayClientProps) {
  const router = useRouter();
  const { state, answer, fireBoost, leave, requeue } = useBattle(intent);

  useEffect(() => {
    if (state.phase !== "ended" || !state.end?.battleId) return;
    const timer = setTimeout(() => router.replace(`/battles/${state.end!.battleId}`), 1_800);
    return () => clearTimeout(timer);
  }, [state.phase, state.end, router]);

  if (state.phase === "error") {
    return (
      <div className="relative flex min-h-screen items-center justify-center qz-arena px-6 text-white">
        <div className="qz-hatch-rev absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="blueprint relative w-full max-w-[520px] border-white/40 p-8">
          <div className="qz-lab text-white/60">Battle</div>
          <h2 className="mt-1">Couldn&apos;t start that battle</h2>
          <p className="text-white/75">{state.error}</p>
          <div className="mt-5 flex gap-2">
            <Link href="/dashboard" className="btn btn-primary">
              BACK TO DASHBOARD
            </Link>
            <Link href="/play" className="btn btn-on-dark">
              FIND A MATCH
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === "battle" || state.phase === "ended") {
    return <BattleScreen state={state} meId={me.userId} onAnswer={answer} onBoost={fireBoost} onLeave={leave} />;
  }

  return (
    <MatchmakingScreen
      state={state}
      intent={intent}
      me={me}
      scopeLabel={scopeLabel}
      scopes={scopes}
      onScopeChange={requeue}
      onLeave={leave}
    />
  );
}
