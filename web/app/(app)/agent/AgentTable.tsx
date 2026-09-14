"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { agentFeedback } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { SIGNAL_LABEL, STATUS_LABEL, evidenceLine, type AgentEvent } from "@/lib/queries/agent";
import { cn } from "@/lib/utils";
const SEV = { 3: { label: "즉시", cls: "bg-[#fbdede] text-[#a12b2b]" }, 2: { label: "보통", cls: "bg-[#fff3d1] text-[#8a5a00]" }, 1: { label: "낮음", cls: "bg-[#e8f1fb] text-[#1d4f8f]" } } as const;
export function AgentTable({ rows }: { rows: AgentEvent[] }) {
  const router = useRouter(); const [pending, start] = useTransition();
  const fb = (id: string, v: "useful" | "not_useful") => start(async () => { const r = await agentFeedback(id, v); if (r.ok) { toast.success(v === "useful" ? "유용함으로 기록" : "불필요로 기록"); router.refresh(); } else toast.error(r.error); });
  return (
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground"><th className="py-2">심각도</th><th>신호</th><th>대상</th><th>판단·사유</th><th>근거</th><th>상태</th><th>감지</th><th>피드백</th></tr></thead>
      <tbody>{rows.map(e => { const sv = SEV[(e.severity ?? 1) as 1 | 2 | 3] ?? SEV[1]; const j = e.judgment ?? {}; return (
        <tr key={e.id} className="border-t align-top" data-testid="agent-row">
          <td className="py-1.5"><span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", sv.cls)}>{sv.label}</span></td>
          <td>{SIGNAL_LABEL[e.signal] ?? e.signal}</td>
          <td className="font-mono">{e.item_code ? <Link className="underline" href={`/items/${e.item_code}`}>{e.item_code}</Link> : e.supplier ?? "-"}{e.category && <span className="ml-1 text-xs text-muted-foreground">{e.category}</span>}</td>
          <td className="max-w-[22rem]"><div>{j.reason ?? <span className="text-muted-foreground">판단 전</span>}</div>{j.action === "propose" && j.qty != null && <div className="text-xs text-muted-foreground">제안 {Number(j.qty).toLocaleString("ko-KR")}개 / {j.need_ym} {j.by === "llm" ? "· AI" : "· 규칙"}</div>}</td>
          <td className="max-w-[24rem] text-xs text-muted-foreground">{evidenceLine(e)}</td>
          <td><Badge variant={e.status === "proposed" ? "default" : e.status === "accepted" ? "secondary" : "outline"}>{STATUS_LABEL[e.status] ?? e.status}</Badge>{e.approval_id && <Link className="ml-1 text-xs underline" href={`/approvals?status=${e.status === "proposed" ? "pending" : e.status === "accepted" ? "approved" : "rejected"}`}>결재</Link>}</td>
          <td className="text-xs">{fmtDateTime(e.first_seen)}{e.notified_count > 0 && <div className="text-muted-foreground">알림 {e.notified_count}회</div>}</td>
          <td className="whitespace-nowrap">{e.feedback ? <span className="text-xs text-muted-foreground">{e.feedback === "useful" ? "유용함" : "불필요"}</span> : <span className="inline-flex gap-1"><Button size="sm" variant="outline" disabled={pending} onClick={() => fb(e.id, "useful")}>유용</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => fb(e.id, "not_useful")}>불필요</Button></span>}</td>
        </tr>); })}
      {rows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">이벤트 없음 — 시스템 설정의 &quot;AI 감시 자율 모드&quot; 가 꺼져 있거나 감지된 신호가 없습니다</td></tr>}</tbody>
    </table></div>
  );
}
