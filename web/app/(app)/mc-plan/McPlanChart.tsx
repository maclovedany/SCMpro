"use client";
import { ChartCard } from "@/components/cards/ChartCard";
import { GroupedBars } from "@/components/charts/MiniCharts";
import { SERIES_COLOR } from "@/components/charts/chartOption";
import { fmtYm } from "@/lib/format";
import type { McCell } from "@/lib/queries/mcPlan";
/** 월별 Sales OL · SCM OL · 실적 (R-UI-13). 시리즈 색은 의미 고정 (R-UI-03) */
export function McPlanChart({ months, cells, insight, href }: { months: string[]; cells: McCell[]; insight: string; href: string }) {
  return (
    <section data-testid="mc-chart">
      <ChartCard title="월별 Sales OL · SCM OL · 실적" insight={insight} href={href} accent="forecast">
        <GroupedBars height={260} categories={months.map(fmtYm)} colors={[SERIES_COLOR.sales_ol, SERIES_COLOR.scm_ol, SERIES_COLOR.actual]}
          series={[{ name: "Sales OL", data: cells.map(c => c.sales_ol) }, { name: "SCM OL", data: cells.map(c => c.scm_ol) }, { name: "실적", data: cells.map(c => c.act) }]} />
      </ChartCard>
    </section>
  );
}
