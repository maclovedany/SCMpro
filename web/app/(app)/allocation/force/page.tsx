import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { fetchForcePool, forcePoolSummary } from "@/lib/queries/customers";
import { KpiTile, type KpiTileProps } from "@/components/cards/KpiTile";
import { fmtInt } from "@/lib/format";
import { ForcePanel } from "./ForcePanel";
/** 강제 배정 (R-AL-53/54, D-058): 사업강화부가 큐 순서와 무관하게 고객사 주문에 가용재고 일부를 배정. KPI → 차트 → 표 */
export default async function ForceAllocPage() {
  const p = await getProfile(); if (!p) redirect("/login");
  if (!["biz_enable", "scm_lead", "admin"].includes(p.role)) redirect("/dashboard");
  const rows = await fetchForcePool(await createServerSupabase()); const s = forcePoolSummary(rows);
  const quota = s.items.reduce((a, i) => a + i.quota, 0), used = s.items.reduce((a, i) => a + i.used, 0);
  const kpis: KpiTileProps[] = [
    { label: "부족이 남은 고객사 주문", value: fmtInt(s.orders), sub: "고객코드가 있는 대기·부분배정 주문", href: "#pool", accent: "ops", icon: "ListOrdered" },
    { label: "지금 강제배정 가능", value: fmtInt(s.eligible), sub: "가용재고와 한도가 남은 주문", href: "#pool", accent: "stock", icon: "Zap", tone: s.eligible > 0 ? "default" : "warn" },
    { label: "품목 한도", value: s.pct == null ? "-" : `${fmtInt(s.pct)}%`, sub: "품목 현재고 대비 (관리 › 시스템 설정에서 변경)", href: "#quota", accent: "cycle", icon: "Percent" },
    { label: "한도 사용", value: `${fmtInt(used)} / ${fmtInt(quota)}`, sub: "대상 품목의 강제배정 누계 / 한도 합", href: "#quota", accent: "risk", icon: "Gauge", progress: quota > 0 ? { pct: Math.min(100, used / quota * 100) } : undefined },
  ];
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">강제 배정</h1>
        <p className="text-sm text-muted-foreground">입고된 물량 중 <b>일부</b>를 요청 순서와 무관하게 특정 고객사 주문에 배정합니다. 조건: 사유 필수 · 수량 ≤ 주문 부족 ≤ 가용재고 · 고객사가 제출한 필요 수량 이내 · 품목 현재고의 한도(%) 이내. 임시배정으로 생성되어 30일 안에 수주 확정이 필요하고, 영업담당·SCM 에 즉시 알림이 갑니다 (R-AL-53/54).</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="fa-kpi">{kpis.map(k => <KpiTile key={k.label} {...k} />)}</div>
      <ForcePanel rows={rows} items={s.items} />
    </div>
  );
}
