"use client";

import { useEffect, useState } from "react";

/** performance.now(), refreshed ~20×/s while `active` (drives the question countdown). */
export function useFrameClock(active: boolean) {
  const [now, setNow] = useState(() => (typeof performance === "undefined" ? 0 : performance.now()));
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = 0;
    const tick = (time: number) => {
      if (time - last >= 50) {
        last = time;
        setNow(time);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return now;
}

/** Date.now(), refreshed every 250 ms while `active` (grace period and countdown). */
export function useWallClock(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
