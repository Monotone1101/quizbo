"use client";

import { useActionState, useEffect, useRef } from "react";
import { completeOnboarding } from "@/app/actions/onboarding";
import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";

const GOALS = [
  ["BOARD", "Board exams", "Class 12 finals"],
  ["ENTRANCE", "Entrance exams", "JEE, NEET and similar"],
  ["SCHOOL", "School tests", "Unit tests and terms"],
  ["KEEPING_UP", "Keeping up", "No exam soon"],
] as const;

const STYLES = [
  ["COMPETITIVE", "Competitive", "Beat someone and climb the ranking. Home opens on battles; the coach is direct."],
  ["PROGRESS", "Progress-tracking", "See the numbers move. Home opens on today's plan; the coach explains a little more."],
  ["REMINDER", "Reminder-driven", "Tell me what to do today. Home opens on today's plan; the coach keeps it brief."],
] as const;

const CONFIDENCE = ["Shaky", "Unsure", "Okay", "Good", "Solid"];
const MINUTES = [30, 45, 60, 90, 120];

function Question({ index, title, hint, children }: { index: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Blueprint className="p-5">
      <div className="qz-lab text-accent-700">Question {index} of 4</div>
      <h4 className="mb-1 mt-1">{title}</h4>
      {hint && <p className="mb-3 text-[13px] text-neutral-600">{hint}</p>}
      {children}
    </Blueprint>
  );
}

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [error, action, pending] = useActionState(completeOnboarding, null);
  const tzRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tzRef.current) tzRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input ref={tzRef} type="hidden" name="timezone" />

      <div className="flex max-w-[360px] flex-col gap-1.5">
        <label htmlFor="name" className="text-[12px] text-neutral-700">
          What should we call you?
        </label>
        <input id="name" name="name" className="input" defaultValue={defaultName} minLength={2} maxLength={40} required />
      </div>

      <Question index={1} title="What are you studying for?">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {GOALS.map(([value, label, hint]) => (
            <label
              key={value}
              className="blueprint flex cursor-pointer flex-col px-3.5 py-3 has-[input:checked]:border-accent has-[input:checked]:bg-accent-100"
            >
              <input type="radio" name="examGoal" value={value} className="sr-only" required />
              <span className="font-heading text-[17px] font-semibold">{label}</span>
              <span className="text-[12px] text-neutral-600">{hint}</span>
            </label>
          ))}
        </div>
      </Question>

      <Question index={2} title="How confident do you feel in your subjects right now?" hint="Sets the rating band for your first five matches.">
        <div className="seg">
          {CONFIDENCE.map((label, i) => (
            <label key={label} className="seg-opt">
              <input type="radio" name="confidence" value={i + 1} required />
              <span className="qz-num text-[15px]">{i + 1}</span> {label}
            </label>
          ))}
        </div>
      </Question>

      <Question index={3} title="What keeps you going?" hint="Shapes your home screen and how the coach talks to you.">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {STYLES.map(([value, label, hint]) => (
            <label
              key={value}
              className="blueprint flex cursor-pointer flex-col px-3.5 py-3 has-[input:checked]:border-accent has-[input:checked]:bg-accent-100"
            >
              <input type="radio" name="motivationStyle" value={value} className="sr-only" required />
              <span className="font-heading text-[17px] font-semibold">{label}</span>
              <span className="text-[12px] leading-snug text-neutral-600">{hint}</span>
            </label>
          ))}
        </div>
      </Question>

      <Question index={4} title="How much time can you study on a normal day?" hint="The planner never schedules more than this.">
        <div className="seg">
          {MINUTES.map((minutes) => (
            <label key={minutes} className="seg-opt">
              <input type="radio" name="dailyStudyMinutes" value={minutes} defaultChecked={minutes === 60} />
              {minutes} min
            </label>
          ))}
        </div>
      </Question>

      {error && <p className="m-0 border-l-2 border-accent pl-2.5 text-[13px]">{error}</p>}
      <div>
        <Button type="submit" variant="primary" size="lg" disabled={pending} className="min-w-[240px]">
          {pending ? "SETTING UP…" : "START QUIZBO"}
        </Button>
      </div>
    </form>
  );
}
