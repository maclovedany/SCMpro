"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ChartCard } from "@/components/cards/ChartCard";
import { GroupedBars } from "@/components/charts/MiniCharts";
import { DataGrid } from "@/components/tables/DataGrid";
import { Badge } from "@/components/ui/badge";
import { drillHref } from "@/lib/drill";
import { MC, MC_BIZ } from "@/lib/design/category";
import { CATEGORY_COLOR } from "@/lib/design/palette";
import { fmtInt, fmtNum, fmtYm } from "@/lib/format";
import type { McItem } from "@/lib/queries/mcItems";
/** MC 구분별 최근 12개월 실적 (R-UI-13). 막대를 누르면 그 구분으로 거른다 */
export function McBizChart({ labels, families, acts, insight }: { labels: string[]; families: number[]; acts: number[]; insight: string }) {
  const router = useRouter();
  return (
    <section data-testid="mc-biz-chart">
      <ChartCard title="MC 구분별 최근 12개월 실적 (DT · GC · PRT)" insight={`${insight} · Family 수 ${labels.map((l, i) => `${l} ${fmtInt(families[i])}`).join(" / ")}`} href="/mc-plan" accent="forecast">
        <GroupedBars height={220} categories={labels} series={[{ name: "최근 12개월 실적", data: acts }]} colors={[CATEGORY_COLOR.MACHINE]}
          onClick={name => router.push(drillHref("/items", { category: MC, biz: (MC_BIZ as readonly string[]).includes(name) ? name : undefined }), { scroll: false })} />
      </ChartCard>
    </section>
  );
}
/** MC 품목 표 (R-FC-16, R-UI-05/08). 행을 누르면 기종 OL · 실적에서 그 Family 를 본다 */
export function McItemsTable({ rows }: { rows: McItem[] }) {
  const router = useRouter();
  const columns = useMemo<ColumnDef<McItem, unknown>[]>(() => [
    { accessorKey: "item_code", header: "Item Code", cell: c => <span className="font-mono text-xs">{(c.getValue() as string | null) ?? "-"}</span> },
    { id: "category", header: "카테고리", accessorFn: () => MC, cell: () => <Badge variant="outline">{MC}</Badge> },
    { accessorKey: "biz", header: "구분", cell: c => <Badge variant="secondary">{(c.getValue() as string | null) ?? "미분류"}</Badge> },
    { accessorKey: "family", header: "Family", cell: c => <span className="font-medium">{String(c.getValue())}</span> },
    { accessorKey: "predecessor", header: "전임기", cell: c => (c.getValue() as string | null) ?? "" },
    { accessorKey: "successor", header: "후속기", cell: c => (c.getValue() as string | null) ?? "" },
    { accessorKey: "act_12m", meta: { align: "right" }, header: "12M 실적", cell: c => fmtInt(c.getValue() as number) },
    { accessorKey: "act_avg_6m", meta: { align: "right" }, header: "6M 월평균", cell: c => fmtNum(c.getValue() as number, 1) },
    { accessorKey: "last_sales_ol", meta: { align: "right" }, header: "최근월 Sales OL", cell: c => fmtInt(c.getValue() as number | null) },
    { accessorKey: "last_scm_ol", meta: { align: "right" }, header: "최근월 SCM OL", cell: c => fmtInt(c.getValue() as number | null) },
    { accessorKey: "last_act", meta: { align: "right" }, header: "최근월 실적", cell: c => fmtInt(c.getValue() as number | null) },
    { accessorKey: "last_act_ym", header: "마지막 실적월", cell: c => { const v = c.getValue() as string | null; return v ? fmtYm(v) : "-"; } },
  ], []);
  return (
    <section id="mc-items" className="scroll-mt-16" data-testid="mc-items">
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">MC Family — {fmtInt(rows.length)}개</h2>
      <DataGrid columns={columns} rows={rows} rowKey={r => r.family} exportName="MC_품목" onRowClick={r => router.push(drillHref("/mc-plan", { biz: r.biz ?? undefined, q: r.family }))} />
    </section>
  );
}
