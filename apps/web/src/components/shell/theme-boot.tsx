"use client";

import { useLayoutEffect } from "react";
import { THEME_EVENT } from "./theme-toggle";

/**
 * The server renders the saved theme from the `qz-theme` cookie. On a first visit (no cookie yet)
 * this adopts the OS preference and saves it, so every later render is correct from the server.
 */
export function ThemeBoot() {
  useLayoutEffect(() => {
    if (/(?:^|; )qz-theme=(dark|light)/.test(document.cookie)) return;
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("qz-dark", dark);
    document.cookie = `qz-theme=${dark ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);
  return null;
}
