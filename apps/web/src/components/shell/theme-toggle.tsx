"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export const THEME_EVENT = "qz-theme-change";

export function ThemeToggle({ className }: { className?: string }) {
  const [night, setNight] = useState<boolean | null>(null);

  useEffect(() => {
    setNight(document.documentElement.classList.contains("qz-dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("qz-dark");
    document.documentElement.classList.toggle("qz-dark", next);
    document.cookie = `qz-theme=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    setNight(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={className ?? "btn btn-secondary btn-icon flex-none"}
      title="Night mode"
      aria-label={night ? "Switch to day mode" : "Switch to night mode"}
    >
      {night ? <Sun size={17} strokeWidth={1.5} /> : <Moon size={17} strokeWidth={1.5} />}
    </button>
  );
}
