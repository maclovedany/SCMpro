import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchItems, parseItemFilters, PAGE } from "@/lib/queries/items";
import { parseFamilyFilters, familyChips, fetchFamilyNames } from "@/lib/queries/families";
import { CATEGORY_TABS, MC, catLabel } from "@/lib/design/category";
import { McItems } from "./McItems";
import { fetchAliasMap } from "@/lib/names";
import { drillHref } from "@/lib/drill";
import { fmtInt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemsTable } from "./ItemsTable";
import { cn } from "@/lib/utils";
export default async function ItemsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (sp.category === MC) return <McItems sp={sp} />;   // MC(기종)는 출고 품목과 다른 자료 — 전용 목록 (R-FC-16, D-077)
  const f = parseItemFilters(sp);
  const sb = await createServerSupabase();
  const g = parseFamilyFilters(sp);   // 제품군 · 기종 필터 (D-076)
  const [{ rows, count }, names, familyNames] = await Promise.all([fetchItems(sb, f, g), fetchAliasMap(sb), fetchFamilyNames(sb)]);
  const page = f.page ?? 1; const pages = Math.max(1, Math.ceil(count / PAGE));
  const active: { k: string; label: string }[] = [];
  if (f.dummy) active.push({ k: "dummy", label: "더미 설정만" });
  if (f.target_dos) active.push({ k: "target_dos", label: "목표 DoS 미설정" });
  if (f.q) active.push({ k: "q", label: `검색: ${f.q}` });
  active.push(...familyChips(g, names));
  if (f.abc) active.push({ k: "abc", label: `ABC ${f.abc}` });
  if (f.xyz) active.push({ k: "xyz", label: `XYZ ${f.xyz}` });
  if (f.pattern) active.push({ k: "pattern", label: `패턴 ${f.pattern}` });
  if (f.champion) active.push({ k: "champion", label: `챔피언 ${f.champion}` });
  if (f.stock === "zero") active.push({ k: "stock", label: "재고 0" });
  if (f.excess) active.push({ k: "excess", label: "과잉 (DoS ≥ 목표 2배)" });
  const without = (k: string) => drillHref("/items", { ...sp, [k]: undefined, page: undefined });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="flex items-center gap-3"><h1 className="text-xl font-semibold">품목</h1><Link href="/items/families" className="text-sm text-muted-foreground underline-offset-2 hover:underline">제품군 · 기종별 보기 →</Link></div><p className="text-sm text-muted-foreground">{fmtInt(count)}개 · 부품은 HOC(발주 코드) 기준으로 합산 (R-XCN-01)</p></div>
        <form className="flex flex-wrap gap-2" action="/items">
          {f.category && <input type="hidden" name="category" value={f.category} />}
          {g.model && <input type="hidden" name="model" value={g.model} />}
          <Input key={g.family ?? ""} name="family" defaultValue={g.family ? String(familyChips({ family: g.family }, names)[0].label.replace(/^제품군: /, "")) : ""} placeholder="제품군 (Family)" className="h-9 w-56" list="family-names" autoComplete="off" aria-label="제품군" />
          <datalist id="family-names">{familyNames.map(n => <option key={n} value={n} />)}</datalist>
          <Input name="q" defaultValue={f.q ?? ""} placeholder="코드·설명 검색" className="h-9 w-64" />
          <Button size="sm" type="submit">검색</Button>
        </form>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {["", ...CATEGORY_TABS].map(c => (
          <Link scroll={false} key={c || "all"} href={drillHref("/items", { ...sp, category: c || undefined, page: undefined })}
            className={cn("rounded-full border px-3 py-1 text-sm", (f.category ?? "") === c ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{c ? catLabel(c) : "전체"}</Link>
        ))}
        {active.map(a => <Link key={a.k} href={without(a.k)}><Badge variant="secondary">{a.label} ✕</Badge></Link>)}
      </div>
      <ItemsTable rows={rows} />
      <div className="flex items-center justify-end gap-2 text-sm">
        <span>{page} / {pages}</span>
        <Link scroll={false} href={drillHref("/items", { ...sp, page: Math.max(1, page - 1) })} aria-disabled={page <= 1}><Button variant="outline" size="sm" disabled={page <= 1}>이전</Button></Link>
        <Link scroll={false} href={drillHref("/items", { ...sp, page: Math.min(pages, page + 1) })}><Button variant="outline" size="sm" disabled={page >= pages}>다음</Button></Link>
      </div>
    </div>
  );
}
