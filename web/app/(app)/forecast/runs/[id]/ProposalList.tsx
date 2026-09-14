"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestTuningApproval } from "../../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime } from "@/lib/format";
type Proposal = { id: string; model: string; status: string; created_at: string | null; response: unknown; comment: string | null };
type Resp = { diagnosis?: { area: string; finding: string; evidence: string }[]; proposals?: { method_key: string; param_patch: Record<string, unknown>; enabled: boolean | null; scope: string; rationale: string; expected_effect: string }[]; data_issues?: string[]; dos_adjustments?: { scope: string; key: string; target_dos_days: number; rationale: string }[] };
export function ProposalList({ runId, proposals }: { runId: string; proposals: Proposal[] }) {
  const router = useRouter();
  const [reason, setReason] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <section className="space-y-3 rounded-md border p-3" data-testid="proposals">
      <h2 className="text-sm font-medium">AI 오차 분석·조정 제안 (gpt-5-nano, R-FC-42) — 승인 후 다음 런에 반영</h2>
      <p className="text-xs text-muted-foreground">생성: 터미널에서 <code>uv run engine forecast tune --run-id {runId}</code></p>
      {proposals.length === 0 && <p className="text-sm text-muted-foreground">제안 없음</p>}
      {proposals.map(p => { const r = (p.response ?? {}) as Resp; return (
        <div key={p.id} className="space-y-2 rounded-md border p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">{p.model}</Badge><Badge variant={p.status === "applied" ? "default" : "secondary"}>{p.status}</Badge>{fmtDateTime(p.created_at)}</div>
          <div><div className="text-sm font-medium">진단</div><ul className="list-disc pl-5 text-sm">{(r.diagnosis ?? []).map((d, i) => <li key={i}><b>{d.area}</b>: {d.finding} <span className="text-muted-foreground">({d.evidence})</span></li>)}</ul></div>
          <div><div className="text-sm font-medium">제안</div><ul className="list-disc pl-5 text-sm">{(r.proposals ?? []).map((x, i) => <li key={i}><code>{x.method_key}</code> {JSON.stringify(x.param_patch)}{x.enabled != null && ` enabled=${x.enabled}`} · {x.scope} — {x.rationale} <span className="text-muted-foreground">→ {x.expected_effect}</span></li>)}</ul></div>
          {(r.dos_adjustments ?? []).length > 0 && <div><div className="text-sm font-medium">목표 DoS 조정 제안 (발주 피드백, D-044)</div><ul className="list-disc pl-5 text-sm">{r.dos_adjustments!.map((d, i) => <li key={i}>{d.scope === "cell" ? `셀 ${d.key}` : <code>{d.key}</code>} → 목표 DoS {d.target_dos_days}일 <span className="text-muted-foreground">({d.rationale})</span></li>)}</ul></div>}
          {(r.data_issues ?? []).length > 0 && <div><div className="text-sm font-medium">데이터 이슈</div><ul className="list-disc pl-5 text-sm">{r.data_issues!.map((d, i) => <li key={i}>{d}</li>)}</ul></div>}
          {p.status === "pending" && (
            <div className="flex gap-2"><Textarea placeholder="승인 요청 사유 (필수)" rows={1} value={reason[p.id] ?? ""} onChange={e => setReason({ ...reason, [p.id]: e.target.value })} className="max-w-md" />
              <Button size="sm" disabled={pending} onClick={() => start(async () => { const x = await requestTuningApproval(p.id, reason[p.id] ?? ""); if (x.ok) { toast.success("승인 요청 완료"); router.refresh(); } else toast.error(x.error); })}>팀장 승인 요청</Button></div>)}
        </div>); })}
    </section>
  );
}
