"use client";
import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime, fmtInt } from "@/lib/format";
import { UPLOAD_TARGETS, type TargetKey } from "@/lib/upload/templates";
type Row = { id: string; file_name: string | null; target: string; row_count: number; ok_count: number; error_count: number; errors: unknown; uploaded_at: string | null };
export function UploadLog({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (rows.length === 0) return <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">업로드 이력이 없습니다</p>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground"><th className="py-2">시각</th><th>파일</th><th>대상</th><th className="text-right">행</th><th className="text-right">성공</th><th className="text-right">오류</th></tr></thead>
      <tbody>{rows.map(r => { const errs = (r.errors ?? []) as { row: number; message: string }[]; return (
        <Fragment key={r.id}>
          <tr className="cursor-pointer border-t hover:bg-muted/40" onClick={() => setOpen(open === r.id ? null : r.id)}>
            <td className="py-1.5">{fmtDateTime(r.uploaded_at)}</td><td>{r.file_name}</td><td><Badge variant="outline">{UPLOAD_TARGETS[r.target as TargetKey]?.label ?? r.target}</Badge></td>
            <td className="text-right tabular-nums">{fmtInt(r.row_count)}</td><td className="text-right tabular-nums">{fmtInt(r.ok_count)}</td>
            <td className="text-right tabular-nums">{r.error_count > 0 ? <Badge variant="destructive">{fmtInt(r.error_count)}</Badge> : 0}</td>
          </tr>
          {open === r.id && errs.length > 0 && <tr><td colSpan={6} className="bg-muted/30 p-2"><ul className="max-h-60 overflow-auto text-xs">{errs.map((e, i) => <li key={i}>행 {e.row}: {e.message}</li>)}</ul></td></tr>}
        </Fragment>); })}</tbody>
    </table>
  );
}
