import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchPlan, buildTreeRows, LINE_PAGE } from "@/lib/queries/orders";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster } from "@/lib/auth/roles";
import { DrillCard } from "@/components/cards/DrillCard";
import { Badge } from "@/components/ui/badge";
import { drillHref } from "@/lib/drill";
import { fmtInt } from "@/lib/format";
import { PlanDetail } from "./PlanDetail";
const STATUS: Record<string, string> = { draft: "초안", confirmed: "확정(승인 대기)", approved: "승인", rejected: "반려" };
export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params; const sp = await searchParams;
  const p = await getProfile();
  const sb = await createServerSupabase();
  const f = { risk: sp.risk === "true", blocked: sp.blocked === "true", flex: sp.flex === "true", category: sp.category, q: sp.q };
  const page = Number(sp.page ?? 1) || 1;
  const { plan, lines, count, catAgg } = await fetchPlan(sb, id, f, page);
  if (!plan) notFound();
  const shown = lines;
  const s = (plan.summary ?? {}) as Record<string, number>;
  const months = Array.from(new Set(Object.values(catAgg).flatMap(c => Object.keys(c)))).sort();
  const treeRows = buildTreeRows(catAgg, shown, months);
  const base = `/orders/${id}`;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><h1 className="text-xl font-semibold">발주 계획 {plan.plan_ym}</h1><Badge variant={plan.status === "approved" ? "default" : "outline"}>{STATUS[plan.status] ?? plan.status}</Badge><Link className="text-sm underline" href={`${base}/report`}>보고서</Link></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <DrillCard label="라인" value={fmtInt(s.lines)} hint="SW 제외 예측 대상 품목" href={base} />
        <DrillCard label="총 발주금액" value={`₩${fmtInt(s.amount)}`} hint={`수량 ${fmtInt(s.qty)}`} href={`${base}/report`} />
        <DrillCard label="품절 위험" value={fmtInt(s.stockout)} href={drillHref(base, { risk: true })} tone={s.stockout > 0 ? "warn" : "default"} />
        <DrillCard label="확정 차단" value={fmtInt(s.blocked)} hint="목표 DoS 미설정 (R-OQ-03)" href={drillHref(base, { blocked: true })} tone={s.blocked > 0 ? "danger" : "default"} />
        <DrillCard label="오버라이드" value={fmtInt(s.overrides ?? 0)} hint="사유 필수 (R-OQ-41)" href={base} />
      </div>
      <PlanDetail plan={{ id: plan.id, plan_ym: plan.plan_ym, status: plan.status }} lines={shown} treeRows={treeRows} months={months} filters={f} canEdit={!!p && canWriteMaster(p.role) && plan.status === "draft"} total={count} page={page} pageSize={LINE_PAGE} />
    </div>
  );
}
