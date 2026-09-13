/** ECharts 공통 마크 스펙 (dataviz marks-and-anatomy): 막대 ≤24px·끝 4px 라운드, 선 2px, 마커 8px, 격자 hairline, 텍스트는 텍스트 토큰 */
import type { EChartsOption } from "echarts";
export const TEXT = { primary: "#0b0b0b", secondary: "#52514e", muted: "#8a8983" };
export const GRID = "#e6e5e1";
export const base: EChartsOption = {
  textStyle: { fontFamily: "inherit", color: TEXT.secondary },
  grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
  tooltip: { trigger: "axis", backgroundColor: "#fff", borderColor: GRID, textStyle: { color: TEXT.primary, fontSize: 12 }, valueFormatter: (v) => (v == null ? "-" : Number(v).toLocaleString("ko-KR")) },
  legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, icon: "circle", textStyle: { color: TEXT.secondary, fontSize: 11 } },
};
export const axisCat = (data: string[]): EChartsOption["xAxis"] => ({ type: "category", data, axisLine: { lineStyle: { color: GRID } }, axisTick: { show: false }, axisLabel: { color: TEXT.secondary, fontSize: 11 } });
export const axisVal = (fmt?: (v: number) => string): EChartsOption["yAxis"] => ({ type: "value", splitLine: { lineStyle: { color: GRID, width: 1 } }, axisLabel: { color: TEXT.muted, fontSize: 11, formatter: fmt } });
export const barSpec = { type: "bar" as const, barMaxWidth: 24, barGap: "10%", itemStyle: { borderRadius: [4, 4, 0, 0] } };
export const hbarSpec = { type: "bar" as const, barMaxWidth: 20, itemStyle: { borderRadius: [0, 4, 4, 0] } };
export const lineSpec = { type: "line" as const, lineStyle: { width: 2 }, symbol: "circle", symbolSize: 8, itemStyle: { borderColor: "#fff", borderWidth: 2 } };
export const compact = (n: number) => (Math.abs(n) >= 1e8 ? `${(n / 1e8).toFixed(n >= 1e9 ? 0 : 1)}억` : Math.abs(n) >= 1e4 ? `${Math.round(n / 1e4).toLocaleString("ko-KR")}만` : n.toLocaleString("ko-KR"));
