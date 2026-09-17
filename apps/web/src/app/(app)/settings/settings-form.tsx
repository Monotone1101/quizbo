"use client";

import { useActionState, useRef } from "react";
import { updateSettings } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";

const STYLES = [
  ["COMPETITIVE", "Competitive"],
  ["PROGRESS", "Progress-tracking"],
  ["REMINDER", "Reminder-driven"],
] as const;

export function SettingsForm({
  defaults,
}: {
  defaults: { name: string; dailyStudyMinutes: number; motivationStyle: string; timezone: string };
}) {
  const [state, action, pending] = useActionState(updateSettings, null);
  const tzRef = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex max-w-[360px] flex-col gap-1.5 text-[12px] text-neutral-700">
        Name
        <input name="name" className="input" defaultValue={defaults.name} minLength={2} maxLength={40} required />
      </label>
      <label className="flex max-w-[200px] flex-col gap-1.5 text-[12px] text-neutral-700">
        Daily study time (minutes)
        <input name="dailyStudyMinutes" type="number" className="input" min={15} max={300} step={5} defaultValue={defaults.dailyStudyMinutes} required />
      </label>
      <div className="flex flex-col gap-1.5 text-[12px] text-neutral-700">
        Motivation style
        <div className="seg w-fit">
          {STYLES.map(([value, label]) => (
            <label key={value} className="seg-opt">
              <input type="radio" name="motivationStyle" value={value} defaultChecked={defaults.motivationStyle === value} required />
              {label}
            </label>
          ))}
        </div>
      </div>
      <label className="flex max-w-[360px] flex-col gap-1.5 text-[12px] text-neutral-700">
        Time zone
        <span className="flex gap-2">
          <input ref={tzRef} name="timezone" className="input" defaultValue={defaults.timezone} required />
          <Button
            onClick={() => {
              if (tzRef.current) tzRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
            }}
          >
            THIS DEVICE
          </Button>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "SAVING…" : "SAVE SETTINGS"}
        </Button>
        {state && <span className={state.ok ? "text-[13px] text-accent-700" : "text-[13px]"}>{state.message}</span>}
      </div>
    </form>
  );
}
