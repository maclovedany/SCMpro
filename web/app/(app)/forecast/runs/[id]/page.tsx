import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchRunDetail, METHOD_LABEL, PATTERN_LABEL } from "@/lib/queries/forecast";
import { Badge } from "@/components/ui/badge";
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
  const { run, acc, proposals } = await fetchRunDetail(sb, id);
  if (!run) notFound();
  const s = (run.summary ?? {}) as Record<string, unknown>;
  const lvl = (l: string, k?: string) => acc.filter(r => r.level === l && (k ? r.key === k : true));
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><h1 className="text-xl font-semibold">런 {run.id.slice(0, 8)}</h1><Badge variant="outline">{run.run_type}</Badge><Badge>{run.status}</Badge></div>
      <p className="text-sm text-muted-foreground">{run.run_type === "backtest" ? `평가 FY${String(run.eval_fy).slice(2)} · ` : ""}학습 {run.train_from} ~ {run.train_to} · 지평선 {run.horizon}개월 · {fmtDateTime(run.finished_at)} · {String(s.seconds ?? "-")}초</p>
      <pre className="overflow-auto rounded-md bg-muted/40 p-2 text-xs">{JSON.stringify(s, null, 1)}</pre>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tbl rows={lvl("total")} title="총계 — 레벨(item/model) × 기법" />
        <Tbl rows={[...lvl("category"), ...lvl("biz")]} title="카테고리 / 사업부 (챔피언)" />
        <Tbl rows={lvl("abcxyz")} title="ABC-XYZ 셀 (챔피언)" />
        <Tbl rows={lvl("pattern")} title="수요 패턴 (챔피언)" labelFn={k => PATTERN_LABEL[k] ?? k} />
      </div>
      {run.run_type === "backtest" && <ProposalList runId={run.id} proposals={proposals} />}
    </div>
  );
}
