"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSystemSetting } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDateTime } from "@/lib/format";
type Row = { key: string; value: string; description: string | null; updated_at: string | null };
export function SettingsForm({ rows }: { rows: Row[] }) {
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(rows.map(r => [r.key, r.value])));
  const [pending, start] = useTransition();
  const save = (key: string) => start(async () => {
    const r = await updateSystemSetting(key, vals[key]);
    if (r.ok) toast.success(`${key} 저장됨`); else toast.error(r.error);
  });
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground"><th className="py-2">키</th><th>값 (JSON)</th><th>설명</th><th>수정</th><th></th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.key} className="border-t">
            <td className="py-2 font-mono">{r.key}</td>
            <td><Input value={vals[r.key]} onChange={e => setVals({ ...vals, [r.key]: e.target.value })} className="h-8 font-mono" aria-label={r.key} /></td>
            <td className="text-muted-foreground">{r.description}</td>
            <td className="text-xs text-muted-foreground">{fmtDateTime(r.updated_at)}</td>
            <td><Button size="sm" disabled={pending || vals[r.key] === r.value} onClick={() => save(r.key)}>저장</Button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
