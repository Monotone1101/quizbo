"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useShell } from "./shell-context";

/**
 * Left rail + main column + coach overlay.
 * md and up: sticky, collapsible rail (fixed 264px inner width so nothing reflows).
 * Below md: the rail is an off-canvas drawer over the page, closed on navigation, Escape or backdrop click.
 */
export function AppFrame({ sidebar, topbar, coach, children }: { sidebar: ReactNode; topbar: ReactNode; coach: ReactNode; children: ReactNode }) {
  const { navHidden, drawerOpen, closeDrawer, railHidden } = useShell();
  const pathname = usePathname();
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

  useEffect(() => {
    if (!drawerOpen) return;
    const aside = asideRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && closeDrawer();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    aside?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = overflow;
      if (aside?.contains(document.activeElement) || document.activeElement === document.body) opener?.focus({ preventScroll: true });
    };
  }, [drawerOpen, closeDrawer]);

  // Same-page links don't change the pathname, so close on any link click inside the drawer too.
  function onRailClick(event: MouseEvent) {
    if (drawerOpen && (event.target as Element).closest("a")) closeDrawer();
  }

  return (
    <div className="relative flex min-h-screen bg-bg">
      {drawerOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" aria-hidden onClick={closeDrawer} />}
      <div
        data-drawer={drawerOpen ? "open" : undefined}
        className={cn(
          "qz-rail fixed inset-y-0 left-0 z-40 w-[264px] max-w-[85vw] overflow-hidden bg-bg shadow-[var(--shadow-lg)]",
          "md:sticky md:top-0 md:z-auto md:h-screen md:max-w-none md:flex-none md:translate-x-0 md:shadow-none",
          drawerOpen ? "translate-x-0" : "invisible -translate-x-full md:visible",
          navHidden && "md:w-0",
        )}
      >
        <aside
          ref={asideRef}
          tabIndex={-1}
          className={cn(
            "flex h-full w-full flex-col overflow-y-auto border-r border-divider outline-none md:w-[264px]",
            navHidden && "md:opacity-0",
          )}
          aria-label="Sidebar"
          aria-hidden={railHidden}
          inert={railHidden}
          onClick={onRailClick}
        >
          {sidebar}
        </aside>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        {children}
      </div>
      {coach}
    </div>
  );
}
