"use client";
import { useRouter } from "next/navigation";
import { ChartCard } from "@/components/cards/ChartCard";
import { GroupedBars, StackedBars, HBars, Donut } from "@/components/charts/MiniCharts";
import { ABC_COLOR, CATEGORY_COLOR, SERIES_LIGHT } from "@/lib/design/palette";
import { drillHref } from "@/lib/drill";
import type { PlanCharts, planHistory } from "@/lib/queries/orders";
/** 발주 계획 차트 (D-035, R-UI-13). 클릭 → 라인 필터 */
export function OrderCharts({ kind, c, base, history }: { kind: "category" | "supplier" | "needYm" | "topItems" | "risk" | "history"; c?: PlanCharts; base?: string; history?: ReturnType<typeof planHistory> }) {
  const router = useRouter(); const b = base ?? "/orders";
  const catColors = (names: string[]) => names.map(n => CATEGORY_COLOR[n] ?? SERIES_LIGHT[5]);
  switch (kind) {
    case "history": return history ? <ChartCard title="발주월별 계획 금액 (승인 > 최신)" insight={history.insight} href="/orders" accent="cycle">
      <GroupedBars height={220} categories={history.x} series={[{ name: "발주 금액", data: history.amount }]} money colors={[SERIES_LIGHT[4]]} /></ChartCard> : null;
    case "category": return c ? <ChartCard title="카테고리별 발주 금액" insight={c.category.insight} href={b} accent="cycle">
      <Donut height={220} data={c.category.data} colors={catColors(c.category.data.map(d => d.name))} centerLabel="총 금액" money onClick={name => router.push(drillHref(b, { category: name }))} /></ChartCard> : null;
    case "supplier": return c ? <ChartCard title="공급처별 발주 금액" insight={c.supplier.insight} href="/schedule" accent="ops">
      <HBars height={220} labels={c.supplier.labels} values={c.supplier.values} money color={SERIES_LIGHT[3]} onClick={() => router.push("/schedule")} /></ChartCard> : null;
    case "needYm": return c ? <ChartCard title="필요월별 발주 금액 — 카테고리" insight={c.needYm.insight} href={b} accent="cycle">
      <StackedBars height={220} categories={c.needYm.categories} series={c.needYm.series} colors={catColors(c.needYm.series.map(s => s.name))} money onClick={(_, s) => router.push(drillHref(b, { category: s }))} /></ChartCard> : null;
    case "topItems": return c ? <ChartCard title="금액 상위 10 품목" insight={c.topItems.insight} href={`${b}/report`} accent="stock">
      <HBars height={Math.max(180, 22 * c.topItems.labels.length + 16)} labels={c.topItems.labels} values={c.topItems.values} money color={SERIES_LIGHT[0]} onClick={name => router.push(drillHref(b, { q: name }))} /></ChartCard> : null;
    case "risk": return c ? <ChartCard title="품절 위험 라인 — 카테고리 × ABC" insight={c.risk.insight} href={drillHref(b, { risk: true })} accent="risk">
      <StackedBars height={220} categories={c.risk.categories} series={c.risk.series} colors={[ABC_COLOR.A, ABC_COLOR.B, ABC_COLOR.C]} onClick={name => router.push(drillHref(b, { risk: true, category: name }))} /></ChartCard> : null;
    default: return null;
  }
}
