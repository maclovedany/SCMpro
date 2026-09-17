"use client";
import { useRouter } from "next/navigation";
import { ChartCard } from "@/components/cards/ChartCard";
import { StackedBars, HBars } from "@/components/charts/MiniCharts";
import { SERIES_LIGHT, SEQ_BLUE } from "@/lib/design/palette";
import type { ExtCharts } from "@/lib/queries/dashboardExt";
import { drillHref } from "@/lib/drill";
/** 확장 묶음 차트 1개씩 (R-UI-16, D-058). 클릭 → 근거 목록 (R-UI-01). 색: 가용·배정 = 파랑 계열, 부족 = 주황 슬롯 (상태색 재사용 금지, R-UI-13) */
export function DashboardExtCharts({ section, charts }: { section: string; charts: ExtCharts }) {
  const router = useRouter();
  switch (section) {
    case "inv": return <ChartCard title="카테고리별 재고 — 가용 · 배정 비율 (%)" insight={charts.inv.insight} href="/items" accent="stock">
      <StackedBars height={236} categories={charts.inv.categories} series={charts.inv.series} colors={[SERIES_LIGHT[0], SEQ_BLUE[1]]}
        onClick={name => router.push(["PART", "SUPPLY", "OPTION"].includes(name) ? drillHref("/items", { category: name }) : "/sales-orders/customers")} /></ChartCard>;
    case "mygroup": return <ChartCard title="담당 품목 — 가용재고 적은 순" insight={charts.mygroup.insight} href="/items/groups" accent="stock">
      <HBars height={236} labels={charts.mygroup.labels} values={charts.mygroup.values} color={SERIES_LIGHT[2]} onClick={() => router.push("/items/groups")} /></ChartCard>;
    case "urgent": return <ChartCard title="긴급발주 단계별 건수 — 요청 → 입고" insight={charts.urgent.insight} href="/extra-demand#urgent" accent="risk">
      <HBars height={236} labels={charts.urgent.labels} values={charts.urgent.values} color={SERIES_LIGHT[1]} onClick={() => router.push("/extra-demand#urgent")} /></ChartCard>;
    case "custalloc": return <ChartCard title="고객사별 필요 수량 — 배정 · 부족 (부족 큰 순)" insight={charts.custalloc.insight} href="/sales-orders/customers" accent="ops">
      <StackedBars height={236} categories={charts.custalloc.categories} series={charts.custalloc.series} colors={[SERIES_LIGHT[0], SERIES_LIGHT[1]]}
        onClick={name => { const i = charts.custalloc.categories.indexOf(name); router.push(drillHref("/sales-orders/customers", { customer: charts.custalloc.codes[i] })); }} /></ChartCard>;
    default: return null;
  }
}
