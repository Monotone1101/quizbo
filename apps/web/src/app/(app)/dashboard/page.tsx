import type { Metadata } from "next";
import { EloCard, QuickNotes, RecentBattles, StreakCard, TodayPlan } from "@/components/dashboard/dashboard-sections";
import { StartMatchPanel } from "@/components/dashboard/start-match-panel";
import { loadDashboard } from "@/lib/data/dashboard";
import { getActiveSubject } from "@/lib/data/subjects";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const { subject } = await getActiveSubject();

  if (!subject) {
    return (
      <div className="p-4 md:p-[26px]">
        <h3>No question bank yet</h3>
        <p className="max-w-[520px] text-neutral-700">
          Seed the curriculum (<code>npm run db:seed</code>) or run the question pipeline, then come back to battle.
        </p>
      </div>
    );
  }

  const data = await loadDashboard(viewer, subject);

  return (
    <div className="flex flex-col gap-[26px] p-4 md:p-[26px]">
      {data.emphasis === "planner" && <TodayPlan sessions={data.today} />}

      <div className="grid grid-cols-1 items-stretch gap-[22px] xl:grid-cols-[minmax(0,1fr)_400px_minmax(0,1fr)]">
        <EloCard subjectName={subject.name} {...data.elo} />
        <StartMatchPanel queueLine={data.queueLine} />
        <StreakCard current={data.streak.current} bestLine={data.streak.bestLine} caption={data.streak.caption} week={data.streak.week} />
      </div>

      <QuickNotes notes={data.notes} />
      <RecentBattles rows={data.recent} />
    </div>
  );
}
