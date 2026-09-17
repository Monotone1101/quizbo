import { coachReply, isAiConfigured, type CoachAttachment } from "@quizbo/ai";
import { prisma, type Prisma } from "@quizbo/db";
import { NextResponse } from "next/server";
import { toMessageView, type CoachThreadView } from "@/lib/coach-types";
import { buildCoachContext } from "@/lib/data/coach";
import { getActiveSubject } from "@/lib/data/subjects";
import { getViewer } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

async function viewerAndSubject() {
  const viewer = await getViewer();
  if (!viewer?.onboardedAt) return null;
  const { subject } = await getActiveSubject();
  return subject ? { viewer, subject } : null;
}

export async function GET() {
  const scope = await viewerAndSubject();
  if (!scope) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { viewer, subject } = scope;
  const [rows, { context, tone, weakTopic }] = await Promise.all([
    prisma.chatMessage.findMany({ where: { userId: viewer.id, channel: "COACH" }, orderBy: { createdAt: "desc" }, take: 40 }),
    buildCoachContext(viewer, subject),
  ]);
  const thread: CoachThreadView = {
    messages: rows.reverse().map(toMessageView),
    subjectName: subject.name,
    tone,
    matches: context.matchesPlayed,
    aiEnabled: isAiConfigured(),
    weakTopic,
  };
  return NextResponse.json(thread, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const scope = await viewerAndSubject();
  if (!scope) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { viewer, subject } = scope;

  const recent = await prisma.chatMessage.count({
    where: { userId: viewer.id, channel: "COACH", role: "USER", createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
  if (recent >= 8) return NextResponse.json({ error: "Slow down a little — try again in a minute." }, { status: 429 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Couldn't read that message." }, { status: 400 });
  }
  const text = String(form.get("message") ?? "").trim().slice(0, 4_000);
  const file = form.get("file");

  let attachment: CoachAttachment | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Files can be up to 4 MB." }, { status: 413 });
    const name = file.name.slice(0, 120) || "upload";
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(name);
    const isText = file.type.startsWith("text/") || /\.(txt|md|markdown)$/i.test(name);
    if (!isPdf && !isText) return NextResponse.json({ error: "Upload a PDF or a plain-text file." }, { status: 415 });
    const bytes = Buffer.from(await file.arrayBuffer());
    attachment = isPdf
      ? { name, mediaType: "application/pdf", data: bytes.toString("base64") }
      : { name, mediaType: "text/plain", data: bytes.toString("utf8") };
  }
  if (!text && !attachment) return NextResponse.json({ error: "Type a question or attach a file." }, { status: 400 });

  const message = text || `Summarise "${attachment?.name}" into note cards I can skim before a match.`;
  const [{ context, tone }, historyRows] = await Promise.all([
    buildCoachContext(viewer, subject),
    prisma.chatMessage.findMany({ where: { userId: viewer.id, channel: "COACH" }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const history = historyRows
    .reverse()
    .filter((row) => !(row.payload && typeof row.payload === "object" && "failed" in row.payload))
    .map((row) => ({ role: row.role === "USER" ? ("user" as const) : ("assistant" as const), content: row.content }));

  const userRow = await prisma.chatMessage.create({
    data: {
      userId: viewer.id,
      channel: "COACH",
      role: "USER",
      content: message,
      ...(attachment ? { payload: { attachment: { name: attachment.name } } } : {}),
    },
  });

  const result = await coachReply({ tone, context, history, message, attachment, signal: request.signal });
  if (!result.ok && result.reason !== "unconfigured") console.warn(`[coach] reply failed: ${result.reason}`);
  const payload: Prisma.InputJsonValue = result.ok
    ? {
        model: result.model,
        noteCards: result.noteCards.map((card) => ({
          ...card,
          source: attachment ? `from ${attachment.name}` : "from chat",
          state: "draft",
        })),
      }
    : { failed: true, reason: result.reason };

  const assistantRow = await prisma.chatMessage.create({
    data: {
      userId: viewer.id,
      channel: "COACH",
      role: "ASSISTANT",
      content: result.ok ? result.reply : result.message,
      payload,
    },
  });

  return NextResponse.json({ messages: [toMessageView(userRow), toMessageView(assistantRow)] });
}
