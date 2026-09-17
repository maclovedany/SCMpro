"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setPriority } from "@/app/(app)/sales-orders/actions";
import { SO_STATUS, type SalesOrderRow } from "@/lib/queries/allocation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtInt, fmtDate } from "@/lib/format";
import { ItemCode } from "@/components/ItemCode";
export function PriorityTable({ rows }: { rows: SalesOrderRow[] }) {
  const router = useRouter(); const [pending, start] = useTransition();
  const [v, setV] = useState<Record<string, { p: string; r: string }>>({});
  return (
    <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-1">품목</th><th>주문번호</th><th>고객</th><th className="text-right">수량</th><th className="text-right">부족</th><th>상태</th><th>요청</th><th>우선순위</th><th>사유</th><th></th></tr></thead>
      <tbody>{rows.map(o => { const e = v[o.id!] ?? { p: String(o.priority), r: "" }; return (
        <tr key={o.id} className="border-t" data-testid="prio-row"><td className="py-1"><ItemCode code={o.item_code} name={o.description} /></td><td className="font-mono">{o.order_no}</td><td>{o.customer}</td><td className="text-right tabular-nums">{fmtInt(Number(o.qty))}</td><td className="text-right tabular-nums">{fmtInt(Number(o.shortage))}</td><td><Badge variant="secondary">{SO_STATUS[o.status!]}</Badge></td><td className="text-xs">{fmtDate(o.requested_at)}</td>
          <td><input type="number" aria-label={`${o.order_no} 우선순위`} className="h-8 w-20 rounded border px-1" value={e.p} onChange={ev => setV({ ...v, [o.id!]: { ...e, p: ev.target.value } })} /></td>
          <td><input aria-label={`${o.order_no} 사유`} className="h-8 w-40 rounded border px-1" value={e.r} onChange={ev => setV({ ...v, [o.id!]: { ...e, r: ev.target.value } })} /></td>
          <td><Button size="sm" variant="outline" disabled={pending || e.p === String(o.priority)} onClick={() => start(async () => { const r = await setPriority(o.id!, Number(e.p), e.r); if (r.ok) { toast.success("우선순위 변경"); router.refresh(); } else toast.error(r.error); })}>저장</Button></td></tr>); })}
      {rows.length === 0 && <tr><td colSpan={10} className="py-4 text-center text-muted-foreground">진행 중 주문 없음</td></tr>}</tbody></table>
  );
}
