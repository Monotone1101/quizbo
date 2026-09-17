import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/shell/sidebar";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { requireViewer } from "@/lib/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const viewer = await requireViewer({ onboarded: false });
  if (viewer.onboardedAt) redirect("/dashboard");

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-[780px]">
        <div className="mb-10 flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="qz-lab text-accent-700">Setup · four questions</div>
        <h1 className="mt-1">Four questions, then you&apos;re in.</h1>
        <p className="mb-8 max-w-[560px] text-neutral-700">
          Your answers set your starting match band, how the coach talks to you, and what your home screen puts first. You can change
          them later in settings.
        </p>
        <OnboardingForm defaultName={viewer.name ?? ""} />
      </div>
    </main>
  );
}
