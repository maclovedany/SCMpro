"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addExtraDemand } from "@/app/(app)/orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function ExtraDemandForm() {
  const [f, setF] = useState({ kind: "confirmed_order", item_code: "", need_ym: "", qty: "", order_no: "", customer: "", model: "", reason: "" });
  const [pending, start] = useTransition(); const router = useRouter();
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border p-3 text-sm">
      <label>종류<br /><select name="kind" className="mt-1 h-9 rounded-md border bg-background px-2" value={f.kind} onChange={e => set("kind", e.target.value)}><option value="confirmed_order">수주 확정</option><option value="meeting_approval">수급회의 승인</option><option value="bulkdeal">Bulkdeal</option></select></label>
      <label>품목<br /><Input name="item_code" className="mt-1 h-9 w-36 font-mono" value={f.item_code} onChange={e => set("item_code", e.target.value)} /></label>
      <label>필요월<br /><Input name="need_ym" placeholder="2026-10" className="mt-1 h-9 w-28" value={f.need_ym} onChange={e => set("need_ym", e.target.value)} /></label>
      <label>수량<br /><Input name="qty" type="number" className="mt-1 h-9 w-24" value={f.qty} onChange={e => set("qty", e.target.value)} /></label>
      {f.kind === "confirmed_order" && <label>주문번호 *<br /><Input name="order_no" className="mt-1 h-9 w-36" value={f.order_no} onChange={e => set("order_no", e.target.value)} /></label>}
      {f.kind === "bulkdeal" && <><label>고객 *<br /><Input name="customer" className="mt-1 h-9 w-32" value={f.customer} onChange={e => set("customer", e.target.value)} /></label><label>기종 *<br /><Input name="model" className="mt-1 h-9 w-28" value={f.model} onChange={e => set("model", e.target.value)} /></label></>}
      {f.kind !== "confirmed_order" && <label>사유{f.kind === "bulkdeal" && " *"}<br /><Input name="reason" className="mt-1 h-9 w-56" value={f.reason} onChange={e => set("reason", e.target.value)} /></label>}
      <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await addExtraDemand({ ...f, qty: Number(f.qty) }); if (r.ok) { toast.success(f.kind === "bulkdeal" ? "등록 — 팀장 승인 요청됨" : "등록됨"); setF({ ...f, item_code: "", qty: "", order_no: "" }); router.refresh(); } else toast.error(r.error); })}>등록</Button>
    </div>
  );
}
