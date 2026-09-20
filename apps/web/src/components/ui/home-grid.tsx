"use client";

import type { CSSProperties } from "react";
import { GridPulse } from "./grid-pulse";

/**
 * The homepage's fine grid: 5 px cells inside a single box. With cells this small the pointer's
 * reach and the lit-cell lid are raised so a sweep still reads as a soft trail, and the hairlines
 * are fainter so the mesh doesn't turn to noise.
 */
export function HomeGrid() {
  return (
    <GridPulse
      cell={5}
      reach={9}
      ambient={6}
      maxLit={520}
      style={{ "--grid-pulse-line": "color-mix(in oklab, var(--color-foreground) 5%, transparent)" } as CSSProperties}
    />
  );
}
