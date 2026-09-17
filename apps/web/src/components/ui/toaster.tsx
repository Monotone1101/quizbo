"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-left"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[340px] items-start gap-2.5 border border-divider bg-neutral-100 px-3.5 py-3 text-[13px] leading-snug text-text shadow-[var(--shadow-md)]",
          title: "font-heading text-[14px] font-semibold",
          description: "text-neutral-700",
          error: "border-accent",
        },
      }}
    />
  );
}
