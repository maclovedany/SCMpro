"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertItemGroup, addGroupItem, removeGroupItem } from "@/app/(app)/admin/actions";
import type { GroupStockRow } from "@/lib/queries/customers";
import { ItemCode } from "@/components/ItemCode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtInt } from "@/lib/format";
const DEPTS = [["", "담당 부서 없음"], ["marketing", "마케팅부"], ["service", "서비스부"], ["sales", "영업부"], ["biz_enable", "사업강화부"]] as const;
type G = { code: string; name: string; owner_dept: string | null; is_dummy: boolean };
export function ItemGroupPanel({ groups, stock }: { groups: G[]; stock: GroupStockRow[] }) {
  const router = useRouter(); const [pending, start] = useTransition();
  const [g, setG] = useState({ code: "", name: "", owner_dept: "" }); const [add, setAdd] = useState<Record<string, string>>({});
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okMsg: string) => start(async () => { const r = await fn(); if (r.ok) { toast.success(okMsg); router.refresh(); } else toast.error(r.error); });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-md border p-3 text-sm">
        <label>그룹 코드 *<br /><Input name="grp_code" className="mt-1 h-9 w-36 font-mono" value={g.code} onChange={e => setG({ ...g, code: e.target.value })} /></label>
        <label>이름 *<br /><Input name="grp_name" className="mt-1 h-9 w-40" value={g.name} onChange={e => setG({ ...g, name: e.target.value })} /></label>
        <label>담당 부서<br /><select name="grp_dept" className="mt-1 h-9 rounded-md border bg-background px-2" value={g.owner_dept} onChange={e => setG({ ...g, owner_dept: e.target.value })}>{DEPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <Button size="sm" disabled={pending || !g.code.trim() || !g.name.trim()} onClick={() => run(() => upsertItemGroup(g), "그룹 저장")}>그룹 추가 · 수정</Button>
      </div>
      {groups.map(gr => { const items = stock.filter(s => s.group_code === gr.code); return (
        <section key={gr.code} className="rounded-md border p-3" data-testid="grp-section">
          <div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="text-sm font-medium">{gr.name} <span className="font-mono text-xs text-muted-foreground">{gr.code}</span></h2>
            <Badge variant="outline">{DEPTS.find(d => d[0] === (gr.owner_dept ?? ""))?.[1] ?? gr.owner_dept}</Badge>{gr.is_dummy && <Badge variant="secondary">더미</Badge>}
            <span className="ml-auto inline-flex items-center gap-1"><Input placeholder="품목코드" className="h-8 w-36 font-mono" value={add[gr.code] ?? ""} onChange={e => setAdd({ ...add, [gr.code]: e.target.value })} />
              <Button size="sm" variant="outline" disabled={pending || !(add[gr.code] ?? "").trim()} onClick={() => run(async () => { const r = await addGroupItem(gr.code, add[gr.code]); if (r.ok) setAdd({ ...add, [gr.code]: "" }); return r; }, "품목 추가")}>품목 추가</Button></span></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-1">품목</th><th className="text-right">현재고</th><th className="text-right">가용</th><th></th></tr></thead>
            <tbody>{items.map(i => <tr key={i.item_code} className="border-t"><td className="py-1"><ItemCode code={i.item_code} name={i.description} maxName="24rem" /></td><td className="text-right tabular-nums">{fmtInt(i.on_hand)}</td><td className="text-right tabular-nums">{fmtInt(i.available)}</td>
              <td className="text-right"><Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removeGroupItem(i.item_code), "품목 제외")}>제외</Button></td></tr>)}
              {items.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">품목 없음</td></tr>}</tbody></table></div>
        </section>); })}
    </div>
  );
}
