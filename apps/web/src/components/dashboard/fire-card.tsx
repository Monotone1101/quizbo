"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Corners } from "@/components/ui/blueprint";
import { THEME_EVENT } from "@/components/shell/theme-toggle";
import { cn } from "@/lib/utils";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
}

const RAMP_TOKENS = ["--color-accent-800", "--color-accent-700", "--color-accent-500", "--color-accent-400", "--color-accent-300"];

/**
 * Streak card with the ember animation. Intensity lives in a ref — fanning and stoking never
 * re-render. Hover raises the target to 0.6, each click adds 0.34 stoke (decays 0.55/s).
 */
export function FireCard({ children, className }: { children: ReactNode; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fire = useRef({ level: 0.1, target: 0.1, stoke: 0, mx: null as number | null });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let last = 0;
    let carry = 0;
    let frame = 0;
    let sinceTokens = 0;
    let particles: Particle[] = [];
    let ramp = ["#0a2463", "#1a4e8a", "#3e92cc", "#6fb0dd", "#a9cfea"];

    const readTokens = () => {
      const styles = getComputedStyle(canvas);
      const values = RAMP_TOKENS.map((token) => styles.getPropertyValue(token).trim());
      if (values.every(Boolean)) ramp = values;
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
      return true;
    };

    const emit = (count: number, level: number, mx: number | null) => {
      for (let i = 0; i < count; i++) {
        const focus =
          mx === null ? Math.random() * width : Math.min(width, Math.max(0, mx + (Math.random() + Math.random() - 1) * (70 + level * 90)));
        const x = mx === null ? focus : Math.random() < 0.7 ? focus : Math.random() * width;
        particles.push({
          x,
          y: height - 4 - Math.random() * 6,
          vx: (Math.random() - 0.5) * (10 + level * 20),
          vy: -(30 + Math.random() * 46) * (0.55 + level),
          life: 0,
          ttl: 0.7 + Math.random() * (0.7 + level * 0.9),
          size: 2 + Math.random() * (2 + level * 4),
        });
      }
    };

    const emberBed = (level: number, mx: number | null) => {
      ctx.fillStyle = ramp[0] ?? "#0a2463";
      const cx = mx === null ? width / 2 : mx;
      for (let x = 0; x < width; x += 6) {
        const distance = Math.abs(x + 3 - cx) / (width * 0.5);
        ctx.globalAlpha = (0.1 + level * 0.5) * Math.max(0.18, 1 - distance);
        ctx.fillRect(x, height - 3, 4, 2);
      }
      ctx.globalAlpha = 1;
    };

    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      const dt = Math.min(0.05, last ? (time - last) / 1000 : 0.016);
      last = time;
      if (++sinceTokens > 60) {
        sinceTokens = 0;
        readTokens();
      }

      const f = fire.current;
      f.stoke = Math.max(0, f.stoke - dt * 0.55);
      const want = Math.min(1.6, f.target + f.stoke);
      f.level += (want - f.level) * Math.min(1, dt * 5);
      const level = f.level;

      carry += (14 + level * 150) * dt;
      const count = Math.floor(carry);
      carry -= count;
      emit(count, level, f.mx);

      ctx.clearRect(0, 0, width, height);
      particles = particles.filter((p) => {
        p.life += dt;
        if (p.life > p.ttl) return false;
        const k = p.life / p.ttl;
        p.vy -= 34 * dt;
        p.vx *= 1 - dt * 1.6;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const band = Math.min(ramp.length - 1, Math.floor(k * ramp.length));
        ctx.globalAlpha = (1 - k) * (0.35 + level * 0.45);
        ctx.fillStyle = ramp[band] ?? "#a9cfea";
        const size = p.size * (1 - k * 0.55);
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
        return true;
      });
      emberBed(level, f.mx);
    };

    const resize = new ResizeObserver(() => {
      measure();
      if (reduced) emberBed(0.1, null);
    });
    resize.observe(canvas);
    const onTheme = () => readTokens();
    window.addEventListener(THEME_EVENT, onTheme);

    if (measure()) {
      if (reduced) emberBed(0.1, null);
      else frame = requestAnimationFrame(draw);
    }
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener(THEME_EVENT, onTheme);
    };
  }, []);

  return (
    <div
      className={cn("card blueprint relative", className)}
      title="Hover anywhere to fan the streak · click to stoke it"
      onMouseEnter={() => {
        fire.current.target = 0.6;
      }}
      onMouseLeave={() => {
        fire.current.target = 0.1;
        fire.current.mx = null;
      }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        fire.current.mx = event.clientX - rect.left;
      }}
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        fire.current.stoke = Math.min(1.1, fire.current.stoke + 0.34);
      }}
    >
      <Corners />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
      {children}
    </div>
  );
}
