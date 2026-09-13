"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSalesOrder, confirmSalesOrder, cancelSalesOrder } from "./actions";
import { SO_STATUS, type SalesOrderRow } from "@/lib/queries/allocation";
import { DrillCard } from "@/components/cards/DrillCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtInt, fmtDateTime, fmtDate } from "@/lib/format";
type Avail = { item_code: string | null; description: string | null; on_hand: number | null; temp_allocated: number | null; firm_allocated: number | null; hold_qty: number | null; available: number | null } | null;
export function SalesOrderPanel({ orders, avail, item, isScm, me }: { orders: SalesOrderRow[]; avail: Avail; item: string; isScm: boolean; me: string }) {
  const router = useRouter();
  const [code, setCode] = useState(item); const [qty, setQty] = useState(""); const [customer, setCustomer] = useState(""); const [mode, setMode] = useState<"partial" | "wait">("partial");
  const [cancel, setCancel] = useState<SalesOrderRow | null>(null); const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const submit = () => start(async () => {
    const r = await createSalesOrder(code, Number(qty), customer, mode);
    if (r.ok) { const d = r.data as { status: string; allocated: number; shortage: number }; toast.success(`등록: ${SO_STATUS[d.status]} · 배정 ${fmtInt(d.allocated)} / 부족 ${fmtInt(d.shortage)}`); setQty(""); router.push(`/sales-orders?item=${encodeURIComponent(code)}`); router.refresh(); } else toast.error(r.error); });
  const confirm = (o: SalesOrderRow) => start(async () => { const r = await confirmSalesOrder(o.id!); if (r.ok) { toast.success("수주 확정 → 확정배정"); router.refresh(); } else toast.error(r.error); });
  const doCancel = () => cancel && start(async () => { const r = await cancelSalesOrder(cancel.id!, reason); if (r.ok) { toast.success("취소 · 배정 해제"); setCancel(null); setReason(""); router.refresh(); } else toast.error(r.error); });
  const mine = orders.filter(o => o.sales_rep === me);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DrillCard label="내 진행 주문" value={fmtInt(mine.filter(o => ["review_requested", "partial", "waiting"].includes(o.status!)).length)} hint="임시배정·대기" href="/sales-orders" />
        <DrillCard label="7일 내 만료" value={fmtInt(mine.filter(o => o.expires_at && Date.parse(o.expires_at) - Date.now() < 7 * 86400e3 && ["review_requested", "partial"].includes(o.status!)).length)} hint="만료 시 자동 해제 (R-AL-02)" href="/sales-orders" tone="warn" />
        <DrillCard label="부족 수량 대기" value={fmtInt(mine.filter(o => o.status === "partial" || o.status === "waiting").length)} hint="입고 시 순번대로 자동 배정" href="/sales-orders" />
        <DrillCard label="확정" value={fmtInt(mine.filter(o => o.status === "confirmed").length)} href="/sales-orders" />
      </div>
      <section className="space-y-3 rounded-md border p-3">
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label>품목<br /><Input name="item_code" value={code} onChange={e => setCode(e.target.value)} className="mt-1 h-9 w-40 font-mono" /></label>
          <Button variant="outline" size="sm" onClick={() => router.push(`/sales-orders?item=${encodeURIComponent(code)}`)}>가용재고 조회</Button>
          {avail && <span className="rounded-md bg-muted px-3 py-2" data-testid="avail">{avail.description} · 현재고 {fmtInt(avail.on_hand)} − 임시 {fmtInt(avail.temp_allocated)} − 확정 {fmtInt(avail.firm_allocated)} − 승인대기 {fmtInt(avail.hold_qty)} = <b>가용 {fmtInt(avail.available)}</b></span>}
        </div>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label>수량<br /><Input name="qty" type="number" value={qty} onChange={e => setQty(e.target.value)} className="mt-1 h-9 w-24" /></label>
          <label>고객<br /><Input name="customer" value={customer} onChange={e => setCustomer(e.target.value)} className="mt-1 h-9 w-40" /></label>
          <label>가용 부족 시<br /><select name="alloc_mode" className="mt-1 h-9 rounded-md border bg-background px-2" value={mode} onChange={e => setMode(e.target.value as "partial" | "wait")}><option value="partial">부분 임시배정 (가능 수량만)</option><option value="wait">전체 배정 대기</option></select></label>
          <Button size="sm" onClick={submit} disabled={pending || !code || !qty}>검토 요청 등록</Button>
        </div>
      </section>
      <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-2">주문번호</th><th>품목</th><th>고객</th><th className="text-right">수량</th><th className="text-right">임시/확정/부족</th><th>상태</th><th>우선순위</th><th>만료</th><th>담당</th><th></th></tr></thead>
        <tbody>{orders.map(o => (
          <tr key={o.id} className="border-t" data-testid="so-row">
            <td className="py-1 font-mono">{o.order_no}</td><td className="font-mono">{o.item_code}</td><td>{o.customer}</td><td className="text-right tabular-nums">{fmtInt(Number(o.qty))}</td>
            <td className="text-right tabular-nums">{fmtInt(Number(o.temp_qty))} / {fmtInt(Number(o.firm_qty))} / <span className={Number(o.shortage) > 0 ? "text-amber-700" : ""}>{fmtInt(Number(o.shortage))}</span></td>
            <td><Badge variant={o.status === "confirmed" ? "default" : ["cancelled", "rejected", "expired"].includes(o.status!) ? "destructive" : "secondary"}>{SO_STATUS[o.status!]}</Badge></td>
            <td className="tabular-nums">{o.priority}</td><td className="text-xs">{o.expires_at ? fmtDate(o.expires_at) : "-"}</td><td className="text-xs">{o.sales_rep_name}</td>
            <td className="space-x-1 text-right">
              {["review_requested", "partial", "waiting"].includes(o.status!) && (o.sales_rep === me || isScm) && <Button size="sm" onClick={() => confirm(o)} disabled={pending}>수주 확정</Button>}
              {!["cancelled", "rejected", "expired"].includes(o.status!) && (o.status !== "confirmed" ? (o.sales_rep === me || isScm) : isScm) && <Button size="sm" variant="ghost" onClick={() => setCancel(o)} disabled={pending}>{o.status === "confirmed" ? "확정배정 해제" : "취소"}</Button>}
            </td>
          </tr>))}
        {orders.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-muted-foreground">주문 없음</td></tr>}</tbody></table>
      <Dialog open={!!cancel} onOpenChange={o => !o && setCancel(null)}>
        <DialogContent><DialogHeader><DialogTitle>{cancel?.status === "confirmed" ? "확정배정 해제 (주문 취소, 복구 불가)" : "주문 취소"}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{cancel?.order_no} · {cancel?.item_code} · 배정 수량은 가용재고로 돌아갑니다. 재진행은 새 주문으로 등록 (R-AL-41).</p>
          <Textarea name="cancel_reason" placeholder="사유 (필수)" value={reason} onChange={e => setReason(e.target.value)} rows={2} />
          <DialogFooter><Button variant="outline" onClick={() => setCancel(null)}>닫기</Button><Button variant="destructive" onClick={doCancel} disabled={pending}>확인</Button></DialogFooter></DialogContent>
      </Dialog>
      <p className="text-xs text-muted-foreground">{fmtDateTime(new Date().toISOString())} 기준</p>
    </div>
  );
}
