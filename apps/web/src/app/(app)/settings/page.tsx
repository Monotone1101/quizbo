import type { Metadata } from "next";
import { signOutAction } from "@/app/actions/auth";
import { EggShelf } from "@/components/fun/egg-shelf";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Blueprint } from "@/components/ui/blueprint";
import { requireViewer } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireViewer();

  return (
    <div className="flex max-w-[820px] flex-col gap-6 p-4 md:p-[26px]">
      <div className="border-b border-divider pb-[18px]">
        <div className="qz-lab text-accent-700">Account</div>
        <div className="mt-1 font-heading text-[42px] font-semibold leading-none">Settings</div>
      </div>

      <Blueprint className="p-5">
        <h4>Study profile</h4>
        <p className="text-[13px] text-neutral-600">
          Your daily time is the planner&apos;s hard budget; motivation style sets the coach&apos;s tone and what your home screen shows first.
        </p>
        <SettingsForm
          defaults={{
            name: viewer.name ?? "",
            dailyStudyMinutes: viewer.dailyStudyMinutes,
            motivationStyle: viewer.motivationStyle ?? "COMPETITIVE",
            timezone: viewer.timezone,
          }}
        />
      </Blueprint>

      <Blueprint className="flex flex-wrap items-center gap-4 p-5">
        <div>
          <h4 className="mb-0.5">Appearance</h4>
          <p className="m-0 text-[13px] text-neutral-600">Night mode is remembered on this device.</p>
        </div>
        <span className="ml-auto">
          <ThemeToggle />
        </span>
      </Blueprint>

      <EggShelf />

      <Blueprint className="flex flex-wrap items-center gap-4 p-5">
        <div>
          <h4 className="mb-0.5">Signed in</h4>
          <p className="m-0 text-[13px] text-neutral-600">
            {viewer.isDemo ? "Demo account — it lives on this browser." : (viewer.email ?? "Signed in")}
          </p>
        </div>
        <form action={signOutAction} className="ml-auto">
          <button type="submit" className="btn btn-secondary">
            SIGN OUT
          </button>
        </form>
      </Blueprint>
    </div>
  );
}
