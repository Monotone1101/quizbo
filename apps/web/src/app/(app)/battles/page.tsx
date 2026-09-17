import type { Metadata } from "next";
import { RecentBattles } from "@/components/dashboard/dashboard-sections";
import { ButtonLink } from "@/components/ui/button";
import { loadRecentBattles } from "@/lib/data/dashboard";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Battles" };

export default async function BattlesPage() {
  const viewer = await requireViewer();
  const rows = await loadRecentBattles(viewer, { take: 60 });
  const won = rows.filter((r) => r.won).length;
  const forfeits = rows.filter((r) => r.result === "FORFEIT").length;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-[26px]">
      <div className="flex flex-wrap items-end gap-x-[26px] gap-y-4 border-b border-divider pb-[18px]">
        <div>
          <div className="qz-lab text-accent-700">History · all subjects</div>
          <div className="mt-1 font-heading text-[56px] font-semibold leading-none">BATTLES</div>
        </div>
        <div className="flex flex-wrap gap-x-[26px] gap-y-3 md:ml-auto md:text-right">
          <div>
            <div className="qz-lab text-neutral-600">Played</div>
            <div className="qz-num text-[34px]">{rows.length}</div>
          </div>
          <div>
            <div className="qz-lab text-neutral-600">Won</div>
            <div className="qz-num text-[34px]">{won}</div>
          </div>
          <div>
            <div className="qz-lab text-neutral-600">Win rate</div>
            <div className="qz-num text-[34px]">{rows.length ? Math.round((won / rows.length) * 100) : 0}%</div>
          </div>
          <div>
            <div className="qz-lab text-neutral-600">Forfeits</div>
            <div className="qz-num text-[34px]">{forfeits}</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/play" variant="primary">
          START NEW MATCH
        </ButtonLink>
        <ButtonLink href="/play/invite">INVITE A FRIEND</ButtonLink>
      </div>
      <RecentBattles rows={rows} title="Every battle" showAll={false} />
    </div>
  );
}
