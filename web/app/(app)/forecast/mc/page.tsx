import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchMcModels, fetchMcCompare, mcSeries, mcFyTable, METHOD_LABEL } from "@/lib/queries/forecast";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { fmtInt, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
export default async function McPage({ searchParams }: { searchParams: Promise<{ model?: string }> }) {
  const { model } = await searchParams;
  const sb = await createServerSupabase();
  const models = await fetchMcModels(sb);
  const sel = model ?? models[0]?.model_base;
  const rows = sel ? await fetchMcCompare(sb, sel) : [];
  const { months, series, forecastFrom } = mcSeries(rows as never);
  const fy = mcFyTable(rows as never);
  const method = rows.find(r => r.method)?.method;
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">기종 예측 비교</h1><p className="text-sm text-muted-foreground">Sales OL · SCM OL · 시스템 기준예측 · 실적 을 항상 함께 표시합니다 (R-FC-10). 백테스트 구간은 평가 FY, 그 이후는 프로덕션 예측(밴드).</p></div>
      <div className="flex flex-wrap gap-1">{models.slice(0, 40).map(m => <Link key={m.model_base} href={`/forecast/mc?model=${m.model_base}`} className={cn("rounded-full border px-2.5 py-0.5 text-xs", m.model_base === sel ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{m.model_base} <span className="opacity-60">{m.biz}</span></Link>)}</div>
      {sel && <section className="rounded-md border p-3">
        <h2 className="mb-1 text-sm font-medium">{sel} — 월별 (챔피언 기법: {method ? METHOD_LABEL[method] ?? method : "-"})</h2>
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
