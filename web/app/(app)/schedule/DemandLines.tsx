"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveDemandLines } from "./actions";
import { DEPT_LABEL } from "@/lib/queries/schedule";
import type { CustomerRow, DemandLineRow } from "@/lib/queries/customers";
import { ItemCode } from "@/components/ItemCode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtInt } from "@/lib/format";
const SCM = ["admin", "item_manager", "scm_lead"];
/** 수요자료 상세 라인 (R-SCH-32, D-058): 부서가 고객사별 필요 수량을 적어 SCM 에 제출. 본인 부서만, SCM 은 대리 입력 */
export function DemandLines({ target, role, customers, lines, depts }: { target: string; role: string; customers: CustomerRow[]; lines: DemandLineRow[]; depts: string[] }) {
  const router = useRouter(); const [pending, start] = useTransition();
  const mine = SCM.includes(role) ? depts : depts.filter(d => d === role);
  const [f, setF] = useState({ dept: mine[0] ?? "", customer_code: "", item_code: "", qty: "", note: "" });
  const canEdit = (d: string) => SCM.includes(role) || d === role;
  const save = (dept: string, l: { customer_code: string; item_code: string; qty: number; note?: string }, ok: string) => start(async () => {
    const r = await saveDemandLines(target, dept, [l]); if (r.ok) { toast.success(ok); setF({ ...f, item_code: "", qty: "", note: "" }); router.refresh(); } else toast.error(r.error); });
  const total = lines.reduce((a, l) => a + l.qty, 0);
  return (
    <section id="demand-lines" className="rounded-md border p-3" data-testid="demand-lines">
      <div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="text-sm font-medium">{target} 고객사별 필요 수량 — {fmtInt(lines.length)}건 · 합계 {fmtInt(total)}</h2>
        <span className="text-xs text-muted-foreground">여기 적은 수량이 고객사 배정현황의 「필요」 가 됩니다. 입력 후 아래 「제출」 을 눌러 마감하세요.</span></div>
      {mine.length > 0 && <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
        {mine.length > 1 && <label>부서<br /><select name="dl_dept" className="mt-1 h-9 rounded-md border bg-background px-2" value={f.dept} onChange={e => setF({ ...f, dept: e.target.value })}>{mine.map(d => <option key={d} value={d}>{DEPT_LABEL[d] ?? d}</option>)}</select></label>}
        <label>고객사 *<br /><select name="dl_customer" className="mt-1 h-9 rounded-md border bg-background px-2" value={f.customer_code} onChange={e => setF({ ...f, customer_code: e.target.value })}><option value="">선택</option>{customers.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}</select></label>
        <label>품목(기기) 코드 *<br /><Input name="dl_item" className="mt-1 h-9 w-40 font-mono" value={f.item_code} onChange={e => setF({ ...f, item_code: e.target.value })} /></label>
        <label>필요 수량 *<br /><Input name="dl_qty" type="number" min={1} className="mt-1 h-9 w-24" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} /></label>
        <label>메모<br /><Input name="dl_note" className="mt-1 h-9 w-44" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></label>
        <Button size="sm" disabled={pending || !f.dept || !f.customer_code || !f.item_code.trim() || !(Number(f.qty) > 0)} onClick={() => save(f.dept, { customer_code: f.customer_code, item_code: f.item_code.trim(), qty: Number(f.qty), note: f.note }, "필요 수량 저장")}>추가 · 수정</Button>
      </div>}
      <div className="max-h-80 overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-1">부서</th><th>고객사</th><th>품목</th><th className="text-right">필요 수량</th><th>메모</th><th></th></tr></thead>
        <tbody>{lines.map(l => <tr key={l.id} className="border-t" data-testid="dl-row"><td className="py-1 whitespace-nowrap">{DEPT_LABEL[l.dept] ?? l.dept}</td><td className="whitespace-nowrap">{l.customer_name ?? l.customer_code}{l.is_dummy && <Badge variant="secondary" className="ml-1 text-[10px]">더미</Badge>}</td>
          <td><ItemCode code={l.item_code} name={l.description} maxName="18rem" /></td><td className="text-right tabular-nums">{fmtInt(l.qty)}</td><td className="text-xs text-muted-foreground">{l.note}</td>
          <td className="text-right">{canEdit(l.dept) && <Button size="sm" variant="ghost" disabled={pending} onClick={() => save(l.dept, { customer_code: l.customer_code, item_code: l.item_code, qty: 0 }, "삭제")}>삭제</Button>}</td></tr>)}
          {lines.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">입력된 필요 수량이 없습니다</td></tr>}</tbody></table></div>
    </section>
  );
}
