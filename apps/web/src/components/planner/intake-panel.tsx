"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addManualDraftAction } from "@/app/actions/planner";
import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import type { IntakeMessageView } from "@/lib/planner-types";
import { cn } from "@/lib/utils";

export function IntakePanel({ messages, aiEnabled }: { messages: IntakeMessageView[]; aiEnabled: boolean }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOptimistic(null);
  }, [messages.length]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, optimistic, sending]);

  async function send() {
    const message = input.trim();
    if (!message || sending) return;
    setSending(true);
    setOptimistic(message);
    setInput("");
    try {
      const response = await fetch("/api/planner/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.ok && response.status !== 200) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (data.error) toast.error(data.error);
        if (response.status >= 400) {
          setOptimistic(null);
          setInput(message);
        }
      }
    } catch {
      toast.error("Couldn't reach Quizbo. Try again.");
      setOptimistic(null);
      setInput(message);
    } finally {
      setSending(false);
      startTransition(() => router.refresh());
    }
  }

  return (
    <Blueprint className="flex h-[560px] flex-col p-0 xl:h-[760px]">
      <div className="flex items-start gap-3 border-b border-divider px-4 py-3.5">
        <div>
          <div className="qz-lab">Exam intake</div>
          <div className="mt-0.5 text-[12px] text-neutral-600">Describe your exams. Nothing is saved until you confirm a card.</div>
        </div>
        <Button
          variant="ghost"
          className="ml-auto flex-none text-[11px]"
          onClick={() =>
            startTransition(async () => {
              const result = await addManualDraftAction();
              if (!result.ok) toast.error(result.message);
              router.refresh();
            })
          }
        >
          ADD EXAM
        </Button>
      </div>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {!aiEnabled && (
          <p className="m-0 border-l-2 border-accent pl-2.5 text-[12px] text-neutral-700">
            AI extraction is offline on this deployment. Use ADD EXAM to fill in a card by hand.
          </p>
        )}
        {messages.length === 0 && !optimistic && (
          <div className="flex">
            <div className="qz-bubble">
              Tell me about your exams — the subject, what it covers and when. For example: “Physics term 2 is on 18 October, mostly optics and
              wave optics.”
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={cn("flex", message.role === "user" && "justify-end")}>
            <div className={cn("qz-bubble", message.role === "user" && "qz-bubble-mine", message.failed && "text-neutral-600")}>{message.content}</div>
          </div>
        ))}
        {optimistic && (
          <div className="flex justify-end">
            <div className="qz-bubble qz-bubble-mine">{optimistic}</div>
          </div>
        )}
        {(sending || (refreshing && optimistic)) && (
          <div className="flex">
            <div className="qz-bubble qz-pulse">Reading your message…</div>
          </div>
        )}
      </div>

      <form
        className="flex gap-2 border-t border-divider px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          className="input"
          placeholder="Physics term 2 is on the 18th…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={sending}
          maxLength={2000}
        />
        <Button type="submit" variant="primary" disabled={sending || !input.trim()}>
          SEND
        </Button>
      </form>
    </Blueprint>
  );
}
