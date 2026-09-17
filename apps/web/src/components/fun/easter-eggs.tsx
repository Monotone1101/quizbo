"use client";

import { useEffect, useMemo, useState } from "react";
import { THEME_EVENT } from "@/components/shell/theme-toggle";
import { EGG_EVENT, triggerEgg, type EggId } from "@/lib/easter-eggs";
import { Confetti } from "./confetti";

const KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
const WORD = "quizbo";

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

function Stars() {
  const stars = useMemo(
    () => Array.from({ length: 60 }, () => ({ left: Math.random() * 100, top: Math.random() * 100, delay: Math.random() * 2.4 })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[55] h-[45vh] animate-[qzFade_10s_ease-in_forwards]" aria-hidden>
      {stars.map((s, i) => (
        <span key={i} className="qz-star" style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s` }} />
      ))}
      <div className="absolute right-[8%] top-[12%] h-12 w-12 rounded-full bg-[#fffaff] shadow-[0_0_40px_10px_rgba(169,207,234,.6)]" />
      <div className="absolute right-[calc(8%-10px)] top-[calc(12%-6px)] h-12 w-12 rounded-full bg-[#0a2463]/90" />
    </div>
  );
}

/**
 * Listens for the global easter eggs (Konami code, typing the name, theme flicking, late nights)
 * and plays every egg's overlay, wherever it was triggered.
 */
export function EasterEggs() {
  const [show, setShow] = useState<{ id: EggId; key: number } | null>(null);

  useEffect(() => {
    let konami = 0;
    let word = "";
    const onKey = (event: KeyboardEvent) => {
      if (typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      konami = key === KONAMI[konami] ? konami + 1 : key === KONAMI[0] ? 1 : 0;
      if (konami === KONAMI.length) {
        konami = 0;
        triggerEgg("konami");
      }
      if (key.length === 1) {
        word = (word + key).slice(-WORD.length);
        if (word === WORD) {
          word = "";
          triggerEgg("quizbo");
        }
      }
    };

    let flips: number[] = [];
    const onTheme = () => {
      const now = Date.now();
      flips = [...flips.filter((t) => now - t < 3_000), now];
      if (flips.length >= 5) {
        flips = [];
        triggerEgg("disco");
      }
    };

    let timer = 0;
    const onEgg = (event: Event) => {
      const id = (event as CustomEvent<EggId>).detail;
      if (id === "logo" || id === "lightning") return;
      setShow({ id, key: Date.now() });
      document.documentElement.classList.toggle("qz-party", id === "konami");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setShow(null);
        document.documentElement.classList.remove("qz-party");
      }, id === "nightowl" ? 10_000 : 6_000);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener(THEME_EVENT, onTheme);
    window.addEventListener(EGG_EVENT, onEgg);

    const hour = new Date().getHours();
    let owl = 0;
    if (hour < 4) {
      try {
        if (!window.sessionStorage.getItem("qz-owl")) {
          window.sessionStorage.setItem("qz-owl", "1");
          owl = window.setTimeout(() => triggerEgg("nightowl"), 1_200);
        }
      } catch {
        // No session storage: skip the owl rather than show it on every page.
      }
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(THEME_EVENT, onTheme);
      window.removeEventListener(EGG_EVENT, onEgg);
      window.clearTimeout(timer);
      window.clearTimeout(owl);
      document.documentElement.classList.remove("qz-party");
    };
  }, []);

  if (!show) return null;
  switch (show.id) {
    case "konami":
    case "flawless":
    case "clutch":
      return <Confetti key={show.key} pieces={show.id === "konami" ? 140 : 110} />;
    case "disco":
      return <div key={show.key} className="qz-disco" aria-hidden />;
    case "quizbo":
      return <div key={show.key} className="qz-rainbow" aria-hidden />;
    case "nightowl":
      return <Stars key={show.key} />;
    default:
      return null;
  }
}
