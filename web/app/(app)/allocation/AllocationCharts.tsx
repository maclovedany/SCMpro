"use client";
import { useRouter } from "next/navigation";
import { ChartCard } from "@/components/cards/ChartCard";
import { StackedBars, HBars, Donut, GroupedBars } from "@/components/charts/MiniCharts";
import { SERIES_LIGHT } from "@/lib/design/palette";
import type { AllocationCharts as C } from "@/lib/queries/allocation";
/** 재고 배정 차트 (D-036): 배정 구성 · 대기 부족 상위 · 임시배정 만료 예정 · 입고 예정 */
export function AllocationCharts({ kind, c }: { kind: "mix" | "queue" | "expiring" | "inbound"; c: C }) {
  const router = useRouter();
  switch (kind) {
    case "mix": return <ChartCard title="재고 배정 구성 (수량)" insight={c.mix.insight} href="/sales-orders?all=1" accent="ops">
      <Donut height={220} data={c.mix.data} colors={[SERIES_LIGHT[3], SERIES_LIGHT[0], SERIES_LIGHT[4], SERIES_LIGHT[1]]} centerLabel="배정·대기" onClick={() => router.push("/sales-orders?all=1")} /></ChartCard>;
    case "queue": return <ChartCard title="대기 부족 수량 상위 품목" insight={c.queue.insight} href="#queue" accent="risk">
      <HBars height={220} labels={c.queue.labels} values={c.queue.values} color={SERIES_LIGHT[1]} onClick={name => router.push(`/sales-orders?item=${encodeURIComponent(name)}&all=1`)} /></ChartCard>;
    case "expiring": return <ChartCard title="임시배정 만료 예정 (30일, 수량)" insight={c.expiring.insight} href="/sales-orders?all=1" accent="ops">
      <GroupedBars height={220} categories={c.expiring.x} series={[{ name: "만료 수량", data: c.expiring.values }]} colors={[SERIES_LIGHT[3]]} /></ChartCard>;
    case "inbound": return <ChartCard title="입고 예정 수량 — 월 × 공급처" insight={c.inbound.insight} href="#inbound" accent="stock">
      <StackedBars height={220} categories={c.inbound.categories} series={c.inbound.series} onClick={() => router.push("#inbound")} /></ChartCard>;
    default: return null;
  }
}
