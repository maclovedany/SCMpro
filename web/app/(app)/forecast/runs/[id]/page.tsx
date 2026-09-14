import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchRunDetail, fetchMethods, METHOD_LABEL, PATTERN_LABEL } from "@/lib/queries/forecast";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/badge";
import { KpiTile, type KpiTileProps } from "@/components/cards/KpiTile";
import { ChartCard } from "@/components/cards/ChartCard";
import { HBars } from "@/components/charts/MiniCharts";
import { SERIES_LIGHT } from "@/lib/design/palette";
import { fmtPct, fmtInt, fmtDateTime } from "@/lib/format";
import { ProposalList } from "./ProposalList";
type AccRow = { level: string | null; key: string | null; method: string | null; bias: number | null; wape: number | null; mape: number | null; n: number | null };
function Tbl({ rows, title, labelFn }: { rows: AccRow[]; title: string; labelFn?: (k: string) => string }) {
  const sorted = [...rows].sort((a, b) => ((a.key ?? "") + a.method).localeCompare((b.key ?? "") + b.method));
  return (
    <section className="rounded-md border p-3"><h2 className="mb-2 text-sm font-medium">{title}</h2>
      <table className="w-full text-sm"><thead><tr className="text-muted-foreground"><th className="text-left">구분</th><th className="text-left">기법</th><th className="text-right">WAPE</th><th className="text-right">Bias</th><th className="text-right">MAPE</th><th className="text-right">n</th></tr></thead>
        <tbody>{sorted.map((r, i) => <tr key={i} className="border-t tabular-nums"><td className="py-0.5">{labelFn ? labelFn(r.key ?? "") : r.key}</td><td>{METHOD_LABEL[r.method ?? ""] ?? r.method}</td><td className="text-right">{fmtPct(r.wape)}</td><td className="text-right">{fmtPct(r.bias)}</td><td className="text-right">{fmtPct(r.mape)}</td><td className="text-right">{fmtInt(r.n)}</td></tr>)}</tbody></table></section>);
}
export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createServerSupabase();
  const [{ run, acc, proposals }, { methods }, profile] = await Promise.all([fetchRunDetail(sb, id), fetchMethods(sb), getProfile()]);
  if (!run) notFound();
  const methodParams = Object.fromEntries(methods.map(m => [m.key, (m.params ?? {}) as Record<string, unknown>]));
  const s = (run.summary ?? {}) as Record<string, unknown>;
  const lvl = (l: string, k?: string) => acc.filter(r => r.level === l && (k ? r.key === k : true));
  const num = (k: string) => (s[k] == null ? null : Number(s[k]));
  const pp = (v: number | null) => (v == null ? "-" : `${(v * 100).toFixed(1)}%`);
  const prev = (s.vs_prev ?? null) as { item_wape_delta?: number | null; model_wape_delta?: number | null } | null;
  const delta = (d: number | null | undefined) => (d == null ? undefined : { text: `직전 런 대비 ${d >= 0 ? "+" : ""}${(d * 100).toFixed(1)}%p`, dir: d > 0.001 ? "up" as const : d < -0.001 ? "down" as const : "flat" as const, good: d <= 0 });
  const isAuto = !!(run.params_snapshot as Record<string, unknown> | null)?.auto_month;
  const isBt = run.run_type === "backtest";
  const olN = num("item_scm_ol_n") ?? 0;
  const kpis: KpiTileProps[] = isBt ? [
    { label: `품목 기준예측 WAPE (FY${String(run.eval_fy).slice(2)})`, value: pp(num("item_wape")), sub: `Bias ${pp(num("item_bias"))} · 품목 ${fmtInt(num("n_items"))}개`, delta: delta(prev?.item_wape_delta), href: "/forecast", accent: "stock", icon: "Package", tone: (num("item_wape") ?? 0) < 0.5 ? "default" : "warn" },
    { label: "기종 기준예측 WAPE", value: pp(num("model_wape")), sub: `Bias ${pp(num("model_bias"))} · 기종 ${fmtInt(num("n_models"))}개`, delta: delta(prev?.model_wape_delta), href: "/forecast/mc", accent: "forecast", icon: "Target", tone: (num("model_wape") ?? 0) < 0.5 ? "default" : "warn" },
    { label: "SCM OL WAPE (같은 기간)", value: pp(num("scm_ol_wape")), sub: `Bias ${pp(num("scm_ol_bias"))} · Sales OL ${pp(num("sales_ol_wape"))} (Bias ${pp(num("sales_ol_bias"))})`, href: "/forecast/mc", accent: "cycle", icon: "Users" },
    { label: "정확도 회귀", value: s.regressed ? "주의" : "없음", sub: s.regressed ? "직전 런보다 WAPE 1%p 이상 악화 — 데이터·기법 변경 확인" : "직전 런 대비 악화 없음", href: "/forecast/runs", accent: s.regressed ? "risk" : "forecast", icon: s.regressed ? "AlertTriangle" : "ShieldCheck", tone: s.regressed ? "warn" : "default" },
    { label: "제출 OL 채점 (품목)", value: olN ? pp(num("item_scm_ol_wape")) : "-", sub: olN ? `Bias ${pp(num("item_scm_ol_bias"))} · ${fmtInt(olN)}개월 채점` : "시스템 제출 OL 의 필요월 실적이 아직 없음 (D-040)", href: "/forecast", accent: "ops", icon: "FileCheck" },
    { label: "실행", value: `${String(s.seconds ?? "-")}초`, sub: `${isAuto ? "자동 런" : "수동 요청"} · 학습 ${run.train_from} ~ ${run.train_to} · 평가 ~${String(s.eval_to ?? "")}`, href: "/forecast/runs", accent: "data", icon: "Timer" },
  ] : [
    { label: "예측 품목", value: fmtInt(num("n_items")), sub: "SW 제외, 최신 백테스트 챔피언 기법 사용", href: "/items", accent: "stock", icon: "Package" },
    { label: "예측 기종", value: fmtInt(num("n_models")), sub: "기종 레벨 (OL 편향보정 포함)", href: "/forecast/mc", accent: "forecast", icon: "Target" },
    { label: "지평선", value: `${run.horizon}개월`, sub: `${((s.months as string[] | undefined) ?? [])[0] ?? ""} ~ ${((s.months as string[] | undefined) ?? []).slice(-1)[0] ?? ""}`, href: "/orders", accent: "cycle", icon: "CalendarRange" },
    { label: "실행", value: `${String(s.seconds ?? "-")}초`, sub: `${isAuto ? "자동 런" : "수동 요청"} · 학습 ~${run.train_to}`, href: "/forecast/runs", accent: "data", icon: "Timer" },
  ];
  const share = Object.entries((s.champion_share ?? {}) as Record<string, number>).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><h1 className="text-xl font-semibold">{isBt ? "백테스트" : "프로덕션 예측"} 런 <span className="font-mono text-base text-muted-foreground">{run.id.slice(0, 8)}</span></h1><Badge variant="outline">{run.run_type}</Badge><Badge variant={run.status === "done" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>{run.status}</Badge>{isAuto && <Badge variant="secondary">자동</Badge>}</div>
      <p className="text-sm text-muted-foreground">{isBt ? `평가 FY${String(run.eval_fy).slice(2)} · ` : ""}학습 {run.train_from} ~ {run.train_to} · 지평선 {run.horizon}개월 · {fmtDateTime(run.finished_at)}{run.error && <span className="ml-2 text-red-600">{run.error}</span>}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="run-kpi">{kpis.map(k => <KpiTile key={k.label} {...k} />)}</div>
      {isBt && share.length > 0 && <ChartCard title="챔피언 기법 분포 — 품목 비중 (%)" insight={`${METHOD_LABEL[share[0][0]] ?? share[0][0]} 이 품목 ${Math.round(share[0][1] * 100)}% 에서 최적 · 기법 ${share.length}종 사용`} href="/admin/forecast-methods" accent="forecast">
        <HBars height={Math.max(160, 22 * share.length + 16)} labels={share.map(([k]) => METHOD_LABEL[k] ?? k)} values={share.map(([, v]) => Math.round(v * 1000) / 10)} color={SERIES_LIGHT[2]} /></ChartCard>}
      {acc.length > 0 && <div className="grid gap-4 lg:grid-cols-2">
        <Tbl rows={lvl("total")} title="총계 — 품목/기종 × 기법" labelFn={k => ({ item: "품목", model: "기종" } as Record<string, string>)[k] ?? k} />
        <Tbl rows={[...lvl("category"), ...lvl("biz")]} title="카테고리 / 사업부 (챔피언)" />
        <Tbl rows={lvl("abcxyz")} title="ABC-XYZ 셀 (챔피언)" />
        <Tbl rows={lvl("pattern")} title="수요 패턴 (챔피언)" labelFn={k => PATTERN_LABEL[k] ?? k} />
      </div>}
      {!isBt && <p className="text-sm text-muted-foreground">프로덕션 런은 미래 예측이라 정확도 표가 없습니다. 예측값은 품목 상세·발주 계획에 반영되어 있고, 정확도는 백테스트 런에서 봅니다.</p>}
      {isBt && <ProposalList runId={run.id} proposals={proposals} methods={methodParams} canRequest={!!profile && canWriteMaster(profile.role)} />}
    </div>
  );
}
