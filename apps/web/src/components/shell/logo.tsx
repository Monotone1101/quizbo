"use client";

import { useRef, useState } from "react";
import { Blueprint } from "@/components/ui/blueprint";
import { triggerEgg } from "@/lib/easter-eggs";

/** The Q mark and wordmark. Poke the Q seven times in a row and it does a barrel roll. */
export function Logo() {
  const [roll, setRoll] = useState(0);
  const clicks = useRef<number[]>([]);

  function poke() {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 2_500), now];
    if (clicks.current.length >= 7) {
      clicks.current = [];
      setRoll((n) => n + 1);
      triggerEgg("logo");
    }
  }

  return (
    <div className="flex items-center gap-2.5">
      <Blueprint
        key={roll}
        corners="diagonal"
        onClick={poke}
        className={`grid h-[34px] w-[34px] flex-none cursor-default select-none place-items-center border-accent bg-accent font-heading text-[20px] font-semibold leading-none text-bg ${roll ? "qz-barrel" : ""}`}
      >
        Q
      </Blueprint>
      <div>
        <div className="font-heading text-[19px] font-semibold leading-none tracking-[.02em]">QUIZBO</div>
        <div className="qz-lab mt-[3px] text-neutral-600">Study · Battle · Rank</div>
      </div>
    </div>
  );
}
