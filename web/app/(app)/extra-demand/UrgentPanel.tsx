"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestUrgent, linkUrgentPo, addInboundEvent } from "./actions";
import { urgentSteps, STAGE_LABEL, EVENT_STAGES, progressPct, type UrgentRow } from "@/lib/queries/urgent";
import { ItemCode } from "@/components/ItemCode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtInt, fmtDate } from "@/lib/format";
const DEPT: Record<string, string> = { sales: "영업", marketing: "마케팅", service: "서비스", biz_enable: "사업강화", item_manager: "SCM", scm_lead: "SCM", admin: "관리자" };
type Po = { id: number; item_code: string; po_no: string | null; planned_date: string; qty: number };
/** 긴급발주 요청·진행 (R-OQ-44, R-SCH-33, D-058): 전 부서 요청 → 팀장 승인 → SCM 이 PO 연결·단계 기록 */
export function UrgentPanel({ rows, pos, isScm, today }: { rows: UrgentRow[]; pos: Po[]; isScm: boolean; today: string }) {
  const router = useRouter(); const [pending, start] = useTransition();
  const [f, setF] = useState({ item: "", qty: "", date: "", reason: "" });
  const [ev, setEv] = useState<Record<string, { po: string; stage: string; date: string }>>({});
  const run = (fn: () => Promise<{ ok: true; data?: unknown } | { ok: false; error: string }>, okMsg: string, after?: () => void) => start(async () => { const r = await fn(); if (r.ok) { toast.success(okMsg); after?.(); router.refresh(); } else toast.error(r.error); });
  return (
    <section id="urgent" className="space-y-3 rounded-md border p-3" data-testid="urgent-panel">
      <div><h2 className="text-sm font-medium">긴급발주 — 요청과 진행</h2><p className="text-xs text-muted-foreground">어느 부서든 요청할 수 있고, SCM팀장이 승인하면 추가수요로 반영됩니다. 이후 SCM 이 PO 를 연결하면 접수 → 출하 → 출항 → 입항 → 통관 → 입고 단계가 표시됩니다.</p></div>
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label>품목 *<br /><Input name="ug_item" className="mt-1 h-9 w-40 font-mono" value={f.item} onChange={e => setF({ ...f, item: e.target.value })} /></label>
        <label>수량 *<br /><Input name="ug_qty" type="number" min={1} className="mt-1 h-9 w-24" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} /></label>
        <label>필요일 *<br /><Input name="ug_date" type="date" min={today} className="mt-1 h-9 w-40" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></label>
        <label>사유 *<br /><Input name="ug_reason" className="mt-1 h-9 w-64" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} /></label>
        <Button size="sm" disabled={pending || !f.item.trim() || !(Number(f.qty) > 0) || !f.date || !f.reason.trim()} onClick={() => run(() => requestUrgent(f.item, Number(f.qty), f.date, f.reason), "긴급발주 요청 — 팀장 승인 대기", () => setF({ item: "", qty: "", date: "", reason: "" }))}>긴급발주 요청</Button>
      </div>
      <div className="space-y-2">{rows.map(u => { const steps = urgentSteps(u.stage); const e = ev[u.id] ?? { po: "", stage: "shipped", date: today }; const myPos = pos.filter(p => p.item_code === u.item_code); return (
        <div key={u.id} className="rounded-md border p-2" data-testid="urgent-row">
          <div className="flex flex-wrap items-center gap-2 text-sm"><ItemCode code={u.item_code} name={u.description} maxName="18rem" /><span className="tabular-nums">{fmtInt(u.qty)}개</span>
            <Badge variant={u.stage === "rejected" ? "destructive" : u.stage === "received" ? "default" : "outline"}>{STAGE_LABEL[u.stage] ?? u.stage}</Badge>
            {u.delayed && u.stage !== "received" && <Badge variant="destructive">지연</Badge>}{u.is_dummy && <Badge variant="secondary" className="text-[10px]">더미</Badge>}
            <span className="text-xs text-muted-foreground">{DEPT[u.requested_dept ?? ""] ?? u.requested_dept} {u.requested_by_name ?? ""} · 요청 {fmtDate(u.created_at)} · 필요일 {fmtDate(u.need_date)}{u.po_no ? ` · ${u.po_no} (${u.supplier_name ?? "-"}) 계획입고 ${fmtDate(u.planned_date)}` : ""}</span></div>
          {u.stage !== "rejected" && <div className="mt-2 flex items-center gap-1" role="progressbar" aria-valuenow={progressPct(u.stage)} aria-valuemin={0} aria-valuemax={100} aria-label={`${u.item_code} 진행 ${STAGE_LABEL[u.stage]}`}>
            {steps.map(s => <div key={s.stage} className="min-w-0 flex-1"><div className={`h-1.5 rounded-full ${s.state === "done" ? "bg-[#2a78d6]" : s.state === "current" ? (u.delayed ? "bg-[#d03b3b]" : "bg-[#eb6834]") : "bg-muted"}`} /><div className={`mt-1 truncate text-[11px] ${s.state === "current" ? "font-semibold" : "text-muted-foreground"}`} title={s.label}>{s.label}</div></div>)}</div>}
          <div className="mt-1 text-xs text-muted-foreground">사유: {u.reason ?? "-"}</div>
          {isScm && u.status === "approved" && u.stage !== "received" && <div className="mt-2 flex flex-wrap items-end gap-2 text-xs">
            {!u.inbound_id ? <><select aria-label={`${u.item_code} PO 선택`} className="h-8 rounded border bg-background px-1" value={e.po} onChange={x => setEv({ ...ev, [u.id]: { ...e, po: x.target.value } })}><option value="">연결할 PO 선택</option>{myPos.map(p => <option key={p.id} value={p.id}>{p.po_no ?? `#${p.id}`} · {fmtInt(p.qty)}개 · {p.planned_date}</option>)}</select>
              <Button size="sm" variant="outline" disabled={pending || !e.po} onClick={() => run(() => linkUrgentPo(u.id, Number(e.po)), "PO 연결")}>PO 연결</Button>{myPos.length === 0 && <span className="text-muted-foreground">이 품목의 미입고 PO 가 없습니다 — 입고예정을 먼저 등록(업로드)하세요</span>}</>
            : <><select aria-label={`${u.item_code} 단계`} className="h-8 rounded border bg-background px-1" value={e.stage} onChange={x => setEv({ ...ev, [u.id]: { ...e, stage: x.target.value } })}>{EVENT_STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
              <input type="date" aria-label={`${u.item_code} 단계 일자`} className="h-8 rounded border px-1" value={e.date} onChange={x => setEv({ ...ev, [u.id]: { ...e, date: x.target.value } })} />
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => addInboundEvent(u.inbound_id!, e.stage, e.date, ""), `단계 기록: ${STAGE_LABEL[e.stage]}`)}>단계 기록</Button><span className="text-muted-foreground">입고 완료는 재고 배정 › 입고 완료에서 처리</span></>}
          </div>}
        </div>); })}
        {rows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">긴급발주가 없습니다</p>}</div>
    </section>
  );
}
