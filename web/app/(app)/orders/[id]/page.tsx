import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchPlan, fetchPlanOverview, planCharts, buildTreeRows, LINE_PAGE, fetchPlanScorecard, scorecardInsight, OUTCOME_LABEL } from "@/lib/queries/orders";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster } from "@/lib/auth/roles";
import { KpiTile, type KpiTileProps } from "@/components/cards/KpiTile";
import { OrderCharts } from "../OrderCharts";
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
  const [{ plan, lines, count, catAgg }, ov, sc] = await Promise.all([fetchPlan(sb, id, f, page), fetchPlanOverview(sb, id), fetchPlanScorecard(sb, id)]);
  if (!plan) notFound();
  const c = planCharts(ov);
  const shown = lines;
  const s = (plan.summary ?? {}) as Record<string, number>;
  const months = Array.from(new Set(Object.values(catAgg).flatMap(c => Object.keys(c)))).sort();
  const treeRows = buildTreeRows(catAgg, shown, months);
  const base = `/orders/${id}`;
  const won = (n: number) => (Math.abs(n) >= 1e8 ? `${(n / 1e8).toFixed(n >= 1e9 ? 0 : 1)}억` : `₩${fmtInt(n)}`);
  const kpis: KpiTileProps[] = [
    { label: "라인", value: fmtInt(s.lines), sub: "SW 제외 예측 대상 품목", href: base, accent: "cycle", icon: "ListOrdered" },
    { label: "총 발주 금액", value: won(Number(s.amount ?? 0)), sub: `수량 ${fmtInt(s.qty)} · 원값 ₩${fmtInt(s.amount)}`, href: `${base}/report`, accent: "cycle", icon: "Coins" },
    { label: "품절 위험", value: fmtInt(s.stockout), sub: "필요월 기초재고 < 수요", href: drillHref(base, { risk: true }), accent: "risk", icon: "AlertTriangle", tone: s.stockout > 0 ? "warn" : "default", progress: s.lines ? { pct: 100 * s.stockout / s.lines, label: `라인의 ${Math.round(100 * s.stockout / s.lines)}%` } : undefined },
    { label: "확정 차단", value: fmtInt(s.blocked), sub: "목표 DoS 미설정 (R-OQ-03)", href: drillHref(base, { blocked: true }), accent: "risk", icon: "Ban", tone: s.blocked > 0 ? "danger" : "default" },
    { label: "오버라이드", value: fmtInt(s.overrides ?? 0), sub: "사유 필수 (R-OQ-41) · Flex 도달 " + fmtInt(s.flex_hit), href: base, accent: "ops", icon: "PenLine" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><h1 className="text-xl font-semibold">발주 계획 {plan.plan_ym}</h1><Badge variant={plan.status === "approved" ? "default" : "outline"}>{STATUS[plan.status] ?? plan.status}</Badge><Link className="text-sm underline" href={`${base}/report`}>보고서</Link></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="plan-kpi">{kpis.map(k => <KpiTile key={k.label} {...k} />)}</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="plan-charts">
        <OrderCharts kind="category" c={c} base={base} /><OrderCharts kind="needYm" c={c} base={base} /><OrderCharts kind="topItems" c={c} base={base} /><OrderCharts kind="risk" c={c} base={base} />
      </div>
      {plan.status === "approved" && <section className="scm-card rounded-xl p-3" data-testid="plan-scorecard" style={{ "--acc": "#1baf7a", "--acc-soft": "#e6f6ef" } as React.CSSProperties}>
        <div className="flex items-center gap-2 text-sm font-semibold"><span className="inline-block h-3.5 w-1 rounded-full bg-[#1baf7a]" />지난 계획 채점 — 제안 vs 실제 발주 vs 결과 (D-044)</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{scorecardInsight(sc)}</p>
        {sc.scored > 0 && <div className="mt-2 grid gap-3 md:grid-cols-2">
          <table className="text-sm"><thead><tr className="text-muted-foreground"><th className="text-left">구분</th><th className="text-right">결품</th><th className="text-right">과잉</th><th className="text-right">적정</th></tr></thead>
            <tbody><tr className="border-t tabular-nums"><td className="py-1">실제 발주(오버라이드 반영)</td><td className="text-right">{fmtInt(sc.human.stockout)}</td><td className="text-right">{fmtInt(sc.human.excess)}</td><td className="text-right">{fmtInt(sc.human.ok)}</td></tr>
              <tr className="border-t tabular-nums"><td className="py-1">시스템 제안대로였다면</td><td className="text-right">{fmtInt(sc.system.stockout)}</td><td className="text-right">{fmtInt(sc.system.excess)}</td><td className="text-right">{fmtInt(sc.system.ok)}</td></tr></tbody></table>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-muted-foreground"><th className="text-left">품목</th><th>필요월</th><th className="text-right">제안</th><th className="text-right">발주</th><th className="text-right">실적</th><th className="text-right">기말</th><th>결과(실제/제안)</th></tr></thead>
            <tbody>{sc.worst.slice(0, 10).map(w => <tr key={w.key_code + w.need_ym} className="border-t tabular-nums"><td className="py-1 font-mono"><Link className="underline" href={`/items/${w.key_code}`}>{w.key_code}</Link> <span className="text-xs text-muted-foreground">{w.abc ?? ""}</span></td><td>{w.need_ym}</td><td className="text-right">{fmtInt(w.proposed)}</td><td className="text-right">{fmtInt(w.ordered)}</td><td className="text-right">{fmtInt(w.actual)}</td><td className="text-right">{fmtInt(w.realized_end)}</td><td>{OUTCOME_LABEL[w.outcome_h]} / {OUTCOME_LABEL[w.outcome_s]}{w.override_reason && <span className="ml-1 text-xs text-muted-foreground" title={w.override_reason}>사유</span>}</td></tr>)}</tbody></table></div>
        </div>}
      </section>}
      <PlanDetail plan={{ id: plan.id, plan_ym: plan.plan_ym, status: plan.status }} lines={shown} treeRows={treeRows} months={months} filters={f} canEdit={!!p && canWriteMaster(p.role) && plan.status === "draft"} total={count} page={page} pageSize={LINE_PAGE} />
    </div>
  );
}
