"use client";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtInt, fmtYm } from "@/lib/format";
export type TreeRow = { id: string; label: string; level: number; values: Record<string, number | null>; editable?: boolean; children?: TreeRow[]; className?: string };
type Props = { months: string[]; rows: TreeRow[]; pastUntil: string; onCellEdit?: (rowId: string, ym: string, value: number | null) => void; firstColLabel?: string };
function flatten(rows: TreeRow[], expanded: Set<string>, out: TreeRow[] = []): TreeRow[] {
  for (const r of rows) { out.push(r); if (r.children?.length && expanded.has(r.id)) flatten(r.children, expanded, out); }
  return out;
}
function allIds(rows: TreeRow[], acc: string[] = []): string[] { for (const r of rows) { acc.push(r.id); if (r.children) allIds(r.children, acc); } return acc; }
/** WBS형 재고전개 그리드 (R-UI-04): 트리 접기/펼치기, 과거/미래 열 구분, 셀 편집 */
export function TreeGrid({ months, rows, pastUntil, onCellEdit, firstColLabel = "항목" }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(allIds(rows)));
  const [editing, setEditing] = useState<{ id: string; ym: string } | null>(null);
  const flat = useMemo(() => flatten(rows, expanded), [rows, expanded]);
  const toggle = (id: string) => setExpanded(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div className="overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-background">
          <tr>
            <th className="sticky left-0 z-20 min-w-48 bg-background px-3 py-2 text-left font-medium text-muted-foreground">{firstColLabel}</th>
            {months.map(m => <th key={m} className={cn("whitespace-nowrap px-2 py-2 text-right font-medium", m <= pastUntil ? "bg-muted/40 text-muted-foreground" : "bg-blue-50/60 text-blue-700")}>{fmtYm(m)}</th>)}
          </tr>
        </thead>
        <tbody>
          {flat.map(r => (
            <tr key={r.id} className={cn("border-t", r.level === 0 && "bg-muted/20 font-medium", r.className)}>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-3 py-1.5" style={{ paddingLeft: 12 + r.level * 16 }}>
                {r.children?.length ? (
                  <button type="button" aria-label={r.label} onClick={() => toggle(r.id)} className="inline-flex items-center gap-1">
                    {expanded.has(r.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{r.label}
                  </button>
                ) : <span>{r.label}</span>}
              </td>
              {months.map(m => {
                const v = r.values[m]; const isEditing = editing?.id === r.id && editing.ym === m;
                return (
                  <td key={m} className={cn("whitespace-nowrap px-2 py-1 text-right tabular-nums", m <= pastUntil ? "bg-muted/20" : "bg-blue-50/30", r.editable && m > pastUntil && "cursor-text hover:bg-blue-100/60")}
                    onClick={() => r.editable && m > pastUntil && onCellEdit && setEditing({ id: r.id, ym: m })}>
                    {isEditing ? (
                      <input type="number" autoFocus defaultValue={v ?? ""} className="w-20 rounded border px-1 text-right"
                        onBlur={e => { onCellEdit?.(r.id, m, e.target.value === "" ? null : Number(e.target.value)); setEditing(null); }}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(null); }} />
                    ) : fmtInt(v)}
                  </td>);
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
