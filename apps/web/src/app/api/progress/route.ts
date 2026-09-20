import { NextResponse } from "next/server";
import { loadProgress } from "@/lib/data/progress";
import { getViewer } from "@/lib/session";

/** The signed-in player's progress as JSON: totals, ELO per battle per subject, topic mastery, weekly activity. */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in to see your progress." }, { status: 401 });
  return NextResponse.json(await loadProgress(viewer), { headers: { "cache-control": "no-store" } });
}
