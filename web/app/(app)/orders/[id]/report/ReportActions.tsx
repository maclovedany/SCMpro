"use client";
import { Button } from "@/components/ui/button";
export function ReportActions({ planYm, lines }: { planYm: string; lines: { code: string; category: string | null; need_ym: string; qty: number; amount: number }[] }) {
  const csv = () => { const body = lines.map(l => `${l.code},${l.category ?? ""},${l.need_ym},${l.qty},${l.amount}`).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿코드,카테고리,필요월,발주수량,금액\n" + body], { type: "text/csv;charset=utf-8" })); a.download = `order-${planYm}.csv`; a.click(); };
  return <div className="flex gap-2 print:hidden"><Button variant="outline" size="sm" onClick={csv}>CSV</Button><Button variant="outline" size="sm" onClick={() => window.print()}>인쇄</Button></div>;
}
