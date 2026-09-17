"use client";

import { toast } from "sonner";

/**
 * Hidden visual surprises. Discoveries are remembered in this browser only; the settings page
 * shows which ones you've found, with a cryptic hint for the rest.
 */
export const EGGS = [
  { id: "konami", name: "Party mode", hint: "↑ ↑ ↓ ↓ … you know the rest." },
  { id: "logo", name: "Barrel roll", hint: "The Q gets dizzy if you poke it enough." },
  { id: "disco", name: "Disco night", hint: "Day, night, day, night, day — quickly." },
  { id: "quizbo", name: "Rainbow wave", hint: "Say the name. Just type it, anywhere." },
  { id: "nightowl", name: "Night owl", hint: "Some stars only come out after midnight." },
  { id: "lightning", name: "Lightning reflexes", hint: "Answer right before a second has passed." },
  { id: "flawless", name: "Flawless", hint: "Win without a scratch." },
  { id: "clutch", name: "Clutch", hint: "Win while hanging on by a thread." },
] as const;

export type EggId = (typeof EGGS)[number]["id"];

const STORE = "qz-eggs";
/** Fired on window for every trigger (found before or not), so overlays can play. */
export const EGG_EVENT = "qz-egg";

export function foundEggs(): EggId[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORE) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is EggId => EGGS.some((egg) => egg.id === id)) : [];
  } catch {
    return [];
  }
}

export function triggerEgg(id: EggId) {
  const found = foundEggs();
  const fresh = !found.includes(id);
  const next = fresh ? [...found, id] : found;
  if (fresh) {
    try {
      window.localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      // Private mode: the egg still plays, it just isn't remembered.
    }
  }
  // Saved first, so listeners (the settings shelf) read the updated list.
  window.dispatchEvent(new CustomEvent<EggId>(EGG_EVENT, { detail: id }));
  if (!fresh) return;
  const egg = EGGS.find((e) => e.id === id);
  toast(`Easter egg found: ${egg?.name ?? id}`, { description: `${next.length} of ${EGGS.length} discovered. Keep exploring.` });
}
