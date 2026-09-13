"use client";
import { ChartCard } from "@/components/cards/ChartCard";
import { Donut, Lines } from "@/components/charts/MiniCharts";
import { SERIES_LIGHT } from "@/lib/design/palette";
import { SO_STATUS, type SalesOrderRow } from "@/lib/queries/allocation";
/** 영업 주문 차트 (D-036): 상태 구성 · 최근 30일 요청 추이 (목록 200건 기준, 클라이언트 집계) */
export function SalesOrderCharts({ orders, now }: { orders: SalesOrderRow[]; now: number }) {
  const cnt: Record<string, number> = {}; for (const o of orders) cnt[o.status ?? ""] = (cnt[o.status ?? ""] ?? 0) + 1;
  const status = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: SO_STATUS[k] ?? k, value: v }));
  const days = Array.from({ length: 30 }, (_, i) => new Date(now - (29 - i) * 86400e3).toISOString().slice(0, 10));
  const daily = days.map(d => orders.filter(o => (o.requested_at ?? "").slice(0, 10) === d).length);
  const active = orders.filter(o => ["review_requested", "partial", "waiting"].includes(o.status ?? "")).length;
  return (<>
    <ChartCard title="주문 상태 구성" insight={orders.length ? `${orders.length}건 중 진행 ${active}건 — 임시배정은 30일 후 자동 만료` : "주문 없음"} href="/sales-orders?all=1" accent="ops">
      {status.length ? <Donut height={200} data={status} colors={[SERIES_LIGHT[3], SERIES_LIGHT[0], SERIES_LIGHT[1], SERIES_LIGHT[2], SERIES_LIGHT[4], SERIES_LIGHT[5], SERIES_LIGHT[6]]} centerLabel="주문" /> : <p className="p-4 text-sm text-muted-foreground">주문 없음</p>}</ChartCard>
    <ChartCard title="최근 30일 검토 요청 건수" insight={`최근 7일 ${daily.slice(-7).reduce((a, b) => a + b, 0)}건 · 30일 ${daily.reduce((a, b) => a + b, 0)}건`} href="/sales-orders?all=1" accent="cycle">
      <Lines height={200} x={days.map(d => d.slice(5))} series={[{ name: "요청", data: daily }]} colors={[SERIES_LIGHT[4]]} /></ChartCard>
  </>);
}
