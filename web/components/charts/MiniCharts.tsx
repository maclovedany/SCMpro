"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { base, axisCat, axisVal, barSpec, hbarSpec, lineSpec, compact, gridFor, TEXT, GRID } from "./theme";
import { SERIES_LIGHT } from "@/lib/design/palette";
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-md bg-muted/40" /> });
type Common = { height?: number; onClick?: (name: string, seriesName?: string) => void };
const ev = (onClick?: Common["onClick"]) => ({ click: (e: { name: string; seriesName?: string }) => onClick?.(e.name, e.seriesName) });
/** 묶음 막대 (카테고리 × 시리즈). 시리즈 색은 고정 슬롯 순 */
export function GroupedBars({ categories, series, height = 220, money = false, colors, onClick }: Common & { categories: string[]; series: { name: string; data: (number | null)[] }[]; money?: boolean; colors?: string[] }) {
  const opt: EChartsOption = { ...base, grid: gridFor(series.length), legend: series.length > 1 ? base.legend : undefined, xAxis: axisCat(categories), yAxis: axisVal(money ? compact : undefined),
    series: series.map((s, i) => ({ ...barSpec, name: s.name, data: s.data, itemStyle: { ...barSpec.itemStyle, color: (colors ?? [...SERIES_LIGHT])[i] } })) };
  return <ReactECharts option={opt} style={{ height }} notMerge onEvents={ev(onClick)} />;
}
/** 스택 막대 (예: 카테고리 × 등급) */
export function StackedBars({ categories, series, height = 220, colors, money = false, onClick }: Common & { categories: string[]; series: { name: string; data: number[] }[]; colors?: string[]; money?: boolean }) {
  const opt: EChartsOption = { ...base, tooltip: { ...base.tooltip, valueFormatter: (v) => (v == null ? "-" : money ? compact(Number(v)) : Number(v).toLocaleString("ko-KR")) }, grid: gridFor(series.length), xAxis: axisCat(categories), yAxis: axisVal(money ? compact : undefined),
    series: series.map((s, i) => ({ ...barSpec, stack: "s", name: s.name, data: s.data, itemStyle: { color: (colors ?? [...SERIES_LIGHT])[i], borderColor: "#fff", borderWidth: 1 } })) };
  return <ReactECharts option={opt} style={{ height }} notMerge onEvents={ev(onClick)} />;
}
/** 가로 막대 (상위 N) */
export function HBars({ labels, values, height = 220, color = SERIES_LIGHT[0], money = false, onClick }: Common & { labels: string[]; values: number[]; color?: string; money?: boolean }) {
  const opt: EChartsOption = { ...base, legend: undefined, grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: "value", splitNumber: 4, splitLine: { lineStyle: { color: GRID } }, axisLabel: { color: TEXT.muted, fontSize: 11, hideOverlap: true, formatter: money ? compact : undefined } },
    yAxis: { type: "category", data: labels, inverse: true, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: TEXT.secondary, fontSize: 11 } },
    series: [{ ...hbarSpec, data: values, itemStyle: { ...hbarSpec.itemStyle, color }, label: { show: true, position: "right", color: TEXT.secondary, fontSize: 11, formatter: (p: unknown) => { const v = Number((p as { value: unknown }).value); return money ? compact(v) : v.toLocaleString("ko-KR"); } } }] };
  return <ReactECharts option={opt} style={{ height }} notMerge onEvents={ev(onClick)} />;
}
/** 도넛 — 가운데 합계, 세그먼트 2px 표면 간격. 카드 폭을 측정해 좁으면(< 340px) 범례를 아래로 내리고 링을 가운데에 (R-UI-07 반응형) */
export function Donut({ data, height = 200, centerLabel, colors, money = false, onClick }: Common & { data: { name: string; value: number }[]; centerLabel?: string; colors?: string[]; money?: boolean }) {
  const ref = useRef<HTMLDivElement>(null); const [w, setW] = useState(0);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(e => setW(Math.round(e[0].contentRect.width))); ro.observe(el); return () => ro.disconnect(); }, []);
  const total = data.reduce((a, d) => a + d.value, 0); const fmt = (n: number) => (money ? compact(n) : n.toLocaleString("ko-KR"));
  const narrow = w > 0 && w < 340;
  const legendRows = narrow ? Math.ceil(data.length / 2) : 0; const h = narrow ? height + legendRows * 18 : height;
  // 링 반지름을 픽셀로: 좌측 영역(넓을 때 폭의 58%) 또는 전체 높이 중 작은 쪽 기준
  const area = narrow ? Math.min(w, height) : Math.min(w * 0.58, height); const rOut = Math.max(40, area / 2 - 8); const rIn = rOut * 0.68;
  const cx = narrow ? "50%" : `${Math.round(w * 0.29)}px`; const cy = narrow ? `${Math.round(height / 2)}px` : "50%";
  const opt: EChartsOption = { ...base, tooltip: { trigger: "item", valueFormatter: (v) => fmt(Number(v)) },
    legend: narrow ? { bottom: 0, left: "center", icon: "circle", itemWidth: 10, itemHeight: 10, textStyle: { color: TEXT.secondary, fontSize: 11 } }
                   : { orient: "vertical", left: `${Math.round(w * 0.62)}px`, top: "middle", icon: "circle", itemWidth: 10, itemHeight: 10, textStyle: { color: TEXT.secondary, fontSize: 11 } },
    series: [{ type: "pie", radius: [rIn, rOut], center: [cx, cy], data: data.map((d, i) => ({ ...d, itemStyle: { color: (colors ?? [...SERIES_LIGHT])[i], borderColor: "#fff", borderWidth: 2 } })), label: { show: false }, emphasis: { scale: false } }],
    graphic: [{ type: "text", left: narrow ? "center" : `${Math.round(w * 0.29) - 40}px`, top: narrow ? `${Math.round(height / 2) - 16}px` : "middle", style: { text: `${centerLabel ?? "합계"}\n${fmt(total)}`, align: "center", width: 80, fill: TEXT.primary, fontSize: 13, fontWeight: 600, lineHeight: 18 } }] };
  return <div ref={ref} className="w-full"><ReactECharts option={w ? opt : { ...base, series: [] }} style={{ height: h }} notMerge onEvents={ev(onClick)} /></div>;
}
/** 라인 (추이). 2px, 마커 8px, 영역 10% */
export function Lines({ x, series, height = 220, pct = false, colors }: Common & { x: string[]; series: { name: string; data: (number | null)[] }[]; pct?: boolean; colors?: string[] }) {
  const opt: EChartsOption = { ...base, legend: series.length > 1 ? base.legend : undefined, tooltip: { ...base.tooltip, valueFormatter: (v) => (v == null ? "-" : pct ? `${(Number(v) * 100).toFixed(1)}%` : Number(v).toLocaleString("ko-KR")) },
    grid: gridFor(series.length), xAxis: axisCat(x), yAxis: axisVal(pct ? (v: number) => `${Math.round(v * 100)}%` : undefined),
    series: series.map((s, i) => ({ ...lineSpec, name: s.name, data: s.data, lineStyle: { width: 2, color: (colors ?? [...SERIES_LIGHT])[i] }, itemStyle: { ...lineSpec.itemStyle, color: (colors ?? [...SERIES_LIGHT])[i] }, areaStyle: { color: (colors ?? [...SERIES_LIGHT])[i], opacity: 0.1 } })) };
  return <ReactECharts option={opt} style={{ height }} notMerge />;
}
/** 히트맵 (예: ABC × XYZ). 셀 값 = 색(순차 램프), 라벨 = 품목 수·금액 비중. 클릭 → (x,y) */
export function Heatmap({ xs, ys, cells, height = 236, colors, onCell }: { xs: string[]; ys: string[]; cells: { x: number; y: number; value: number; label: string }[]; height?: number; colors?: string[]; onCell?: (xi: number, yi: number) => void }) {
  const max = Math.max(1e-9, ...cells.map(c => c.value));
  const opt: EChartsOption = { ...base, legend: undefined, grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: "item", backgroundColor: "#fff", borderColor: GRID, textStyle: { color: TEXT.primary, fontSize: 12 }, formatter: (p: unknown) => { const d = (p as { data: { name?: string } }).data; return d?.name ?? ""; } },
    xAxis: { type: "category", data: xs, position: "top", axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false }, axisLabel: { color: TEXT.secondary, fontSize: 11 } },
    yAxis: { type: "category", data: ys, inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: TEXT.secondary, fontSize: 12, fontWeight: 600 } },
    visualMap: { show: false, min: 0, max, inRange: { color: colors ?? ["#e8f1fb", "#9ec5f4", "#3987e5", "#184f95"] } },
    series: [{ type: "heatmap", data: cells.map(c => ({ value: [c.x, c.y, c.value], name: c.label, label: { color: c.value / max > 0.45 ? "#fff" : TEXT.primary } })),
      label: { show: true, fontSize: 11, lineHeight: 15, formatter: (p: unknown) => String((p as { name: string }).name).replace(" · ", "\n") },
      itemStyle: { borderColor: "#fff", borderWidth: 3, borderRadius: 6 }, emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.15)" } } }] };
  return <ReactECharts option={opt} style={{ height }} notMerge onEvents={{ click: (e: { value: number[] }) => onCell?.(e.value[0], e.value[1]) }} />;
}
