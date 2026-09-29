import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchMcItems, mcByBiz } from "@/lib/queries/mcItems";
import { CATEGORY_TABS, MC, MC_BIZ, catLabel } from "@/lib/design/category";
import { KpiTile, type KpiTileProps } from "@/components/cards/KpiTile";
import { drillHref } from "@/lib/drill";
import { fmtInt, fmtYm } from "@/lib/format";
import { cn } from "@/lib/utils";
import { McBizChart, McItemsTable } from "./McItemsTable";
/** 품목 › MC (R-FC-16, D-077): 기종(MC) 제품군 목록. MC 는 DT · GC · PRT 로 나뉜다 — 구분으로 거르고 구분별로 집계한다. KPI → 차트 → 근거 표 (R-UI-13) */
export async function McItems({ sp }: { sp: Record<string, string | undefined> }) {
  const biz = (MC_BIZ as readonly string[]).includes(sp.biz ?? "") ? sp.biz : undefined;
  const sb = await createServerSupabase();
  const all = await fetchMcItems(sb);
  const rows = all.filter(r => (!biz || r.biz === biz) && (sp.active !== "true" || r.act_12m > 0) && (sp.lineage !== "true" || r.predecessor || r.successor));
  const by = mcByBiz(all); const lastYm = all[0]?.last_ym ?? null;
  const here = (o: Record<string, string | boolean | undefined>) => drillHref("/items", { category: MC, biz, ...o });
  const scope = biz ? all.filter(r => r.biz === biz) : all;
  const kpis: KpiTileProps[] = [
    { label: `MC Family 수${biz ? ` (${biz})` : ""}`, value: fmtInt(scope.length), sub: by.map(b => `${b.biz} ${fmtInt(b.n)}`).join(" · "), href: here({}) + "#mc-items", accent: "stock", icon: "Layers" },
    { label: "최근 12개월 실적", value: fmtInt(scope.reduce((a, r) => a + r.act_12m, 0)), sub: lastYm ? `${fmtYm(lastYm)} 까지 · ${by.map(b => `${b.biz} ${fmtInt(b.act_12m)}`).join(" · ")}` : "데이터 없음", href: "/mc-plan", accent: "forecast", icon: "PackageCheck" },
    { label: "실적 있는 Family", value: `${fmtInt(scope.filter(r => r.act_12m > 0).length)} / ${fmtInt(scope.length)}`, sub: "최근 12개월에 실적 1대 이상", href: here({ active: true }) + "#mc-items", accent: "ops", icon: "Activity" },
    { label: "전임 · 후속 관계", value: fmtInt(scope.filter(r => r.predecessor).length), sub: "전임기가 있는 Family (회사 제공)", href: here({ lineage: true }) + "#mc-items", accent: "cycle", icon: "GitBranch" },
  ];
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-sm", on ? "bg-primary text-primary-foreground" : "hover:bg-muted");
  const small = (on: boolean) => cn("rounded-full border px-2.5 py-0.5 text-xs", on ? "bg-primary text-primary-foreground" : "hover:bg-muted");
  const top = by.filter(b => b.n > 0).sort((a, b) => b.act_12m - a.act_12m)[0];
  return (
    <div className="space-y-4">
      <div><div className="flex items-center gap-3"><h1 className="text-xl font-semibold">품목</h1><Link href="/items/families" className="text-sm text-muted-foreground underline-offset-2 hover:underline">제품군 · 기종별 보기 →</Link></div>
        <p className="text-sm text-muted-foreground">MC(기종) {fmtInt(rows.length)}개 · DT · GC · PRT 로 구분 · Family 는 회사가 정한 약자, Item Code 는 익명 코드 (D-077)</p></div>
      <div className="flex flex-wrap items-center gap-2" data-testid="category-tabs">
        {["", ...CATEGORY_TABS].map(c => <Link scroll={false} key={c || "all"} href={drillHref("/items", { category: c || undefined })} className={chip(c === MC)}>{c ? catLabel(c) : "전체"}</Link>)}
      </div>
      <div className="flex flex-wrap items-center gap-1" data-testid="mc-biz-tabs"><span className="mr-1 text-xs text-muted-foreground">MC 구분</span>
        <Link scroll={false} href={drillHref("/items", { category: MC })} className={small(!biz)}>전체</Link>
        {MC_BIZ.map(b => <Link scroll={false} key={b} href={drillHref("/items", { category: MC, biz: b })} className={small(b === biz)}>{b}</Link>)}
        {(sp.active === "true" || sp.lineage === "true") && <Link scroll={false} href={drillHref("/items", { category: MC, biz })} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{sp.active === "true" ? "실적 있는 Family" : "전임 · 후속 관계 있음"} ✕</Link>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="mc-kpi">{kpis.map(k => <KpiTile key={k.label} {...k} />)}</div>
      <McBizChart labels={by.map(b => b.biz)} families={by.map(b => b.n)} acts={by.map(b => Math.round(b.act_12m))}
        insight={top ? `${top.biz} 가 최근 12개월 실적 ${fmtInt(top.act_12m)} 로 가장 많음 — Family ${fmtInt(top.n)}개 중 ${fmtInt(top.active)}개에 실적` : "데이터 없음"} />
      <McItemsTable rows={rows} />
    </div>
  );
}
