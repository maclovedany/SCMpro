"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestTuningApproval, requestTuning } from "../../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime } from "@/lib/format";
import { describeProposal, humanize, PROPOSAL_STATUS } from "@/lib/forecast/tuningText";
type Proposal = { id: string; model: string; status: string; created_at: string | null; response: unknown; comment: string | null };
type Resp = { diagnosis?: { area: string; finding: string; evidence: string }[]; proposals?: { method_key: string; param_patch: Record<string, unknown>; enabled: boolean | null; scope: string; rationale: string; expected_effect: string }[]; data_issues?: string[]; dos_adjustments?: { scope: string; key: string; target_dos_days: number; rationale: string }[] };
/** AI 오차 분석·조정 제안 — 사람 말로 (D-052). methods: 기법 키 → 현재 params (현재 → 제안 표시용) */
export function ProposalList({ runId, proposals, methods, canRequest }: { runId: string; proposals: Proposal[]; methods: Record<string, Record<string, unknown>>; canRequest: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const queued = proposals.some(p => p.status === "queued");
  return (
    <section className="space-y-3 rounded-md border p-3" data-testid="proposals">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">AI 오차 분석·조정 제안 — 승인하면 다음 예측 런부터 반영</h2>
        {canRequest && <Button size="sm" variant="outline" className="ml-auto" disabled={pending || queued} onClick={() => start(async () => { const x = await requestTuning(runId); if (x.ok) { toast.success("AI 분석을 요청했습니다 — 10분 내 처리"); router.refresh(); } else toast.error(x.error); })}>{queued ? "분석 대기 중" : "AI 오차 분석 요청"}</Button>}
      </div>
      <p className="text-xs text-muted-foreground">자동 런은 분석까지 자동으로 만듭니다. 수동 런은 위 버튼으로 요청하면 주기 작업이 10분 내 처리합니다. 제안은 팀장 승인 전에는 적용되지 않습니다.</p>
      {proposals.length === 0 && <p className="text-sm text-muted-foreground">아직 분석이 없습니다</p>}
      {proposals.map(p => { const r = (p.response ?? {}) as Resp; const st = PROPOSAL_STATUS[p.status] ?? { label: p.status, tone: "secondary" as const }; return (
        <div key={p.id} className="space-y-2 rounded-md border p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant={st.tone}>{st.label}</Badge><span>{p.model}</span><span>{fmtDateTime(p.created_at)}</span>{p.status === "failed" && p.comment && <span className="text-red-600">{p.comment}</span>}</div>
          {p.status === "queued" && <p className="text-sm text-muted-foreground">엔진이 최신 백테스트 결과를 읽어 분석 중입니다. 잠시 후 새로고침하세요.</p>}
          {(r.diagnosis ?? []).length > 0 && <div><div className="text-sm font-medium">진단</div><ul className="list-disc pl-5 text-sm">{r.diagnosis!.map((d, i) => <li key={i}><b>{humanize(d.area)}</b>: {humanize(d.finding)}{d.evidence && <span className="text-muted-foreground"> — {humanize(d.evidence)}</span>}</li>)}</ul></div>}
          {(r.proposals ?? []).length > 0 && <div><div className="text-sm font-medium">제안</div><ul className="list-disc pl-5 text-sm">{r.proposals!.map((x, i) => <li key={i}><b>{describeProposal(x, methods[x.method_key])}</b> — {humanize(x.rationale)}{x.expected_effect && <span className="text-muted-foreground"> → {humanize(x.expected_effect)}</span>}</li>)}</ul></div>}
          {(r.dos_adjustments ?? []).length > 0 && <div><div className="text-sm font-medium">목표 DoS 조정 제안 (지난 발주 채점 근거)</div><ul className="list-disc pl-5 text-sm">{r.dos_adjustments!.map((d, i) => <li key={i}>{d.scope === "cell" ? `${d.key} 셀 전체` : `품목 ${d.key}`} → 목표 DoS {d.target_dos_days}일 <span className="text-muted-foreground">— {humanize(d.rationale)}</span></li>)}</ul></div>}
          {(r.data_issues ?? []).length > 0 && <div><div className="text-sm font-medium">데이터 확인 필요</div><ul className="list-disc pl-5 text-sm">{r.data_issues!.map((d, i) => <li key={i}>{humanize(d)}</li>)}</ul></div>}
          {p.status === "pending" && canRequest && (
            <div className="flex gap-2"><Textarea placeholder="승인 요청 사유 (필수)" rows={1} value={reason[p.id] ?? ""} onChange={e => setReason({ ...reason, [p.id]: e.target.value })} className="max-w-md" />
              <Button size="sm" disabled={pending} onClick={() => start(async () => { const x = await requestTuningApproval(p.id, reason[p.id] ?? ""); if (x.ok) { toast.success("승인 요청 완료"); router.refresh(); } else toast.error(x.error); })}>팀장 승인 요청</Button></div>)}
        </div>); })}
    </section>
  );
}
