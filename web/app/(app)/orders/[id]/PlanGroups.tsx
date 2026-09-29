"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGrid } from "@/components/tables/DataGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { drillHref } from "@/lib/drill";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PlanGroupRow } from "@/lib/queries/families";
import type { LineFilters } from "@/lib/queries/orders";
type Props = { base: string; by: "family" | "model"; rows: PlanGroupRow[]; familyNames: string[]; chips: { k: "family" | "model"; label: string }[]; filters: LineFilters; exportName: string };
/** 발주 계획을 제품군 · 기종으로 보기 (R-UI-18, D-076): 필터 + 묶어 보기. 행을 누르면 아래 라인이 그 제품군(기종)으로 좁혀진다 */
export function PlanGroups({ base, by, rows, familyNames, chips, filters, exportName }: Props) {
  const router = useRouter();
  const keep = Object.fromEntries(Object.entries(filters).filter(([k, v]) => v && !["family", "model"].includes(k))) as Record<string, string | boolean>;   // 켜진 필터만 주소에 남긴다
  const columns = useMemo<ColumnDef<PlanGroupRow, unknown>[]>(() => [
    { accessorKey: "name", header: by === "model" ? "기종" : "제품군 (Family)", cell: c => <span className="block max-w-[22rem] truncate" title={String(c.getValue())}>{String(c.getValue())}</span> },
    { accessorKey: "categories", header: "카테고리" },
    { accessorKey: "n_lines", meta: { align: "right" }, header: "라인", cell: c => fmtInt(c.getValue() as number) },
    { accessorKey: "qty", meta: { align: "right" }, header: "발주 수량", cell: c => <b>{fmtInt(c.getValue() as number)}</b> },
    { accessorKey: "amount", meta: { align: "right" }, header: "금액", cell: c => `₩${fmtInt(c.getValue() as number)}` },
    { accessorKey: "n_stockout", meta: { align: "right" }, header: "품절 위험", cell: c => <span className={cn((c.getValue() as number) > 0 && "text-amber-700")}>{fmtInt(c.getValue() as number)}</span> },
    { accessorKey: "n_flex", meta: { align: "right" }, header: "Flex 도달", cell: c => fmtInt(c.getValue() as number) },
  ], [by]);
  const chip = (on: boolean) => cn("rounded-full border px-2.5 py-0.5 text-xs", on ? "bg-primary text-primary-foreground" : "hover:bg-muted");
  return (
    <section className="space-y-2 rounded-md border p-3" data-testid="plan-groups">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">제품군 · 기종으로 보기</h2>
        <Link scroll={false} href={drillHref(base, { ...keep, family: filters.family, model: filters.model })} className={chip(by === "family")}>제품군별</Link>
        <Link scroll={false} href={drillHref(base, { ...keep, family: filters.family, model: filters.model, by: "model" })} className={chip(by === "model")}>기종별</Link>
        {chips.map(c => <Link scroll={false} key={c.k} href={drillHref(base, { ...keep, family: filters.family, model: filters.model, by: by === "model" ? "model" : undefined, [c.k]: undefined })}><Badge variant="secondary">{c.label} ✕</Badge></Link>)}
        <form className="ml-auto flex gap-2" action={base}>
          {Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
          {by === "model" && <input type="hidden" name="by" value="model" />}
          <Input key={filters.family ?? ""} name="family" defaultValue={filters.family ?? ""} placeholder="제품군 (Family)" className="h-8 w-56" list="plan-family-names" autoComplete="off" aria-label="제품군" />
          <datalist id="plan-family-names">{familyNames.map(n => <option key={n} value={n} />)}</datalist>
          <Button size="sm" variant="outline" type="submit">적용</Button>
        </form>
      </div>
      <DataGrid columns={columns} rows={rows} rowKey={r => r.key} exportName={exportName} height={300} emptyText="요약할 라인이 없습니다"
        onRowClick={r => router.push(drillHref(base, { ...keep, by: by === "model" ? "model" : undefined, [by === "model" ? "model" : "family"]: (by === "model" ? r.key : r.name) || undefined }), { scroll: false })} />
      <p className="text-xs text-muted-foreground">{by === "model" ? "기종별은 그 기종에 연결된 품목(제품군 이름 · BOM · 옵션 연결)의 라인입니다. 한 품목이 여러 기종에 연결되면 기종마다 셉니다." : "제품군별은 계획 전체 라인을 제품군으로 묶은 것입니다."} 행을 누르면 아래 재고전개와 라인이 그 범위로 좁혀집니다.</p>
    </section>
  );
}
