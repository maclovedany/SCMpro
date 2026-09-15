"use client";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/export/ExportMenu";
import { exportRows, normalizeCell, type ExportFormat } from "@/lib/export/sheet";

const HEADERS = ["코드", "카테고리", "필요월", "발주수량", "금액"];

export function ReportActions({ planYm, lines }: { planYm: string; lines: { code: string; category: string | null; need_ym: string; qty: number; amount: number }[] }) {
  const onExport = (format: ExportFormat) =>
    exportRows(`order-${planYm}`, HEADERS, lines.map(l => [l.code, l.category, l.need_ym, l.qty, l.amount].map(normalizeCell)), format, `발주 ${planYm}`);
  return <div className="flex gap-2 print:hidden">
    <ExportMenu onExport={onExport} disabled={lines.length === 0} />
    <Button variant="outline" size="sm" onClick={() => window.print()}>인쇄</Button>
  </div>;
}
