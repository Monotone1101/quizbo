"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { selectSubject } from "@/app/actions/preferences";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Option {
  id: string;
  label: string;
}

export function SubjectSwitcher({ current, options }: { current: Option | null; options: Option[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="btn btn-secondary w-full justify-between px-2.5 py-2 text-[14px]"
          disabled={pending || options.length === 0}
        >
          <span className="truncate">{current?.label ?? "No subjects yet"}</span>
          <span className="text-[11px] text-accent">{pending ? "…" : "CHANGE"}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[224px]">
        <DropdownMenuLabel>Battle subject</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onSelect={() =>
              startTransition(async () => {
                await selectSubject(option.id);
                router.refresh();
              })
            }
          >
            {option.label}
            {option.id === current?.id && <Check size={14} strokeWidth={1.5} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
