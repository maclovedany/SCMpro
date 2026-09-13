import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { drillHref } from "@/lib/drill";
import type { TsSeries } from "@/components/charts/chartOption";
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
