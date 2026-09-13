"use client";
import { ChartCard } from "@/components/cards/ChartCard";
import { StackedBars, GroupedBars, Donut } from "@/components/charts/MiniCharts";
import { SERIES_LIGHT, STATUS } from "@/lib/design/palette";
import { DEPT_LABEL, type ScheduleCharts as C } from "@/lib/queries/schedule";
/** 일정·제출 차트 (D-036): 공급처별 발주 회차 · 제출 현황 · 입고 차이 · 지연/정시/조기 */
export function ScheduleCharts({ kind, c, depts, target }: { kind: "rounds" | "submission" | "gap" | "dist"; c: C; depts?: { dept: string; submitted: boolean; by: string | null }[]; target?: string }) {
  switch (kind) {
    case "rounds": return <ChartCard title="공급처별 발주 회차 (향후 3개월)" insight={c.rounds.insight} href="#calendar" accent="cycle">
      <StackedBars height={220} categories={c.rounds.categories} series={c.rounds.series} /></ChartCard>;
    case "submission": return <ChartCard title={`${target ?? ""} 수요자료 제출 현황`} insight={c.submission.insight} href="#submission" accent="ops">
      <div className="space-y-2 p-1 text-sm">
        <div className="flex items-center gap-2"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(2, c.submission.pct)}%`, background: c.submission.pct === 100 ? STATUS.good : SERIES_LIGHT[3] }} /></div><span className="w-16 text-right tabular-nums text-xs text-muted-foreground">{c.submission.done}/{c.submission.total} 부서</span></div>
        <ul className="grid grid-cols-2 gap-1.5">{(depts ?? []).map(d => <li key={d.dept} className="flex items-center gap-2 rounded-lg border bg-white/60 px-2 py-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.submitted ? STATUS.good : STATUS.warning }} /><span className="flex-1">{DEPT_LABEL[d.dept] ?? d.dept}</span><span className="text-xs text-muted-foreground">{d.submitted ? `제출 · ${d.by ?? ""}` : "미제출"}</span></li>)}</ul>
      </div></ChartCard>;
    case "gap": return <ChartCard title="계획 vs 실제 입고일 차이 — 공급처별 월 평균(일)" insight={c.gap.insight} href="#gap" accent="stock">
      {c.gap.categories.length ? <GroupedBars height={220} categories={c.gap.categories} series={c.gap.series} /> : <p className="p-4 text-sm text-muted-foreground">실입고 데이터 없음</p>}</ChartCard>;
    case "dist": return <ChartCard title="입고 정시율 — 지연 · 정시 · 조기 (건)" insight={c.dist.insight} href="#gap" accent="risk">
      {c.dist.data.some(d => d.value > 0) ? <Donut height={220} data={c.dist.data} colors={[STATUS.serious, STATUS.good, SERIES_LIGHT[0]]} centerLabel="실입고" /> : <p className="p-4 text-sm text-muted-foreground">실입고 데이터 없음</p>}</ChartCard>;
    default: return null;
  }
}
