"use client";

import { useActionState, useEffect, useState } from "react";
import { signInDemo, signInWithEmail } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const DEMO_KEY_STORAGE = "quizbo-demo-key";

function demoKey() {
  try {
    let key = localStorage.getItem(DEMO_KEY_STORAGE);
    if (!key || !/^[a-z0-9-]{16,64}$/.test(key)) {
      key = crypto.randomUUID();
      localStorage.setItem(DEMO_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export function DemoSignInForm() {
  const [error, action, pending] = useActionState(signInDemo, null);
  // Controlled, so React's automatic form reset after a failed attempt can't blank it.
  const [key, setKey] = useState("");

  useEffect(() => setKey(demoKey()), []);

  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="demo-name" className="text-[12px] text-neutral-700">
        Your name
      </label>
      <div className="flex gap-2">
        <input id="demo-name" name="name" className="input" placeholder="Aarav Menon" minLength={2} maxLength={40} required autoComplete="name" />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "…" : "CONTINUE"}
        </Button>
      </div>
      <input type="hidden" name="key" value={key} readOnly />
      {error && <p className="m-0 text-[12px] text-accent-700">{error}</p>}
      <p className="m-0 text-[11px] text-neutral-600">Demo accounts stay on this browser. Use Google or email to keep progress across devices.</p>
    </form>
  );
}

export function EmailSignInForm() {
  const [error, action, pending] = useActionState(signInWithEmail, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="email" className="text-[12px] text-neutral-700">
        Email
      </label>
      <div className="flex gap-2">
        <input id="email" name="email" type="email" className="input" placeholder="you@school.edu" required autoComplete="email" />
        <Button type="submit" disabled={pending}>
          {pending ? "…" : "SEND LINK"}
        </Button>
      </div>
      {error && <p className="m-0 text-[12px] text-accent-700">{error}</p>}
    </form>
  );
}
