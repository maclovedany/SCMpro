"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChartCard } from "@/components/cards/ChartCard";
import { GroupedBars, HBars, Lines, Heatmap } from "@/components/charts/MiniCharts";
import { ABC_COLOR, CATEGORY_COLOR, SERIES_LIGHT } from "@/lib/design/palette";
import { drillHref } from "@/lib/drill";
import { GRADE_GUIDE, XYZ_LABEL, type OverviewCharts } from "@/lib/queries/forecast";
/** 예측 화면 차트 (D-034, R-UI-13). 전부 클릭 드릴다운 */
export function ForecastCharts({ kind, c, acc }: { kind: "heat" | "guide" | "gradeValue" | "gradeDos" | "trend" | "champion" | "wape"; c: OverviewCharts; acc?: { labels: string[]; keys: string[]; values: number[]; insight: string; href: string; filterKey?: string } }) {
  const router = useRouter();
  switch (kind) {
    case "heat": return <ChartCard title="ABC-XYZ 매트릭스 (R-FC-35) — 셀 클릭 시 품목 목록" insight={c.heat.insight} href="/items" accent="forecast">
      <Heatmap height={250} xs={c.heat.xs} ys={c.heat.ys} cells={c.heat.cells} onCell={(x, y) => router.push(drillHref("/items", { abc: c.heat.ys[y], xyz: ["X", "Y", "Z"][x] }))} /></ChartCard>;
    case "guide": return <ChartCard title="등급별 관리 지침" insight="셀을 누르면 해당 품목 목록" accent="forecast">
      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
        {["A", "B", "C"].flatMap(abc => ["X", "Y", "Z"].map(xyz => { const g = GRADE_GUIDE[`${abc}${xyz}`];
          return <Link key={abc + xyz} href={drillHref("/items", { abc, xyz })} className="rounded-lg border p-2 transition hover:border-[var(--acc)] hover:bg-white/70">
            <div className="mb-0.5 flex items-center gap-1 font-semibold"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ABC_COLOR[abc] }} />{abc}{xyz}<span className="ml-auto font-normal text-muted-foreground">{XYZ_LABEL[xyz].slice(2)}</span></div>
            <div className="text-foreground">{g.policy}</div><div className="text-muted-foreground">{g.tip}</div></Link>; }))}
      </div></ChartCard>;
    case "gradeValue": return <ChartCard title="등급별 재고 금액" insight={c.gradeValue.insight} href={drillHref("/items", { abc: "A" })} accent="stock">
      <HBars height={200} labels={c.gradeValue.labels} values={c.gradeValue.values} money color={SERIES_LIGHT[0]} onClick={name => router.push(drillHref("/items", { abc: name.slice(0, 1) }))} /></ChartCard>;
    case "gradeDos": return <ChartCard title="등급별 평균 DoS vs 목표 (일)" insight={c.gradeDos.insight} href="/items" accent="stock">
      <GroupedBars height={200} categories={c.gradeDos.categories} series={c.gradeDos.series} colors={[SERIES_LIGHT[0], "#9ec5f4"]} onClick={name => router.push(drillHref("/items", { abc: name.slice(0, 1) }))} /></ChartCard>;
    case "trend": return <ChartCard title="최근 12개월 카테고리별 출고 수량" insight={c.trend.insight} href="/items" accent="forecast">
      <Lines height={240} x={c.trend.x} series={c.trend.series} colors={c.trend.series.map(s => CATEGORY_COLOR[s.name] ?? SERIES_LIGHT[0])} /></ChartCard>;
    case "champion": return <ChartCard title="챔피언 기법 분포 (품목 수)" insight={c.champion.insight} href="/forecast/runs" accent="forecast">
      <HBars height={Math.max(160, 22 * c.champion.labels.length + 24)} labels={c.champion.labels} values={c.champion.values} color={SERIES_LIGHT[2]} onClick={name => { const i = c.champion.labels.indexOf(name); if (i >= 0) router.push(drillHref("/items", { champion: c.champion.keys[i] })); }} /></ChartCard>;
    case "wape": return acc ? <ChartCard title={acc.filterKey ? (acc.filterKey === "category" ? "카테고리별 WAPE (품목 챔피언)" : "수요패턴별 WAPE (품목 챔피언)") : "기종 레벨 WAPE — 기법별 (낮을수록 정확)"} insight={acc.insight} href={acc.href} accent="forecast">
      <HBars height={Math.max(150, 22 * acc.labels.length + 24)} labels={acc.labels} values={acc.values} color={SERIES_LIGHT[2]} onClick={name => { const i = acc.labels.indexOf(name); if (i < 0) return; router.push(acc.filterKey ? drillHref("/items", { [acc.filterKey]: acc.keys[i] }) : acc.href); }} /></ChartCard> : null;
    default: return null;
  }
}
