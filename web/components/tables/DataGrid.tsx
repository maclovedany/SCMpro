"use client";
import { useMemo, useRef, useState } from "react";
import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Download, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> { align?: "left" | "right" | "center" }
}
const alignCls = (a?: string) => a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

type Props<T> = { columns: ColumnDef<T, unknown>[]; rows: T[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; csvName?: string; toolbar?: React.ReactNode; height?: number; emptyText?: string };
/** 정렬·검색·컬럼 숨김·CSV·가상 스크롤 (R-UI-05) */
export function DataGrid<T>({ columns, rows, rowKey, onRowClick, csvName = "export", toolbar, height = 560, emptyText = "데이터가 없습니다" }: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const table = useReactTable({ data: rows, columns, state: { sorting, globalFilter }, onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel() });
  const parentRef = useRef<HTMLDivElement>(null);
  const tRows = table.getRowModel().rows;
  const virt = useVirtualizer({ count: tRows.length, getScrollElement: () => parentRef.current, estimateSize: () => 36, overscan: 12 });
  const items = virt.getVirtualItems();
  const padTop = items.length ? items[0].start : 0;
  const padBottom = items.length ? virt.getTotalSize() - items[items.length - 1].end : 0;
  const csv = useMemo(() => () => {
    const cols = table.getVisibleLeafColumns();
    const head = cols.map(c => JSON.stringify(String(c.columnDef.header ?? c.id))).join(",");
    const body = tRows.map(r => cols.map(c => JSON.stringify(String(r.getValue(c.id) ?? ""))).join(",")).join("\n");
    const blob = new Blob(["﻿" + head + "\n" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${csvName}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }, [table, tRows, csvName]);
  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-2 border-b p-2">
        <Input placeholder="검색…" value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} className="h-8 w-56" />
        <span className="text-xs text-muted-foreground">{tRows.length.toLocaleString("ko-KR")}행</span>
        <div className="ml-auto flex items-center gap-2">{toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}><Columns3 className="mr-1 h-4 w-4" />컬럼</DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table.getAllLeafColumns().map(c => (
                <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={v => c.toggleVisibility(!!v)}>{String(c.columnDef.header ?? c.id)}</DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={csv}><Download className="mr-1 h-4 w-4" />CSV</Button>
        </div>
      </div>
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight: height }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_var(--border)]">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>{hg.headers.map(h => (
                <th key={h.id} className={cn("cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium text-muted-foreground", alignCls(h.column.columnDef.meta?.align))} onClick={h.column.getToggleSortingHandler()}>
                  <span className="inline-flex items-center gap-1">{flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === "asc" && <ArrowUp className="h-3 w-3" />}{h.column.getIsSorted() === "desc" && <ArrowDown className="h-3 w-3" />}</span>
                </th>))}</tr>
            ))}
          </thead>
          <tbody>
            {padTop > 0 && <tr><td style={{ height: padTop }} /></tr>}
            {items.map(vi => { const r = tRows[vi.index]; return (
              <tr key={rowKey(r.original)} data-index={vi.index} className={cn("border-t hover:bg-muted/40", onRowClick && "cursor-pointer")} onClick={() => onRowClick?.(r.original)}>
                {r.getVisibleCells().map(c => <td key={c.id} className={cn("whitespace-nowrap px-3 py-1.5", alignCls(c.column.columnDef.meta?.align), c.column.columnDef.meta?.align === "right" && "tabular-nums")}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
              </tr>); })}
            {padBottom > 0 && <tr><td style={{ height: padBottom }} /></tr>}
            {tRows.length === 0 && <tr><td colSpan={columns.length} className="p-8 text-center text-muted-foreground">{emptyText}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
