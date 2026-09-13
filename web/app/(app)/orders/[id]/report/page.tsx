import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchPlan, fetchPrevApprovedPlan } from "@/lib/queries/orders";
import { fmtInt, fmtPct, fmtDateTime } from "@/lib/format";
import { ReportActions } from "./ReportActions";
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createServerSupabase();
  const { plan, lines } = await fetchPlan(sb, id);
  if (!plan) notFound();
  const prev = await fetchPrevApprovedPlan(sb, plan.plan_ym);
  const q = (l: typeof lines[number]) => Number(l.override_qty ?? l.final_qty ?? 0);
  const total = lines.reduce((a, l) => a + Number(l.amount ?? 0), 0);
  const prevAmt = prev ? Number(prev.amount) : null;
  const byCat = Object.entries(lines.reduce((m, l) => { const c = l.category ?? "-"; m[c] = m[c] ?? { n: 0, qty: 0, amount: 0, base: 0, req: 0 }; m[c].n++; m[c].qty += q(l); m[c].amount += Number(l.amount ?? 0); m[c].base += Number(l.flex_base ?? 0); m[c].req += Number(l.required_qty ?? 0); return m; }, {} as Record<string, { n: number; qty: number; amount: number; base: number; req: number }>));
  const bySup = Object.entries(lines.reduce((m, l) => { const c = String(l.supplier_id ?? "-"); m[c] = m[c] ?? { n: 0, amount: 0 }; m[c].n++; m[c].amount += Number(l.amount ?? 0); return m; }, {} as Record<string, { n: number; amount: number }>));
  const top = [...lines].sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0)).slice(0, 20);
  return (
    <div className="mx-auto max-w-4xl space-y-5 print:max-w-none">
      <div className="flex items-start justify-between"><div><h1 className="text-xl font-semibold">발주 보고 — {plan.plan_ym}</h1><p className="text-sm text-muted-foreground">상태 {plan.status} · 생성 {fmtDateTime(plan.created_at)} · 승인 {fmtDateTime(plan.approved_at)} (업무절차 ⑦)</p></div><ReportActions planYm={plan.plan_ym} lines={lines.map(l => ({ code: l.key_code, category: l.category, need_ym: l.need_ym, qty: q(l), amount: Number(l.amount ?? 0) }))} /></div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">당월 총 발주금액</div><div className="text-2xl font-semibold">₩{fmtInt(total)}</div></div>
        <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">전월 승인 계획 대비</div><div className="text-2xl font-semibold">{prevAmt ? fmtPct((total - prevAmt) / prevAmt) : "-"}</div><div className="text-xs text-muted-foreground">{prev ? `${prev.plan_ym} ₩${fmtInt(prevAmt!)}` : "전월 계획 없음"}</div></div>
        <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">제출 OL 대비 필요량</div><div className="text-2xl font-semibold">{(() => { const b = lines.reduce((a, l) => a + Number(l.flex_base ?? 0), 0); const r = lines.filter(l => l.flex_base != null).reduce((a, l) => a + Number(l.required_qty ?? 0), 0); return b ? fmtPct((r - b) / b) : "-"; })()}</div><div className="text-xs text-muted-foreground">Flex 기준 (R-OQ-10)</div></div>
      </div>
      <section><h2 className="mb-1 text-sm font-medium">카테고리별</h2><table className="w-full text-sm"><thead><tr className="text-muted-foreground"><th className="text-left">카테고리</th><th className="text-right">품목</th><th className="text-right">발주 수량</th><th className="text-right">금액</th><th className="text-right">제출 OL</th><th className="text-right">필요량</th></tr></thead>
        <tbody>{byCat.map(([c, v]) => <tr key={c} className="border-t tabular-nums"><td className="py-1">{c}</td><td className="text-right">{fmtInt(v.n)}</td><td className="text-right">{fmtInt(v.qty)}</td><td className="text-right">₩{fmtInt(v.amount)}</td><td className="text-right">{fmtInt(v.base)}</td><td className="text-right">{fmtInt(v.req)}</td></tr>)}</tbody></table></section>
      <section><h2 className="mb-1 text-sm font-medium">공급처별</h2><table className="w-full text-sm"><tbody>{bySup.map(([c, v]) => <tr key={c} className="border-t tabular-nums"><td className="py-1">공급처 #{c}</td><td className="text-right">{fmtInt(v.n)} 품목</td><td className="text-right">₩{fmtInt(v.amount)}</td></tr>)}</tbody></table></section>
      <section><h2 className="mb-1 text-sm font-medium">금액 상위 20 품목</h2><table className="w-full text-sm"><tbody>{top.map(l => <tr key={l.id} className="border-t tabular-nums"><td className="py-1 font-mono">{l.key_code}</td><td>{l.category}</td><td className="text-right">{fmtInt(q(l))}</td><td className="text-right">₩{fmtInt(Number(l.amount ?? 0))}</td><td className="text-xs text-muted-foreground">{l.override_reason ?? ""}</td></tr>)}</tbody></table></section>
    </div>
  );
}
