"use client";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGrid } from "@/components/tables/DataGrid";
import { Badge } from "@/components/ui/badge";
import { fmtInt, fmtNum } from "@/lib/format";
import type { ItemMasterRow } from "@/lib/queries/items";
export function ItemsTable({ rows }: { rows: ItemMasterRow[] }) {
  const router = useRouter();
  const columns = useMemo<ColumnDef<ItemMasterRow, unknown>[]>(() => [
    { accessorKey: "key_code", header: "코드", cell: c => <span className="font-mono">{String(c.getValue())}</span> },
    { accessorKey: "description", header: "설명" },
    { accessorKey: "category", header: "카테고리", cell: c => <Badge variant="outline">{String(c.getValue())}</Badge> },
    { accessorKey: "family", header: "제품군" },
    { accessorKey: "avg_6m", meta: { align: "right" }, header: "6M 평균", cell: c => <span className="tabular-nums">{fmtNum(c.getValue() as number)}</span> },
    { accessorKey: "total_12m", meta: { align: "right" }, header: "12M 합", cell: c => <span className="tabular-nums">{fmtInt(c.getValue() as number)}</span> },
    { accessorKey: "on_hand", meta: { align: "right" }, header: "현재고", cell: c => <span className="tabular-nums">{fmtInt(c.getValue() as number)}{c.row.original.stock_is_dummy && <Badge variant="secondary" className="ml-1 text-[10px]">더미</Badge>}</span> },
    { accessorKey: "inbound_qty", meta: { align: "right" }, header: "입고예정", cell: c => <span className="tabular-nums">{fmtInt(c.getValue() as number)}</span> },
    { accessorKey: "dos_days", meta: { align: "right" }, header: "DoS", cell: c => <span className="tabular-nums">{fmtInt(c.getValue() as number)}</span> },
    { accessorKey: "target_dos_days", meta: { align: "right" }, header: "목표 DoS", cell: c => <span className="tabular-nums">{fmtInt(c.getValue() as number)}</span> },
    { accessorKey: "moq", meta: { align: "right" }, header: "MOQ", cell: c => <span className="tabular-nums">{fmtInt(c.getValue() as number)}</span> },
    { accessorKey: "setting_status", header: "설정", cell: c => <span>{String(c.getValue() ?? "-")}{c.row.original.setting_is_dummy && <Badge variant="secondary" className="ml-1 text-[10px]">더미</Badge>}</span> },
    { accessorKey: "last_ship_ym", header: "최근 출고월" },
    { accessorKey: "pattern", header: "패턴" },
    { id: "abcxyz", header: "ABC-XYZ", accessorFn: r => `${r.abc ?? "-"}${r.xyz ?? "-"}` },
    { accessorKey: "champion_method", header: "챔피언 기법" },
  ], []);
  return <DataGrid columns={columns} rows={rows} rowKey={r => r.key_code!} onRowClick={r => router.push(`/items/${encodeURIComponent(r.key_code!)}`)} csvName="items" />;
}
