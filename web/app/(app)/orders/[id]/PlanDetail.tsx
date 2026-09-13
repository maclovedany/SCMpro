"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { overrideLine, confirmPlan } from "../actions";
import { TreeGrid, type TreeRow } from "@/components/tables/TreeGrid";
import { DataGrid } from "@/components/tables/DataGrid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtInt, fmtNum } from "@/lib/format";
import { drillHref } from "@/lib/drill";
import type { LineRow, LineFilters } from "@/lib/queries/orders";
import { cn } from "@/lib/utils";
type Props = { plan: { id: string; plan_ym: string; status: string }; lines: LineRow[]; treeRows: TreeRow[]; months: string[]; filters: LineFilters; canEdit: boolean; total: number; page: number; pageSize: number };
export function PlanDetail({ plan, lines, treeRows, months, filters, canEdit, total, page, pageSize }: Props) {
  const router = useRouter();
  const [edit, setEdit] = useState<{ line: LineRow; qty: number | null } | null>(null);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();
  const base = `/orders/${plan.id}`;
  const dataLast = months[0] ? months[0] : "";
  const save = () => edit && start(async () => { const r = await overrideLine(Number(edit.line.id), edit.qty, reason); if (r.ok) { toast.success("오버라이드 저장"); setEdit(null); setReason(""); router.refresh(); } else toast.error(r.error); });
  const confirm = () => start(async () => { const r = await confirmPlan(plan.id, reason || `발주 계획 ${plan.plan_ym} 확정`); if (r.ok) { toast.success("승인 요청을 보냈습니다"); setConfirmOpen(false); router.refresh(); } else toast.error(r.error); });
  const onCellEdit = (rowId: string, _ym: string, value: number | null) => {
    const code = rowId.replace(/^it-/, "").replace(/-ord$/, ""); const line = lines.find(l => l.key_code === code);
    if (line && canEdit) setEdit({ line, qty: value });
  };
  const columns = useMemo<ColumnDef<LineRow, unknown>[]>(() => [
    { accessorKey: "key_code", header: "코드", cell: c => <Link className="font-mono underline-offset-2 hover:underline" href={`/items/${c.getValue()}`}>{String(c.getValue())}</Link> },
    { accessorKey: "category", header: "카테고리" }, { accessorKey: "need_ym", header: "필요월" },
    { accessorKey: "on_hand", meta: { align: "right" }, header: "현재고", cell: c => fmtInt(c.getValue() as number) },
    { accessorKey: "inbound_until_need", meta: { align: "right" }, header: "입고예정", cell: c => fmtInt(c.getValue() as number) },
    { accessorKey: "forecast_need", meta: { align: "right" }, header: "예측(필요월)", cell: c => fmtNum(c.getValue() as number, 1) },
    { accessorKey: "extras_need", meta: { align: "right" }, header: "추가수요", cell: c => fmtInt(c.getValue() as number) },
    { accessorKey: "start_need", meta: { align: "right" }, header: "기초(필요월)", cell: c => <span className={cn((c.getValue() as number) < 0 && "text-red-600")}>{fmtInt(c.getValue() as number)}</span> },
    { accessorKey: "target_stock", meta: { align: "right" }, header: "목표재고", cell: c => fmtInt(c.getValue() as number) },
    { accessorKey: "required_qty", meta: { align: "right" }, header: "필요량", cell: c => fmtInt(c.getValue() as number) },
    { id: "flex", meta: { align: "right" }, header: "Flex 범위", accessorFn: r => r.flex_base != null ? `${fmtInt(r.flex_min)}~${fmtInt(r.flex_max)}${r.flex_hit ? " !" : ""}` : "-" },
    { accessorKey: "moq", meta: { align: "right" }, header: "MOQ" },
    { accessorKey: "final_qty", meta: { align: "right" }, header: "제안 발주", cell: c => <b>{fmtInt(c.getValue() as number)}</b> },
    { accessorKey: "override_qty", meta: { align: "right" }, header: "오버라이드", cell: c => c.getValue() != null ? <Badge variant="secondary">{fmtInt(c.getValue() as number)}</Badge> : "" },
    { accessorKey: "dos_after", meta: { align: "right" }, header: "발주 후 DoS", cell: c => <span className={cn(c.row.original.target_dos_days != null && (c.getValue() as number) < c.row.original.target_dos_days! && "text-amber-700")}>{fmtInt(c.getValue() as number)}</span> },
    { accessorKey: "amount", meta: { align: "right" }, header: "금액", cell: c => `₩${fmtInt(c.getValue() as number)}` },
    { id: "flags", header: "상태", accessorFn: r => [r.stockout_risk && "품절위험", r.blocked && "차단", r.flex_hit && "Flex"].filter(Boolean).join(",") },
  ], []);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {[["전체", {}], ["품절 위험", { risk: true }], ["차단", { blocked: true }], ["Flex 도달", { flex: true }]].map(([label, f]) => {
          const active = JSON.stringify(f) === JSON.stringify(Object.fromEntries(Object.entries(filters).filter(([k, v]) => v && k !== "q")));
          return <Link key={label as string} href={drillHref(base, f as Record<string, boolean>)} className={cn("rounded-full border px-3 py-1", active ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{label as string}</Link>; })}
        <span className="text-muted-foreground">{fmtInt(lines.length)} / {fmtInt(total)} 라인 (페이지 {page}/{Math.max(1, Math.ceil(total / pageSize))})</span>
        <Link href={drillHref(base, { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page: Math.max(1, page - 1) })} className="rounded border px-2 py-0.5">이전</Link>
        <Link href={drillHref(base, { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page: page + 1 })} className="rounded border px-2 py-0.5">다음</Link>
        {canEdit && <Button size="sm" className="ml-auto" onClick={() => setConfirmOpen(true)} disabled={pending}>확정 → 팀장 승인 요청</Button>}
      </div>
      <section className="rounded-md border p-3">
        <h2 className="mb-2 text-sm font-medium">재고전개 (R-UI-04) — 카테고리 합계(전체) → 품목(현재 페이지) → 예측/입고/추가/기초/기말/확정 발주. 확정 발주 셀 클릭으로 오버라이드</h2>
        <TreeGrid months={months} rows={treeRows} pastUntil={dataLast ? `${dataLast}-` : ""} onCellEdit={canEdit ? onCellEdit : undefined} firstColLabel="카테고리 / 품목" expandLevel={0} />
      </section>
      <section data-testid="line-grid"><h2 className="mb-2 text-sm font-medium">라인 (근거 컬럼 포함, R-OQ-41)</h2>
        <DataGrid columns={columns} rows={lines} rowKey={r => String(r.id)} csvName={`order-plan-${plan.plan_ym}`} onRowClick={canEdit ? r => setEdit({ line: r, qty: Number(r.override_qty ?? r.final_qty) }) : undefined} /></section>
      <Dialog open={!!edit} onOpenChange={o => !o && setEdit(null)}>
        <DialogContent><DialogHeader><DialogTitle>발주량 오버라이드 — {edit?.line.key_code}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">제안 {fmtInt(edit?.line.final_qty)} (필요량 {fmtInt(edit?.line.required_qty)}, MOQ {edit?.line.moq}{edit?.line.flex_base != null ? `, Flex ${fmtInt(edit.line.flex_min)}~${fmtInt(edit.line.flex_max)}` : ""})</p>
          <input type="number" name="override_qty" className="h-9 w-40 rounded border px-2" value={edit?.qty ?? ""} onChange={e => setEdit(edit && { ...edit, qty: e.target.value === "" ? null : Number(e.target.value) })} />
          <Textarea name="override_reason" placeholder="사유 (필수)" value={reason} onChange={e => setReason(e.target.value)} rows={2} />
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>취소</Button><Button onClick={save} disabled={pending}>저장</Button></DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent><DialogHeader><DialogTitle>계획 확정</DialogTitle></DialogHeader>
          <p className="text-sm">확정하면 SCM팀장 승인 요청이 생성되고, 승인 시 라인의 최종 수량이 Supplier 제출 OL 로 기록됩니다.</p>
          <Textarea name="confirm_reason" placeholder="확정 메모 (선택)" value={reason} onChange={e => setReason(e.target.value)} rows={2} />
          <DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>취소</Button><Button onClick={confirm} disabled={pending}>확정</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
