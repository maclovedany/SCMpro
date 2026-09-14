import { createServerSupabase } from "@/lib/supabase/server";
import { fetchLatestRuns, fetchAccuracySummary, accuracyTable, fetchForecastOverview, overviewCharts, fetchItemOlSummary, METHOD_LABEL, PATTERN_LABEL } from "@/lib/queries/forecast";
import { DrillCard } from "@/components/cards/DrillCard";
import { KpiTile, type KpiTileProps } from "@/components/cards/KpiTile";
import { drillHref } from "@/lib/drill";
import { fmtPct, fmtInt, fmtDateTime } from "@/lib/format";
import { ForecastCharts } from "./ForecastCharts";
const pct1 = (v: number | null | undefined) => (v == null ? 0 : Math.round(Number(v) * 1000) / 10);
/** 예측 화면 (D-034, R-UI-13): KPI 스트립 + 정확도 · ABC-XYZ 교차 분석 · 등급별 재고 · 출고 추이 · 챔피언 분포 */
export default async function ForecastPage() {
  const sb = await createServerSupabase();
  const [runs, acc, ov, olSum] = await Promise.all([fetchLatestRuns(sb), fetchAccuracySummary(sb), fetchForecastOverview(sb), fetchItemOlSummary(sb)]);
  const olTot = olSum.find(r => r.level === "total");   // 시스템 제출 OL 정확도 (실적 쌓인 뒤, D-040)
  const bt = runs.backtest; const pr = runs.production;
  const s = (bt?.summary ?? {}) as Record<string, number | string | null>;
  const itemTbl = accuracyTable(acc, "item");
  // OL 정확도는 런 summary(scm_ol_wape 등)에 있음 — 정확도 행에 없으면 보강 (D-034)
  const olRow = (method: "scm_ol" | "sales_ol") => (s[`${method}_wape`] == null ? [] : [{ level: "total", key: "model", method, wape: Number(s[`${method}_wape`]), bias: s[`${method}_bias`] == null ? null : Number(s[`${method}_bias`]), label: METHOD_LABEL[method] }]);
  const modelTbl = [...accuracyTable(acc, "model").filter(r => !["scm_ol", "sales_ol"].includes(r.method) || r.wape != null), ...olRow("scm_ol").filter(o => !acc.some(r => r.level === "total" && r.key === "model" && r.method === o.method)), ...olRow("sales_ol").filter(o => !acc.some(r => r.level === "total" && r.key === "model" && r.method === o.method))].sort((a, b) => (a.wape ?? 9) - (b.wape ?? 9));
  const sys = modelTbl.find(r => r.method === "champion"); const scm = modelTbl.find(r => r.method === "scm_ol"); const sales = modelTbl.find(r => r.method === "sales_ol");
  const itemW = itemTbl.find(r => r.method === "champion")?.wape; const base6 = itemTbl.find(r => r.method === "baseline6")?.wape;
  const c = overviewCharts(ov);
  const byCat = acc.filter(r => r.level === "category" && r.method === "champion").sort((a, b) => (a.wape ?? 9) - (b.wape ?? 9));
  const byPat = acc.filter(r => r.level === "pattern" && r.method === "champion").sort((a, b) => (a.wape ?? 9) - (b.wape ?? 9));
  const fy = bt?.eval_fy ? `FY${String(bt.eval_fy).slice(2)}` : "-";
  const gain = sys?.wape != null && scm?.wape != null ? scm.wape - sys.wape : null;
  const kpis: KpiTileProps[] = [
    { label: `기준예측 WAPE (기종, ${fy})`, value: fmtPct(sys?.wape), href: "/forecast/mc", accent: "forecast", icon: "Target", tone: sys?.wape != null && sys.wape < 0.5 ? "default" : "warn",
      delta: gain == null ? undefined : { text: `SCM OL 보다 ${pct1(Math.abs(gain))}%p ${gain >= 0 ? "정확" : "부정확"}`, dir: gain >= 0 ? "down" : "up", good: gain >= 0 }, progress: { pct: Math.max(0, 100 - pct1(sys?.wape)), label: `Bias ${fmtPct(sys?.bias)} · 목표 < 50%` } },
    { label: "SCM OL · Sales OL WAPE", value: fmtPct(scm?.wape), sub: `Sales OL ${fmtPct(sales?.wape)} · Bias ${fmtPct(scm?.bias)}`, href: "/forecast/mc", accent: "cycle", icon: "Users" },
    { label: "품목 기준예측 WAPE", value: fmtPct(itemW), href: bt ? `/forecast/runs/${bt.id}` : "/forecast/runs", accent: "stock", icon: "Package",
      delta: itemW != null && base6 != null ? { text: `6M 평균 대비 ${pct1(base6 - itemW)}%p 개선`, dir: "down", good: base6 >= itemW } : undefined, sub: olTot?.wape != null ? `제출 OL WAPE ${fmtPct(olTot.wape)} (${fmtInt(olTot.n_items)}품목 ${fmtInt(olTot.n)}개월)` : `품목 ${fmtInt(Number(s.n_items ?? 0))}개 · 제출 OL 은 실적이 쌓이면 채점` },
    { label: "최근 프로덕션 예측", value: pr ? `${pr.horizon}개월` : "-", sub: pr ? `${pr.train_to} 까지 학습 · ${fmtDateTime(pr.finished_at)}` : "아직 없음 — 런에서 요청", href: "/forecast/runs", accent: "ops", icon: "PlayCircle", tone: pr ? "default" : "warn" },
  ];
  const wapeMethods = { labels: modelTbl.map(r => r.label), keys: modelTbl.map(r => r.method), values: modelTbl.map(r => pct1(r.wape)), href: "/forecast/mc",
    insight: sys && scm ? `시스템 기준예측 ${fmtPct(sys.wape)} vs SCM OL ${fmtPct(scm.wape)} · Sales OL ${fmtPct(sales?.wape)}` : "백테스트 결과 없음" };
  const wapeCat = { labels: byCat.map(r => r.key), keys: byCat.map(r => r.key), values: byCat.map(r => pct1(r.wape)), href: "/items", filterKey: "category", insight: byCat[0] ? `${byCat[0].key} 가 가장 정확 (${fmtPct(byCat[0].wape)})` : "-" };
  const wapePat = { labels: byPat.map(r => PATTERN_LABEL[r.key] ?? r.key), keys: byPat.map(r => r.key), values: byPat.map(r => pct1(r.wape)), href: "/items", filterKey: "pattern", insight: byPat.length ? `${PATTERN_LABEL[byPat[byPat.length - 1].key] ?? byPat[byPat.length - 1].key} 패턴이 가장 어려움 (${fmtPct(byPat[byPat.length - 1].wape)})` : "-" };
  const gA = c.grade[0], gAll = c.grade.reduce((a, g) => a + g.stockout, 0);
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">예측</h1><p className="text-sm text-muted-foreground">FY 롤링 백테스트(R-FC-40)로 기법을 평가·선택하고 Sales OL · SCM OL 과 나란히 비교합니다 (D-002). 카드·차트를 누르면 근거 목록으로 이동합니다.</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="fc-kpi">{kpis.map(k => <KpiTile key={k.label} {...k} />)}</div>
      <section data-testid="fc-accuracy">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">정확도 (최신 백테스트 {fy})</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <ForecastCharts kind="wape" c={c} acc={wapeMethods} /><ForecastCharts kind="wape" c={c} acc={wapeCat} /><ForecastCharts kind="wape" c={c} acc={wapePat} />
        </div>
      </section>
      <section data-testid="fc-matrix">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">ABC-XYZ 교차 분석</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-3"><ForecastCharts kind="heat" c={c} /></div>
          <div className="lg:col-span-2"><ForecastCharts kind="guide" c={c} /></div>
        </div>
      </section>
      <section data-testid="fc-grade">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">등급별 재고 상태</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-1 lg:grid-cols-1">
            <DrillCard compact accent="stock" label="A 등급 품목" value={fmtInt(gA.n_items)} hint={`평균 DoS ${gA.avg_dos ?? "-"}일 · 목표 ${gA.target_dos ?? "-"}일`} href={drillHref("/items", { abc: "A" })} />
            <DrillCard compact accent="risk" label="재고 0 품목 (A 등급)" value={fmtInt(gA.stockout)} hint={`전체 ${fmtInt(gAll)}개 재고 0 — 이 중 A 등급은 즉시 확인`} href={drillHref("/items", { abc: "A", stock: "zero" })} tone={gA.stockout > 0 ? "danger" : "default"} />
            <DrillCard compact accent="ops" label="과잉 후보 (DoS ≥ 목표 2배)" value={fmtInt(c.grade.reduce((a, g) => a + g.excess, 0))} hint={c.grade.map(g => `${g.abc} ${fmtInt(g.excess)}`).join(" · ")} href={drillHref("/items", { excess: true })} tone={gA.excess > 0 ? "warn" : "default"} />
          </div>
          <div className="lg:col-span-2"><ForecastCharts kind="gradeValue" c={c} /></div>
          <div className="lg:col-span-2"><ForecastCharts kind="gradeDos" c={c} /></div>
        </div>
      </section>
      <section data-testid="fc-trend">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">출고 추이 · 챔피언 기법 {ov.last_ym ? `(최근 ${ov.last_ym} 까지)` : ""}</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-3"><ForecastCharts kind="trend" c={c} /></div>
          <div className="lg:col-span-2"><ForecastCharts kind="champion" c={c} /></div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">기법 라벨: {Object.values(METHOD_LABEL).slice(0, 4).join(", ")} … · 카테고리 색: 부품 파랑 · 소모품 아쿠아 · 옵션 주황</p>
      </section>
    </div>
  );
}
