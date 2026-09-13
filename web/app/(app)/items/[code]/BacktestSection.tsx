"use client";
import { useMemo, useState } from "react";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { DrillCard } from "@/components/cards/DrillCard";
import { Badge } from "@/components/ui/badge";
import { fmtInt, fmtPct, fmtNum } from "@/lib/format";
import { METHOD_LABEL, type ItemBacktest } from "@/lib/queries/forecast";
import type { TsSeries } from "@/components/charts/chartOption";
import { cn } from "@/lib/utils";
/** 품목 예측 검증 (R-FC-40/41): 학습 구간 → 평가 FY 예측 vs 실적. 기법을 골라 비교 */
export function BacktestSection({ bt, histStart }: { bt: ItemBacktest | null; histStart?: string }) {
  const [method, setMethod] = useState<string>(bt?.champion ?? "");
  const [compare, setCompare] = useState<string>("");
  const series = useMemo<TsSeries[]>(() => {
    if (!bt) return [];
    const out: TsSeries[] = [{ name: "실제 출고", role: "actual", data: bt.actual }, { name: `예측 · ${METHOD_LABEL[method] ?? method}`, role: "forecast", data: bt.byMethod[method] ?? [] }];
    if (compare && compare !== method) out.push({ name: `비교 · ${METHOD_LABEL[compare] ?? compare}`, role: "other", data: bt.byMethod[compare] ?? [] });
    return out;
  }, [bt, method, compare]);
  if (!bt) return <section className="rounded-md border p-3 text-sm text-muted-foreground">예측 검증 결과 없음 — 백테스트가 아직 실행되지 않았거나 이 품목은 학습 이력이 부족합니다.</section>;
  const m = bt.metrics.find(x => x.method === method); const champ = bt.metrics.find(x => x.champion);
  const fy = bt.run.eval_fy ? `FY${String(bt.run.eval_fy).slice(2)}` : "";
  const totalA: number = bt.actual.reduce<number>((a, v) => a + (v ?? 0), 0); const totalF: number = (bt.byMethod[method] ?? []).reduce<number>((a, v) => a + (v ?? 0), 0);
  return (
    <section className="space-y-3 rounded-md border p-3" data-testid="backtest">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">예측 검증 (백테스트 {fy})</h2>
        <span className="text-xs text-muted-foreground">학습 {histStart && histStart > (bt.run.train_from ?? "") ? histStart : bt.run.train_from} ~ {bt.run.train_to} (이 품목 이력 기준) → 예측 {bt.months[0]} ~ {bt.months[bt.months.length - 1]} 를 같은 기간 실적과 비교. 챔피언 = WAPE 최소 기법 (R-FC-31)</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DrillCard label="챔피언 기법" value={METHOD_LABEL[bt.champion] ?? bt.champion} hint={`후보 ${bt.metrics.length}개 중 최선`} href="#backtest-table" />
        <DrillCard label="오차 WAPE (선택 기법)" value={fmtPct(m?.wape)} hint="Σ|예측−실적| ÷ Σ실적 · 낮을수록 좋음" href="#backtest-table" tone={m?.wape != null && m.wape > 0.5 ? "warn" : "default"} />
        <DrillCard label="편향 Bias" value={fmtPct(m?.bias)} hint={m?.bias != null ? (m.bias > 0 ? "예측이 실적보다 큼(과대)" : "예측이 실적보다 작음(과소)") : "-"} href="#backtest-table" />
        <DrillCard label="12개월 합계 실적 / 예측" value={`${fmtInt(totalA)} / ${fmtInt(totalF)}`} hint={`차이 ${fmtInt(totalF - totalA)}`} href="#backtest-table" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label>표시 기법 <select className="ml-1 h-8 rounded-md border bg-background px-2" value={method} onChange={e => setMethod(e.target.value)} aria-label="백테스트 기법">{bt.metrics.map(x => <option key={x.method} value={x.method}>{x.label}{x.champion ? " ★" : ""} — WAPE {fmtPct(x.wape)}</option>)}</select></label>
        <label>비교 기법 <select className="ml-1 h-8 rounded-md border bg-background px-2" value={compare} onChange={e => setCompare(e.target.value)} aria-label="비교 기법"><option value="">(없음)</option>{bt.metrics.filter(x => x.method !== method).map(x => <option key={x.method} value={x.method}>{x.label} — WAPE {fmtPct(x.wape)}</option>)}</select></label>
      </div>
      <TimeSeriesChart months={bt.months} series={series} forecastFrom={bt.months[0]} height={280} />
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]" id="backtest-table">
        <table className="w-full text-sm"><thead><tr className="text-muted-foreground"><th className="text-left">월</th><th className="text-right">실적</th><th className="text-right">예측</th><th className="text-right">차이</th><th className="text-right">오차율</th></tr></thead>
          <tbody>{bt.months.map((ym, i) => { const a = bt.actual[i]; const f = (bt.byMethod[method] ?? [])[i]; const diff = a != null && f != null ? f - a : null; return (
            <tr key={ym} className="border-t tabular-nums"><td className="py-0.5">{ym}</td><td className="text-right">{fmtInt(a)}</td><td className="text-right">{fmtNum(f, 1)}</td><td className={cn("text-right", diff != null && diff > 0 && "text-amber-700", diff != null && diff < 0 && "text-blue-700")}>{diff == null ? "-" : (diff > 0 ? "+" : "") + fmtNum(diff, 1)}</td><td className="text-right">{a ? fmtPct(Math.abs(diff ?? 0) / a) : "-"}</td></tr>); })}
            <tr className="border-t font-medium tabular-nums"><td className="py-0.5">합계</td><td className="text-right">{fmtInt(totalA)}</td><td className="text-right">{fmtInt(totalF)}</td><td className="text-right">{(totalF - totalA > 0 ? "+" : "") + fmtInt(totalF - totalA)}</td><td className="text-right">{fmtPct(m?.wape)}</td></tr></tbody></table>
        <div><div className="mb-1 text-xs font-medium text-muted-foreground">기법별 성적 (이 품목)</div>
          <ul className="text-xs">{bt.metrics.map(x => <li key={x.method} className={cn("flex justify-between border-t py-0.5", x.method === method && "font-medium")}><span>{x.label}{x.champion && <Badge className="ml-1 text-[10px]">챔피언</Badge>}</span><span className="tabular-nums">WAPE {fmtPct(x.wape)} · Bias {fmtPct(x.bias)}</span></li>)}</ul>
          {champ && <p className="mt-2 text-xs text-muted-foreground">평가 구간 기준으로 기법을 고르므로 이 수치는 상한 추정입니다. 프로덕션 예측은 이 챔피언을 미래에 적용합니다 (D-020).</p>}</div>
      </div>
    </section>
  );
}
