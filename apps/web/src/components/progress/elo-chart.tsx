"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EloPoint } from "@/lib/data/progress";
import { formatSigned } from "@/lib/utils";

const H = 240;
const PAD = { top: 16, right: 44, bottom: 26, left: 44 };

type Point = { x: number; y: number; elo: number; label: string; detail: string | null; delta: number | null };

/** Rounds the y-range out to clean 25-point ticks. */
function ticks(min: number, max: number) {
  const step = max - min > 200 ? 50 : 25;
  const lo = Math.floor((min - 10) / step) * step;
  const hi = Math.ceil((max + 10) / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi; v += step) out.push(v);
  return { lo, hi, out };
}

/**
 * ELO over battles for one subject: a single 2px line with a 10% area wash, a hairline grid,
 * the current rating labelled at the end, and a crosshair + tooltip on hover (or keyboard focus).
 */
export function EloChart({ start, timeline }: { start: number; timeline: EloPoint[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry?.contentRect.width ?? 640))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { points, grid, lo, hi } = useMemo(() => {
    const values = [start, ...timeline.map((p) => p.elo)];
    const { lo, hi, out } = ticks(Math.min(...values), Math.max(...values));
    const innerW = width - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * innerH;
    const points: Point[] = [
      { x: x(0), y: y(start), elo: start, label: "Start", detail: "Placement rating", delta: null },
      ...timeline.map((p, i) => ({
        x: x(i + 1),
        y: y(p.elo),
        elo: p.elo,
        label: `Battle ${String(p.number).padStart(4, "0")}`,
        detail: `${p.result} vs ${p.opponent} · ${new Date(p.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
        delta: p.delta,
      })),
    ];
    return { points, grid: out.map((v) => ({ v, y: y(v) })), lo, hi };
  }, [start, timeline, width]);

  const last = points[points.length - 1]!;
  const line = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${last.x.toFixed(1)},${H - PAD.bottom} L${points[0]!.x.toFixed(1)},${H - PAD.bottom} Z`;
  const shown = active !== null ? points[active] : null;

  function onMove(event: React.PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i]!.x - px) < Math.abs(points[best]!.x - px)) best = i;
    setActive(best);
  }

  function onKey(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
    else if (event.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? points.length) - 1));
    else return;
    event.preventDefault();
  }

  return (
    <div ref={box} className="relative w-full">
      <svg
        width={width}
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        role="img"
        aria-label={`ELO from ${start} to ${last.elo} over ${timeline.length} battles, range ${lo} to ${hi}`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="block max-w-full outline-none focus-visible:outline-2 focus-visible:outline-accent"
      >
        {grid.map((g) => (
          <g key={g.v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={g.y} y2={g.y} stroke="var(--color-divider)" strokeWidth={1} />
            <text x={PAD.left - 8} y={g.y} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-neutral-600)">
              {g.v.toLocaleString("en-US")}
            </text>
          </g>
        ))}
        <path d={area} fill="var(--color-accent)" opacity={0.1} />
        <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <text x={PAD.left} y={H - 8} fontSize={11} fill="var(--color-neutral-600)">
          Start
        </text>
        <text x={width - PAD.right} y={H - 8} textAnchor="end" fontSize={11} fill="var(--color-neutral-600)">
          {timeline.length} {timeline.length === 1 ? "battle" : "battles"}
        </text>
        {/* End label: the current rating, in text ink beside the end-dot. */}
        <circle cx={last.x} cy={last.y} r={5} fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth={2} />
        <text x={last.x + 9} y={last.y} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--color-text)">
          {last.elo}
        </text>
        {shown && (
          <g pointerEvents="none">
            <line x1={shown.x} x2={shown.x} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-neutral-400)" strokeWidth={1} />
            <circle cx={shown.x} cy={shown.y} r={5} fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth={2} />
          </g>
        )}
        <rect
          x={PAD.left - 12}
          y={0}
          width={width - PAD.left - PAD.right + 24}
          height={H}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
        />
      </svg>
      {shown && (
        <div
          className="pointer-events-none absolute z-10 min-w-[150px] rounded-lg border border-divider bg-bg px-3 py-2 text-[12px] shadow-[var(--shadow-md)]"
          style={{
            left: Math.min(Math.max(shown.x - 75, 0), width - 170),
            top: Math.max(0, shown.y - 78),
          }}
          role="status"
        >
          <div className="qz-lab text-neutral-600">{shown.label}</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="qz-num text-[20px]">{shown.elo}</span>
            {shown.delta !== null && <span className="text-neutral-700">{formatSigned(shown.delta)}</span>}
          </div>
          {shown.detail && <div className="mt-0.5 text-neutral-600">{shown.detail}</div>}
        </div>
      )}
    </div>
  );
}
