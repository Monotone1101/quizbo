"use client";

import { useMemo, type CSSProperties } from "react";

const COLORS = ["#0a2463", "#3e92cc", "#fffaff", "#d8315b", "#a9cfea", "#f07a98"];

/** A one-off shower of palette confetti. Re-key it to throw another one. */
export function Confetti({ pieces = 90, duration = 3 }: { pieces?: number; duration?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        time: duration * (0.7 + Math.random() * 0.6),
        drift: (Math.random() - 0.5) * 240,
        spin: (Math.random() - 0.5) * 1440,
        color: COLORS[i % COLORS.length],
        round: Math.random() > 0.7,
      })),
    [pieces, duration],
  );
  return (
    <div className="qz-confetti" aria-hidden>
      {bits.map((bit, i) => (
        <i
          key={i}
          style={
            {
              left: `${bit.left}%`,
              background: bit.color,
              borderRadius: bit.round ? "999px" : "1px",
              animationDuration: `${bit.time}s`,
              animationDelay: `${bit.delay}s`,
              "--drift": `${bit.drift}px`,
              "--spin": `${bit.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
