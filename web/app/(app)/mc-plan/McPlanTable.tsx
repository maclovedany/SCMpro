"use client";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ExportMenu } from "@/components/export/ExportMenu";
import { exportRows, type Cell, type ExportFormat } from "@/lib/export/sheet";
import { fmtInt, fmtPct, fmtYm } from "@/lib/format";
import { cn } from "@/lib/utils";
import { mcSummary, type McCell, type McLine } from "@/lib/queries/mcPlan";
export type McSort = "default" | "iot" | "product" | "sales" | "scm" | "act" | "ratio";
const SUB = ["Sales OL", "SCM OL", "실적", "실적/Sales OL"] as const;
const val = (l: McLine, s: McSort): number | string | null => s === "iot" ? l.iot : s === "product" ? l.product : s === "sales" ? l.total.sales_ol : s === "scm" ? l.total.scm_ol : s === "act" ? l.total.act : s === "ratio" ? l.total.ratio : null;
// 왼쪽 세 열은 넓은 화면에서 고정 (가로 스크롤 시에도 어떤 Product 인지 보이게)
const C1 = "md:sticky md:left-0 md:z-10 w-[6.5rem] min-w-[6.5rem]", C2 = "md:sticky md:left-[6.5rem] md:z-10 w-[3.5rem] min-w-[3.5rem]", C3 = "md:sticky md:left-[10rem] md:z-10 w-[17rem] min-w-[17rem] md:shadow-[1px_0_0_var(--border)]";
/** 기종 OL · 실적 표 (R-FC-15): 월마다 Sales OL · SCM OL · 실적 · 실적/Sales OL, 끝에 기간 합계. 맨 위에 합계와 소계(DT/GC · PRINTER, 원본 파일과 같은 묶음). 검색·정렬·내보내기 (R-UI-05/08) */
export function McPlanTable({ months, lines, exportName, initialSort = "default", activeOnly = false }: { months: string[]; lines: McLine[]; exportName: string; initialSort?: McSort; activeOnly?: boolean }) {
  const [q, setQ] = useState(""); const [sort, setSort] = useState<McSort>(initialSort); const [desc, setDesc] = useState(initialSort !== "default");
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    const f = lines.filter(l => (!activeOnly || (l.total.act ?? 0) > 0) && (!k || [l.product, l.iot, l.codename, l.model_base, l.biz].some(v => (v ?? "").toLowerCase().includes(k))));
    if (sort === "default") return f;
    return [...f].sort((a, b) => { const x = val(a, sort), y = val(b, sort); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y)); return desc ? -c : c; });
  }, [lines, q, sort, desc, activeOnly]);
  const summary = useMemo(() => mcSummary(months, shown), [months, shown]);
  const tops = [{ key: "total", label: "합계", ...summary.total }, ...summary.groups];
  const by = (s: McSort) => () => { if (sort === s) { if (desc) setDesc(false); else { setSort("default"); setDesc(true); } } else { setSort(s); setDesc(s !== "iot" && s !== "product"); } };
  const arrow = (s: McSort) => sort !== s ? null : desc ? <ArrowDown className="ml-0.5 inline h-3 w-3" /> : <ArrowUp className="ml-0.5 inline h-3 w-3" />;
  const onExport = (format: ExportFormat) => {
    const headers = ["IOT", "구분", "Product", ...months.flatMap(m => SUB.map(s => `${fmtYm(m)} ${s}`)), ...SUB.map(s => `합계 ${s}`)];
    const cell = (c: McCell): Cell[] => [c.sales_ol ?? "", c.scm_ol ?? "", c.act ?? "", c.ratio == null ? "" : Math.round(c.ratio * 1000) / 1000];
    exportRows(exportName, headers, [...tops.map(t => [t.label, "", `Product ${t.n}개`, ...t.cells.flatMap(cell), ...cell(t.total)]), ...shown.map(l => [l.iot ?? "", l.biz ?? "", l.product, ...l.cells.flatMap(cell), ...cell(l.total)])], format);
  };
  const nums = (c: McCell, strong = false) => <>
    <td className={cn("border-l text-right tabular-nums", strong && "font-medium")}>{fmtInt(c.sales_ol)}</td><td className={cn("text-right tabular-nums", strong && "font-medium")}>{fmtInt(c.scm_ol)}</td>
    <td className={cn("text-right tabular-nums", strong ? "font-semibold" : "font-medium")}>{fmtInt(c.act)}</td><td className="text-right tabular-nums text-muted-foreground">{fmtPct(c.ratio)}</td></>;
  const th = "whitespace-nowrap py-1.5 text-xs font-medium text-muted-foreground";
  return (
    <section id="mc-table" className="scroll-mt-16 space-y-2" data-testid="mc-table">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Product 별 월 실적 — {fmtInt(shown.length)}개{activeOnly ? " (실적 있는 Product 만)" : ""}</h2>
        <Input name="mc-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Product · IOT 검색" className="ml-auto h-8 w-56" />
        <ExportMenu onExport={onExport} disabled={shown.length === 0} />
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-md border">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20 bg-background">
            <tr>
              <th rowSpan={2} className={cn(th, C1, "border-b bg-background text-left")}><button type="button" onClick={by("iot")}>IOT{arrow("iot")}</button></th>
              <th rowSpan={2} className={cn(th, C2, "border-b bg-background text-left")}>구분</th>
              <th rowSpan={2} className={cn(th, C3, "border-b bg-background text-left")}><button type="button" onClick={by("product")}>Product{arrow("product")}</button></th>
              {months.map(m => <th key={m} colSpan={4} className={cn(th, "border-l text-center")}>{fmtYm(m)}</th>)}
              <th colSpan={4} className={cn(th, "border-l bg-muted/50 text-center text-foreground")}>합계</th>
            </tr>
            <tr>
              {months.map(m => SUB.map((s, i) => <th key={m + s} className={cn(th, "border-b text-right", i === 0 && "border-l")}>{s}</th>))}
              {(["sales", "scm", "act", "ratio"] as McSort[]).map((s, i) => <th key={s} className={cn(th, "border-b bg-muted/50 text-right", i === 0 && "border-l")}><button type="button" onClick={by(s)}>{SUB[i]}{arrow(s)}</button></th>)}
            </tr>
          </thead>
          <tbody>
            {tops.map(t => <tr key={t.key} className="bg-muted/40" data-testid={t.key === "total" ? "mc-total-row" : "mc-subtotal-row"}>
              <td colSpan={2} className={cn("md:sticky md:left-0 md:z-10 whitespace-nowrap border-b bg-muted", t.key === "total" ? "font-semibold" : "pl-4 font-medium")}>{t.label}</td><td className={cn(C3, "border-b bg-muted text-muted-foreground")}>Product {fmtInt(t.n)}개</td>
              {t.cells.map((c, i) => <Fragment key={i}>{nums(c, true)}</Fragment>)}{nums(t.total, true)}
            </tr>)}
            {shown.map(l => <tr key={l.key} className="group hover:bg-muted/30" data-testid="mc-row">
              <td className={cn(C1, "border-b bg-background font-mono text-xs group-hover:bg-muted")}>{l.iot ?? "-"}</td>
              <td className={cn(C2, "border-b bg-background text-xs text-muted-foreground group-hover:bg-muted")}>{l.biz ?? "-"}</td>
              <td className={cn(C3, "border-b bg-background group-hover:bg-muted")}><div className="flex items-center gap-1"><div className="min-w-0 flex-1 truncate" title={l.product}>{l.model_base ? <Link href={`/forecast/mc?model=${encodeURIComponent(l.model_base)}`} className="hover:underline">{l.product}</Link> : l.product}</div>
                {l.model_base && <Link href={`/items?model=${encodeURIComponent(l.model_base)}`} className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label="연결 품목" title={`${l.codename ?? l.model_base} 에 연결된 부품 · 소모품 · 옵션`}><Package className="h-3.5 w-3.5" /></Link>}</div></td>
              {l.cells.map((c, i) => <Fragment key={i}>{nums(c)}</Fragment>)}{nums(l.total)}
            </tr>)}
            {shown.length === 0 && <tr><td colSpan={3 + (months.length + 1) * 4} className="p-6 text-center text-muted-foreground">조건에 맞는 Product 가 없습니다</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">합계와 소계는 표에 보이는 행만 더한 값입니다. 실적/Sales OL 은 Sales OL 이 0 이면 표시하지 않습니다. Product 를 누르면 그 기종의 예측 비교로, 상자 아이콘을 누르면 그 기종에 연결된 품목 목록으로 이동합니다.</p>
    </section>
  );
}
