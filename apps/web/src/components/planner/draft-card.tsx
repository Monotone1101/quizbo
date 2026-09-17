"use client";

import { formatDate } from "@quizbo/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmDraftAction, discardDraftAction } from "@/app/actions/planner";
import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import type { DraftCardView } from "@/lib/planner-types";
import { cn } from "@/lib/utils";

type Priority = "" | "HIGH" | "MEDIUM" | "LOW";
const PRIORITY_LABEL: Record<Exclude<Priority, "">, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

export function DraftCard({ card, index, total, today }: { card: DraftCardView; index: number; total: number; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const original = {
    subject: card.exam.subject,
    name: card.exam.exam_name ?? "",
    examDate: card.exam.exam_date ?? "",
    priority: (card.exam.priority?.toUpperCase() ?? "") as Priority,
    topics: card.exam.topics.join(", "),
  };
  const [values, setValues] = useState(original);
  const [draftValues, setDraftValues] = useState(original);
  const [editing, setEditing] = useState(card.manual || !card.exam.exam_date);
  const [edited, setEdited] = useState(false);

  const confidence = edited ? "set" : card.exam.date_confidence;
  const dateOk = Boolean(values.examDate) && values.examDate > today;
  const title = `${values.subject || "Subject"} — ${values.name || "Exam"}`;

  const confirm = () =>
    startTransition(async () => {
      const result = await confirmDraftAction({
        messageId: card.messageId,
        draftId: card.draftId,
        subject: values.subject,
        name: values.name,
        examDate: values.examDate,
        priority: values.priority || null,
        topics: values.topics
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        edited,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      router.refresh();
    });

  const discard = () =>
    startTransition(async () => {
      const result = await discardDraftAction(card.messageId, card.draftId);
      if (!result.ok) toast.error(result.message);
      router.refresh();
    });

  const saveEdits = () => {
    const changed = JSON.stringify(draftValues) !== JSON.stringify(values);
    setValues(draftValues);
    if (changed) setEdited(true);
    setEditing(false);
  };

  return (
    <Blueprint className={cn("card p-4", confidence === "inferred" && "border-accent")}>
      <div className="flex items-center justify-between gap-2">
        <div className="card-kicker">
          Exam {index + 1} of {total}
        </div>
        {confidence === "explicit" && <span className="tag tag-accent">DATE EXPLICIT</span>}
        {confidence === "inferred" && <span className="tag tag-inferred">DATE INFERRED</span>}
        {confidence === "missing" && <span className="tag tag-outline">DATE MISSING</span>}
        {confidence === "set" && <span className="tag tag-accent">EDITED BY YOU</span>}
      </div>

      {editing ? (
        <form
          className="mt-1 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            saveEdits();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
              Subject
              <input className="input" value={draftValues.subject} onChange={(e) => setDraftValues({ ...draftValues, subject: e.target.value })} required maxLength={60} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
              Exam name
              <input className="input" value={draftValues.name} placeholder="Unit test" onChange={(e) => setDraftValues({ ...draftValues, name: e.target.value })} maxLength={60} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
              Date
              <input
                className="input"
                type="date"
                min={today}
                value={draftValues.examDate}
                onChange={(e) => setDraftValues({ ...draftValues, examDate: e.target.value })}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
              Priority
              <select className="input" value={draftValues.priority} onChange={(e) => setDraftValues({ ...draftValues, priority: e.target.value as Priority })}>
                <option value="">Not stated (medium)</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
            Topics (comma-separated)
            <input className="input" value={draftValues.topics} placeholder="Optics, Wave optics" onChange={(e) => setDraftValues({ ...draftValues, topics: e.target.value })} />
          </label>
          <div className="mt-1 flex gap-2">
            <Button type="submit" variant="primary" className="flex-1">
              USE THESE DETAILS
            </Button>
            {!card.manual && card.exam.exam_date && (
              <Button
                onClick={() => {
                  setDraftValues(values);
                  setEditing(false);
                }}
              >
                CANCEL
              </Button>
            )}
            <Button variant="ghost" onClick={discard} disabled={pending}>
              DISCARD
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="card-title text-[20px]">{title}</div>
          <div className="mb-2 mt-1 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13px]">
            <span className="text-neutral-600">Date</span>
            {values.examDate ? (
              confidence === "inferred" ? (
                <span className="w-fit border-b border-dashed border-accent">
                  {formatDate(values.examDate)}
                  {card.exam.date_phrase ? ` — read from “${card.exam.date_phrase}”` : " — inferred"}
                </span>
              ) : (
                <span>{formatDate(values.examDate)}</span>
              )
            ) : (
              <span className="text-neutral-600">not stated — add one to confirm</span>
            )}
            <span className="text-neutral-600">Priority</span>
            {values.priority ? <span>{PRIORITY_LABEL[values.priority]}</span> : <span className="text-neutral-600">not stated</span>}
            <span className="text-neutral-600">Topics</span>
            <span>{values.topics || <span className="text-neutral-600">none named — the scheduler needs at least one</span>}</span>
          </div>
          {!edited && card.topicPreview.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-1">
              {card.topicPreview.map((preview) => (
                <span key={preview.query} className={cn("tag", preview.kind === "new" ? "tag-outline" : "tag-neutral")}>
                  {preview.detail}
                </span>
              ))}
            </div>
          )}
          {!edited && !card.subjectMatch && values.subject && (
            <div className="mb-1 text-[11px] text-neutral-600">“{values.subject}” isn&apos;t a Quizbo subject yet — confirming adds it for planning.</div>
          )}
          {!dateOk && values.examDate && <div className="text-[11px] text-accent-700">That date has already passed — edit it to confirm.</div>}
          <div className="mt-auto flex gap-2 pt-1">
            <Button variant="primary" className="flex-1" disabled={pending || !dateOk || !values.topics.trim()} onClick={confirm}>
              {pending ? "SAVING…" : confidence === "inferred" ? "CONFIRM DATE" : "CONFIRM"}
            </Button>
            <Button
              onClick={() => {
                setDraftValues(values);
                setEditing(true);
              }}
              disabled={pending}
            >
              EDIT
            </Button>
          </div>
        </>
      )}
    </Blueprint>
  );
}
