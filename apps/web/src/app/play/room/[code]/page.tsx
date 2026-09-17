import { normalizeRoomCode } from "@quizbo/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayClient } from "@/components/play/play-client";
import { loadPlayerCard } from "@/lib/data/player-card";
import { getActiveSubject } from "@/lib/data/subjects";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Battle room" };

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const viewer = await requireViewer();
  const roomCode = normalizeRoomCode((await params).code);
  if (!roomCode) notFound();

  const { subject } = await getActiveSubject();
  const me = await loadPlayerCard(viewer, subject?.id ?? "");
  return <PlayClient intent={{ kind: "join", roomCode }} me={me} scopeLabel={null} />;
}
