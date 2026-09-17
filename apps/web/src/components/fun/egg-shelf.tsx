"use client";

import { Egg } from "lucide-react";
import { useEffect, useState } from "react";
import { Blueprint } from "@/components/ui/blueprint";
import { EGG_EVENT, EGGS, foundEggs, type EggId } from "@/lib/easter-eggs";
import { cn } from "@/lib/utils";

/** Settings panel: which easter eggs this browser has found, with hints for the rest. */
export function EggShelf() {
  const [found, setFound] = useState<EggId[] | null>(null);

  useEffect(() => {
    const load = () => setFound(foundEggs());
    load();
    window.addEventListener(EGG_EVENT, load);
    return () => window.removeEventListener(EGG_EVENT, load);
  }, []);

  const count = found?.length ?? 0;
  return (
    <Blueprint className="p-5">
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <h4 className="mb-0">Easter eggs</h4>
        <span className="qz-num text-[18px] text-hot">
          {count} / {EGGS.length}
        </span>
        <span className="text-[13px] text-neutral-600">Hidden around Quizbo. Found ones are remembered on this device.</span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {EGGS.map((egg) => {
          const got = found?.includes(egg.id) ?? false;
          return (
            <div
              key={egg.id}
              className={cn(
                "flex items-start gap-2.5 border p-3",
                got ? "border-hot bg-hot-soft" : "border-dashed border-divider",
              )}
            >
              <Egg size={18} strokeWidth={1.5} className={cn("mt-0.5 flex-none", got ? "text-hot" : "text-neutral-500")} aria-hidden />
              <div className="min-w-0">
                <div className="font-heading text-[15px] font-semibold leading-tight">{got ? egg.name : "???"}</div>
                <div className="text-[12px] leading-snug text-neutral-600">{egg.hint}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Blueprint>
  );
}
