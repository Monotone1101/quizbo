"use client";

import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ScopeSubject, ScopeTopic } from "@/lib/data/battle-scopes";
import { cn } from "@/lib/utils";

/**
 * Subject + topic pickers for the arena. Native <select> popups take the page's white text into the
 * OS menu and become unreadable on the dark arena, so these are the app's Radix menu restyled for
 * the dark surface — same square, hairline shape language as every other menu.
 */
export function ScopePicker({
  scopes,
  subject,
  topic,
  onChange,
  variant = "bar",
  className,
}: {
  scopes: ScopeSubject[];
  subject: ScopeSubject;
  topic: ScopeTopic | null;
  onChange: (subjectId: string, topicId: string | null) => void;
  /** "bar" sits in the header while searching; "panel" is the pre-match setup. */
  variant?: "bar" | "panel";
  className?: string;
}) {
  const panel = variant === "panel";
  return (
    <div className={cn(panel ? "grid w-full gap-3 sm:grid-cols-2" : "flex flex-wrap items-center gap-2", className)}>
      <Field label="Subject" panel={panel}>
        <Menu
          panel={panel}
          value={subject.name}
          hint={`${subject.questions} Q`}
          ariaLabel="Subject to battle in"
          items={scopes.map((option) => ({
            id: option.id,
            name: option.name,
            count: option.questions,
            selected: option.id === subject.id,
          }))}
          onPick={(id) => onChange(id, null)}
        />
      </Field>
      <Field label="Topic" panel={panel}>
        <Menu
          panel={panel}
          value={topic?.name ?? "Mixed topics"}
          hint={`${topic?.questions ?? subject.questions} Q`}
          ariaLabel="Topic to battle in"
          heading={`${subject.name} · topics with enough validated questions`}
          items={[
            { id: "", name: "Mixed topics", count: subject.questions, selected: topic === null },
            ...subject.topics.map((option) => ({
              id: option.id,
              name: option.name,
              count: option.questions,
              selected: option.id === topic?.id,
            })),
          ]}
          onPick={(id) => onChange(subject.id, id || null)}
        />
      </Field>
    </div>
  );
}

function Field({ label, panel, children }: { label: string; panel: boolean; children: React.ReactNode }) {
  if (!panel) return <>{children}</>;
  return (
    <label className="block">
      <span className="qz-lab mb-1.5 block text-white/55">{label}</span>
      {children}
    </label>
  );
}

interface MenuItem {
  id: string;
  name: string;
  count: number;
  selected: boolean;
}

function Menu({
  value,
  hint,
  items,
  onPick,
  ariaLabel,
  heading,
  panel,
}: {
  value: string;
  hint: string;
  items: MenuItem[];
  onPick: (id: string) => void;
  ariaLabel: string;
  heading?: string;
  panel: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className={cn(
          "group flex items-center gap-2 border border-white/30 bg-white/10 text-white outline-none transition-colors",
          "hover:border-white/55 hover:bg-white/15 focus-visible:border-white/80 data-[state=open]:border-white/80 data-[state=open]:bg-white/15",
          panel ? "w-full justify-between px-3.5 py-3 text-[15px]" : "qz-lab max-w-[60vw] px-3 py-[7px]",
        )}
      >
        <span className="truncate">{value}</span>
        <span className="flex flex-none items-center gap-2">
          <span className={cn("text-white/45", panel ? "text-[12px]" : "text-[10px]")}>{hint}</span>
          <ChevronDown className="h-3.5 w-3.5 text-white/60 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[min(320px,60vh)] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto border-white/20 bg-[#0d1830] text-white shadow-[0_18px_40px_rgba(0,0,0,.45)]"
      >
        {heading && <DropdownMenuLabel className="text-white/45">{heading}</DropdownMenuLabel>}
        {items.map((item) => (
          <DropdownMenuItem
            key={item.id || "mixed"}
            onSelect={() => onPick(item.id)}
            className="gap-4 text-white/85 data-[highlighted]:bg-white/15 data-[highlighted]:text-white"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Check className={cn("h-3.5 w-3.5 flex-none", item.selected ? "opacity-100" : "opacity-0")} aria-hidden="true" />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="qz-num flex-none text-[11px] text-white/45">{item.count}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
