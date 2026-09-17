"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { forceAllocate } from "@/app/(app)/sales-orders/actions";
import { maxForceQty, type ForcePoolRow } from "@/lib/queries/customers";
import { ChartCard } from "@/components/cards/ChartCard";
import { StackedBars } from "@/components/charts/MiniCharts";
import { ItemCode } from "@/components/ItemCode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SERIES_LIGHT, SEQ_BLUE } from "@/lib/design/palette";
import { fmtInt, fmtDate } from "@/lib/format";
type Item = { item_code: string; description: string | null; quota: number; used: number; remaining: number; available: number; orders: number };
export function ForcePanel({ rows, items }: { rows: ForcePoolRow[]; items: Item[] }) {
  const router = useRouter(); const [pending, start] = useTransition();
  const [v, setV] = useState<Record<string, { q: string; r: string }>>({});
  const tight = [...items].sort((a, b) => a.remaining - b.remaining)[0];
  return (
    <div className="space-y-6">
      <div id="quota" data-testid="fa-chart">
        <ChartCard title="품목별 강제배정 한도 — 사용 · 잔여" insight={tight ? `${tight.item_code} 잔여 한도 ${fmtInt(tight.remaining)} — 가장 적음` : "대상 품목 없음"} accent="risk">
          <StackedBars height={240} categories={items.map(i => i.item_code)} series={[{ name: "사용", data: items.map(i => i.used) }, { name: "잔여", data: items.map(i => i.remaining) }]} colors={[SERIES_LIGHT[1], SEQ_BLUE[1]]} /></ChartCard>
      </div>
      <section id="pool" className="overflow-x-auto rounded-md border p-3">
        <table className="w-full text-sm"><thead><tr className="whitespace-nowrap text-left text-muted-foreground"><th className="py-1">품목</th><th>고객사</th><th>주문</th><th className="text-right">부족</th><th className="text-right">가용</th><th className="text-right">고객 필요</th><th className="text-right">품목 한도 잔여</th><th className="text-right">최대</th><th>수량</th><th>사유 *</th><th></th></tr></thead>
          <tbody>{rows.map(o => { const max = maxForceQty(o); const e = v[o.order_id] ?? { q: "", r: "" }; return (
            <tr key={o.order_id} className="border-t" data-testid="force-row">
              <td className="py-1"><ItemCode code={o.item_code} name={o.description} /></td>
              <td className="whitespace-nowrap">{o.customer_name}{o.is_strategic && <Badge variant="outline" className="ml-1 text-[10px]">전략</Badge>}{o.is_dummy && <Badge variant="secondary" className="ml-1 text-[10px]">더미</Badge>}</td>
              <td className="whitespace-nowrap font-mono text-xs">{o.order_no}<span className="ml-1 font-sans text-muted-foreground">{fmtDate(o.requested_at)}</span></td>
              <td className="text-right tabular-nums">{fmtInt(o.shortage)}</td><td className="text-right tabular-nums">{fmtInt(o.available)}</td>
              <td className="whitespace-nowrap text-right tabular-nums">{o.customer_need == null ? "-" : `${fmtInt(o.customer_forced_qty)} / ${fmtInt(o.customer_need)}`}</td>
              <td className="text-right tabular-nums">{fmtInt(Math.max(0, o.item_quota - o.item_forced_qty))}</td>
              <td className="text-right font-semibold tabular-nums">{fmtInt(max)}</td>
              <td><input type="number" min={1} max={max} aria-label={`${o.order_no} 강제배정 수량`} className="h-8 w-20 rounded border px-1" value={e.q} disabled={max <= 0} onChange={ev => setV({ ...v, [o.order_id]: { ...e, q: ev.target.value } })} /></td>
              <td><input aria-label={`${o.order_no} 강제배정 사유`} className="h-8 w-48 rounded border px-1" value={e.r} disabled={max <= 0} onChange={ev => setV({ ...v, [o.order_id]: { ...e, r: ev.target.value } })} /></td>
              <td><Button size="sm" variant="outline" disabled={pending || max <= 0 || !(Number(e.q) > 0) || !e.r.trim()} onClick={() => start(async () => { const r = await forceAllocate(o.order_id, Number(e.q), e.r);
                if (r.ok) { toast.success(`강제배정 ${fmtInt(Number(e.q))}개 — ${o.customer_name}`); setV({ ...v, [o.order_id]: { q: "", r: "" } }); router.refresh(); } else toast.error(r.error); })}>강제 배정</Button></td>
            </tr>); })}
            {rows.length === 0 && <tr><td colSpan={11} className="py-6 text-center text-muted-foreground">부족이 남은 고객사 주문이 없습니다</td></tr>}</tbody></table>
        <p className="mt-2 text-xs text-muted-foreground">최대 = min(부족, 가용, 품목 한도 잔여, 고객 필요 잔여). 고객 필요 「-」 는 수요자료 라인이 없어 고객사 한도를 적용하지 않는 경우입니다.</p>
      </section>
    </div>
  );
}
