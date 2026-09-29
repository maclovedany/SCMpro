"use client";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportMenu } from "@/components/export/ExportMenu";
import { exportRows, type Cell, type ExportFormat } from "@/lib/export/sheet";
import { fmtInt, fmtPct, fmtYm } from "@/lib/format";
import { cn } from "@/lib/utils";
import { mcSummary, mcLineage, type McCell, type McLine } from "@/lib/queries/mcPlan";
export type McSort = "default" | "iot" | "product" | "sales" | "scm" | "act" | "ratio";
const SUB = ["Sales OL", "SCM OL", "실적", "실적/Sales OL"] as const;
const val = (l: McLine, s: McSort): number | string | null => s === "iot" ? l.iot : s === "product" ? l.product : s === "sales" ? l.total.sales_ol : s === "scm" ? l.total.scm_ol : s === "act" ? l.total.act : s === "ratio" ? l.total.ratio : null;
// 왼쪽 세 열은 넓은 화면에서 고정 (가로 스크롤 시에도 어떤 Family 인지 보이게)
const C1 = "md:sticky md:left-0 md:z-10 w-[6.5rem] min-w-[6.5rem]", C2 = "md:sticky md:left-[6.5rem] md:z-10 w-[3.5rem] min-w-[3.5rem]", C3 = "md:sticky md:left-[10rem] md:z-10 w-[17rem] min-w-[17rem] md:shadow-[1px_0_0_var(--border)]";
/** 전임 · 후속 표시: 묶은 줄은 "전임 → 후속", 아니면 전임기·후속기 이름 */
const lineageNote = (l: McLine) => l.members.length > 1 ? l.members.join(" → ") : [l.predecessor && `전임 ${l.predecessor}`, l.successor && `후속 ${l.successor}`].filter(Boolean).join(" · ");
/** 기종(MC) OL · 실적 표 (R-FC-15 · R-FC-16): 월마다 Sales OL · SCM OL · 실적 · 실적/Sales OL, 끝에 기간 합계.
 *  맨 위에 합계와 소계(DT/GC — DT · GC, PRINTER). 전임 · 후속 묶기, 검색·정렬·내보내기 (R-UI-05/08) */
export function McPlanTable({ months, lines, exportName, initialSort = "default", activeOnly = false, initialQuery = "" }: { months: string[]; lines: McLine[]; exportName: string; initialSort?: McSort; activeOnly?: boolean; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery); const [sort, setSort] = useState<McSort>(initialSort); const [desc, setDesc] = useState(initialSort !== "default"); const [joined, setJoined] = useState(false);
  const hasLineage = useMemo(() => lines.some(l => l.predecessor && lines.some(x => x.key === l.predecessor)), [lines]);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    const base = joined ? mcLineage(lines) : lines;
    const f = base.filter(l => (!activeOnly || (l.total.act ?? 0) > 0) && (!k || [l.product, l.iot, l.codename, l.model_base, l.biz, l.predecessor, l.successor, ...l.members].some(v => (v ?? "").toLowerCase().includes(k))));
    if (sort === "default") return f;
    return [...f].sort((a, b) => { const x = val(a, sort), y = val(b, sort); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y)); return desc ? -c : c; });
  }, [lines, q, sort, desc, activeOnly, joined]);
  const summary = useMemo(() => mcSummary(months, shown), [months, shown]);
  const tops = [{ key: "total", label: "합계", sub: false, ...summary.total }, ...summary.groups];
  const by = (s: McSort) => () => { if (sort === s) { if (desc) setDesc(false); else { setSort("default"); setDesc(true); } } else { setSort(s); setDesc(s !== "iot" && s !== "product"); } };
  const arrow = (s: McSort) => sort !== s ? null : desc ? <ArrowDown className="ml-0.5 inline h-3 w-3" /> : <ArrowUp className="ml-0.5 inline h-3 w-3" />;
  const onExport = (format: ExportFormat) => {
    const headers = ["Item Code", "구분", "Family", "전임 · 후속", ...months.flatMap(m => SUB.map(s => `${fmtYm(m)} ${s}`)), ...SUB.map(s => `합계 ${s}`)];
    const cell = (c: McCell): Cell[] => [c.sales_ol ?? "", c.scm_ol ?? "", c.act ?? "", c.ratio == null ? "" : Math.round(c.ratio * 1000) / 1000];
    exportRows(exportName, headers, [...tops.map(t => [t.label, "", `Family ${t.n}개`, "", ...t.cells.flatMap(cell), ...cell(t.total)]), ...shown.map(l => [l.iot ?? "", l.biz ?? "", l.product, lineageNote(l), ...l.cells.flatMap(cell), ...cell(l.total)])], format);
  };
  const nums = (c: McCell, strong = false) => <>
    <td className={cn("border-l text-right tabular-nums", strong && "font-medium")}>{fmtInt(c.sales_ol)}</td><td className={cn("text-right tabular-nums", strong && "font-medium")}>{fmtInt(c.scm_ol)}</td>
    <td className={cn("text-right tabular-nums", strong ? "font-semibold" : "font-medium")}>{fmtInt(c.act)}</td><td className="text-right tabular-nums text-muted-foreground">{fmtPct(c.ratio)}</td></>;
  const th = "whitespace-nowrap py-1.5 text-xs font-medium text-muted-foreground";
  return (
    <section id="mc-table" className="scroll-mt-16 space-y-2" data-testid="mc-table">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Family 별 월 실적 — {fmtInt(shown.length)}개{activeOnly ? " (실적 있는 Family 만)" : ""}</h2>
        {hasLineage && <Button size="sm" variant={joined ? "default" : "outline"} className="h-8" onClick={() => setJoined(!joined)} aria-pressed={joined} data-testid="mc-lineage-toggle">전임 · 후속 묶기</Button>}
        <Input name="mc-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Family · Item Code · 구분 검색" className="ml-auto h-8 w-60" />
        <ExportMenu onExport={onExport} disabled={shown.length === 0} />
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-md border">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20 bg-background">
            <tr>
              <th rowSpan={2} className={cn(th, C1, "border-b bg-background text-left")}><button type="button" onClick={by("iot")}>Item Code{arrow("iot")}</button></th>
              <th rowSpan={2} className={cn(th, C2, "border-b bg-background text-left")}>구분</th>
              <th rowSpan={2} className={cn(th, C3, "border-b bg-background text-left")}><button type="button" onClick={by("product")}>Family{arrow("product")}</button></th>
              {months.map(m => <th key={m} colSpan={4} className={cn(th, "border-l text-center")}>{fmtYm(m)}</th>)}
              <th colSpan={4} className={cn(th, "border-l bg-muted/50 text-center text-foreground")}>합계</th>
            </tr>
            <tr>
              {months.map(m => SUB.map((s, i) => <th key={m + s} className={cn(th, "border-b text-right", i === 0 && "border-l")}>{s}</th>))}
              {(["sales", "scm", "act", "ratio"] as McSort[]).map((s, i) => <th key={s} className={cn(th, "border-b bg-muted/50 text-right", i === 0 && "border-l")}><button type="button" onClick={by(s)}>{SUB[i]}{arrow(s)}</button></th>)}
            </tr>
          </thead>
          <tbody>
            {tops.map(t => <tr key={t.key} className="bg-muted/40" data-testid={t.key === "total" ? "mc-total-row" : t.sub ? "mc-biz-row" : "mc-subtotal-row"}>
              <td colSpan={2} className={cn("md:sticky md:left-0 md:z-10 whitespace-nowrap border-b bg-muted", t.key === "total" ? "font-semibold" : t.sub ? "pl-8 text-muted-foreground" : "pl-4 font-medium")}>{t.label}</td><td className={cn(C3, "border-b bg-muted text-muted-foreground")}>Family {fmtInt(t.n)}개</td>
              {t.cells.map((c, i) => <Fragment key={i}>{nums(c, !t.sub)}</Fragment>)}{nums(t.total, !t.sub)}
            </tr>)}
            {shown.map(l => { const note = lineageNote(l); return <tr key={l.key} className="group hover:bg-muted/30" data-testid="mc-row">
              <td className={cn(C1, "border-b bg-background font-mono text-xs group-hover:bg-muted")}>{l.iot ?? "-"}</td>
              <td className={cn(C2, "border-b bg-background text-xs text-muted-foreground group-hover:bg-muted")}>{l.biz ?? "-"}</td>
              <td className={cn(C3, "border-b bg-background group-hover:bg-muted")}><div className="flex items-center gap-1"><div className="min-w-0 flex-1 truncate" title={note ? `${l.product} (${note})` : l.product}>{l.model_base ? <Link href={`/forecast/mc?model=${encodeURIComponent(l.model_base)}`} className="hover:underline">{l.product}</Link> : l.product}
                  {note && <span className="ml-1.5 text-xs text-muted-foreground" data-testid="mc-lineage">{note}</span>}</div>
                {l.model_base && <Link href={`/items?model=${encodeURIComponent(l.model_base)}`} className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label="연결 품목" title="이 기종에 연결된 SPAREPARTS · CONSUMABLE · OPTION"><Package className="h-3.5 w-3.5" /></Link>}</div></td>
              {l.cells.map((c, i) => <Fragment key={i}>{nums(c)}</Fragment>)}{nums(l.total)}
            </tr>; })}
            {shown.length === 0 && <tr><td colSpan={3 + (months.length + 1) * 4} className="p-6 text-center text-muted-foreground">조건에 맞는 Family 가 없습니다</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">합계와 소계는 표에 보이는 행만 더한 값입니다. 실적/Sales OL 은 Sales OL 이 0 이면 표시하지 않습니다. 「전임 · 후속 묶기」를 켜면 전임기와 후속기를 한 줄로 더해 기종이 바뀐 해에도 이어서 볼 수 있습니다. Family 를 누르면 그 기종의 예측 비교로, 상자 아이콘을 누르면 연결된 품목 목록으로 이동합니다.</p>
    </section>
  );
}
