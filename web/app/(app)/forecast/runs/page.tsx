import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchRuns } from "@/lib/queries/forecast";
import { getProfile } from "@/lib/auth/getProfile";
import { canUpload } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime, fmtPct } from "@/lib/format";
import { RunRequestForm } from "./RunRequestForm";
export default async function RunsPage() {
  const p = await getProfile();
  const sb = await createServerSupabase();
  const runs = await fetchRuns(sb);
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">예측 런</h1><p className="text-sm text-muted-foreground">백테스트(평가 FY) 와 프로덕션 예측 이력. 요청한 런은 엔진(`engine forecast pending`)이 처리합니다. &quot;자동&quot; 표시는 시스템 설정의 예측 자동 실행(월 1회)으로 만들어진 런입니다 (D-041).</p></div>
      {p && canUpload(p.role) && <RunRequestForm />}
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="py-2">생성</th><th>종류</th><th>평가 FY / 지평선</th><th>학습 구간</th><th>상태</th><th className="text-right">품목 WAPE</th><th className="text-right">기종 WAPE</th><th className="text-right">SCM OL</th><th className="text-right">소요(초)</th></tr></thead>
        <tbody>{runs.map(r => { const s = (r.summary ?? {}) as Record<string, number | null>; return (
          <tr key={r.id} className="border-t hover:bg-muted/40">
            <td className="py-1.5"><Link className="underline" href={`/forecast/runs/${r.id}`}>{fmtDateTime(r.created_at)}</Link></td>
            <td><Badge variant="outline">{r.run_type}</Badge>{(r.params_snapshot as Record<string, unknown> | null)?.auto_month ? <Badge variant="secondary" className="ml-1">자동</Badge> : null}</td><td>{r.run_type === "backtest" ? `FY${String(r.eval_fy ?? "").slice(2)}` : `${r.horizon}개월`}</td>
            <td className="text-xs">{r.train_from} ~ {r.train_to}</td>
            <td><Badge variant={r.status === "done" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>{r.status}</Badge>{r.error && <span className="ml-1 text-xs text-red-600">{r.error.slice(0, 60)}</span>}</td>
            <td className="text-right tabular-nums">{fmtPct(s.item_wape)}</td><td className="text-right tabular-nums">{fmtPct(s.model_wape)}</td><td className="text-right tabular-nums">{fmtPct(s.scm_ol_wape)}</td><td className="text-right tabular-nums">{s.seconds ?? "-"}</td>
          </tr>); })}
        {runs.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">런 없음</td></tr>}</tbody>
      </table>
    </div>
  );
}
