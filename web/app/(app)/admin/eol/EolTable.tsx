"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { upsertEol } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
type Row = { model_base: string; biz: string | null; launch_date?: string | null; eol_date?: string | null; eos_date?: string | null; is_dummy?: boolean };
export function EolTable({ rows }: { rows: Row[] }) {
  const [edit, setEdit] = useState<Record<string, { launch_date: string; eol_date: string; eos_date: string }>>({});
  const [pending, start] = useTransition();
  const g = (r: Row) => edit[r.model_base] ?? { launch_date: r.launch_date ?? "", eol_date: r.eol_date ?? "", eos_date: r.eos_date ?? "" };
  const set = (r: Row, k: "launch_date" | "eol_date" | "eos_date", v: string) => setEdit({ ...edit, [r.model_base]: { ...g(r), [k]: v } });
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground"><th className="py-2">기종</th><th>구분</th><th>출시일</th><th>EOL</th><th>EOS</th><th></th></tr></thead>
      <tbody>{rows.map(r => { const e = g(r); const dirty = !!edit[r.model_base]; return (
        <tr key={r.model_base} className="border-t">
          <td className="py-1 font-mono">{r.model_base}</td><td><Badge variant="outline">{r.biz ?? "-"}</Badge></td>
          {(["launch_date", "eol_date", "eos_date"] as const).map(k => <td key={k}><input type="date" value={e[k]} onChange={ev => set(r, k, ev.target.value)} className="h-8 rounded border px-1" aria-label={`${r.model_base} ${k}`} /></td>)}
          <td className="text-right"><Button size="sm" variant={dirty ? "default" : "outline"} disabled={pending || !dirty} onClick={() => start(async () => {
            const x = await upsertEol(r.model_base, e.launch_date, e.eol_date, e.eos_date); if (x.ok) { toast.success("저장됨"); const n = { ...edit }; delete n[r.model_base]; setEdit(n); } else toast.error(x.error); })}>저장</Button></td>
        </tr>); })}</tbody>
    </table>
  );
}
