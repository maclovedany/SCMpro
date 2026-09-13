"use client";
import { useRouter } from "next/navigation";
import { ChartCard } from "@/components/cards/ChartCard";
import { GroupedBars, StackedBars, HBars, Donut, Lines } from "@/components/charts/MiniCharts";
import { ABC_COLOR, CATEGORY_COLOR, SERIES_LIGHT } from "@/lib/design/palette";
import type { chartData } from "@/lib/queries/dashboard";
import { drillHref } from "@/lib/drill";
type Charts = ReturnType<typeof chartData>;
/** 섹션별 차트 1개 (D-032). 클릭 → 근거 목록 (R-UI-01) */
export function DashboardCharts({ section, charts, planId }: { section: string; charts: Charts; planId: string | null }) {
  const router = useRouter(); const planHref = planId ? `/orders/${planId}` : "/orders";
  switch (section) {
    case "stock": return <ChartCard title="카테고리별 재고 금액 — 현재 · 목표 · 예상 월말" insight={charts.stock.insight} href={planHref} accent="stock">
      <GroupedBars height={236} categories={charts.stock.categories} series={charts.stock.series} money colors={[SERIES_LIGHT[0], "#9ec5f4", SERIES_LIGHT[4]]} onClick={name => router.push(drillHref(planHref, { category: name }))} /></ChartCard>;
    case "risk": return <ChartCard title="품절 위험 품목 — 카테고리 × ABC 등급" insight={charts.risk.insight} href={drillHref(planHref, { risk: true })} accent="risk">
      <StackedBars height={236} categories={charts.risk.categories} series={charts.risk.series} colors={[ABC_COLOR.A, ABC_COLOR.B, ABC_COLOR.C]} onClick={name => router.push(drillHref(planHref, { risk: true, category: name }))} /></ChartCard>;
    case "cycle": return <ChartCard title="월별 발주 금액 추이" insight={charts.cycle.insight} href="/orders" accent="cycle">
      {charts.cycle.x.length > 1 ? <Lines height={236} x={charts.cycle.x} series={charts.cycle.series} colors={[SERIES_LIGHT[4]]} /> : <HBars labels={charts.cycle.x} values={charts.cycle.series[0].data.map(v => v ?? 0)} money color={SERIES_LIGHT[4]} height={236} />}</ChartCard>;
    case "forecast": return <ChartCard title="예측 오차(WAPE) 비교 — 낮을수록 정확" insight={charts.forecast.insight} href="/forecast" accent="forecast">
      <HBars labels={charts.forecast.labels} values={charts.forecast.values.map(v => Math.round(v * 1000) / 10)} color={SERIES_LIGHT[2]} height={236} onClick={() => router.push("/forecast")} /></ChartCard>;
    case "ops": return <ChartCard title="재고 배정 구성 (수량)" insight={charts.ops.insight} href="/allocation" accent="ops">
      <Donut height={236} data={charts.ops.data} colors={[SERIES_LIGHT[3], SERIES_LIGHT[0], SERIES_LIGHT[4], SERIES_LIGHT[1]]} centerLabel="배정·대기" onClick={() => router.push("/allocation")} /></ChartCard>;
    case "data": return <ChartCard title="카테고리 색상 범례" insight="화면 어디서나 같은 색: 부품 파랑 · 소모품 아쿠아 · 옵션 주황" accent="data">
      <div className="flex flex-wrap gap-3 p-2 text-sm">{Object.entries(CATEGORY_COLOR).map(([k, c]) => <span key={k} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: c }} />{k}</span>)}</div></ChartCard>;
    default: return null;
  }
}
