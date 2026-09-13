"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleMethod, updateMethodParams, updatePolicy } from "@/app/(app)/forecast/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type M = { key: string; name: string; family: string; patterns: string[]; abc_scope: string[]; level: string; min_history: number; enabled: boolean; is_baseline: boolean; params: unknown; description: string | null };
type P = { cell: string; methods: string[]; note: string | null };
export function MethodTable({ methods, policy }: { methods: M[]; policy: P[] }) {
  const [params, setParams] = useState<Record<string, string>>(Object.fromEntries(methods.map(m => [m.key, JSON.stringify(m.params)])));
  const [pol, setPol] = useState<Record<string, Set<string>>>(Object.fromEntries(policy.map(p => [p.cell, new Set(p.methods)])));
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => start(async () => { const r = await fn(); if (r.ok) toast.success(ok); else toast.error(r.error ?? "실패"); });
  return (
    <div className="space-y-6">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="py-2">사용</th><th>키</th><th>이름</th><th>계열</th><th>적용 패턴</th><th>ABC</th><th>레벨</th><th className="text-right">최소 이력</th><th>params (JSON)</th><th></th></tr></thead>
        <tbody>{methods.map(m => (
          <tr key={m.key} className="border-t">
            <td className="py-1"><input type="checkbox" aria-label={`${m.key} 사용`} checked={m.enabled} disabled={m.is_baseline || pending} onChange={e => run(() => toggleMethod(m.key, e.target.checked), `${m.name} ${e.target.checked ? "on" : "off"}`)} /></td>
            <td className="font-mono">{m.key}{m.is_baseline && <Badge variant="secondary" className="ml-1 text-[10px]">기준선</Badge>}</td><td>{m.name}</td><td>{m.family}</td>
            <td className="text-xs">{m.patterns.join(",")}</td><td className="text-xs">{m.abc_scope.join("")}</td><td className="text-xs">{m.level}</td><td className="text-right tabular-nums">{m.min_history}</td>
            <td><Input value={params[m.key]} onChange={e => setParams({ ...params, [m.key]: e.target.value })} className="h-7 font-mono text-xs" aria-label={`${m.key} params`} /></td>
            <td><Button size="sm" variant="outline" disabled={pending || params[m.key] === JSON.stringify(m.params)} onClick={() => run(() => updateMethodParams(m.key, params[m.key]), "params 저장")}>저장</Button></td>
          </tr>))}</tbody>
      </table>
      <section>
        <h2 className="mb-2 text-sm font-medium">ABC-XYZ 셀별 후보 기법 (R-FC-35)</h2>
        <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-1">셀</th>{methods.filter(m => m.level !== "model").map(m => <th key={m.key} className="text-center font-mono text-xs">{m.key}</th>)}<th></th></tr></thead>
          <tbody>{policy.map(p => (
            <tr key={p.cell} className="border-t"><td className="py-1 font-medium">{p.cell}</td>
              {methods.filter(m => m.level !== "model").map(m => <td key={m.key} className="text-center"><input type="checkbox" aria-label={`${p.cell} ${m.key}`} checked={pol[p.cell]?.has(m.key) ?? false} disabled={m.is_baseline} onChange={e => { const s = new Set(pol[p.cell]); if (e.target.checked) s.add(m.key); else s.delete(m.key); setPol({ ...pol, [p.cell]: s }); }} /></td>)}
              <td><Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updatePolicy(p.cell, [...(pol[p.cell] ?? [])]), `${p.cell} 저장`)}>저장</Button></td></tr>))}</tbody></table>
      </section>
    </div>
  );
}
