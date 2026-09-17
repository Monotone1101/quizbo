"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Blueprint } from "@/components/ui/blueprint";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Blueprint className="w-full max-w-[520px] p-[34px]">
        <div className="qz-lab text-accent-700">Something broke</div>
        <div className="mt-1 font-heading text-[28px] font-semibold">That didn&apos;t load</div>
        <p className="mb-4 mt-1.5 text-[13px] text-neutral-700">
          Your battles and plan are safe. Try again, or head back to the dashboard.
          {error.digest && <span className="block text-[11px] text-neutral-600">Reference: {error.digest}</span>}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary" onClick={reset}>
            TRY AGAIN
          </button>
          <Link href="/dashboard" className="btn btn-secondary">
            DASHBOARD
          </Link>
        </div>
      </Blueprint>
    </main>
  );
}
