"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#1e1b18", "#0b1a45", "#0a2463", "#1a4e8a", "#2a6fa8", "#3e92cc", "#a9cfea"];
const STOPS = [30, 46, 58, 70, 80, 90, 100];

const gradient = (w: number) =>
  `radial-gradient(${w}% ${w + 8}% at 50% 22%, ${COLORS.map((color, i) => `${color} ${STOPS[i]}%`).join(", ")})`;

/** Matchmaking field: a radial Imperial-to-Blue-Bell gradient whose width breathes between 120% and 130%. */
export function BreathingGradient() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.background = gradient(125);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let w = 125;
    let direction = 1;
    let frame = 0;
    const tick = () => {
      if (w >= 130) direction = -1;
      if (w <= 120) direction = 1;
      w += direction * 0.09;
      el.style.background = gradient(w);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <div ref={ref} className="absolute inset-0" aria-hidden="true" />;
}
