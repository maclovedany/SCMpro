import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchMcFys, fetchMcOlAct, mcPivot, fyLabel, BIZ_ORDER } from "@/lib/queries/mcPlan";
import { KpiTile, type KpiTileProps } from "@/components/cards/KpiTile";
import { drillHref } from "@/lib/drill";
import { fmtInt, fmtPct, fmtYm } from "@/lib/format";
import { cn } from "@/lib/utils";
import { McPlanChart } from "./McPlanChart";
import { McPlanTable, type McSort } from "./McPlanTable";
const SORTS: McSort[] = ["default", "sales", "scm", "act", "ratio"];
/** 기종(MC) OL · 실적 (R-FC-15 · R-FC-16, D-075 · D-077): 회사 파일 'MC OL vs ACT' 와 같은 배치 — Item Code · 구분 · Family, 월별 Sales OL · SCM OL · 실적 · 실적/Sales OL.
 *  Family 는 회사가 정한 보안용 약자, Item Code 는 익명 코드, 구분은 DT · GC · PRT. 화면 구조 = KPI → 차트 → 근거 표 (R-UI-13) */
export default async function McPlanPage({ searchParams }: { searchParams: Promise<{ fy?: string; biz?: string; sort?: string; active?: string; q?: string }> }) {
  const sp = await searchParams;
  const sb = await createServerSupabase();
  const fys = await fetchMcFys(sb);
  const fy = fys.includes(Number(sp.fy)) ? Number(sp.fy) : fys[0];
  const biz = (BIZ_ORDER as readonly string[]).includes(sp.biz ?? "") ? sp.biz : undefined;
  const sort = SORTS.includes(sp.sort as McSort) ? (sp.sort as McSort) : "default";
  const rows = fy == null ? [] : await fetchMcOlAct(sb, fy);
  const p = mcPivot(rows, biz);
  const t = p.total.total; const last = p.total.cells[p.total.cells.length - 1]; const lastYm = p.months[p.months.length - 1];
  const here = (o: Record<string, string | number | boolean | undefined>) => drillHref("/mc-plan", { fy, biz, ...o });
  const scmRatio = t.act == null || !t.scm_ol ? null : t.act / t.scm_ol;
  const period = p.months.length ? `${fmtYm(p.months[0])} ~ ${fmtYm(lastYm)} · ${p.months.length}개월` : "데이터 없음";
  const kpis: KpiTileProps[] = [
    { label: `실적 합계 (${fy == null ? "-" : fyLabel(fy)})`, value: fmtInt(t.act), sub: period, href: here({ sort: "act" }) + "#mc-table", accent: "stock", icon: "PackageCheck" },
    { label: "실적 ÷ Sales OL", value: fmtPct(t.ratio), sub: `Sales OL ${fmtInt(t.sales_ol)}`, href: here({ sort: "ratio" }) + "#mc-table", accent: "cycle", icon: "Users",
      progress: t.ratio == null ? undefined : { pct: t.ratio * 100, label: `Sales OL ${fmtInt(t.sales_ol)} 중 실적 ${fmtInt(t.act)}` } },
    { label: "실적 ÷ SCM OL", value: fmtPct(scmRatio), sub: `SCM OL ${fmtInt(t.scm_ol)}`, href: here({ sort: "scm" }) + "#mc-table", accent: "forecast", icon: "Target",
      progress: scmRatio == null ? undefined : { pct: scmRatio * 100, label: `SCM OL ${fmtInt(t.scm_ol)} 중 실적 ${fmtInt(t.act)}` } },
    { label: "실적 있는 Family", value: `${fmtInt(p.activeProducts)} / ${fmtInt(p.lines.length)}`, sub: "기간 안에 실적이 1대 이상", href: here({ active: true }) + "#mc-table", accent: "ops", icon: "Layers" },
  ];
  const insight = last && lastYm ? `${fmtYm(lastYm)} 실적 ${fmtInt(last.act)} — Sales OL ${fmtInt(last.sales_ol)} 의 ${fmtPct(last.ratio)} · SCM OL ${fmtInt(last.scm_ol)}` : "데이터 없음";
  const chip = (on: boolean) => cn("rounded-full border px-2.5 py-0.5 text-xs", on ? "bg-primary text-primary-foreground" : "hover:bg-muted");
  return (
    <div className="space-y-6">
      <div><div className="flex items-center gap-2"><h1 className="text-xl font-semibold">기종 OL · 실적</h1><span className="rounded-full border px-2 py-0.5 text-xs font-medium">MC</span></div><p className="text-sm text-muted-foreground">MC(기종)의 Family 별 월 Sales OL · SCM OL · 실적을 회사 파일과 같은 배치로 봅니다. MC 는 DT · GC · PRT 로 나뉩니다. Family 는 회사가 정한 약자, Item Code 는 익명 코드입니다 (D-077).</p></div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="mc-filters">
        <div className="flex flex-wrap items-center gap-1"><span className="mr-1 text-xs text-muted-foreground">회계연도</span>{fys.map(f => <Link key={f} scroll={false} href={drillHref("/mc-plan", { fy: f, biz })} className={chip(f === fy)}>{fyLabel(f)}</Link>)}</div>
        <div className="flex flex-wrap items-center gap-1"><span className="mr-1 text-xs text-muted-foreground">MC 구분</span>
          <Link scroll={false} href={drillHref("/mc-plan", { fy })} className={chip(!biz)}>전체</Link>
          {BIZ_ORDER.map(b => <Link key={b} scroll={false} href={drillHref("/mc-plan", { fy, biz: b })} className={chip(b === biz)}>{b}</Link>)}</div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="mc-kpi">{kpis.map(k => <KpiTile key={k.label} {...k} />)}</div>
      <McPlanChart months={p.months} cells={p.total.cells} insight={insight} href={here({}) + "#mc-table"} />
      <McPlanTable key={`${fy}-${biz ?? "all"}-${sort}-${sp.active ?? ""}-${sp.q ?? ""}`} months={p.months} lines={p.lines} exportName={`기종_OL_실적_${fy == null ? "" : fyLabel(fy)}${biz ? "_" + biz : ""}`} initialSort={sort} activeOnly={sp.active === "true"} initialQuery={sp.q ?? ""} />
    </div>
  );
}
