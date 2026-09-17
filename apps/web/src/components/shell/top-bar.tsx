"use client";

import { PanelLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { useShell } from "./shell-context";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/battles", label: "Battles" },
  { href: "/planner", label: "Planner" },
  { href: "/resources", label: "Resources" },
] as const;

function crumbFor(pathname: string) {
  if (pathname.startsWith("/battles")) return "Battles";
  if (pathname.startsWith("/planner")) return "Planner / This week";
  if (pathname.startsWith("/resources")) return "Resources";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Home";
}

export function TopBar({ bankCount }: { bankCount: number }) {
  const pathname = usePathname();
  const { railHidden, toggleNav, openCoach, coachOpen, closeCoach, crumb } = useShell();

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-divider px-4 py-3 md:flex-nowrap md:gap-[22px] md:px-[26px] md:py-3.5">
      <button
        type="button"
        onClick={toggleNav}
        className="btn btn-ghost btn-icon mr-0.5 flex-none text-neutral-500 opacity-60 hover:text-text hover:opacity-100 focus-visible:opacity-100"
        title="Show or hide the sidebar"
        aria-label={railHidden ? "Show the sidebar" : "Hide the sidebar"}
        aria-expanded={!railHidden}
      >
        <PanelLeft size={16} strokeWidth={1.25} />
      </button>
      {railHidden && <span className="mr-1.5 font-heading text-[17px] font-semibold tracking-[.02em]">QUIZBO</span>}
      <span className="mr-[26px] hidden font-heading text-[15px] font-semibold tracking-[.02em] text-neutral-600 md:inline">
        {crumb ?? crumbFor(pathname)}
      </span>
      <nav
        aria-label="Main"
        className="order-last -mx-4 flex w-[calc(100%+2rem)] min-w-0 items-center gap-3.5 overflow-x-auto px-4 pt-0.5 whitespace-nowrap [scrollbar-width:none] md:order-none md:mx-0 md:w-auto md:overflow-visible md:px-0 md:pt-0"
      >
        {LINKS.map((link, index) => (
          <Fragment key={link.href}>
            {index > 0 && <span aria-hidden className="h-4 w-px flex-none bg-divider" />}
            <Link href={link.href} className="nav-link" aria-current={pathname.startsWith(link.href) ? "page" : undefined}>
              {link.label}
            </Link>
          </Fragment>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2.5">
        <span className="hidden text-[11px] text-neutral-600 lg:inline">Q. bank {bankCount.toLocaleString("en-US")} validated</span>
        <ThemeToggle />
        <button type="button" className="btn btn-primary tracking-[.06em]" onClick={() => (coachOpen ? closeCoach() : openCoach())}>
          ASK COACH
        </button>
      </div>
    </header>
  );
}
