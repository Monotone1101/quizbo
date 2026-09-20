"use client";

import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteNote } from "@/app/actions/notes";
import { Blueprint } from "@/components/ui/blueprint";

export interface NoteCardData {
  id: string;
  kicker: string;
  title: string;
  body: string;
  meta: string;
}

/**
 * A saved coach note. Discarding is a two-step confirm rather than a dialog: the note is gone for
 * good (the card lives in the coach thread, not here), and one stray click shouldn't delete it.
 */
export function NoteCard({ note }: { note: NoteCardData }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const discard = () => {
    startTransition(async () => {
      try {
        await deleteNote(note.id);
        toast.success("Note discarded");
      } catch {
        setConfirming(false);
        toast.error("Couldn't discard that note — try again.");
      }
    });
  };

  return (
    <Blueprint className="card group relative p-4">
      <div className="card-kicker pr-7">{note.kicker}</div>
      <div className="card-title">{note.title}</div>
      <p className="card-body">{note.body}</p>
      <div className="card-meta">{note.meta}</div>

      {confirming ? (
        <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-3 bg-surface p-4 text-center">
          <p className="text-[13px] text-neutral-700">Discard this note? It can&apos;t be undone.</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary text-[11px]" onClick={discard} disabled={pending}>
              {pending ? "DISCARDING…" : "DISCARD"}
            </button>
            <button type="button" className="btn text-[11px]" onClick={() => setConfirming(false)} disabled={pending}>
              KEEP
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Discard note: ${note.title}`}
          onClick={() => setConfirming(true)}
          className="absolute right-2 top-2 z-[2] grid h-6 w-6 place-items-center border border-transparent text-neutral-600 opacity-0 transition-[opacity,color,border-color] hover:border-divider hover:text-text focus-visible:border-divider focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </Blueprint>
  );
}
