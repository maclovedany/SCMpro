"use client";
import { ItemCode } from "@/components/ItemCode";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { receiveInbound, manualAllocate, runTick } from "@/app/(app)/sales-orders/actions";
import { SO_STATUS } from "@/lib/queries/allocation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtInt, fmtDateTime } from "@/lib/format";
type Q = { id: string | null; order_no: string | null; item_code: string | null; description: string | null; qty: number | null; shortage: number | null; status: string | null; priority: number | null; requested_at: string | null; available: number | null; allocation_mode: string | null; queue_pos: number | null; sales_rep_name: string | null };
type I = { id: number; item_code: string; po_no: string | null; qty: number; planned_date: string; status: string; supplier: { code: string; name: string } | null };
type P = { id: string; payload: unknown; reason: string; requested_at: string | null };
export function AllocationPanel({ queue, inbound, pending, names = {} }: { queue: Q[]; inbound: I[]; pending: P[]; names?: Record<string, string> }) {
  const router = useRouter(); const [pendingT, start] = useTransition();
  const [alloc, setAlloc] = useState<Q | null>(null); const [qty, setQty] = useState(""); const [reason, setReason] = useState("");
  const doAlloc = () => alloc && start(async () => { const r = await manualAllocate(alloc.id!, Number(qty), reason); if (r.ok) { const d = r.data as { result: string }; toast.success(d.result === "firm" ? "확정배정 완료" : "승인대기 확보 — 팀장 승인 요청"); setAlloc(null); setQty(""); setReason(""); router.refresh(); } else toast.error(r.error); });
  const receive = (i: I) => start(async () => { const r = await receiveInbound(i.id, new Date().toISOString().slice(0, 10)); if (r.ok) { const d = r.data as { mode: string; auto_allocated_orders: number }; toast.success(`입고 완료 · ${d.mode === "auto" ? `자동배정 ${d.auto_allocated_orders}건` : "수동 배정 대기"}`); router.refresh(); } else toast.error(r.error); });
  const tick = () => start(async () => { const r = await runTick(); if (r.ok) { const d = r.data as { expired: number; reminders: number; approval_repeats: number }; toast.success(`만료 ${d.expired} · 예고 알림 ${d.reminders} · 승인 반복 알림 ${d.approval_repeats}`); router.refresh(); } else toast.error(r.error); });
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={tick} disabled={pendingT}>만료·알림 처리 실행 (tick)</Button><span className="text-xs text-muted-foreground">운영에서는 pg_cron 10분 주기 (SP5)</span></div>
      <section id="queue" className="rounded-md border p-3"><h2 className="mb-2 text-sm font-medium">대기 주문 큐 (R-AL-11 순서)</h2>
        <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-1">품목</th><th>순번</th><th>주문번호</th><th>담당</th><th className="text-right">요청</th><th className="text-right">부족</th><th className="text-right">가용</th><th>우선순위</th><th>상태</th><th>배정방식</th><th></th></tr></thead>
          <tbody>{queue.map(q => <tr key={q.id} className="border-t" data-testid="queue-row"><td className="py-1"><ItemCode code={q.item_code} name={q.description} /></td><td>{q.queue_pos}</td><td className="font-mono">{q.order_no}</td><td className="text-xs">{q.sales_rep_name}</td><td className="text-right tabular-nums">{fmtInt(Number(q.qty))}</td><td className="text-right tabular-nums text-amber-700">{fmtInt(Number(q.shortage))}</td><td className="text-right tabular-nums">{fmtInt(Number(q.available))}</td><td>{q.priority}</td><td><Badge variant="secondary">{SO_STATUS[q.status!]}</Badge></td><td className="text-xs">{q.allocation_mode ?? "auto"}</td>
            <td className="text-right"><Button size="sm" variant={q.queue_pos === 1 ? "default" : "outline"} disabled={pendingT || (q.available ?? 0) <= 0} onClick={() => { setAlloc(q); setQty(String(Math.min(Number(q.shortage), Number(q.available)))); }}>{q.queue_pos === 1 ? "수동 배정" : "우선 배정(승인)"}</Button></td></tr>)}
          {queue.length === 0 && <tr><td colSpan={11} className="py-4 text-center text-muted-foreground">대기 주문 없음</td></tr>}</tbody></table></section>
      <section id="inbound" className="rounded-md border p-3"><h2 className="mb-2 text-sm font-medium">입고 처리 (창고 입고 완료 → 재고 반영 → auto 품목 자동배정)</h2>
        <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-1">PO</th><th>품목</th><th>공급처</th><th className="text-right">수량</th><th>계획일</th><th>상태</th><th></th></tr></thead>
          <tbody>{inbound.map(i => <tr key={i.id} className="border-t" data-testid="inbound-row"><td className="py-1 font-mono">{i.po_no}</td><td><ItemCode code={i.item_code} name={names[i.item_code]} /></td><td className="text-xs">{i.supplier?.name}</td><td className="text-right tabular-nums">{fmtInt(Number(i.qty))}</td><td>{i.planned_date}</td><td><Badge variant="outline">{i.status}</Badge></td><td className="text-right"><Button size="sm" variant="outline" disabled={pendingT} onClick={() => receive(i)}>입고 완료</Button></td></tr>)}
          {inbound.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">없음</td></tr>}</tbody></table></section>
      <section className="rounded-md border p-3"><h2 className="mb-2 text-sm font-medium">우선배정 승인 대기</h2>
        <ul className="text-sm">{pending.map(p => { const pl = p.payload as { order_no: string; item_code: string; qty: number; available: number }; return <li key={p.id} className="border-t py-1">{pl.order_no} · {pl.item_code} {fmtInt(pl.qty)}개 (가용 {fmtInt(pl.available)}) · 사유: {p.reason} · {fmtDateTime(p.requested_at)}</li>; })}{pending.length === 0 && <li className="text-muted-foreground">없음</li>}</ul></section>
      <Dialog open={!!alloc} onOpenChange={o => !o && setAlloc(null)}>
        <DialogContent><DialogHeader><DialogTitle>{alloc?.queue_pos === 1 ? "수동 확정배정" : "우선 배정 (등록 순서 건너뜀 → SCM팀장 승인)"}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{alloc?.order_no} · {alloc?.item_code} · 부족 {fmtInt(Number(alloc?.shortage))} · 가용 {fmtInt(Number(alloc?.available))}{alloc?.queue_pos !== 1 && " · 승인 전까지 '승인대기 확보수량'으로 잠김 (R-AL-16)"}</p>
          <Input name="alloc_qty" type="number" value={qty} onChange={e => setQty(e.target.value)} className="w-32" />
          {alloc?.queue_pos !== 1 && <Textarea name="alloc_reason" placeholder="우선 배정 사유 (필수, R-AL-15)" value={reason} onChange={e => setReason(e.target.value)} rows={2} />}
          <DialogFooter><Button variant="outline" onClick={() => setAlloc(null)}>취소</Button><Button onClick={doAlloc} disabled={pendingT}>배정</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
