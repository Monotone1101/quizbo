"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteExamAction, replanAction } from "@/app/actions/planner";
import { Button } from "@/components/ui/button";

export function ReplanButton({ label = "RE-PLAN", variant = "secondary" }: { label?: string; variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await replanAction();
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
          router.refresh();
        })
      }
    >
      {pending ? "PLANNING…" : label}
    </Button>
  );
}

export function RemoveExamButton({ examId }: { examId: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      className="text-[11px]"
      disabled={pending}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        startTransition(async () => {
          const result = await deleteExamAction(examId);
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
          router.refresh();
        });
      }}
    >
      {pending ? "REMOVING…" : armed ? "CONFIRM REMOVE" : "REMOVE"}
    </Button>
  );
}
