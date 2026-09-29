import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchMcModels, fetchMcCompare, mcSeries, mcFyTable, METHOD_LABEL } from "@/lib/queries/forecast";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { fmtInt, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fetchAliasMap, realName } from "@/lib/names";
import { fetchMcItems } from "@/lib/queries/mcItems";
import { drillHref } from "@/lib/drill";
/** 기종 예측 비교 (R-FC-10). 차트는 기종 묶음 단위 — 어떤 Family 를 눌러서 왔는지와 그 기종에 속한 Family 를 함께 보여 준다 (D-079) */
export default async function McPage({ searchParams }: { searchParams: Promise<{ model?: string; family?: string }> }) {
  const { model, family } = await searchParams;
  const sb = await createServerSupabase();
  const [models, names, mcItems] = await Promise.all([fetchMcModels(sb), fetchAliasMap(sb), fetchMcItems(sb)]);
  const picked = family ? mcItems.find(i => i.family === family) ?? null : null;
  const nm = (mb: string) => realName(names, "codename", mb);   // 기종 이름은 실제 이름으로, 주소의 model 값은 시스템 코드 그대로 (D-075)
  const sel = model ?? picked?.model_base ?? models[0]?.model_base;
  const siblings = sel ? mcItems.filter(i => i.model_base === sel) : [];          // 이 기종 묶음에 속한 Family
  const rows = sel ? await fetchMcCompare(sb, sel) : [];
  const { months, series, forecastFrom } = mcSeries(rows as never);
  const fy = mcFyTable(rows as never);
  const method = rows.find(r => r.method)?.method;
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">기종 예측 비교</h1><p className="text-sm text-muted-foreground">Sales OL · SCM OL · 시스템 기준예측 · 실적 을 항상 함께 표시합니다 (R-FC-10). 백테스트 구간은 평가 FY, 그 이후는 프로덕션 예측(밴드).</p></div>
      <div className="flex flex-wrap gap-1">{models.slice(0, 40).map(m => <Link key={m.model_base} href={`/forecast/mc?model=${m.model_base}`} className={cn("rounded-full border px-2.5 py-0.5 text-xs", m.model_base === sel ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{nm(m.model_base)} <span className="opacity-60">{m.biz}</span></Link>)}</div>
      {sel && (picked || siblings.length > 0) && <section className="space-y-2 rounded-md border p-3 text-sm" data-testid="mc-family-info">
        {picked && <div className="flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="mc-picked">
          <span className="text-muted-foreground">선택한 Family</span><span className="text-base font-semibold">{picked.family}</span>
          <span className="rounded-full border px-2 py-0.5 text-xs">MC</span>{picked.biz && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{picked.biz}</span>}
          <span className="text-muted-foreground">Item Code <span className="font-mono text-xs text-foreground">{picked.item_code ?? "-"}</span></span>
          {picked.predecessor && <span className="text-muted-foreground">전임 <span className="text-foreground">{picked.predecessor}</span></span>}
          {picked.successor && <span className="text-muted-foreground">후속 <span className="text-foreground">{picked.successor}</span></span>}
          <span className="text-muted-foreground">최근 12개월 실적 <span className="tabular-nums text-foreground">{fmtInt(picked.act_12m)}</span></span>
          <Link className="ml-auto text-xs text-muted-foreground hover:underline" href={drillHref("/mc-plan", { biz: picked.biz ?? undefined, q: picked.family })}>기종 OL · 실적에서 이 Family 보기 →</Link>
        </div>}
        {siblings.length > 0 && <div className="flex flex-wrap items-center gap-1" data-testid="mc-siblings"><span className="mr-1 text-xs text-muted-foreground">기종 {nm(sel)} 에 속한 Family {fmtInt(siblings.length)}개</span>
          {siblings.map(i => <Link key={i.family} scroll={false} href={drillHref("/forecast/mc", { model: sel, family: i.family })} aria-current={i.family === picked?.family ? "true" : undefined}
            className={cn("rounded-full border px-2.5 py-0.5 text-xs", i.family === picked?.family ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{i.family}</Link>)}</div>}
        <p className="text-xs text-muted-foreground">아래 차트와 정확도는 기종 {nm(sel)} 전체(속한 Family 의 합) 기준입니다. Family 별 월 수치는 기종 OL · 실적에서 봅니다.</p>
      </section>}
      {sel && <section className="rounded-md border p-3">
        <div className="float-right flex gap-3 text-xs"><Link className="text-muted-foreground hover:underline" href={`/items?model=${encodeURIComponent(sel)}`}>연결 품목 →</Link><Link className="text-muted-foreground hover:underline" href="/mc-plan">기종 OL · 실적 →</Link></div>
        <h2 className="mb-1 text-sm font-medium">{nm(sel)}{picked ? ` · 선택한 Family ${picked.family}` : ""} — 월별 (챔피언 기법: {method ? METHOD_LABEL[method] ?? method : "-"})</h2>
        <TimeSeriesChart months={months} series={series} forecastFrom={forecastFrom} height={340} />
      </section>}
      <section className="rounded-md border p-3">
        <h2 className="mb-2 text-sm font-medium">FY별 정확도 (R-FC-08 회계연도 4월 시작)</h2>
        <table className="w-full text-sm"><thead><tr className="text-muted-foreground"><th className="text-left">FY</th><th className="text-right">실적 합</th><th className="text-right">Sales OL Bias</th><th className="text-right">Sales OL WAPE</th><th className="text-right">SCM OL Bias</th><th className="text-right">SCM OL WAPE</th><th className="text-right">기준예측 Bias</th><th className="text-right">기준예측 WAPE</th></tr></thead>
          <tbody>{fy.map(r => <tr key={r.fy} className="border-t tabular-nums"><td className="py-1">{r.fy}</td><td className="text-right">{fmtInt(r.act)}</td><td className="text-right">{fmtPct(r.sales_bias)}</td><td className="text-right">{fmtPct(r.sales_wape)}</td><td className="text-right">{fmtPct(r.scm_bias)}</td><td className="text-right">{fmtPct(r.scm_wape)}</td><td className="text-right font-medium text-blue-700">{fmtPct(r.sys_bias)}</td><td className="text-right font-medium text-blue-700">{fmtPct(r.sys_wape)}</td></tr>)}</tbody></table>
        <p className="mt-1 text-xs text-muted-foreground">기준예측 열은 백테스트 평가 FY 에만 값이 있습니다.</p>
      </section>
    </div>
  );
}
