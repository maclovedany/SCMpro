"use client";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import { buildTimeSeriesOption, type TsSeries } from "./chartOption";
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-md bg-muted/40" /> });
type Props = { months: string[]; series: TsSeries[]; forecastFrom?: string; yName?: string; bars?: string[]; height?: number;
  onPointClick?: (ym: string, seriesName: string) => void };
/** ECharts 시계열 래퍼 (R-UI-03): 툴팁·범례·줌·예측 음영·밴드·클릭 드릴다운 */
export function TimeSeriesChart({ months, series, forecastFrom, yName, bars, height = 320, onPointClick }: Props) {
  const option: EChartsOption = useMemo(() => buildTimeSeriesOption({ months, series, forecastFrom, yName, bars }), [months, series, forecastFrom, yName, bars]);
  return (
    <ReactECharts option={option} style={{ height }} notMerge lazyUpdate
      onEvents={{ click: (e: { dataIndex: number; seriesName: string }) => onPointClick?.(months[e.dataIndex], e.seriesName) }} />
  );
}
