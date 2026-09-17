import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { authProviders } from "@/auth";
import { signInWithGoogle } from "@/app/actions/auth";
import { Logo } from "@/components/shell/sidebar";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Blueprint } from "@/components/ui/blueprint";
import { GridPulse } from "@/components/ui/grid-pulse";
import { getViewer } from "@/lib/session";
import { DemoSignInForm, EmailSignInForm } from "./sign-in-forms";

export const metadata: Metadata = { title: "Sign in" };

const SPECS = [
  ["1v1 battles", "15 validated questions, 12 seconds each. Correct answers hit your opponent; wrong ones hit you."],
  ["Coach", "Explains your misses and turns your chapters into cards you can skim before a match."],
  ["Planner", "Describe your exams in chat. Nothing is saved until you confirm, and the schedule reads your mastery."],
] as const;

const ERRORS: Record<string, string> = {
  CredentialsSignin: "That didn't work — use a name with at least 2 characters.",
  OAuthAccountNotLinked: "That email is already linked to another sign-in method.",
  Verification: "The sign-in link expired. Request a new one.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; check?: string }> }) {
  const viewer = await getViewer();
  if (viewer) redirect(viewer.onboardedAt ? "/dashboard" : "/onboarding");
  const { error, check } = await searchParams;

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_520px]">
      <section className="qz-arena relative hidden overflow-hidden text-white lg:block">
        <GridPulse cell={32} ambient={4} style={{ "--grid-pulse-line": "rgba(255,250,255,0.07)" } as CSSProperties} />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="font-heading text-[19px] font-semibold tracking-[.02em]">QUIZBO</div>
          <div>
            <div className="qz-lab text-white/60">Study · Battle · Rank</div>
            <h1 className="mt-2 max-w-[560px] text-[64px] leading-[0.95]" data-grid-avoid>Beat someone at physics before lunch.</h1>
            <div className="mt-10 grid max-w-[640px] grid-cols-1 gap-5 border-t border-white/20 pt-6 xl:grid-cols-3">
              {SPECS.map(([title, body]) => (
                <div key={title}>
                  <div className="qz-lab text-[#a9cfea]">{title}</div>
                  <p className="mt-1.5 text-[13px] leading-snug text-white/75" data-grid-avoid>{body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[12px] text-white/50">Questions are generated offline and validated before they ever reach a battle.</div>
        </div>
      </section>

      <section className="relative flex items-center justify-center p-6 sm:p-10">
        <ThemeToggle className="btn btn-secondary btn-icon absolute right-6 top-6" />
        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <Logo />
          </div>
          <Blueprint className="flex flex-col gap-5 p-6">
            <div>
              <div className="qz-lab text-accent-700">Sign in</div>
              <h3 className="mb-0 mt-1">Pick up where you left off</h3>
            </div>

            {check === "email" && (
              <p className="m-0 border-l-2 border-accent pl-2.5 text-[13px]">Check your inbox — the sign-in link is on its way.</p>
            )}
            {error && <p className="m-0 border-l-2 border-accent pl-2.5 text-[13px]">{ERRORS[error] ?? "Sign-in failed. Try again."}</p>}

            {authProviders.google && (
              <form action={signInWithGoogle}>
                <button type="submit" className="btn btn-secondary w-full justify-center py-2.5">
                  CONTINUE WITH GOOGLE
                </button>
              </form>
            )}

            {authProviders.email && <EmailSignInForm />}

            {(authProviders.demo || (!authProviders.google && !authProviders.email)) && (
              <div className="flex flex-col gap-2 border-t border-divider pt-4">
                <div className="qz-lab text-neutral-600">Demo account</div>
                <DemoSignInForm />
              </div>
            )}
          </Blueprint>
        </div>
      </section>
    </main>
  );
}
