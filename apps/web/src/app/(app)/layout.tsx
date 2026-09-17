import { prisma } from "@quizbo/db";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { CoachDrawer } from "@/components/shell/coach-drawer";
import { ShellProvider } from "@/components/shell/shell-context";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { loadSidebar } from "@/lib/data/sidebar";
import { getActiveSubject, subjectLabel } from "@/lib/data/subjects";
import { requireViewer } from "@/lib/session";
import { MOTIVATION_LABEL } from "@/lib/utils";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  const { subject, subjects } = await getActiveSubject();
  const [sidebar, bankCount, jar] = await Promise.all([
    subject ? loadSidebar(viewer, subject) : Promise.resolve(null),
    subject ? prisma.question.count({ where: { validated: true, topic: { subjectId: subject.id } } }) : Promise.resolve(0),
    cookies(),
  ]);

  const profileLine = [viewer.motivationStyle ? MOTIVATION_LABEL[viewer.motivationStyle] : null, `${viewer.dailyStudyMinutes} min/day`]
    .filter(Boolean)
    .join(" · ");

  return (
    <ShellProvider initialNavHidden={jar.get("qz-nav")?.value === "hidden"}>
      <AppFrame
        sidebar={
          <Sidebar
            profileName={viewer.name ?? "Student"}
            profileLine={profileLine}
            subject={subject ? { id: subject.id, label: subjectLabel(subject) } : null}
            subjects={subjects.map((s) => ({ id: s.id, label: subjectLabel(s) }))}
            data={sidebar}
          />
        }
        topbar={<TopBar bankCount={bankCount} />}
        coach={<CoachDrawer />}
      >
        <main className="flex-1">{children}</main>
      </AppFrame>
    </ShellProvider>
  );
}
