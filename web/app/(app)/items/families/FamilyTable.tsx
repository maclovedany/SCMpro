"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ChartCard } from "@/components/cards/ChartCard";
import { HBars } from "@/components/charts/MiniCharts";
import { DataGrid } from "@/components/tables/DataGrid";
import { drillHref } from "@/lib/drill";
import { fmtInt, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FamilyGroup } from "@/lib/queries/families";
const itemsHref = (by: "family" | "model", key: string, category?: string) => drillHref("/items", { [by]: key, category });
/** 12개월 출고 상위 10 (R-UI-13). 막대를 누르면 품목 목록 */
export function FamilyChart({ by, category, labels, keys, values, insight }: { by: "family" | "model"; category?: string; labels: string[]; keys: string[]; values: number[]; insight: string }) {
  const router = useRouter();
  return (
    <section data-testid="family-chart">
      <ChartCard title={`12개월 출고 상위 10 — ${by === "model" ? "기종" : "제품군"}`} insight={insight} href="#family-table" accent="stock">
        <HBars height={300} labels={labels} values={values} onClick={name => { const i = labels.indexOf(name); if (i >= 0) router.push(itemsHref(by, keys[i], category)); }} />
      </ChartCard>
    </section>
  );
}
/** 제품군 · 기종별 요약 표 (R-UI-05/08/18) */
export function FamilyTable({ by, category, rows }: { by: "family" | "model"; category?: string; rows: FamilyGroup[] }) {
  const router = useRouter();
  const columns = useMemo<ColumnDef<FamilyGroup, unknown>[]>(() => [
    { accessorKey: "name", header: by === "model" ? "기종" : "제품군 (Family)", cell: c => <span className="block max-w-[24rem] truncate" title={String(c.getValue())}>{String(c.getValue())}</span> },
    { accessorKey: "categories", header: "카테고리" },
    { accessorKey: "n_items", meta: { align: "right" }, header: "품목 수", cell: c => fmtInt(c.getValue() as number) },
    { accessorKey: "on_hand", meta: { align: "right" }, header: "현재고", cell: c => fmtInt(c.getValue() as number) },
    { accessorKey: "inbound_qty", meta: { align: "right" }, header: "입고예정", cell: c => fmtInt(c.getValue() as number) },
    { accessorKey: "avg_6m", meta: { align: "right" }, header: "6M 평균", cell: c => fmtNum(c.getValue() as number, 1) },
    { accessorKey: "total_12m", meta: { align: "right" }, header: "12M 출고", cell: c => fmtInt(c.getValue() as number) },
    { accessorKey: "dos_days", meta: { align: "right" }, header: "DoS (일)", cell: c => fmtInt(c.getValue() as number | null) },
    { accessorKey: "n_zero_stock", meta: { align: "right" }, header: "재고 0 품목", cell: c => <span className={cn((c.getValue() as number) > 0 && "text-amber-700")}>{fmtInt(c.getValue() as number)}</span> },
    { accessorKey: "n_below_target", meta: { align: "right" }, header: "목표 미달 품목", cell: c => fmtInt(c.getValue() as number) },
  ], [by]);
  return (
    <section id="family-table" className="scroll-mt-16" data-testid="family-table">
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{by === "model" ? "기종" : "제품군"}별 요약 — {fmtInt(rows.length)}개</h2>
      <DataGrid columns={columns} rows={rows} rowKey={r => r.key} exportName={by === "model" ? "기종별_품목_요약" : "제품군별_품목_요약"} onRowClick={r => router.push(itemsHref(by, by === "model" ? r.key : r.name, category))} />
    </section>
  );
}
