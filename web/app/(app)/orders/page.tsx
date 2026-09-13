import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchPlans } from "@/lib/queries/orders";
import { getProfile } from "@/lib/auth/getProfile";
import { canUpload } from "@/lib/auth/roles";
import { DrillCard } from "@/components/cards/DrillCard";
import { Badge } from "@/components/ui/badge";
import { fmtInt, fmtDateTime } from "@/lib/format";
import { drillHref } from "@/lib/drill";
import { GeneratePlanForm } from "./GeneratePlanForm";
const STATUS: Record<string, string> = { draft: "초안", confirmed: "확정(승인 대기)", approved: "승인", rejected: "반려" };
export default async function OrdersPage() {
  const p = await getProfile();
  const sb = await createServerSupabase();
  const plans = await fetchPlans(sb);
  const latest = plans[0]; const s = (latest?.summary ?? {}) as Record<string, number>;
  const prevApproved = plans.find(x => x.status === "approved" && x.id !== latest?.id);
  const now = new Date(); const defaultYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">발주 계획</h1><p className="text-sm text-muted-foreground">예측 + 재고 + 입고예정 + 확정 추가수요 → DoS·Flex·MOQ 산출 (R-OQ). 품목담당자 확정 → SCM팀장 승인 → Supplier 제출 OL 기록.</p></div>
      {p && canUpload(p.role) && <GeneratePlanForm defaultYm={defaultYm} />}
      {latest && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <DrillCard label={`최신 계획 ${latest.plan_ym}`} value={STATUS[latest.status ?? ""] ?? latest.status ?? "-"} hint={`라인 ${fmtInt(latest.n_lines)} · ${fmtDateTime(latest.created_at)}`} href={`/orders/${latest.id}`} />
          <DrillCard label="총 발주금액" value={`₩${fmtInt(Number(latest.amount))}`} hint={prevApproved ? `전월 승인 ₩${fmtInt(Number(prevApproved.amount))}` : "비교 대상 없음"} href={`/orders/${latest.id}/report`} />
          <DrillCard label="품절 위험 품목" value={fmtInt(s.stockout)} hint="필요월도 기초재고 < 수요 (①품절 최소화)" href={drillHref(`/orders/${latest.id}`, { risk: true })} tone={s.stockout > 0 ? "warn" : "default"} />
          <DrillCard label="확정 차단 (목표 DoS 미설정)" value={fmtInt(s.blocked)} hint="R-OQ-03" href={drillHref(`/orders/${latest.id}`, { blocked: true })} tone={s.blocked > 0 ? "danger" : "default"} />
          <DrillCard label="Flex 범위 도달" value={fmtInt(s.flex_hit)} hint="제출 OL ±20/30% 클램프" href={drillHref(`/orders/${latest.id}`, { flex: true })} />
        </div>)}
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="py-2">발주월</th><th>상태</th><th className="text-right">라인</th><th className="text-right">금액</th><th className="text-right">품절위험</th><th className="text-right">차단</th><th>생성</th><th>승인</th></tr></thead>
        <tbody>{plans.map(r => { const ss = (r.summary ?? {}) as Record<string, number>; return (
          <tr key={r.id} className="border-t hover:bg-muted/40"><td className="py-1.5"><Link className="underline" href={`/orders/${r.id}`}>{r.plan_ym}</Link></td><td><Badge variant={r.status === "approved" ? "default" : "outline"}>{STATUS[r.status ?? ""] ?? r.status}</Badge></td>
            <td className="text-right tabular-nums">{fmtInt(r.n_lines)}</td><td className="text-right tabular-nums">₩{fmtInt(Number(r.amount))}</td><td className="text-right tabular-nums">{fmtInt(ss.stockout)}</td><td className="text-right tabular-nums">{fmtInt(ss.blocked)}</td>
            <td className="text-xs">{fmtDateTime(r.created_at)}</td><td className="text-xs">{fmtDateTime(r.approved_at)}</td></tr>); })}
        {plans.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">계획 없음 — 위에서 생성하세요</td></tr>}</tbody>
      </table>
    </div>
  );
}
