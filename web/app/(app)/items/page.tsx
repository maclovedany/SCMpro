import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchItems, parseItemFilters, CATEGORIES, PAGE } from "@/lib/queries/items";
import { drillHref } from "@/lib/drill";
import { fmtInt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemsTable } from "./ItemsTable";
import { cn } from "@/lib/utils";
export default async function ItemsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const f = parseItemFilters(sp);
  const sb = await createServerSupabase();
  const { rows, count } = await fetchItems(sb, f);
  const page = f.page ?? 1; const pages = Math.max(1, Math.ceil(count / PAGE));
  const active: { k: string; label: string }[] = [];
  if (f.dummy) active.push({ k: "dummy", label: "더미 설정만" });
  if (f.target_dos) active.push({ k: "target_dos", label: "목표 DoS 미설정" });
  if (f.q) active.push({ k: "q", label: `검색: ${f.q}` });
  if (f.abc) active.push({ k: "abc", label: `ABC ${f.abc}` });
  if (f.xyz) active.push({ k: "xyz", label: `XYZ ${f.xyz}` });
  if (f.pattern) active.push({ k: "pattern", label: `패턴 ${f.pattern}` });
  if (f.champion) active.push({ k: "champion", label: `챔피언 ${f.champion}` });
  if (f.stock === "zero") active.push({ k: "stock", label: "재고 0" });
  if (f.excess) active.push({ k: "excess", label: "과잉 (DoS ≥ 목표 2배)" });
  const without = (k: string) => drillHref("/items", { ...sp, [k]: undefined, page: undefined });
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div><h1 className="text-xl font-semibold">품목</h1><p className="text-sm text-muted-foreground">{fmtInt(count)}개 · 부품은 HOC(발주 코드) 기준으로 합산 (R-XCN-01)</p></div>
        <form className="flex gap-2" action="/items">
          {f.category && <input type="hidden" name="category" value={f.category} />}
          <Input name="q" defaultValue={f.q ?? ""} placeholder="코드·설명 검색" className="h-9 w-64" />
          <Button size="sm" type="submit">검색</Button>
        </form>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {["", ...CATEGORIES].map(c => (
          <Link scroll={false} key={c || "all"} href={drillHref("/items", { ...sp, category: c || undefined, page: undefined })}
            className={cn("rounded-full border px-3 py-1 text-sm", (f.category ?? "") === c ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{c || "전체"}</Link>
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
