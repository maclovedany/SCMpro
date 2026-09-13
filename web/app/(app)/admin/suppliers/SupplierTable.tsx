"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { upsertSupplier, deleteSupplier } from "../actions";
import type { SupplierRow } from "@/lib/queries/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
const empty = { code: "", name: "", country: "", prep_days: 7, lead_time_days: 30 };
export function SupplierTable({ rows }: { rows: SupplierRow[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof empty & { id?: number }>(empty);
  const [pending, start] = useTransition();
  const edit = (r?: SupplierRow) => { setForm(r ? { id: r.id, code: r.code, name: r.name, country: r.country ?? "", prep_days: r.prep_days, lead_time_days: r.lead_time_days } : empty); setOpen(true); };
  const save = () => start(async () => { const r = await upsertSupplier(form); if (r.ok) { toast.success("저장됨"); setOpen(false); } else toast.error(r.error); });
  const del = (id: number) => { if (!confirm("삭제하시겠습니까?")) return; start(async () => { const r = await deleteSupplier(id); if (r.ok) toast.success("삭제됨"); else toast.error(r.error); }); };
  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => edit()}>공급처 추가</Button>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="py-2">코드</th><th>이름</th><th>국가</th><th className="text-right">출항 준비일</th><th className="text-right">리드타임(일)</th><th>출처</th><th></th></tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.id} className="border-t">
            <td className="py-2 font-mono">{r.code}</td><td>{r.name}</td><td>{r.country}</td>
            <td className="text-right tabular-nums">{r.prep_days}</td><td className="text-right tabular-nums">{r.lead_time_days}</td>
            <td>{r.is_dummy ? <Badge variant="secondary">더미</Badge> : <Badge variant="outline">{r.source}</Badge>}</td>
            <td className="space-x-1 text-right"><Button variant="outline" size="sm" onClick={() => edit(r)}>편집</Button><Button variant="ghost" size="sm" onClick={() => del(r.id)}>삭제</Button></td>
          </tr>))}</tbody>
      </table>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "공급처 편집" : "공급처 추가"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="s-code">코드</Label><Input id="s-code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} disabled={!!form.id} /></div>
            <div><Label htmlFor="s-name">이름</Label><Input id="s-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label htmlFor="s-country">국가</Label><Input id="s-country" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
            <div><Label htmlFor="s-prep">출항 준비일</Label><Input id="s-prep" type="number" value={form.prep_days} onChange={e => setForm({ ...form, prep_days: Number(e.target.value) })} /></div>
            <div><Label htmlFor="s-lead">리드타임(일)</Label><Input id="s-lead" type="number" value={form.lead_time_days} onChange={e => setForm({ ...form, lead_time_days: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>취소</Button><Button onClick={save} disabled={pending}>저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
