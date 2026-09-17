"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Client-provided ASCII loop. Self-host both files before launch and point these env vars at them.
export const FISTS_VIDEO_URL =
  process.env.NEXT_PUBLIC_FISTS_VIDEO_URL ||
  "https://assets.21st.dev/ascii-recipes/videos/user_3HgdEeKGCVNhWWoCeJ53q1fDQCD/d10d3128-eb57-4c90-af3c-cd3a2ad651ec.mp4";
export const FISTS_POSTER_URL =
  process.env.NEXT_PUBLIC_FISTS_POSTER_URL ||
  "https://assets.21st.dev/ascii-recipes/thumbnails/user_3HgdEeKGCVNhWWoCeJ53q1fDQCD/bf6f766e-747f-46dd-af14-6390b7eae845.webp";

export function AsciiVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    // `muted` must be forced as a property and an attribute, then play() called, or the loop stalls on the poster.
    video.muted = true;
    video.setAttribute("muted", "");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      return;
    }
    video.play().catch(() => {});
  }, []);

  return (
    <video
      ref={ref}
      src={FISTS_VIDEO_URL}
      poster={FISTS_POSTER_URL}
      autoPlay
      loop
      muted
      playsInline
      aria-label="Fists colliding — animated ASCII art"
      className={cn("block h-full w-full object-cover", className)}
    />
  );
}
