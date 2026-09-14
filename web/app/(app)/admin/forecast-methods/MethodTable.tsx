"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleMethod, updateMethodParams, updatePolicy } from "@/app/(app)/forecast/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PARAM_SPECS, METHOD_INFO, FAMILY_LABEL, LEVEL_LABEL, PATTERN_SHORT, describeMethodParams, type ParamSpec } from "@/lib/forecast/methodRegistry";
import { cn } from "@/lib/utils";
type M = { key: string; name: string; family: string; patterns: string[]; abc_scope: string[]; level: string; min_history: number; enabled: boolean; is_baseline: boolean; params: unknown; description: string | null };
type P = { cell: string; methods: string[]; note: string | null };
const CELL_LABEL: Record<string, string> = { A: "A 등급(금액 상위)", B: "B 등급", C: "C 등급", X: "안정", Y: "변동", Z: "불규칙" };
function ParamControl({ mk, pk, spec, value, onChange }: { mk: string; pk: string; spec: ParamSpec; value: unknown; onChange: (v: unknown) => void }) {
  const id = `${mk}-${pk}`; const aria = `${mk} ${spec.label}`;
  return (
    <label htmlFor={id} className="grid gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{spec.label}{"unit" in spec && spec.unit ? ` (${spec.unit})` : ""}</span>
      {spec.kind === "int" || spec.kind === "number" ? <Input id={id} aria-label={aria} type="number" min={spec.min} max={spec.max} step={spec.step ?? (spec.kind === "int" ? 1 : 0.01)} value={String(value ?? "")} onChange={e => onChange(e.target.value)} className="h-8 w-32" />
        : spec.kind === "bool" ? <span className="inline-flex items-center gap-2"><input id={id} aria-label={aria} type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} /><span>{value ? (spec.onLabel ?? "켬") : (spec.offLabel ?? "끔")}</span></span>
        : <select id={id} aria-label={aria} className="h-8 rounded-md border bg-background px-2" value={String(value ?? "")} onChange={e => onChange(e.target.value)}>{spec.options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}</select>}
      <span className="text-[11px] text-muted-foreground">{spec.help}</span>
    </label>
  );
}
/** 기법 카드 (D-053, R-UI-10): JSON 없이 라벨·단위·도움말이 있는 컨트롤로 파라미터 조정 */
export function MethodTable({ methods, policy }: { methods: M[]; policy: P[] }) {
  const [draft, setDraft] = useState<Record<string, Record<string, unknown>>>(Object.fromEntries(methods.map(m => [m.key, { ...((m.params ?? {}) as Record<string, unknown>) }])));
  const [pol, setPol] = useState<Record<string, Set<string>>>(Object.fromEntries(policy.map(p => [p.cell, new Set(p.methods)])));
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => start(async () => { const r = await fn(); if (r.ok) toast.success(ok); else toast.error(r.error ?? "실패"); });
  const changed = (m: M) => JSON.stringify(draft[m.key]) !== JSON.stringify(m.params ?? {});
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="method-cards">
        {methods.map(m => { const specs = PARAM_SPECS[m.key] ?? {}; const info = METHOD_INFO[m.key]; const cur = (m.params ?? {}) as Record<string, unknown>; const advanced = Object.keys(cur).filter(k => !(k in specs)); return (
          <div key={m.key} className={cn("scm-card rounded-xl p-4", !m.enabled && "opacity-70")} style={{ "--acc": m.enabled ? "#1baf7a" : "#6b7280", "--acc-soft": m.enabled ? "#e6f6ef" : "#f1f2f4" } as React.CSSProperties} data-testid={`method-${m.key}`}>
            <div className="flex items-start gap-3">
              <label className="mt-1 inline-flex items-center gap-2 text-sm"><input type="checkbox" aria-label={`${m.key} 사용`} checked={m.enabled} disabled={m.is_baseline || pending} onChange={e => run(() => toggleMethod(m.key, e.target.checked), `${m.name} ${e.target.checked ? "on" : "off"}`)} /><span className="sr-only">사용</span></label>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{m.name}</span>{m.is_baseline && <Badge variant="secondary">기준선 · 항상 사용</Badge>}{!m.enabled && !m.is_baseline && <Badge variant="outline">사용 안 함</Badge>}</div>
                {info && <p className="mt-0.5 text-sm text-muted-foreground">{info.plain}</p>}
                {info && <p className="text-xs text-muted-foreground">언제: {info.when}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <Badge variant="outline">{FAMILY_LABEL[m.family] ?? m.family}</Badge>
                  <Badge variant="outline">{LEVEL_LABEL[m.level] ?? m.level} 레벨</Badge>
                  <Badge variant="outline">{m.abc_scope.join("·")} 등급</Badge>
                  <Badge variant="outline">{m.patterns.map(p => PATTERN_SHORT[p] ?? p).join("·")} 패턴</Badge>
                  <Badge variant="outline">이력 {m.min_history}개월 이상</Badge>
                </div>
              </div>
            </div>
            <div className="mt-3 border-t pt-3">
              <div className="mb-2 text-xs text-muted-foreground">현재 설정: <span className="text-foreground">{describeMethodParams(m.key, cur)}</span></div>
              {Object.keys(specs).length > 0 ? (
                <div className="flex flex-wrap items-end gap-4">
                  {Object.entries(specs).map(([pk, sp]) => <ParamControl key={pk} mk={m.key} pk={pk} spec={sp} value={draft[m.key]?.[pk]} onChange={v => setDraft({ ...draft, [m.key]: { ...draft[m.key], [pk]: v } })} />)}
                  <Button size="sm" variant={changed(m) ? "default" : "outline"} disabled={pending || !changed(m)} onClick={() => run(() => updateMethodParams(m.key, draft[m.key]), `${m.name} 설정 저장 — 다음 런부터 적용`)}>저장</Button>
                </div>) : <p className="text-sm text-muted-foreground">조정할 설정이 없습니다 — 데이터에서 자동으로 추정합니다.</p>}
              {advanced.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">고급 설정(개발자 관리, 화면에서 변경 불가): {advanced.join(", ")}</p>}
            </div>
          </div>); })}
      </div>
      <section className="scm-card rounded-xl p-4" style={{ "--acc": "#4a3aa7", "--acc-soft": "#ecebf7" } as React.CSSProperties}>
        <h2 className="text-sm font-semibold">등급·패턴별 후보 기법 (R-FC-35)</h2>
        <p className="mb-2 text-xs text-muted-foreground">품목을 금액 등급(A/B/C) × 수요 안정성(X/Y/Z)으로 나눈 9칸마다 어떤 기법을 시도할지. 백테스트는 체크된 기법 중 가장 정확한 것을 고릅니다. 기준선은 항상 포함.</p>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1">칸</th>{methods.filter(m => m.level !== "model").map(m => <th key={m.key} className="px-1 text-center text-[11px] font-normal">{m.name}</th>)}<th></th></tr></thead>
          <tbody>{policy.map(p => (
            <tr key={p.cell} className="border-t"><td className="whitespace-nowrap py-1"><span className="font-medium">{p.cell}</span> <span className="text-xs text-muted-foreground">{CELL_LABEL[p.cell[0]]}·{CELL_LABEL[p.cell[1]]}</span></td>
              {methods.filter(m => m.level !== "model").map(m => <td key={m.key} className="text-center"><input type="checkbox" aria-label={`${p.cell} ${m.key}`} checked={pol[p.cell]?.has(m.key) ?? false} disabled={m.is_baseline} onChange={e => { const s = new Set(pol[p.cell]); if (e.target.checked) s.add(m.key); else s.delete(m.key); setPol({ ...pol, [p.cell]: s }); }} /></td>)}
              <td><Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updatePolicy(p.cell, [...(pol[p.cell] ?? [])]), `${p.cell} 저장`)}>저장</Button></td></tr>))}</tbody></table></div>
      </section>
    </div>
  );
}
