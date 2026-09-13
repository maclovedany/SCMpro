"use client";
import { UPLOAD_TARGETS, type TargetKey } from "@/lib/upload/templates";
type Props = { target: TargetKey; headers: string[]; mapping: Record<string, string | undefined>; onChange: (m: Record<string, string | undefined>) => void; preview: Record<string, string>[] };
export function ColumnMapper({ target, headers, mapping, onChange, preview }: Props) {
  const cols = UPLOAD_TARGETS[target].columns;
  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="py-1">대상 컬럼</th><th>타입</th><th>파일 컬럼</th></tr></thead>
        <tbody>{cols.map(c => (
          <tr key={c.key} className="border-t">
            <td className="py-1">{c.label}{c.required && <span className="text-red-600"> *</span>} <span className="font-mono text-xs text-muted-foreground">{c.key}</span></td>
            <td className="text-xs text-muted-foreground">{c.type}{c.enum ? ` (${c.enum.join("/")})` : ""}</td>
            <td><select name={`map-${c.key}`} aria-label={`${c.label} 매핑`} className="h-8 rounded border bg-background px-2" value={mapping[c.key] ?? ""} onChange={e => onChange({ ...mapping, [c.key]: e.target.value || undefined })}>
              <option value="">(없음)</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></td>
          </tr>))}</tbody>
      </table>
      <div className="overflow-auto rounded-md border">
        <table className="w-full text-xs"><thead><tr>{headers.map(h => <th key={h} className="whitespace-nowrap bg-muted/40 px-2 py-1 text-left">{h}</th>)}</tr></thead>
          <tbody>{preview.slice(0, 20).map((r, i) => <tr key={i} className="border-t">{headers.map(h => <td key={h} className="whitespace-nowrap px-2 py-0.5">{r[h]}</td>)}</tr>)}</tbody></table>
      </div>
    </div>
  );
}
