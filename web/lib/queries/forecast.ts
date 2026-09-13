import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { drillHref } from "@/lib/drill";
import type { TsSeries } from "@/components/charts/chartOption";
import { withRetry } from "@/lib/supabase/retry";
type SB = SupabaseClient<Database>;
export const METHOD_LABEL: Record<string, string> = { champion: "시스템 기준예측", sales_ol: "Sales OL", scm_ol: "SCM OL", baseline6: "6M 평균", ma3: "이동평균 3M", ma12: "이동평균 12M", snaive: "전년동월×추세",
  ses: "SES", holt: "Holt", hw: "Holt-Winters", croston: "Croston", sba: "SBA", arima: "AutoARIMA", prophet: "Prophet", lgbm: "LightGBM", ol_bias: "OL 편향보정" };
export const PATTERN_LABEL: Record<string, string> = { smooth: "안정", erratic: "불규칙", intermittent: "간헐", lumpy: "간헐·변동", dead: "휴면" };

export async function fetchLatestRuns(sb: SB) {
  const { data } = await sb.schema("analytics").from("v_forecast_latest_run").select("*");
  const m = Object.fromEntries((data ?? []).map(r => [r.run_type, r]));
  return { backtest: m.backtest ?? null, production: m.production ?? null };
}
export async function fetchAccuracySummary(sb: SB) {
  const { data } = await sb.schema("analytics").from("v_accuracy_summary").select("level,key,method,bias,wape,mape,n,sum_actual").in("level", ["total", "category", "biz", "abcxyz", "pattern"]);
  return (data ?? []).map(r => ({ level: r.level ?? "", key: r.key ?? "", method: r.method ?? "", bias: r.bias, wape: r.wape, mape: r.mape, n: r.n })) as AccRow[];
}
export type AccRow = { level: string; key: string; method: string; bias: number | null; wape: number | null; mape?: number | null; n?: number | null };
export function accuracyTable(rows: AccRow[], key: "item" | "model") {
  return rows.filter(r => r.level === "total" && r.key === key).map(r => ({ ...r, label: METHOD_LABEL[r.method] ?? r.method }))
    .sort((a, b) => (a.wape ?? 9) - (b.wape ?? 9));
}
export async function fetchMatrix(sb: SB) {
  const { data } = await sb.schema("analytics").from("v_abc_xyz_matrix").select("*");
  return data ?? [];
}
export type MatrixCell = { abc: string; xyz: string; n_items: number; value_share: number; href: string };
export function buildMatrix(rows: { abc: string | null; xyz: string | null; n_items: number | null; value_12m?: number | null; value_share: number | null }[]) {
  const map = new Map(rows.map(r => [`${r.abc}${r.xyz}`, r]));
  return ["A", "B", "C"].map(abc => ({ abc, cells: ["X", "Y", "Z"].map(xyz => {
    const r = map.get(`${abc}${xyz}`);
    return { abc, xyz, n_items: r?.n_items ?? 0, value_share: r?.value_share ?? 0, href: drillHref("/items", { abc, xyz }) } as MatrixCell;
  }) }));
}
export async function fetchChampionShare(sb: SB) {
  const { data } = await sb.schema("app").from("item_class").select("champion_method");
  const cnt: Record<string, number> = {};
  for (const r of data ?? []) { const k = r.champion_method ?? "(없음)"; cnt[k] = (cnt[k] ?? 0) + 1; }
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([method, n]) => ({ method, label: METHOD_LABEL[method] ?? method, n }));
}
export async function fetchMcModels(sb: SB) {
  const { data } = await sb.schema("analytics").from("v_mc_compare").select("model_base,biz,act");
  const agg = new Map<string, { model_base: string; biz: string | null; act: number }>();
  for (const r of data ?? []) { const a = agg.get(r.model_base!) ?? { model_base: r.model_base!, biz: r.biz, act: 0 }; a.act += Number(r.act ?? 0); agg.set(r.model_base!, a); }
  return [...agg.values()].sort((a, b) => b.act - a.act);
}
export async function fetchMcCompare(sb: SB, model: string) {
  const { data } = await sb.schema("analytics").from("v_mc_compare").select("*").eq("model_base", model).order("ym");
  return data ?? [];
}
export type McRow = { ym: string; sales_ol: number | null; scm_ol: number | null; act: number | null; system_fc: number | null; lower: number | null; upper: number | null; fy?: number | null; method?: string | null };
export function mcSeries(rows: McRow[]): { months: string[]; series: TsSeries[]; forecastFrom?: string } {
  const months = rows.map(r => r.ym);
  const n = (v: number | null | undefined) => (v == null ? null : Number(v));
  const hasBand = rows.some(r => r.lower != null);
  const fcFrom = rows.find(r => r.act == null && r.system_fc != null)?.ym;
  const series: TsSeries[] = [
    { name: "실적", role: "actual", data: rows.map(r => n(r.act)) },
    { name: "Sales OL", role: "sales_ol", data: rows.map(r => n(r.sales_ol)) },
    { name: "SCM OL", role: "scm_ol", data: rows.map(r => n(r.scm_ol)) },
    { name: "시스템 기준예측", role: "forecast", data: rows.map(r => n(r.system_fc)), ...(hasBand ? { band: { lower: rows.map(r => Number(r.lower ?? r.system_fc ?? 0)), upper: rows.map(r => Number(r.upper ?? r.system_fc ?? 0)) } } : {}) },
  ];
  return { months, series, forecastFrom: fcFrom };
}
export function mcFyTable(rows: McRow[]) {
  const by = new Map<number, { fy: number; act: number; sales: number; scm: number; sys: number; sysN: number; ae_sales: number; ae_scm: number; ae_sys: number }>();
  for (const r of rows) {
    if (r.act == null || r.fy == null) continue;
    const t = by.get(r.fy) ?? { fy: r.fy, act: 0, sales: 0, scm: 0, sys: 0, sysN: 0, ae_sales: 0, ae_scm: 0, ae_sys: 0 };
    const a = Number(r.act); t.act += a;
    if (r.sales_ol != null) { t.sales += Number(r.sales_ol); t.ae_sales += Math.abs(Number(r.sales_ol) - a); }
    if (r.scm_ol != null) { t.scm += Number(r.scm_ol); t.ae_scm += Math.abs(Number(r.scm_ol) - a); }
    if (r.system_fc != null) { t.sys += Number(r.system_fc); t.sysN += a; t.ae_sys += Math.abs(Number(r.system_fc) - a); }
    by.set(r.fy, t);
  }
  return [...by.values()].sort((a, b) => a.fy - b.fy).map(t => ({ fy: `FY${String(t.fy).slice(2)}`, act: t.act,
    sales_bias: t.act ? (t.sales - t.act) / t.act : null, sales_wape: t.act ? t.ae_sales / t.act : null,
    scm_bias: t.act ? (t.scm - t.act) / t.act : null, scm_wape: t.act ? t.ae_scm / t.act : null,
    sys_bias: t.sysN ? (t.sys - t.sysN) / t.sysN : null, sys_wape: t.sysN ? t.ae_sys / t.sysN : null }));
}
export async function fetchRuns(sb: SB) {
  const { data } = await sb.schema("app").from("forecast_run").select("*").order("created_at", { ascending: false }).limit(50);
  return data ?? [];
}
export async function fetchRunDetail(sb: SB, id: string) {
  const [run, acc, proposals] = await Promise.all([
    sb.schema("app").from("forecast_run").select("*").eq("id", id).maybeSingle(),
    sb.schema("app").from("forecast_accuracy").select("level,key,method,bias,wape,mape,n").eq("run_id", id).in("level", ["total", "category", "biz", "abcxyz", "pattern"]),
    sb.schema("app").from("forecast_tuning_proposal").select("*").eq("run_id", id).order("created_at", { ascending: false }),
  ]);
  return { run: run.data, acc: acc.data ?? [], proposals: proposals.data ?? [] };
}
export async function fetchItemForecast(sb: SB, code: string) {
  const [fc, cls] = await Promise.all([
    sb.schema("analytics").from("v_forecast_latest").select("ym,method,value,lower,upper").eq("key_code", code).order("ym"),
    sb.schema("app").from("item_class").select("*").eq("key_code", code).maybeSingle(),
  ]);
  return { forecast: fc.data ?? [], cls: cls.data };
}
export async function fetchMethods(sb: SB) {
  const [m, p] = await Promise.all([sb.schema("app").from("forecast_method").select("*").order("sort"), sb.schema("app").from("forecast_policy").select("*").order("cell")]);
  return { methods: m.data ?? [], policy: p.data ?? [] };
}

/** 품목 백테스트 검증 (R-FC-40/41): 최신 백테스트 런에서 이 품목의 기법별 예측 vs 실적, 지표 */
export async function fetchItemBacktest(sb: SB, code: string) {
  const { data: run } = await sb.schema("analytics").from("v_forecast_latest_run").select("id,eval_fy,train_from,train_to").eq("run_type", "backtest").maybeSingle();
  if (!run) return null;
  const [res, acc] = await Promise.all([
    sb.schema("app").from("forecast_result").select("ym,method,value,actual,is_champion").eq("run_id", run.id!).eq("level", "item").eq("key_code", code).order("ym"),
    sb.schema("app").from("forecast_accuracy").select("method,wape,bias,mape,n").eq("run_id", run.id!).eq("level", "item").eq("key", code),
  ]);
  const rows = res.data ?? [];
  if (!rows.length) return null;
  const months = Array.from(new Set(rows.map(r => r.ym!))).sort();
  const methods = Array.from(new Set(rows.map(r => r.method!)));
  const champion = rows.find(r => r.is_champion)?.method ?? methods[0];
  const actual = months.map(m => { const r = rows.find(x => x.ym === m); return r?.actual == null ? null : Number(r.actual); });
  const byMethod: Record<string, (number | null)[]> = {};
  for (const mk of methods) byMethod[mk] = months.map(m => { const r = rows.find(x => x.ym === m && x.method === mk); return r?.value == null ? null : Number(r.value); });
  const metrics = (acc.data ?? []).map(a => ({ method: a.method!, label: METHOD_LABEL[a.method!] ?? a.method!, wape: a.wape, bias: a.bias, mape: a.mape, n: a.n, champion: a.method === champion })).sort((a, b) => (a.wape ?? 9) - (b.wape ?? 9));
  return { run: { id: run.id!, eval_fy: run.eval_fy, train_from: run.train_from, train_to: run.train_to }, months, actual, byMethod, champion, metrics };
}
export type ItemBacktest = NonNullable<Awaited<ReturnType<typeof fetchItemBacktest>>>;

/** 예측 화면 개요 (D-034): RPC fn_forecast_overview 한 번 — 매트릭스(재고·DoS 포함)·등급별 재고·12개월 카테고리 추이·챔피언 분포 */
export type ForecastOverview = {
  matrix: { abc: string; xyz: string; n_items: number; value_share: number | null; stock_value: number | null; avg_dos: number | null }[];
  grade: { abc: string; n_items: number; stock_value: number | null; avg_dos: number | null; target_dos: number | null; excess: number; stockout: number }[];
  trend: { ym: string; category: string; qty: number }[];
  champion: { method: string; n: number }[];
  last_ym: string | null;
};
export async function fetchForecastOverview(sb: SB): Promise<ForecastOverview> {
  const { data, error } = await withRetry(() => sb.schema("app").rpc("fn_forecast_overview"));
  if (error) throw error;
  const d = (data ?? {}) as Partial<ForecastOverview>;
  return { matrix: d.matrix ?? [], grade: d.grade ?? [], trend: d.trend ?? [], champion: d.champion ?? [], last_ym: d.last_ym ?? null };
}
export const XYZ_LABEL: Record<string, string> = { X: "X 안정", Y: "Y 변동", Z: "Z 불규칙" };
/** ABC-XYZ 셀별 관리 지침 (R-FC-35 운영 해석) — 한 줄 */
export const GRADE_GUIDE: Record<string, { policy: string; tip: string }> = {
  AX: { policy: "자동 보충 · 시계열 예측", tip: "안전재고 낮게, 발주 주기 짧게" },
  AY: { policy: "예측 + 중간 안전재고", tip: "월별 리뷰, Bias 추적" },
  AZ: { policy: "수동 검토 · 영업 정보 결합", tip: "안전재고 높게 또는 주문 기반" },
  BX: { policy: "자동 보충 · 예측 기반", tip: "표준 안전재고" },
  BY: { policy: "예측 + 표준 안전재고", tip: "분기 리뷰" },
  BZ: { policy: "예외 관리 · 최소 재고", tip: "간헐 기법(Croston/SBA)" },
  CX: { policy: "min-max 규칙", tip: "묶음 발주로 빈도 낮춤" },
  CY: { policy: "min-max · 낮은 빈도", tip: "재고 상한 관리" },
  CZ: { policy: "주문 시 조달 · 단종 검토", tip: "재고 최소화, EOL 후보" },
};
/** 화면용 차트 데이터로 변환 (순수 함수 — 테스트 가능) */
export function overviewCharts(o: ForecastOverview) {
  const xs = ["X", "Y", "Z"], ys = ["A", "B", "C"];
  const cells = ys.flatMap((abc, y) => xs.map((xyz, x) => { const r = o.matrix.find(m => m.abc === abc && m.xyz === xyz);
    return { x, y, value: Number(r?.value_share ?? 0), label: `${(r?.n_items ?? 0).toLocaleString("ko-KR")}개 · 금액 ${Math.round(Number(r?.value_share ?? 0) * 1000) / 10}%` }; }));
  const top = [...o.matrix].sort((a, b) => Number(b.value_share ?? 0) - Number(a.value_share ?? 0))[0];
  const grade = ys.map(abc => o.grade.find(g => g.abc === abc) ?? { abc, n_items: 0, stock_value: 0, avg_dos: null, target_dos: null, excess: 0, stockout: 0 });
  const months = Array.from(new Set(o.trend.map(t => t.ym))).sort();
  const cats = ["PART", "SUPPLY", "OPTION"];
  const trend = { x: months, series: cats.map(c => ({ name: c, data: months.map(m => o.trend.find(t => t.ym === m && t.category === c)?.qty ?? 0) })) };
  const mom = cats.map(c => { const d = trend.series.find(x => x.name === c)!.data; const r3 = d.slice(-3), p9 = d.slice(0, -3);
    const a = r3.length ? r3.reduce((x, y) => x + y, 0) / r3.length : 0, b = p9.length ? p9.reduce((x, y) => x + y, 0) / p9.length : 0; return { c, r: b ? (a - b) / b : 0 }; })
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];
  const champTotal = o.champion.reduce((a, c) => a + c.n, 0);
  return {
    heat: { xs: xs.map(x => XYZ_LABEL[x]), ys, cells, insight: top ? `${top.abc}${top.xyz} 셀이 금액의 ${Math.round(Number(top.value_share ?? 0) * 1000) / 10}% (${top.n_items.toLocaleString("ko-KR")}개) — 예측 정밀도가 가장 중요한 구간` : "분류 결과 없음" },
    grade,
    gradeValue: { labels: grade.map(g => `${g.abc} 등급`), values: grade.map(g => Number(g.stock_value ?? 0)), insight: `A 등급 ${grade[0].n_items.toLocaleString("ko-KR")}개가 재고 금액의 ${Math.round(100 * Number(grade[0].stock_value ?? 0) / Math.max(1, grade.reduce((a, g) => a + Number(g.stock_value ?? 0), 0)))}% 차지` },
    gradeDos: { categories: grade.map(g => `${g.abc} 등급`), series: [{ name: "평균 DoS", data: grade.map(g => g.avg_dos == null ? null : Number(g.avg_dos)) }, { name: "목표 DoS", data: grade.map(g => g.target_dos == null ? null : Number(g.target_dos)) }],
      insight: (() => { const over = grade.filter(g => g.avg_dos != null && g.target_dos != null && Number(g.avg_dos) > Number(g.target_dos)).map(g => g.abc); return over.length ? `${over.join("·")} 등급 평균 DoS 가 목표를 초과 — 과잉 후보 ${grade.reduce((a, g) => a + g.excess, 0).toLocaleString("ko-KR")}개` : "모든 등급이 목표 DoS 이내"; })() },
    trend: { ...trend, insight: months.length >= 6 ? `최근 3개월 평균이 직전 9개월 대비 ${mom.c} ${mom.r >= 0 ? "+" : ""}${Math.round(mom.r * 100)}% — 변동이 가장 큰 카테고리` : "출고 이력 부족" },
    champion: { labels: o.champion.map(c => METHOD_LABEL[c.method] ?? c.method), keys: o.champion.map(c => c.method), values: o.champion.map(c => c.n),
      insight: o.champion[0] ? `${METHOD_LABEL[o.champion[0].method] ?? o.champion[0].method} 이 품목 ${Math.round(100 * o.champion[0].n / Math.max(1, champTotal))}% 에서 최적` : "백테스트 결과 없음" },
  };
}
export type OverviewCharts = ReturnType<typeof overviewCharts>;
