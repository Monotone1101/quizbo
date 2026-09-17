import Link from "next/link";
import { Blueprint } from "@/components/ui/blueprint";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Blueprint className="qz-hatch w-full max-w-[520px] p-[34px] text-center">
        <div className="bg-bg px-4 py-3">
          <div className="qz-lab text-neutral-600">404</div>
          <div className="mt-1 font-heading text-[28px] font-semibold">Nothing on this page</div>
          <p className="mx-auto mb-4 mt-1.5 max-w-[360px] text-[13px] text-neutral-700">
            The link may be old, or the battle belongs to someone else.
          </p>
          <Link href="/dashboard" className="btn btn-primary">
            BACK TO DASHBOARD
          </Link>
        </div>
      </Blueprint>
    </main>
  );
}
