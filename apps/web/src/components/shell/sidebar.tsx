import Link from "next/link";
import { LootDrops } from "@/components/fun/loot";
import { Blueprint } from "@/components/ui/blueprint";
import type { SidebarData } from "@/lib/data/sidebar";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { SubjectSwitcher } from "./subject-switcher";

export { Logo };

function SectionHeader({ title, aside }: { title: string; aside: React.ReactNode }) {
  return (
    <div className="mb-[9px] flex items-baseline justify-between">
      <span className="qz-lab">{title}</span>
      <span className="text-[10px] text-neutral-600">{aside}</span>
    </div>
  );
}

export function Sidebar({
  profileName,
  profileLine,
  subject,
  subjects,
  data,
}: {
  profileName: string;
  profileLine: string;
  subject: { id: string; label: string } | null;
  subjects: Array<{ id: string; label: string }>;
  data: SidebarData | null;
}) {
  return (
    <>
      <div className="border-b border-divider px-5 pb-4 pt-5">
        <Link href="/dashboard" className="text-text no-underline hover:text-text">
          <Logo />
        </Link>
      </div>

      <div className="border-b border-divider px-5 py-3.5">
        <div className="qz-lab mb-[7px] text-neutral-600">Subject</div>
        <SubjectSwitcher current={subject} options={subjects} />
      </div>

      <div className="border-b border-divider px-5 py-4">
        <SectionHeader title="Ranking" aside={data?.rankingLabel ?? "WEEKLY"} />
        {data?.ranking.length ? (
          data.ranking.map((row) => (
            <div
              key={row.userId}
              className={cn("-mx-[7px] flex items-center gap-[9px] px-[7px] py-[5px]", row.you && "bg-accent-100")}
            >
              <span className="qz-num w-4 text-[13px] text-neutral-600">{row.rank}</span>
              <span className="flex-1 truncate text-[13px]">{row.name}</span>
              <span className="qz-num text-[14px]">{row.elo}</span>
            </div>
          ))
        ) : (
          <p className="m-0 text-[12px] text-neutral-600">No ranked battles this week yet.</p>
        )}
      </div>

      <div className="border-b border-divider px-5 py-4">
        <SectionHeader
          title="Upcoming"
          aside={
            <Link href="/planner" className="text-[10px] no-underline">
              PLANNER →
            </Link>
          }
        />
        <div className="flex flex-col gap-[9px]">
          {data?.upcoming.length ? (
            data.upcoming.map((item) => (
              <div key={item.id} className="flex items-start gap-2.5">
                <div className="qz-num w-[34px] flex-none border-r border-divider pr-2 text-right text-[11px] text-accent-700">
                  {item.day}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] leading-tight">{item.topic}</div>
                  <div className="text-[11px] text-neutral-600">{item.meta}</div>
                </div>
              </div>
            ))
          ) : (
            <p className="m-0 text-[12px] text-neutral-600">Nothing scheduled. Tell the planner about an exam.</p>
          )}
        </div>
      </div>

      <div className="flex-1 px-5 py-4">
        <LootDrops picks={data?.resources ?? []} />
      </div>

      <div className="flex items-center gap-2.5 border-t border-divider px-5 py-3.5">
        <Blueprint corners="diagonal" className="qz-hatch h-[30px] w-[30px] flex-none" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] leading-tight">{profileName}</div>
          <div className="truncate text-[11px] text-neutral-600">{profileLine}</div>
        </div>
        <Link href="/settings" className="btn btn-ghost text-[11px]">
          SETTINGS
        </Link>
      </div>
    </>
  );
}
