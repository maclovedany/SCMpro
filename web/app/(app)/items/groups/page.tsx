import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { fetchGroupStock } from "@/lib/queries/customers";
import { KpiTile } from "@/components/cards/KpiTile";
import { ItemCode } from "@/components/ItemCode";
import { Badge } from "@/components/ui/badge";
import { drillHref } from "@/lib/drill";
import { fmtInt } from "@/lib/format";
const DEPT: Record<string, string> = { sales: "영업부", marketing: "마케팅부", service: "서비스부", biz_enable: "사업강화부" };
/** 품목 그룹 재고 (R-INV-09, D-058): 제품군(용지·카드리더기 …)별 현재고·가용. 대시보드 "담당 품목 재고" 의 근거 목록 */
export default async function GroupStockPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const p = await getProfile(); if (!p) redirect("/login");
  const { group } = await searchParams;
  const all = await fetchGroupStock(await createServerSupabase());
  const groups = Array.from(new Map(all.map(r => [r.group_code, { code: r.group_code, name: r.group_name, dept: r.owner_dept, dummy: r.is_dummy }])).values());
  const rows = all.filter(r => !group || r.group_code === group).sort((a, b) => a.available - b.available || a.item_code.localeCompare(b.item_code));
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">품목 그룹 재고</h1><p className="text-sm text-muted-foreground">제품군별 현재고와 가용재고(현재고 − 임시·확정배정 − 승인대기). 그룹 구성은 관리 › 품목 그룹 또는 업로드로 바꿉니다 (R-INV-09).</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="grp-kpi">{groups.map(g => { const r = all.filter(x => x.group_code === g.code); const zero = r.filter(x => x.available <= 0).length; return (
        <KpiTile key={g.code} label={`${g.name}${g.dept ? ` · ${DEPT[g.dept] ?? g.dept}` : ""}`} value={fmtInt(r.reduce((a, x) => a + x.on_hand, 0))} sub={`가용 ${fmtInt(r.reduce((a, x) => a + Math.max(0, x.available), 0))} · 품목 ${r.length}개 · 가용 0 품목 ${zero}${g.dummy ? " · 더미" : ""}`}
          href={drillHref("/items/groups", { group: g.code })} accent="stock" icon="Package" tone={zero > 0 ? "warn" : "default"} />); })}</div>
      <section className="overflow-x-auto rounded-md border p-3">
        <div className="mb-2 flex flex-wrap gap-2 text-sm"><Link scroll={false} href="/items/groups" className={`rounded-full border px-3 py-1 ${!group ? "bg-muted font-medium" : ""}`}>전체</Link>
          {groups.map(g => <Link scroll={false} key={g.code} href={drillHref("/items/groups", { group: g.code })} className={`rounded-full border px-3 py-1 ${group === g.code ? "bg-muted font-medium" : ""}`}>{g.name}</Link>)}</div>
        <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-1">그룹</th><th>품목</th><th className="text-right">현재고</th><th className="text-right">가용</th><th className="text-right">DoS(일)</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.item_code} className="border-t" data-testid="grp-row"><td className="py-1 whitespace-nowrap">{r.group_name}</td><td><ItemCode code={r.item_code} name={r.description} maxName="24rem" /></td>
            <td className="text-right tabular-nums">{fmtInt(r.on_hand)}</td><td className="text-right tabular-nums">{r.available <= 0 ? <Badge variant="destructive">{fmtInt(r.available)}</Badge> : fmtInt(r.available)}</td><td className="text-right tabular-nums">{r.dos_days == null ? "-" : fmtInt(r.dos_days)}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">그룹에 품목이 없습니다</td></tr>}</tbody></table>
      </section>
    </div>
  );
}
