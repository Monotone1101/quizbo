import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { EasterEggs } from "@/components/fun/easter-eggs";
import { ThemeBoot } from "@/components/shell/theme-boot";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import "./globals.css";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-barlow", display: "swap" });
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Quizbo", template: "%s · Quizbo" },
  description: "Study · Battle · Rank — 1v1 quiz battles, an AI coach, and a planner that reads your mastery.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffaff" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1b18" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The saved theme is applied on the server; ThemeBoot picks the OS preference on a first visit.
  const theme = (await cookies()).get("qz-theme")?.value;
  return (
    <html
      lang="en"
      className={cn(barlow.variable, barlowCondensed.variable, theme === "dark" && "qz-dark")}
      suppressHydrationWarning
    >
      <body>
        <ThemeBoot />
        {children}
        <Toaster />
        <EasterEggs />
      </body>
    </html>
  );
}
