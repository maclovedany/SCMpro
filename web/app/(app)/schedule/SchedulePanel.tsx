"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { submitDemand, runFullTick } from "./actions";
import { DEPT_LABEL } from "@/lib/queries/schedule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtInt, fmtDateTime } from "@/lib/format";
type Cal = { supplier_code: string | null; supplier_name: string | null; ym: string | null; sailing_date: string | null; order_date: string | null; eta: string | null };
type Sub = { ym: string; deadline: string; overdue: boolean; depts: { dept: string; submitted: boolean; submitted_at: string | null; by: string | null }[] | null };
type Gap = { summary: { supplier_code: string | null; ym: string | null; n: number | null; avg_diff: number | null; min_diff: number | null; max_diff: number | null }[]; rows: { id: number | null; item_code: string | null; supplier_name: string | null; po_no: string | null; planned_date: string | null; actual_date: string | null; diff_days: number | null }[] };
export function SchedulePanel({ cal, sub, gap, role, target }: { cal: Cal[]; sub: Sub; gap: Gap; role: string; target: string }) {
  const router = useRouter(); const [pending, start] = useTransition(); const [note, setNote] = useState("");
  const canSubmit = (d: string) => role === d || ["admin", "item_manager", "scm_lead"].includes(role);
  return (
    <div className="space-y-5">
      <section id="calendar" className="rounded-md border p-3"><h2 className="mb-2 text-sm font-medium">발주 캘린더 (향후 3개월)</h2>
        <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-1">공급처</th><th>월</th><th>출항일</th><th>발주일(영업일)</th><th>입고예정(영업일)</th></tr></thead>
          <tbody>{cal.map((c, i) => <tr key={i} className="border-t" data-testid="cal-row"><td className="py-0.5">{c.supplier_name} <span className="text-xs text-muted-foreground">{c.supplier_code}</span></td><td>{c.ym}</td><td>{c.sailing_date}</td><td className="font-medium">{c.order_date}</td><td>{c.eta}</td></tr>)}</tbody></table></section>
      <section id="submission" className="rounded-md border p-3">
        <div className="mb-2 flex items-center gap-2"><h2 className="text-sm font-medium">{target} 수요자료 제출 현황 — 마감 {sub.deadline}</h2>{sub.overdue && <Badge variant="destructive">마감 경과</Badge>}
          <Button size="sm" variant="outline" className="ml-auto" disabled={pending} onClick={() => start(async () => { const r = await runFullTick(); if (r.ok) { const d = r.data as { submission_reminders: number; expired: number }; toast.success(`tick: 미제출 알림 ${d.submission_reminders} · 만료 ${d.expired}`); router.refresh(); } else toast.error(r.error); })}>tick 실행</Button></div>
        <table className="w-full text-sm"><tbody>{(sub.depts ?? []).map(d => <tr key={d.dept} className="border-t" data-testid="dept-row"><td className="py-1">{DEPT_LABEL[d.dept] ?? d.dept}</td>
          <td>{d.submitted ? <Badge>제출 · {d.by} · {fmtDateTime(d.submitted_at)}</Badge> : <Badge variant="secondary">미제출</Badge>}</td>
          <td className="text-right">{canSubmit(d.dept) && !d.submitted && <span className="inline-flex items-center gap-1"><Input placeholder="메모" value={note} onChange={e => setNote(e.target.value)} className="h-8 w-40" /><Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await submitDemand(target, d.dept, note); if (r.ok) { toast.success("제출 완료"); router.refresh(); } else toast.error(r.error); })}>제출</Button></span>}</td></tr>)}</tbody></table></section>
      <section id="gap" className="rounded-md border p-3"><h2 className="mb-2 text-sm font-medium">계획 vs 실제 입고일 차이 (R-SCH-10/11) — 최근 50건</h2>
        <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-1">PO</th><th>품목</th><th>공급처</th><th>계획</th><th>실제</th><th className="text-right">차이(일)</th></tr></thead>
          <tbody>{gap.rows.slice(0, 50).map(r => <tr key={r.id} className="border-t"><td className="py-0.5 font-mono">{r.po_no}</td><td className="font-mono">{r.item_code}</td><td>{r.supplier_name}</td><td>{r.planned_date}</td><td>{r.actual_date}</td><td className="text-right tabular-nums">{fmtInt(r.diff_days)}</td></tr>)}</tbody></table></section>
    </div>
  );
}
