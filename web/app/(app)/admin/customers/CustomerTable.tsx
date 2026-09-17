"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertCustomer, deleteCustomer } from "@/app/(app)/admin/actions";
import type { CustomerRow } from "@/lib/queries/customers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function CustomerTable({ rows }: { rows: CustomerRow[] }) {
  const router = useRouter(); const [pending, start] = useTransition();
  const [f, setF] = useState({ code: "", name: "", segment: "", is_strategic: false });
  const save = () => start(async () => { const r = await upsertCustomer(f); if (r.ok) { toast.success("저장"); setF({ code: "", name: "", segment: "", is_strategic: false }); router.refresh(); } else toast.error(r.error); });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-md border p-3 text-sm">
        <label>고객코드 *<br /><Input name="cust_code" className="mt-1 h-9 w-32 font-mono" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></label>
        <label>이름 *<br /><Input name="cust_name" className="mt-1 h-9 w-48" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
        <label>세그먼트<br /><Input name="cust_segment" className="mt-1 h-9 w-32" value={f.segment} onChange={e => setF({ ...f, segment: e.target.value })} /></label>
        <label className="flex h-9 items-center gap-1"><input type="checkbox" checked={f.is_strategic} onChange={e => setF({ ...f, is_strategic: e.target.checked })} />전략 고객</label>
        <Button size="sm" disabled={pending || !f.code.trim() || !f.name.trim()} onClick={save}>추가 · 수정</Button>
        <span className="text-xs text-muted-foreground">같은 코드를 넣으면 수정됩니다</span>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-1">코드</th><th>이름</th><th>세그먼트</th><th>구분</th><th>담당 영업</th><th></th></tr></thead>
        <tbody>{rows.map(c => <tr key={c.code} className="border-t" data-testid="cust-row"><td className="py-1 font-mono">{c.code}</td><td>{c.name}</td><td>{c.segment ?? "-"}</td>
          <td className="whitespace-nowrap">{c.is_strategic && <Badge variant="outline" className="mr-1">전략</Badge>}{c.is_dummy && <Badge variant="secondary">더미</Badge>}</td><td>{c.sales_rep_name ?? "-"}</td>
          <td className="text-right whitespace-nowrap"><Button size="sm" variant="ghost" onClick={() => setF({ code: c.code, name: c.name, segment: c.segment ?? "", is_strategic: c.is_strategic })}>편집</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await deleteCustomer(c.code); if (r.ok) { toast.success("삭제"); router.refresh(); } else toast.error(r.error); })}>삭제</Button></td></tr>)}
          {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">고객사가 없습니다</td></tr>}</tbody></table></div>
    </div>
  );
}
