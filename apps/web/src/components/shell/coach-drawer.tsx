"use client";

import { Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { discardDraftNote, saveDraftNote } from "@/app/actions/notes";
import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import type { CoachMessageView, CoachThreadView } from "@/lib/coach-types";
import { cn } from "@/lib/utils";
import { useShell } from "./shell-context";

const ACCEPT = ".pdf,.txt,.md,application/pdf,text/plain,text/markdown";

export function CoachDrawer() {
  const { coachOpen, closeCoach, coachPrompt, consumeCoachPrompt } = useShell();
  const router = useRouter();
  const [thread, setThread] = useState<CoachThreadView | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!coachOpen || thread) return;
    let cancelled = false;
    setLoadError(false);
    fetch("/api/coach", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: CoachThreadView) => !cancelled && setThread(data))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [coachOpen, thread]);

  useEffect(() => {
    if (!coachOpen) return;
    if (coachPrompt) {
      setInput(coachPrompt);
      consumeCoachPrompt();
    }
    inputRef.current?.focus();
  }, [coachOpen, coachPrompt, consumeCoachPrompt]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [thread?.messages.length, sending, coachOpen]);

  useEffect(() => {
    if (!coachOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && closeCoach();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [coachOpen, closeCoach]);

  async function send(text: string) {
    const message = text.trim();
    if ((!message && !file) || sending) return;
    setSending(true);
    const body = new FormData();
    body.set("message", message);
    if (file) body.set("file", file);
    try {
      const response = await fetch("/api/coach", { method: "POST", body });
      const data = (await response.json()) as { messages?: CoachMessageView[]; error?: string };
      if (!response.ok || !data.messages) throw new Error(data.error ?? "The coach couldn't answer that.");
      setThread((current) => (current ? { ...current, messages: [...current.messages, ...data.messages!] } : current));
      setInput("");
      setFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The coach couldn't answer that.");
    } finally {
      setSending(false);
    }
  }

  async function decide(messageId: string, index: number, action: "save" | "discard") {
    const result = action === "save" ? await saveDraftNote(messageId, index) : await discardDraftNote(messageId, index);
    if (!result.ok) return;
    setThread((current) =>
      current
        ? {
            ...current,
            messages: current.messages.map((m) =>
              m.id === messageId
                ? { ...m, noteCards: m.noteCards.map((c, i) => (i === index ? { ...c, state: action === "save" ? "saved" : "discarded" } : c)) }
                : m,
            ),
          }
        : current,
    );
    if (action === "save") {
      toast.success("Saved to quick notes");
      router.refresh();
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  if (!coachOpen) return null;

  const weak = thread?.weakTopic;
  const chips = [
    weak ? `Why do I keep missing ${weak}?` : "What should I work on first?",
    weak ? `Quiz me on ${weak}` : "Quiz me on my last battle",
    "Summarise my last battle",
    "Explain simpler",
  ];

  return (
    <aside
      role="dialog"
      aria-label="Personal coach"
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-[382px] max-w-full flex-col border-l border-divider bg-neutral-100 shadow-[var(--shadow-lg)]",
        dragging && "outline outline-2 -outline-offset-4 outline-accent",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="flex items-start gap-2.5 border-b border-divider p-4">
        <div>
          <div className="font-heading text-[20px] font-semibold leading-none">PERSONAL COACH</div>
          <div className="mt-0.5 text-[11px] text-neutral-600">
            {thread ? `${thread.subjectName} · tone: ${thread.tone} · knows your last ${thread.matches} matches` : "Loading…"}
          </div>
        </div>
        <button type="button" className="btn btn-ghost ml-auto text-[16px] leading-none" onClick={closeCoach} aria-label="Close coach">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {loadError && <p className="text-[13px] text-neutral-700">Couldn&apos;t load the coach. Close and try again.</p>}
        {thread && !thread.aiEnabled && (
          <p className="border-l-2 border-accent pl-2.5 text-[12px] text-neutral-700">
            The coach is offline on this deployment (no Gemini API key). Everything else works.
          </p>
        )}
        {thread && thread.messages.length === 0 && (
          <div className="flex">
            <div className="qz-bubble">
              Ask about a mistake, or drop a chapter, PDF or your class notes here — I&apos;ll turn it into short cards you can skim before a match.
            </div>
          </div>
        )}
        {thread?.messages.map((message) => (
          <div key={message.id} className="flex flex-col gap-3">
            <div className={cn("flex", message.role === "user" && "justify-end")}>
              <div className={cn("qz-bubble", message.role === "user" && "qz-bubble-mine", message.failed && "text-neutral-600")}>
                {message.attachment && <div className="qz-lab mb-1 text-accent-700">📎 {message.attachment}</div>}
                {message.content}
              </div>
            </div>
            {message.noteCards.map((card, index) =>
              card.state === "discarded" ? null : (
                <Blueprint key={index} corners="diagonal" className="bg-bg p-3">
                  <div className="qz-lab mb-1.5 text-accent-700">{card.state === "saved" ? "Saved note card" : "Drafted note card"}</div>
                  <div className="font-heading text-[17px] font-semibold">{card.title}</div>
                  <div className="mt-1 text-[12px] text-neutral-800">{card.body}</div>
                  {card.state === "draft" && (
                    <div className="mt-2.5 flex gap-2">
                      <Button variant="primary" className="flex-1 text-[12px]" onClick={() => decide(message.id, index, "save")}>
                        SAVE TO QUICK NOTES
                      </Button>
                      <Button className="text-[12px]" onClick={() => decide(message.id, index, "discard")}>
                        DISCARD
                      </Button>
                    </div>
                  )}
                </Blueprint>
              ),
            )}
          </div>
        ))}
        {sending && (
          <div className="flex">
            <div className="qz-bubble qz-pulse">Thinking…</div>
          </div>
        )}
      </div>

      <div className="border-t border-divider px-4 py-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Button key={chip} size="sm" onClick={() => void send(chip)} disabled={sending || !thread}>
              {chip}
            </Button>
          ))}
        </div>
        {file && (
          <div className="mb-2 flex items-center gap-2 text-[12px]">
            <Paperclip size={13} strokeWidth={1.5} />
            <span className="truncate">{file.name}</span>
            <button type="button" className="btn btn-ghost ml-auto text-[11px]" onClick={() => setFile(null)}>
              REMOVE
            </button>
          </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <Button size="icon" className="flex-none" onClick={() => fileRef.current?.click()} aria-label="Attach a PDF or text file">
            <Paperclip size={16} strokeWidth={1.5} />
          </Button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept={ACCEPT}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <input
            ref={inputRef}
            className="input"
            placeholder="Ask, or drop a chapter…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={sending}
            maxLength={4000}
          />
          <Button variant="primary" type="submit" disabled={sending || (!input.trim() && !file)}>
            SEND
          </Button>
        </form>
        <div className="mt-2 text-[10px] text-neutral-600">
          Coach explains and summarises. It never writes the questions used in a live battle.
        </div>
      </div>
    </aside>
  );
}
