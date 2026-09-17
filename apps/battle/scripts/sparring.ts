/**
 * DEV ONLY — a sparring partner so you can play a full battle alone.
 *
 *   npm run sparring -w @quizbo/battle -- --room AB3XQ            join an invite room
 *   npm run sparring -w @quizbo/battle -- --queue                 queue for the default subject
 *   npm run sparring -w @quizbo/battle -- --queue --subject maths-12 --accuracy 0.4
 *   npm run sparring -w @quizbo/battle -- --queue --boosts 1           fire a boost every question
 *
 * It signs in as a separate demo user, answers after 2–7 s, and fires a boost now and then
 * (--boosts 0..1 sets how often; default 0.4). It reads the answer key from the
 * database to simulate an accuracy level, which a real client can never do — never run it against
 * production.
 */
import { config } from "../src/env";
import {
  BATTLE_TOKEN,
  BOOSTS,
  normalizeRoomCode,
  type BoostSlot,
  type ClientToServerEvents,
  type PublicPlayer,
  type ServerToClientEvents,
} from "@quizbo/core";
import { prisma } from "@quizbo/db";
import { SignJWT } from "jose";
import { io, type Socket } from "socket.io-client";

function flag(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const next = process.argv[index + 1];
  return next && !next.startsWith("--") ? next : "true";
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("The sparring partner is for local development only.");

  const room = flag("room");
  const queue = flag("queue");
  const accuracy = Math.min(1, Math.max(0, Number(flag("accuracy") ?? 0.6)));
  const boostRate = Math.min(1, Math.max(0, Number(flag("boosts") ?? 0.4)));
  const name = flag("name") ?? "Sparring Partner";
  const subjectSlug = flag("subject") ?? "physics-12";
  if (!room && !queue) throw new Error("Pass --room <CODE> or --queue");

  // --user-id plays as an existing account (e.g. your own demo user) for scripted end-to-end runs.
  const asUserId = flag("user-id");
  const user = asUserId
    ? await prisma.user.findUniqueOrThrow({ where: { id: asUserId } })
    : await prisma.user.upsert({
        where: { email: "sparring@demo.quizbo.local" },
        update: { name },
        create: { email: "sparring@demo.quizbo.local", name, isDemo: true, onboardedAt: new Date(), confidence: 3, motivationStyle: "COMPETITIVE" },
      });
  const displayName = asUserId ? (user.name ?? "Player") : name;

  const token = await new SignJWT({ name: displayName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(BATTLE_TOKEN.issuer)
    .setAudience(BATTLE_TOKEN.audience)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(config.jwtSecret));

  const url = process.env.NEXT_PUBLIC_BATTLE_URL ?? `http://localhost:${config.port}`;
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(url, { auth: { token }, transports: ["websocket"] });
  const log = (...parts: unknown[]) => console.info(`[sparring ${new Date().toISOString().slice(11, 19)}]`, ...parts);

  socket.on("connect", async () => {
    log(`connected as ${displayName} (${user.id})`);
    if (room) {
      const code = normalizeRoomCode(room);
      if (!code) throw new Error(`Invalid room code ${room}`);
      socket.emit("room:join", { roomCode: code });
    } else {
      const subject = await prisma.subject.findUnique({ where: { slug: subjectSlug } });
      if (!subject) throw new Error(`No subject ${subjectSlug}`);
      socket.emit("queue:join", { subjectId: subject.id, topicId: flag("topic") ?? null });
    }
  });
  socket.on("connect_error", (error) => log("connect error:", error.message));
  socket.on("queue:status", (s) => log(`queue: waited ${Math.round(s.waitedMs / 1000)}s band ±${s.band} size ${s.queueSize}`));
  socket.on("match:found", (m) => log(`match found vs ${m.opponent.name} (${m.opponent.rating}) in ${m.roomCode}`));
  let hand: BoostSlot[] = [];
  const track = (players: PublicPlayer[]) => {
    hand = players.find((p) => p.userId === user.id)?.boosts ?? hand;
  };
  socket.on("room:state", (r) => track(r.players));
  socket.on("boost:used", (b) => {
    track(b.players);
    log(`${b.userId === user.id ? "fired" : "opponent fired"} ${BOOSTS[b.boostId].name}`);
  });
  socket.on("room:ready", (r) => track(r.players));
  socket.on("room:ready", (r) => log(`ready: ${r.players.map((p) => p.name).join(" vs ")} · ${r.totalRounds} rounds`));
  socket.on("question:next", async (question) => {
    if (question.answered) return;
    const row = await prisma.question.findUnique({ where: { id: question.questionId }, select: { correctIndex: true } });
    const correct = row?.correctIndex ?? 0;
    const wrong = question.options.map((o) => o.id).filter((id) => id !== correct);
    const optionId = Math.random() < accuracy ? correct : (wrong[Math.floor(Math.random() * wrong.length)] ?? correct);
    const delay = 2_000 + Math.random() * 5_000;
    const ready = hand.filter((b) => b.state === "ready");
    const boost = ready[Math.floor(Math.random() * ready.length)];
    if (boost && Math.random() < boostRate) {
      setTimeout(() => socket.emit("boost:use", { roomCode: question.roomCode, boostId: boost.id }), Math.min(900, delay / 2));
    }
    setTimeout(() => socket.emit("answer:submit", { roomCode: question.roomCode, optionId }), delay);
    log(`Q${question.round}: answering in ${(delay / 1000).toFixed(1)}s`);
  });
  socket.on("round:result", (r) => track(r.players));
  socket.on("round:result", (r) => log(`HP ${r.players.map((p) => `${p.name} ${p.hp}`).join(" · ")}`));
  socket.on("room:opponent_disconnected", (p) => log(`opponent dropped — paused for ${p.graceMs / 1000}s`));
  socket.on("room:opponent_reconnected", () => log("opponent back"));
  socket.on("room:error", (e) => log(`error ${e.code}: ${e.message}`));
  socket.on("battle:end", async (end) => {
    log(`battle over (${end.reason}); winner ${end.winnerId === user.id ? displayName : end.winnerId ? "opponent" : "draw"}; battle ${end.battleId}`);
    socket.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
