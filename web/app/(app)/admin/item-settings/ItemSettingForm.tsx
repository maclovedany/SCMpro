"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestItemSettingApproval } from "../actions";
import type { fetchItemSetting, ItemSettingPayload } from "@/lib/queries/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtInt, fmtNum, fmtDateTime } from "@/lib/format";
type Data = Awaited<ReturnType<typeof fetchItemSetting>>;
const FIELD_LABEL: Record<string, string> = { target_dos_days: "목표 DoS", moq: "MOQ", unit_price: "단가", allocation_mode: "배정방식", status: "상태", is_dummy: "더미", source: "출처", approved_at: "승인시각" };
export function ItemSettingForm({ code, data }: { code: string; data: Data }) {
  const s = data.setting; const m = data.master!;
  const router = useRouter();
  const [f, setF] = useState({ target_dos_days: s?.target_dos_days?.toString() ?? "", moq: s?.moq?.toString() ?? "1", unit_price: s?.unit_price?.toString() ?? "", allocation_mode: (s?.allocation_mode ?? "auto") as "auto" | "manual" });
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const locked = s?.status === "pending" || !!data.pending;
  const submit = () => start(async () => {
    const payload: ItemSettingPayload = {};
    if (f.target_dos_days !== (s?.target_dos_days?.toString() ?? "")) payload.target_dos_days = Number(f.target_dos_days);
    if (f.moq !== (s?.moq?.toString() ?? "1")) payload.moq = Number(f.moq);
    if (f.unit_price !== (s?.unit_price?.toString() ?? "")) payload.unit_price = Number(f.unit_price);
    if (f.allocation_mode !== (s?.allocation_mode ?? "auto")) payload.allocation_mode = f.allocation_mode;
    const r = await requestItemSettingApproval(code, payload, reason);
    if (r.ok) { toast.success("승인 요청을 보냈습니다"); router.refresh(); } else toast.error(r.error);
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-md border p-4">
        <div className="flex items-center gap-2"><span className="font-mono text-lg font-semibold">{code}</span><Badge variant="outline">{m.category}</Badge>{s?.is_dummy && <Badge variant="secondary">더미 설정</Badge>}
          {locked && <Badge className="bg-amber-500">승인 대기 중</Badge>}{s?.status === "approved" && !s.is_dummy && <Badge className="bg-green-600">승인됨</Badge>}</div>
        <p className="text-sm text-muted-foreground">{m.description} · 6M 평균 {fmtNum(m.avg_6m)} · 현재고 {fmtInt(m.on_hand)} · DoS {fmtInt(m.dos_days)}일</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="target_dos_days">목표 DoS (일)</Label><Input id="target_dos_days" name="target_dos_days" type="number" value={f.target_dos_days} onChange={e => setF({ ...f, target_dos_days: e.target.value })} disabled={locked} /></div>
          <div><Label htmlFor="moq">MOQ</Label><Input id="moq" name="moq" type="number" value={f.moq} onChange={e => setF({ ...f, moq: e.target.value })} disabled={locked} /></div>
          <div><Label htmlFor="unit_price">단가</Label><Input id="unit_price" name="unit_price" type="number" value={f.unit_price} onChange={e => setF({ ...f, unit_price: e.target.value })} disabled={locked} /></div>
          <div><Label htmlFor="allocation_mode">신규 입고 배정방식</Label>
            <select id="allocation_mode" name="allocation_mode" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={f.allocation_mode} onChange={e => setF({ ...f, allocation_mode: e.target.value as "auto" | "manual" })} disabled={locked}>
              <option value="auto">자동 배정</option><option value="manual">수동 배정</option></select></div>
        </div>
        <div><Label htmlFor="reason">변경 사유 (필수)</Label><Textarea id="reason" name="reason" value={reason} onChange={e => setReason(e.target.value)} disabled={locked} rows={2} /></div>
        {data.pending && <p className="text-sm text-amber-700">대기 중 요청: {JSON.stringify(data.pending.payload)} — {data.pending.reason} ({fmtDateTime(data.pending.requested_at)})</p>}
        <Button onClick={submit} disabled={pending || locked}>승인 요청</Button>
      </section>
      <section className="rounded-md border p-4">
        <h2 className="mb-2 text-sm font-medium">변경 이력 (audit_log, 최근 20)</h2>
        <ul className="space-y-1 text-xs">
          {data.audit.map(a => { const b = (a.before ?? {}) as Record<string, unknown>; const af = (a.after ?? {}) as Record<string, unknown>;
            const diff = Object.keys(FIELD_LABEL).filter(k => JSON.stringify(b[k]) !== JSON.stringify(af[k])).map(k => `${FIELD_LABEL[k]}: ${b[k] ?? "-"} → ${af[k] ?? "-"}`);
            return <li key={a.id} className="border-t py-1"><span className="text-muted-foreground">{fmtDateTime(a.at)} · {a.action}</span> {diff.join(", ") || "(변경 없음)"}</li>; })}
          {data.audit.length === 0 && <li className="text-muted-foreground">이력 없음</li>}
        </ul>
      </section>
    </div>
  );
}
