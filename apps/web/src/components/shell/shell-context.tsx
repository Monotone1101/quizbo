"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface ShellState {
  /** Desktop rail collapsed (persisted in the qz-nav cookie). */
  navHidden: boolean;
  /** Below md the rail is an overlay drawer, closed by default and never persisted. */
  drawerOpen: boolean;
  closeDrawer: () => void;
  /** Whether the rail is currently out of view at this viewport width. */
  railHidden: boolean;
  isDesktop: boolean;
  toggleNav: () => void;
  coachOpen: boolean;
  coachPrompt: string | null;
  openCoach: (prompt?: string) => void;
  closeCoach: () => void;
  consumeCoachPrompt: () => void;
  crumb: string | null;
  setCrumb: (crumb: string | null) => void;
}

const ShellContext = createContext<ShellState | null>(null);

const DESKTOP_QUERY = "(min-width: 48rem)"; // Tailwind's md breakpoint

/** Assumes desktop until mounted so the server render matches the existing desktop layout. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return isDesktop;
}

export function ShellProvider({ initialNavHidden, children }: { initialNavHidden: boolean; children: ReactNode }) {
  const [navHidden, setNavHidden] = useState(initialNavHidden);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachPrompt, setCoachPrompt] = useState<string | null>(null);
  const [crumb, setCrumb] = useState<string | null>(null);

  useEffect(() => {
    if (isDesktop) setDrawerOpen(false);
  }, [isDesktop]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const toggleNav = useCallback(() => {
    if (!window.matchMedia(DESKTOP_QUERY).matches) {
      setDrawerOpen((open) => !open);
      return;
    }
    setNavHidden((hidden) => {
      const next = !hidden;
      document.cookie = `qz-nav=${next ? "hidden" : "open"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  const value = useMemo<ShellState>(
    () => ({
      navHidden,
      drawerOpen,
      closeDrawer,
      railHidden: isDesktop ? navHidden : !drawerOpen,
      isDesktop,
      toggleNav,
      coachOpen,
      coachPrompt,
      openCoach: (prompt) => {
        setCoachPrompt(prompt ?? null);
        setCoachOpen(true);
      },
      closeCoach: () => setCoachOpen(false),
      consumeCoachPrompt: () => setCoachPrompt(null),
      crumb,
      setCrumb,
    }),
    [navHidden, drawerOpen, closeDrawer, isDesktop, toggleNav, coachOpen, coachPrompt, crumb],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const context = useContext(ShellContext);
  if (!context) throw new Error("useShell must be used inside ShellProvider");
  return context;
}

/** Lets a server-rendered page set the top-bar breadcrumb ("Battles / 0284"). */
export function SetCrumb({ label }: { label: string }) {
  const { setCrumb } = useShell();
  useEffect(() => {
    setCrumb(label);
    return () => setCrumb(null);
  }, [label, setCrumb]);
  return null;
}

export function OpenCoach({
  prompt,
  className,
  children,
  as = "link",
}: {
  prompt?: string;
  className?: string;
  children: ReactNode;
  as?: "link" | "button";
}) {
  const { openCoach } = useShell();
  if (as === "button") {
    return (
      <button type="button" className={className} onClick={() => openCoach(prompt)}>
        {children}
      </button>
    );
  }
  return (
    <a
      href="#coach"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        openCoach(prompt);
      }}
    >
      {children}
    </a>
  );
}
