import type { EChartsOption } from "echarts";
import { fmtYm } from "@/lib/format";
/** 시리즈 의미별 고정 색상 (R-UI-03) */
export type SeriesRole = "actual" | "forecast" | "sales_ol" | "scm_ol" | "order" | "other";
export const SERIES_COLOR: Record<SeriesRole, string> = { actual: "#6b7280", forecast: "#2563eb", sales_ol: "#f97316", scm_ol: "#16a34a", order: "#7c3aed", other: "#0ea5e9" };
export type TsSeries = { name: string; role: SeriesRole; data: (number | null)[]; band?: { lower: number[]; upper: number[] } };
export function buildTimeSeriesOption(p: { months: string[]; series: TsSeries[]; forecastFrom?: string; yName?: string; bars?: string[] }): EChartsOption {
  const x = p.months.map(fmtYm);
  const series: Record<string, unknown>[] = [];
  for (const s of p.series) {
    const isBar = p.bars?.includes(s.name);
    const base: Record<string, unknown> = {
      name: s.name, type: isBar ? "bar" : "line", data: s.data, itemStyle: { color: SERIES_COLOR[s.role] },
      lineStyle: { color: SERIES_COLOR[s.role], type: s.role === "forecast" ? "dashed" : "solid" },
      smooth: false, connectNulls: false, showSymbol: true, symbolSize: 5,
    };
    if (s.role === "forecast" && p.forecastFrom) {
      base.markArea = { silent: true, itemStyle: { color: "rgba(37,99,235,0.08)" }, data: [[{ xAxis: fmtYm(p.forecastFrom) }, { xAxis: x[x.length - 1] }]] };
    }
    series.push(base);
    if (s.band) {
      const stack = `${s.name}-band`;
      series.push(
        { name: `${s.name} 구간`, type: "line", data: s.band.lower, lineStyle: { opacity: 0 }, stack, symbol: "none", silent: true, tooltip: { show: false } },
        { name: `${s.name} 구간`, type: "line", data: s.band.upper.map((u, i) => u - s.band!.lower[i]), lineStyle: { opacity: 0 }, areaStyle: { color: SERIES_COLOR[s.role], opacity: 0.12 }, stack, symbol: "none", silent: true, tooltip: { show: false } },
      );
    }
  }
  return {
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "-" : Number(v).toLocaleString("ko-KR")) },
    legend: { top: 0, type: "scroll", data: p.series.map(s => s.name) },
    grid: { left: 56, right: 24, top: 40, bottom: 60 },
    xAxis: { type: "category", data: x, boundaryGap: !!p.bars?.length },
    yAxis: { type: "value", name: p.yName },
    dataZoom: [{ type: "inside", startValue: Math.max(0, x.length - 36) }, { type: "slider", height: 18, bottom: 8, startValue: Math.max(0, x.length - 36) }],   // 기본 최근 36개월
    series: series as EChartsOption["series"],
  };
}
