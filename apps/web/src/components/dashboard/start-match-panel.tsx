"use client";

import { normalizeRoomCode } from "@quizbo/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Blueprint } from "@/components/ui/blueprint";
import { Button, ButtonLink } from "@/components/ui/button";
import { AsciiVideo } from "./ascii-video";

export function StartMatchPanel({ queueLine }: { queueLine: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <Blueprint className="flex flex-col items-center gap-3.5 border-accent p-5">
      <div className="qz-lab self-start text-accent-700">1v1 Battle · MVP</div>
      <Blueprint className="duotone relative h-[186px] w-full bg-neutral-900">
        <AsciiVideo />
        <div className="qz-lab absolute bottom-0 left-0 z-[2] bg-bg px-[7px] py-[3px] text-neutral-700">ASCII · loop</div>
      </Blueprint>
      <ButtonLink href="/play" variant="primary" size="lg" className="w-full">
        START NEW MATCH
      </ButtonLink>
      <div className="flex flex-wrap justify-center gap-4 text-[12px] text-neutral-700">
        <span>12s / question</span>
        <span className="text-divider">|</span>
        <span>±150 ELO</span>
        <span className="text-divider">|</span>
        <span>{queueLine}</span>
      </div>
      <div className="flex w-full items-center gap-2 border-t border-divider pt-3">
        <ButtonLink href="/play/invite" variant="ghost" className="text-[12px]">
          INVITE A FRIEND
        </ButtonLink>
        <form
          className="ml-auto flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            const normalized = normalizeRoomCode(code);
            if (!normalized) {
              toast.error("Room codes are five letters and numbers.");
              return;
            }
            router.push(`/play/room/${normalized}`);
          }}
        >
          <label htmlFor="room-code" className="sr-only">
            Room code
          </label>
          <input
            id="room-code"
            className="input h-[30px] min-h-0 w-[88px] py-1 text-center font-heading uppercase tracking-[.14em]"
            placeholder="CODE"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="off"
          />
          <Button type="submit" size="sm">
            JOIN
          </Button>
        </form>
      </div>
    </Blueprint>
  );
}
