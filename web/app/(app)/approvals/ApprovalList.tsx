"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { decideApproval } from "./actions";
import { kindLabel, type ApprovalRow } from "@/lib/queries/approvals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtDateTime } from "@/lib/format";
export function ApprovalList({ rows, canDecide }: { rows: ApprovalRow[]; canDecide: boolean }) {
  const router = useRouter();
  const [target, setTarget] = useState<{ row: ApprovalRow; decision: "approved" | "rejected" } | null>(null);
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  const run = () => target && start(async () => {
    const r = await decideApproval(target.row.id!, target.decision, comment);
    if (r.ok) { toast.success(target.decision === "approved" ? "승인했습니다" : "반려했습니다"); setTarget(null); setComment(""); router.refresh(); } else toast.error(r.error);
  });
  if (rows.length === 0) return <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">해당 상태의 요청이 없습니다</p>;
  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.id} className="flex items-start justify-between gap-4 rounded-md border p-4" data-testid="approval-row">
          <div className="space-y-1">
            <div className="flex items-center gap-2"><Badge variant="outline">{kindLabel(r.kind!)}</Badge><span className="text-sm font-medium">{r.description}</span></div>
            <div className="text-xs text-muted-foreground">요청 {r.requester_name ?? "-"} · {fmtDateTime(r.requested_at)} · 사유: {r.reason}</div>
            {r.status !== "pending" && <div className="text-xs">{r.status === "approved" ? "승인" : "반려"} {r.approver_name ?? ""} · {fmtDateTime(r.decided_at)}{r.comment && ` · 의견: ${r.comment}`}</div>}
          </div>
          {r.status === "pending" && canDecide && (
            <div className="flex shrink-0 gap-2">
              <Button size="sm" onClick={() => setTarget({ row: r, decision: "approved" })}>승인</Button>
              <Button size="sm" variant="outline" onClick={() => setTarget({ row: r, decision: "rejected" })}>반려</Button>
            </div>)}
        </div>
      ))}
      <Dialog open={!!target} onOpenChange={o => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{target?.decision === "approved" ? "승인" : "반려"} 확인</DialogTitle></DialogHeader>
          <p className="text-sm">{target?.row.description}</p>
          <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder={target?.decision === "rejected" ? "반려 사유 (필수)" : "의견 (선택)"} rows={3} name="comment" />
          <DialogFooter><Button variant="outline" onClick={() => setTarget(null)}>취소</Button><Button onClick={run} disabled={pending}>확인</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
