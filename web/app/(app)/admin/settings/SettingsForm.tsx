"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSystemSetting } from "../actions";
import { SETTINGS, SETTING_ORDER, DEPTS, encodeSetting, describeSetting, type Flex } from "@/lib/settings/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDateTime } from "@/lib/format";
type Row = { key: string; value: unknown; description: string | null; updated_at: string | null };
/** 비개발자용 설정 화면 (R-UI-10): 키별 컨트롤, JSON 미노출 */
export function SettingsForm({ rows }: { rows: Row[] }) {
  const byKey = Object.fromEntries(rows.map(r => [r.key, r]));
  const ordered = [...SETTING_ORDER.filter(k => byKey[k]), ...rows.map(r => r.key).filter(k => !SETTING_ORDER.includes(k))];
  const [draft, setDraft] = useState<Record<string, unknown>>(() => Object.fromEntries(rows.map(r => [r.key, initial(r.key, r.value)])));
  const [pending, start] = useTransition();
  const save = (key: string) => { const enc = encodeSetting(key, draft[key]); if (!enc.ok) { toast.error(enc.error); return; }
    start(async () => { const r = await updateSystemSetting(key, enc.json); if (r.ok) toast.success(`${SETTINGS[key]?.label ?? key} 저장됨`); else toast.error(r.error); }); };
  const dirty = (key: string) => { const enc = encodeSetting(key, draft[key]); return enc.ok && enc.json !== JSON.stringify(byKey[key].value); };
  return (
    <div className="space-y-3">
      {ordered.map(key => { const r = byKey[key]; const spec = SETTINGS[key]; const v = draft[key]; return (
        <div key={key} className="grid grid-cols-1 gap-2 rounded-md border p-3 lg:grid-cols-[16rem_1fr_auto]" data-testid={`setting-${key}`}>
          <div><div className="text-sm font-medium">{spec?.label ?? key}</div><div className="text-xs text-muted-foreground">{spec?.help ?? r.description}</div><div className="mt-1 text-xs text-muted-foreground">현재: <b>{describeSetting(key, r.value)}</b> · {fmtDateTime(r.updated_at)}</div></div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {!spec || spec.kind === "text" ? <Input value={String(v ?? "")} onChange={e => setDraft({ ...draft, [key]: e.target.value })} className="h-9 w-72" aria-label={spec?.label ?? key} /> : null}
            {spec?.kind === "int" && <><Input type="number" min={spec.min} max={spec.max} value={String(v ?? "")} onChange={e => setDraft({ ...draft, [key]: e.target.value })} className="h-9 w-28" aria-label={spec.label} /><span className="text-muted-foreground">{spec.unit} <span className="text-xs">({spec.min}~{spec.max})</span></span></>}
            {spec?.kind === "select" && <select className="h-9 rounded-md border bg-background px-2" value={String(v)} onChange={e => setDraft({ ...draft, [key]: e.target.value })} aria-label={spec.label}>{spec.options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}</select>}
            {spec?.kind === "days-list" && <><Input value={String(v ?? "")} onChange={e => setDraft({ ...draft, [key]: e.target.value })} className="h-9 w-56" aria-label={spec.label} placeholder="10, 5, 3, 2, 1" /><span className="text-muted-foreground">일 전 (쉼표로 구분)</span></>}
            {spec?.kind === "dept-multi" && DEPTS.map(d => <label key={d.value} className="inline-flex items-center gap-1"><input type="checkbox" checked={(v as string[]).includes(d.value)} onChange={e => setDraft({ ...draft, [key]: e.target.checked ? [...(v as string[]), d.value] : (v as string[]).filter(x => x !== d.value) })} />{d.label}</label>)}
            {spec?.kind === "flex-table" && <FlexEditor rows={v as Flex[]} onChange={rows => setDraft({ ...draft, [key]: rows })} />}
          </div>
          <div className="flex items-start"><Button size="sm" disabled={pending || !dirty(key)} onClick={() => save(key)}>저장</Button></div>
        </div>); })}
    </div>
  );
}
function initial(key: string, value: unknown): unknown {
  const spec = SETTINGS[key]; if (!spec) return typeof value === "string" ? value : JSON.stringify(value);
  if (spec.kind === "days-list") return (value as number[]).join(", ");
  if (spec.kind === "flex-table") return [...(value as Flex[])];
  if (spec.kind === "dept-multi") return [...(value as string[])];
  return value;
}
function FlexEditor({ rows, onChange }: { rows: Flex[]; onChange: (r: Flex[]) => void }) {
  const set = (i: number, patch: Partial<Flex>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <table className="text-sm"><thead><tr className="text-muted-foreground"><th className="text-left">리드타임 이후 몇 번째 달</th><th className="text-left">허용 폭 (±%)</th><th></th></tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}><td><Input type="number" min={1} value={r.offset} onChange={e => set(i, { offset: Number(e.target.value) })} className="h-8 w-20" aria-label={`Flex ${i + 1} 순서`} /></td><td><Input type="number" min={0} max={100} value={r.pct} onChange={e => set(i, { pct: Number(e.target.value) })} className="h-8 w-20" aria-label={`Flex ${i + 1} 허용폭`} /></td><td><Button size="sm" variant="ghost" onClick={() => onChange(rows.filter((_, j) => j !== i))}>삭제</Button></td></tr>)}
        <tr><td colSpan={3}><Button size="sm" variant="outline" onClick={() => onChange([...rows, { offset: (rows.at(-1)?.offset ?? 0) + 1, pct: 30 }])}>달 추가</Button> <span className="text-xs text-muted-foreground">표에 없는 이후 달은 제한 없음</span></td></tr></tbody></table>
  );
}
