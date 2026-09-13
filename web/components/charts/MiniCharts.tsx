"use client";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { base, axisCat, axisVal, barSpec, hbarSpec, lineSpec, compact, TEXT, GRID } from "./theme";
import { SERIES_LIGHT } from "@/lib/design/palette";
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-md bg-muted/40" /> });
type Common = { height?: number; onClick?: (name: string, seriesName?: string) => void };
const ev = (onClick?: Common["onClick"]) => ({ click: (e: { name: string; seriesName?: string }) => onClick?.(e.name, e.seriesName) });
/** 묶음 막대 (카테고리 × 시리즈). 시리즈 색은 고정 슬롯 순 */
export function GroupedBars({ categories, series, height = 220, money = false, colors, onClick }: Common & { categories: string[]; series: { name: string; data: (number | null)[] }[]; money?: boolean; colors?: string[] }) {
  const opt: EChartsOption = { ...base, legend: series.length > 1 ? base.legend : undefined, xAxis: axisCat(categories), yAxis: axisVal(money ? compact : undefined),
    series: series.map((s, i) => ({ ...barSpec, name: s.name, data: s.data, itemStyle: { ...barSpec.itemStyle, color: (colors ?? [...SERIES_LIGHT])[i] } })) };
  return <ReactECharts option={opt} style={{ height }} notMerge onEvents={ev(onClick)} />;
}
/** 스택 막대 (예: 카테고리 × 등급) */
export function StackedBars({ categories, series, height = 220, colors, onClick }: Common & { categories: string[]; series: { name: string; data: number[] }[]; colors?: string[] }) {
  const opt: EChartsOption = { ...base, xAxis: axisCat(categories), yAxis: axisVal(),
    series: series.map((s, i) => ({ ...barSpec, stack: "s", name: s.name, data: s.data, itemStyle: { color: (colors ?? [...SERIES_LIGHT])[i], borderColor: "#fff", borderWidth: 1 } })) };
  return <ReactECharts option={opt} style={{ height }} notMerge onEvents={ev(onClick)} />;
}
/** 가로 막대 (상위 N) */
export function HBars({ labels, values, height = 220, color = SERIES_LIGHT[0], money = false, onClick }: Common & { labels: string[]; values: number[]; color?: string; money?: boolean }) {
  const opt: EChartsOption = { ...base, legend: undefined, grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: "value", splitLine: { lineStyle: { color: GRID } }, axisLabel: { color: TEXT.muted, fontSize: 11, formatter: money ? compact : undefined } },
    yAxis: { type: "category", data: labels, inverse: true, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: TEXT.secondary, fontSize: 11 } },
    series: [{ ...hbarSpec, data: values, itemStyle: { ...hbarSpec.itemStyle, color }, label: { show: true, position: "right", color: TEXT.secondary, fontSize: 11, formatter: (p: unknown) => { const v = Number((p as { value: unknown }).value); return money ? compact(v) : v.toLocaleString("ko-KR"); } } }] };
  return <ReactECharts option={opt} style={{ height }} notMerge onEvents={ev(onClick)} />;
}
/** 도넛 — 가운데 합계, 범례 우측, 세그먼트 2px 표면 간격 */
export function Donut({ data, height = 200, centerLabel, colors, onClick }: Common & { data: { name: string; value: number }[]; centerLabel?: string; colors?: string[] }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const opt: EChartsOption = { ...base, tooltip: { trigger: "item", valueFormatter: (v) => Number(v).toLocaleString("ko-KR") }, legend: { orient: "vertical", right: 0, top: "middle", icon: "circle", itemWidth: 10, itemHeight: 10, textStyle: { color: TEXT.secondary, fontSize: 11 } },
    series: [{ type: "pie", radius: ["58%", "82%"], center: ["35%", "50%"], data: data.map((d, i) => ({ ...d, itemStyle: { color: (colors ?? [...SERIES_LIGHT])[i], borderColor: "#fff", borderWidth: 2 } })), label: { show: false }, emphasis: { scale: false } }],
    graphic: [{ type: "text", left: "35%", top: "middle", style: { text: `${centerLabel ?? "합계"}\n${total.toLocaleString("ko-KR")}`, align: "center", fill: TEXT.primary, fontSize: 13, fontWeight: 600, lineHeight: 18 } }] };
  return <ReactECharts option={opt} style={{ height }} notMerge onEvents={ev(onClick)} />;
}
/** 라인 (추이). 2px, 마커 8px, 영역 10% */
export function Lines({ x, series, height = 220, pct = false, colors }: Common & { x: string[]; series: { name: string; data: (number | null)[] }[]; pct?: boolean; colors?: string[] }) {
  const opt: EChartsOption = { ...base, legend: series.length > 1 ? base.legend : undefined, tooltip: { ...base.tooltip, valueFormatter: (v) => (v == null ? "-" : pct ? `${(Number(v) * 100).toFixed(1)}%` : Number(v).toLocaleString("ko-KR")) },
    xAxis: axisCat(x), yAxis: axisVal(pct ? (v: number) => `${Math.round(v * 100)}%` : undefined),
    series: series.map((s, i) => ({ ...lineSpec, name: s.name, data: s.data, lineStyle: { width: 2, color: (colors ?? [...SERIES_LIGHT])[i] }, itemStyle: { ...lineSpec.itemStyle, color: (colors ?? [...SERIES_LIGHT])[i] }, areaStyle: { color: (colors ?? [...SERIES_LIGHT])[i], opacity: 0.1 } })) };
  return <ReactECharts option={opt} style={{ height }} notMerge />;
}
