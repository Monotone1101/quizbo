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
  { href: "/progress", label: "Progress" },
  { href: "/resources", label: "Resources" },
] as const;

function crumbFor(pathname: string) {
  if (pathname.startsWith("/battles")) return "Battles";
  if (pathname.startsWith("/planner")) return "Planner / This week";
  if (pathname.startsWith("/progress")) return "Progress";
  if (pathname.startsWith("/resources")) return "Resources";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Home";
}

/**
 * Laid out by the header's own width (a container query), not the window's: the sidebar takes a
 * different share of the screen when it's open, closed or a drawer.
 *   < 960 px   two rows: controls on top, the links in a full-width row that scrolls sideways.
 *   ≥ 960 px   one row; the page crumb joins at 1120 px, the question-bank count at 1280 px.
 */
export function TopBar({ bankCount }: { bankCount: number }) {
  const pathname = usePathname();
  const { railHidden, toggleNav, openCoach, coachOpen, closeCoach, crumb } = useShell();

  return (
    <header className="@container border-b border-divider">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 @min-[960px]:flex-nowrap @min-[960px]:gap-x-5 @min-[960px]:px-[26px] @min-[960px]:py-3.5">
        <button
          type="button"
          onClick={toggleNav}
          className="btn btn-ghost btn-icon flex-none text-neutral-500 opacity-60 hover:text-text hover:opacity-100 focus-visible:opacity-100"
          title="Show or hide the sidebar"
          aria-label={railHidden ? "Show the sidebar" : "Hide the sidebar"}
          aria-expanded={!railHidden}
        >
          <PanelLeft size={16} strokeWidth={1.25} />
        </button>
        {railHidden && <span className="flex-none font-heading text-[17px] font-semibold tracking-[.02em]">QUIZBO</span>}
        <span className="hidden min-w-0 flex-none truncate font-heading text-[15px] font-semibold tracking-[.02em] text-neutral-600 @min-[1120px]:inline">
          {crumb ?? crumbFor(pathname)}
        </span>

        <nav
          aria-label="Main"
          className="order-last -mx-4 flex w-[calc(100%+2rem)] min-w-0 items-center gap-3 overflow-x-auto px-4 pb-0.5 whitespace-nowrap [scrollbar-width:none] @min-[960px]:order-none @min-[960px]:mx-0 @min-[960px]:w-auto @min-[960px]:flex-1 @min-[960px]:justify-center @min-[960px]:overflow-visible @min-[960px]:px-0 @min-[960px]:pb-0 @min-[1120px]:justify-start"
        >
          {LINKS.map((link, index) => (
            <Fragment key={link.href}>
              {index > 0 && <span aria-hidden className="h-4 w-px flex-none bg-divider" />}
              <Link
                href={link.href}
                className="nav-link flex-none"
                aria-current={pathname.startsWith(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            </Fragment>
          ))}
        </nav>

        <div className="ml-auto flex flex-none items-center gap-2.5">
          <span className="hidden text-[11px] whitespace-nowrap text-neutral-600 @min-[1280px]:inline">
            Q. bank {bankCount.toLocaleString("en-US")} validated
          </span>
          <ThemeToggle />
          <button
            type="button"
            className="btn btn-primary tracking-[.06em] whitespace-nowrap"
            onClick={() => (coachOpen ? closeCoach() : openCoach())}
          >
            ASK COACH
          </button>
        </div>
      </div>
    </header>
  );
}
