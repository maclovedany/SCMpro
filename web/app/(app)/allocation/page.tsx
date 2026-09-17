import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster, canApprove } from "@/lib/auth/roles";
import { fetchQueue, fetchOpenInbound, fetchPendingPriority, fetchAllocationOverview, allocationCharts } from "@/lib/queries/allocation";
import { KpiTile, type KpiTileProps } from "@/components/cards/KpiTile";
import { fmtInt } from "@/lib/format";
import { AllocationPanel } from "./AllocationPanel";
import { fetchItemNames } from "@/lib/queries/customers";
import { AllocationCharts } from "./AllocationCharts";
/** 재고 배정 (D-036, R-UI-13): KPI 4 + 차트 4 + 큐·입고·승인 패널 */
export default async function AllocationPage() {
  const p = await getProfile(); if (!p || !(canWriteMaster(p.role) || canApprove(p.role))) redirect("/dashboard");
  const sb = await createServerSupabase();
  await headers(); const today = new Date().toISOString().slice(0, 10);
  const [queue, inbound, pending, ov] = await Promise.all([fetchQueue(sb), fetchOpenInbound(sb), fetchPendingPriority(sb), fetchAllocationOverview(sb)]);
  const c = allocationCharts(ov, today);
  const items = new Set(queue.map(q => q.item_code)); const allocatable = queue.filter(q => (q.available ?? 0) > 0).length;
  const kpis: KpiTileProps[] = [
    { label: "대기 주문", value: fmtInt(queue.length), sub: `${items.size} 품목 · 부족 ${fmtInt(Number(ov.alloc_mix.waiting))}개`, href: "#queue", accent: "ops", icon: "ListChecks", tone: queue.length ? "warn" : "default" },
    { label: "배정 가능 (가용 > 0)", value: fmtInt(allocatable), sub: "수동 배정 또는 자동배정 대기", href: "#queue", accent: "stock", icon: "PackageCheck", progress: queue.length ? { pct: 100 * allocatable / queue.length, label: `대기 주문의 ${Math.round(100 * allocatable / queue.length)}%` } : undefined },
    { label: "입고 대기", value: fmtInt(inbound.length), sub: "ordered/shipped → 창고 입고 완료", href: "#inbound", accent: "cycle", icon: "Truck" },
    { label: "우선배정 승인 대기", value: fmtInt(pending.length), sub: "10분마다 팀장 반복 알림 (R-AL-17)", href: "/approvals?status=pending", accent: "risk", icon: "ShieldAlert", tone: pending.length ? "danger" : "default" },
  ];
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">재고 배정</h1><p className="text-sm text-muted-foreground">대기 주문 큐(우선순위 → 검토요청 순), 입고 처리(자동/수동 배정), 수동 우선배정(팀장 승인), 만료·알림 처리 (R-AL-10~17, R-AL-30). 카드·차트를 누르면 해당 목록으로 이동합니다.</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="al-kpi">{kpis.map(k => <KpiTile key={k.label} {...k} />)}</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 charts-4" data-testid="al-charts">
        <AllocationCharts kind="mix" c={c} /><AllocationCharts kind="queue" c={c} /><AllocationCharts kind="expiring" c={c} /><AllocationCharts kind="inbound" c={c} />
      </div>
      <AllocationPanel queue={queue} inbound={inbound as never} pending={pending} names={await fetchItemNames(sb, inbound.map(i => i.item_code))} />
    </div>
  );
}
