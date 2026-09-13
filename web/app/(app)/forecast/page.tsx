import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchLatestRuns, fetchAccuracySummary, accuracyTable, fetchMatrix, buildMatrix, fetchChampionShare, METHOD_LABEL, PATTERN_LABEL } from "@/lib/queries/forecast";
import { DrillCard } from "@/components/cards/DrillCard";
import { drillHref } from "@/lib/drill";
import { fmtPct, fmtInt, fmtDateTime } from "@/lib/format";
import { AccuracyChart } from "./AccuracyChart";
import { cn } from "@/lib/utils";
export default async function ForecastPage() {
  const sb = await createServerSupabase();
  const [runs, acc, matrix, champ] = await Promise.all([fetchLatestRuns(sb), fetchAccuracySummary(sb), fetchMatrix(sb), fetchChampionShare(sb)]);
  const bt = runs.backtest; const pr = runs.production;
  const s = (bt?.summary ?? {}) as Record<string, number | string | null>;
  const modelTbl = accuracyTable(acc, "model"); const itemTbl = accuracyTable(acc, "item");
  const sys = modelTbl.find(r => r.method === "champion"); const scm = modelTbl.find(r => r.method === "scm_ol"); const sales = modelTbl.find(r => r.method === "sales_ol");
  const rows = buildMatrix(matrix);
  const byCat = acc.filter(r => r.level === "category" && r.method === "champion");
  const byPat = acc.filter(r => r.level === "pattern" && r.method === "champion");
  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold">예측</h1><p className="text-sm text-muted-foreground">FY 롤링 백테스트(R-FC-40)로 기법을 평가·선택하고 Sales OL · SCM OL 과 나란히 비교합니다 (D-002). 카드는 클릭하면 상세로 이동합니다.</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DrillCard label={`기준예측 WAPE (기종, FY${bt?.eval_fy ? String(bt.eval_fy).slice(2) : "-"})`} value={fmtPct(sys?.wape)} hint={`Bias ${fmtPct(sys?.bias)} · 목표 < 50%`} href="/forecast/mc" tone={sys?.wape != null && sys.wape < 0.5 ? "default" : "warn"} />
        <DrillCard label="SCM OL WAPE (같은 기간)" value={fmtPct(scm?.wape)} hint={`Bias ${fmtPct(scm?.bias)} · Sales OL ${fmtPct(sales?.wape)}`} href="/forecast/mc" />
        <DrillCard label="품목 기준예측 WAPE" value={fmtPct(itemTbl.find(r => r.method === "champion")?.wape)} hint={`품목 ${fmtInt(Number(s.n_items ?? 0))}개 · 기준선 ${fmtPct(itemTbl.find(r => r.method === "baseline6")?.wape)}`} href={bt ? `/forecast/runs/${bt.id}` : "/forecast/runs"} />
        <DrillCard label="최근 프로덕션 예측" value={pr ? `${pr.horizon}개월` : "-"} hint={pr ? `${pr.train_to} 까지 학습 · ${fmtDateTime(pr.finished_at)}` : "아직 없음 — engine forecast run"} href="/forecast/runs" tone={pr ? "default" : "warn"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border p-3">
          <h2 className="mb-2 text-sm font-medium">기종 레벨 정확도 — 기법별 (최신 백테스트)</h2>
          <AccuracyChart rows={modelTbl.map(r => ({ label: r.label, wape: r.wape, bias: r.bias }))} />
        </section>
        <section className="rounded-md border p-3">
          <h2 className="mb-2 text-sm font-medium">ABC-XYZ 매트릭스 (R-FC-35) — 셀 클릭 시 품목 목록</h2>
          <table className="w-full text-sm"><thead><tr><th></th>{["X 안정", "Y 변동", "Z 불규칙"].map(h => <th key={h} className="py-1 text-center text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>{rows.map(r => <tr key={r.abc}><td className="py-1 font-medium">{r.abc}</td>{r.cells.map(c => (
              <td key={c.xyz} className="p-1"><Link href={c.href} className={cn("block rounded-md border p-2 text-center hover:border-primary", c.abc === "A" && "bg-blue-50/60", c.abc === "B" && "bg-slate-50")}>
                <div className="text-lg font-semibold tabular-nums">{fmtInt(c.n_items)}</div><div className="text-xs text-muted-foreground">{fmtPct(c.value_share)} 금액</div></Link></td>))}</tr>)}</tbody></table>
        </section>
        <section className="rounded-md border p-3">
          <h2 className="mb-2 text-sm font-medium">챔피언 기법 분포 (품목)</h2>
          <ul className="space-y-1 text-sm">{champ.map(c => <li key={c.method} className="flex items-center gap-2"><Link href={drillHref("/items", { champion: c.method })} className="w-36 underline-offset-2 hover:underline">{c.label}</Link>
            <div className="h-3 flex-1 rounded bg-muted"><div className="h-3 rounded bg-blue-500" style={{ width: `${Math.round(100 * c.n / Math.max(1, champ.reduce((a, b) => a + b.n, 0)))}%` }} /></div><span className="w-16 text-right tabular-nums">{fmtInt(c.n)}</span></li>)}
            {champ.length === 0 && <li className="text-muted-foreground">백테스트 결과 없음</li>}</ul>
        </section>
        <section className="rounded-md border p-3">
          <h2 className="mb-2 text-sm font-medium">카테고리·수요패턴별 WAPE (품목 챔피언)</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <table><tbody>{byCat.map(r => <tr key={r.key} className="border-t"><td className="py-1"><Link className="hover:underline" href={drillHref("/items", { category: r.key })}>{r.key}</Link></td><td className="text-right tabular-nums">{fmtPct(r.wape)}</td><td className="text-right tabular-nums text-muted-foreground">{fmtPct(r.bias)}</td></tr>)}</tbody></table>
            <table><tbody>{byPat.map(r => <tr key={r.key} className="border-t"><td className="py-1"><Link className="hover:underline" href={drillHref("/items", { pattern: r.key })}>{PATTERN_LABEL[r.key] ?? r.key}</Link></td><td className="text-right tabular-nums">{fmtPct(r.wape)}</td><td className="text-right tabular-nums text-muted-foreground">{fmtPct(r.bias)}</td></tr>)}</tbody></table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">열: WAPE · Bias. 기법 라벨: {Object.values(METHOD_LABEL).slice(0, 3).join(", ")} …</p>
        </section>
      </div>
    </div>
  );
}
