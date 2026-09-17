"use client";

import { useEffect, useRef } from "react";
import { THEME_EVENT } from "@/components/shell/theme-toggle";

/**
 * Digits trickling down behind the ELO figure. Columns every 13px, redraw throttled to 70ms, glyph
 * alpha fades along each trail; colour and font are re-read from tokens so night mode recolours it.
 */
export function DigitRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = 13;
    let columns: Array<{ y: number; v: number; len: number }> = [];
    let width = 0;
    let height = 0;
    let ink = "#0a2463";
    let face = "Barlow Condensed";
    let last = 0;
    let sinceMeasure = 0;
    let frame = 0;

    const readTokens = () => {
      const styles = getComputedStyle(canvas);
      ink = styles.getPropertyValue("--color-accent").trim() || ink;
      face = styles.getPropertyValue("--font-heading").trim() || face;
    };

    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return false;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readTokens();
      const count = Math.floor(width / step);
      if (columns.length !== count) {
        columns = Array.from({ length: count }, () => ({
          y: Math.random() * height,
          v: 0.5 + Math.random() * 1.6,
          len: 6 + Math.floor(Math.random() * 14),
        }));
      }
      return true;
    };

    const paint = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.font = `11px ${face}, monospace`;
      ctx.textBaseline = "top";
      ctx.fillStyle = ink;
      columns.forEach((column, i) => {
        for (let k = 0; k < column.len; k++) {
          const y = column.y - k * step;
          if (y < -step || y > height) continue;
          ctx.globalAlpha = (1 - k / column.len) * 0.3;
          ctx.fillText(String(Math.floor(Math.random() * 10)), i * step + 3, y);
        }
        column.y += column.v * step * 0.5;
        if (column.y - column.len * step > height) {
          column.y = -step;
          column.v = 0.5 + Math.random() * 1.6;
        }
      });
      ctx.globalAlpha = 1;
    };

    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (time - last < 70) return;
      last = time;
      if (++sinceMeasure > 40) {
        sinceMeasure = 0;
        readTokens();
      }
      paint();
    };

    const resize = new ResizeObserver(() => {
      measure();
      if (reduced) paint();
    });
    resize.observe(canvas);
    const onTheme = () => {
      readTokens();
      if (reduced) paint();
    };
    window.addEventListener(THEME_EVENT, onTheme);

    if (measure()) {
      if (reduced) paint();
      else frame = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener(THEME_EVENT, onTheme);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
