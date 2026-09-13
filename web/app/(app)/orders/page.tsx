import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchPlans, fetchPlanOverview, planCharts, planHistory } from "@/lib/queries/orders";
import { getProfile } from "@/lib/auth/getProfile";
import { canUpload } from "@/lib/auth/roles";
import { KpiTile, type KpiTileProps } from "@/components/cards/KpiTile";
import { Badge } from "@/components/ui/badge";
import { fmtInt, fmtDateTime } from "@/lib/format";
import { drillHref } from "@/lib/drill";
import { GeneratePlanForm } from "./GeneratePlanForm";
import { OrderCharts } from "./OrderCharts";
const STATUS: Record<string, string> = { draft: "초안", confirmed: "확정(승인 대기)", approved: "승인", rejected: "반려" };
const won = (n: number) => (Math.abs(n) >= 1e8 ? `${(n / 1e8).toFixed(n >= 1e9 ? 0 : 1)}억` : `₩${fmtInt(n)}`);
/** 발주 계획 목록 (D-035, R-UI-13): KPI 스트립 + 최신 계획 구성 차트 + 이력 */
export default async function OrdersPage() {
  const p = await getProfile();
  const sb = await createServerSupabase();
  const plans = await fetchPlans(sb);
  const latest = plans[0]; const s = (latest?.summary ?? {}) as Record<string, number>;
  const prevApproved = plans.find(x => x.status === "approved" && x.plan_ym! < (latest?.plan_ym ?? ""));
  const ov = latest ? await fetchPlanOverview(sb, latest.id!) : null; const c = ov ? planCharts(ov) : null; const hist = planHistory(plans);
  const now = new Date(); const defaultYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const base = latest ? `/orders/${latest.id}` : "/orders";
  const amt = Number(latest?.amount ?? 0), prevAmt = prevApproved ? Number(prevApproved.amount) : null; const d = prevAmt ? (amt - prevAmt) / prevAmt : null;
  const kpis: KpiTileProps[] = latest ? [
    { label: `최신 계획 ${latest.plan_ym}`, value: STATUS[latest.status ?? ""] ?? latest.status ?? "-", sub: `라인 ${fmtInt(latest.n_lines)} · ${fmtDateTime(latest.created_at)}`, href: base, accent: "cycle", icon: "ClipboardList" },
    { label: "총 발주 금액", value: won(amt), href: `${base}/report`, accent: "cycle", icon: "Coins", delta: d == null ? undefined : { text: `전월 승인 대비 ${d >= 0 ? "+" : ""}${Math.round(d * 1000) / 10}%`, dir: d > 0.005 ? "up" : d < -0.005 ? "down" : "flat", good: Math.abs(d) < 0.2 }, sub: prevApproved ? `전월 승인 ${won(prevAmt!)}` : "비교 대상 없음" },
    { label: "품절 위험 품목", value: fmtInt(s.stockout), sub: "필요월 기초재고 < 수요 (①품절 최소화)", href: drillHref(base, { risk: true }), accent: "risk", icon: "AlertTriangle", tone: s.stockout > 0 ? "warn" : "default" },
    { label: "확정 차단 (목표 DoS 미설정)", value: fmtInt(s.blocked), sub: "R-OQ-03 · 품목 설정에서 목표 DoS 입력", href: drillHref(base, { blocked: true }), accent: "risk", icon: "Ban", tone: s.blocked > 0 ? "danger" : "default" },
    { label: "Flex 범위 도달", value: fmtInt(s.flex_hit), sub: "제출 OL ±20/30% 클램프 (R-OQ-10)", href: drillHref(base, { flex: true }), accent: "ops", icon: "SlidersHorizontal", progress: latest.n_lines ? { pct: 100 * s.flex_hit / Number(latest.n_lines), label: `라인의 ${Math.round(100 * s.flex_hit / Number(latest.n_lines))}%` } : undefined },
  ] : [];
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">발주 계획</h1><p className="text-sm text-muted-foreground">예측 + 재고 + 입고예정 + 확정 추가수요 → DoS·Flex·MOQ 산출 (R-OQ). 품목담당자 확정 → SCM팀장 승인 → Supplier 제출 OL 기록. 카드·차트를 누르면 해당 라인으로 이동합니다.</p></div>
      {p && canUpload(p.role) && <GeneratePlanForm defaultYm={defaultYm} />}
      {latest && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="op-kpi">{kpis.map(k => <KpiTile key={k.label} {...k} />)}</div>}
      {c && (
        <section data-testid="op-latest">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">최신 계획 구성 — {latest!.plan_ym}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <OrderCharts kind="category" c={c} base={base} /><OrderCharts kind="needYm" c={c} base={base} /><OrderCharts kind="supplier" c={c} base={base} /><OrderCharts kind="risk" c={c} base={base} />
          </div>
        </section>)}
      <section data-testid="op-history">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">계획 이력</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2"><OrderCharts kind="history" history={hist} /></div>
          <div className="scm-card rounded-xl p-3 lg:col-span-3" style={{ "--acc": "#4a3aa7", "--acc-soft": "#ecebf7" } as React.CSSProperties}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-2">발주월</th><th>상태</th><th className="text-right">라인</th><th className="text-right">금액</th><th className="text-right">품절위험</th><th className="text-right">차단</th><th>생성</th><th>승인</th></tr></thead>
              <tbody>{plans.map(r => { const ss = (r.summary ?? {}) as Record<string, number>; return (
                <tr key={r.id} className="border-t hover:bg-white/60"><td className="py-1.5"><Link className="underline" href={`/orders/${r.id}`}>{r.plan_ym}</Link></td><td><Badge variant={r.status === "approved" ? "default" : "outline"}>{STATUS[r.status ?? ""] ?? r.status}</Badge></td>
                  <td className="text-right tabular-nums">{fmtInt(r.n_lines)}</td><td className="text-right tabular-nums">₩{fmtInt(Number(r.amount))}</td><td className="text-right tabular-nums">{fmtInt(ss.stockout)}</td><td className="text-right tabular-nums">{fmtInt(ss.blocked)}</td>
                  <td className="text-xs">{fmtDateTime(r.created_at)}</td><td className="text-xs">{fmtDateTime(r.approved_at)}</td></tr>); })}
              {plans.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">계획 없음 — 위에서 생성하세요</td></tr>}</tbody>
            </table></div>
          </div>
        </div>
      </section>
    </div>
  );
}
