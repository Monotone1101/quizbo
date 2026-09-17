"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { relativeTime } from "@/lib/utils";

/**
 * "Loot drops": the study links you opened most recently, remembered in this browser.
 * Every resource link in the app records itself here when opened.
 */
export interface Loot {
  url: string;
  title: string;
  source: string;
}

interface LootEntry extends Loot {
  at: number;
}

const STORE = "qz-loot";
const EVENT = "qz-loot-change";
const KEEP = 12;
const SHOW = 4;

function readLoot(): LootEntry[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORE) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((e): e is LootEntry => typeof e?.url === "string" && typeof e?.title === "string" && typeof e?.at === "number")
      : [];
  } catch {
    return [];
  }
}

function remember(loot: Loot) {
  const next = [{ ...loot, at: Date.now() }, ...readLoot().filter((e) => e.url !== loot.url)].slice(0, KEEP);
  try {
    window.localStorage.setItem(STORE, JSON.stringify(next));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

/** An external study link that lands in Loot Drops when opened. */
export function LootLink({ loot, className, children }: { loot: Loot; className?: string; children: ReactNode }) {
  const record = () => remember(loot);
  return (
    <a
      href={loot.url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={record}
      onAuxClick={(event) => event.button === 1 && record()}
    >
      {children}
    </a>
  );
}

const linkClass = "group block border-l-2 border-accent-300 pl-[9px] text-text no-underline hover:border-hot hover:text-accent-700";

/** Sidebar section: recent loot, or picks for your weakest topics until you've opened something. */
export function LootDrops({ picks }: { picks: Array<Loot & { id: string }> }) {
  const [recent, setRecent] = useState<LootEntry[] | null>(null);

  useEffect(() => {
    const load = () => setRecent(readLoot());
    load();
    window.addEventListener(EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const hasRecent = Boolean(recent?.length);
  const items = hasRecent ? recent!.slice(0, SHOW) : picks;

  return (
    <>
      <div className="mb-[9px] flex items-baseline justify-between">
        <span className="qz-lab">
          Loot drops <span className="text-hot">✦</span>
        </span>
        <Link href="/resources" className="text-[10px] text-neutral-600 no-underline hover:text-accent-700">
          {hasRecent ? "RECENT" : "FRESH PICKS"} · ALL →
        </Link>
      </div>
      {!hasRecent && recent !== null && (
        <p className="m-0 mb-2 text-[11px] leading-snug text-neutral-600">Nothing looted yet. These fit your weak spots:</p>
      )}
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <LootLink key={item.url} loot={item} className={linkClass}>
            <div className="text-[13px] leading-[1.3]">{item.title}</div>
            <div className="qz-lab mt-0.5 flex gap-1.5 text-neutral-600">
              <span className="truncate">{item.source}</span>
              {"at" in item && <span className="flex-none text-accent-700">· {relativeTime(new Date(item.at))}</span>}
            </div>
          </LootLink>
        ))}
        {items.length === 0 && recent !== null && (
          <p className="m-0 text-[12px] text-neutral-600">
            Open anything in the <Link href="/resources">library</Link> and it drops here.
          </p>
        )}
      </div>
    </>
  );
}
