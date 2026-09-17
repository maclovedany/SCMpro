"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ChartCard } from "@/components/cards/ChartCard";
import { StackedBars, HBars } from "@/components/charts/MiniCharts";
import { DataGrid } from "@/components/tables/DataGrid";
import { ItemCode } from "@/components/ItemCode";
import { Badge } from "@/components/ui/badge";
import { SERIES_LIGHT } from "@/lib/design/palette";
import { drillHref } from "@/lib/drill";
import { fmtInt, fmtPct } from "@/lib/format";
import type { CustAllocRow, customerAllocCharts } from "@/lib/queries/customers";
const DEPT: Record<string, string> = { sales: "영업", marketing: "마케팅", service: "서비스", biz_enable: "사업강화", item_manager: "SCM", scm_lead: "SCM", admin: "관리자" };
const num = (v: unknown) => <span className="tabular-nums">{fmtInt(Number(v ?? 0))}</span>;
export function CustomerAllocView({ charts, rows, filter }: { charts: ReturnType<typeof customerAllocCharts>; rows: CustAllocRow[]; filter: { customer: string | null; customerName: string | null; shortOnly: boolean } }) {
  const router = useRouter();
  const columns = useMemo<ColumnDef<CustAllocRow, unknown>[]>(() => [
    { accessorKey: "customer_name", header: "고객사", cell: c => <span className="whitespace-nowrap">{String(c.getValue() ?? c.row.original.customer_code)}{c.row.original.is_strategic && <Badge variant="outline" className="ml-1 text-[10px]">전략</Badge>}{c.row.original.is_dummy && <Badge variant="secondary" className="ml-1 text-[10px]">더미</Badge>}</span> },
    { id: "item", header: "품목", accessorFn: r => `${r.item_code} ${r.description ?? ""}`, cell: c => <ItemCode code={c.row.original.item_code} name={c.row.original.description} maxName="18rem" /> },
    { accessorKey: "depts", header: "제출 부서", cell: c => <span className="whitespace-nowrap text-xs">{String(c.getValue() ?? "").split(",").filter(Boolean).map(d => DEPT[d] ?? d).join(" · ") || "주문만"}</span> },
    { accessorKey: "need_qty", meta: { align: "right" }, header: "필요", cell: c => num(c.getValue()) },
    { accessorKey: "order_qty", meta: { align: "right" }, header: "주문", cell: c => num(c.getValue()) },
    { accessorKey: "temp_qty", meta: { align: "right" }, header: "임시배정", cell: c => num(c.getValue()) },
    { accessorKey: "firm_qty", meta: { align: "right" }, header: "확정배정", cell: c => num(c.getValue()) },
    { accessorKey: "forced_qty", meta: { align: "right" }, header: "그중 강제", cell: c => num(c.getValue()) },
    { accessorKey: "shortage_qty", meta: { align: "right" }, header: "부족", cell: c => <span className={Number(c.getValue()) > 0 ? "font-semibold tabular-nums text-[#c2410c]" : "tabular-nums"}>{fmtInt(Number(c.getValue() ?? 0))}</span> },
    { accessorKey: "fill_rate", meta: { align: "right" }, header: "충족률", cell: c => <span className="tabular-nums">{fmtPct(c.getValue() as number | null)}</span> },
    { accessorKey: "available", meta: { align: "right" }, header: "품목 가용", cell: c => num(c.getValue()) },
  ], []);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="ca-charts">
        <ChartCard title="고객사별 필요 수량 — 배정 · 부족 (부족 큰 순)" insight={charts.bars.insight} accent="ops">
          <StackedBars height={260} categories={charts.bars.categories} series={charts.bars.series} colors={[SERIES_LIGHT[0], SERIES_LIGHT[1]]} onClick={name => { const hit = rows.find(r => r.customer_name === name); router.push(drillHref("/sales-orders/customers", { customer: hit?.customer_code, short: filter.shortOnly ? 1 : undefined }), { scroll: false }); }} /></ChartCard>
        <ChartCard title="부족 수량 상위 품목" insight={charts.items.insight} accent="risk">
          <HBars height={260} labels={charts.items.labels} values={charts.items.values} color={SERIES_LIGHT[1]} /></ChartCard>
      </div>
      <section data-testid="ca-table">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <Link scroll={false} href="/sales-orders/customers" className={`rounded-full border px-3 py-1 ${!filter.customer && !filter.shortOnly ? "bg-muted font-medium" : ""}`}>전체</Link>
          <Link scroll={false} href={drillHref("/sales-orders/customers", { customer: filter.customer ?? undefined, short: filter.shortOnly ? undefined : 1 })} className={`rounded-full border px-3 py-1 ${filter.shortOnly ? "bg-muted font-medium" : ""}`}>부족만</Link>
          {filter.customer && <Link scroll={false} href={drillHref("/sales-orders/customers", { short: filter.shortOnly ? 1 : undefined })} className="rounded-full border bg-muted px-3 py-1 font-medium">{filter.customerName ?? filter.customer} ✕</Link>}
          <span className="text-xs text-muted-foreground">막대를 누르면 그 고객사만 봅니다</span>
        </div>
        <DataGrid columns={columns} rows={rows} rowKey={r => `${r.customer_code}|${r.item_code}`} exportName="customer-allocation" height={480} emptyText="조건에 맞는 고객사·품목이 없습니다" />
      </section>
    </div>
  );
}
