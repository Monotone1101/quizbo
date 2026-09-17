import "server-only";

export interface BattleServiceStats {
  online: boolean;
  queued: number;
  rooms: number;
}

/** Reads the battle service's health endpoint for the live queue size. Never throws. */
export async function battleServiceStats(): Promise<BattleServiceStats> {
  const base = process.env.BATTLE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_BATTLE_URL;
  if (!base) return { online: false, queued: 0, rooms: 0 };
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/healthz`, { cache: "no-store", signal: AbortSignal.timeout(800) });
    if (!response.ok) throw new Error(String(response.status));
    const json = (await response.json()) as Partial<BattleServiceStats>;
    return { online: true, queued: Number(json.queued ?? 0), rooms: Number(json.rooms ?? 0) };
  } catch {
    return { online: false, queued: 0, rooms: 0 };
  }
}
