"use client";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });
/** 기법별 WAPE(막대) + Bias(라인, 우축) — R-UI-03 */
export function AccuracyChart({ rows }: { rows: { label: string; wape: number | null; bias: number | null }[] }) {
  const option: EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "-" : `${(Number(v) * 100).toFixed(1)}%`) },
    legend: { top: 0 }, grid: { left: 48, right: 48, top: 36, bottom: 70 },
    xAxis: { type: "category", data: rows.map(r => r.label), axisLabel: { rotate: 35, fontSize: 11 } },
    yAxis: [{ type: "value", name: "WAPE", axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` } }, { type: "value", name: "Bias", axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` } }],
    series: [
      { name: "WAPE", type: "bar", data: rows.map(r => r.wape), itemStyle: { color: (p: { name: string }) => p.name === "시스템 기준예측" ? "#2563eb" : p.name === "SCM OL" ? "#16a34a" : p.name === "Sales OL" ? "#f97316" : "#94a3b8" } },
      { name: "Bias", type: "line", yAxisIndex: 1, data: rows.map(r => r.bias), itemStyle: { color: "#7c3aed" }, lineStyle: { color: "#7c3aed" }, markLine: { silent: true, data: [{ yAxis: 0 }], lineStyle: { color: "#7c3aed", type: "dashed" } } },
    ],
  };
  return <ReactECharts option={option} style={{ height: 300 }} notMerge />;
}
