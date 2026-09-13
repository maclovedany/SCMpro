"use client";
import Link from "next/link";
import { useMemo } from "react";
import { DrillCard } from "@/components/cards/DrillCard";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { TreeGrid } from "@/components/tables/TreeGrid";
import { Badge } from "@/components/ui/badge";
import { fmtInt, fmtNum, fmtDate } from "@/lib/format";
import { drillHref } from "@/lib/drill";
import type { ItemDetail as D } from "@/lib/queries/items";
import { METHOD_LABEL, PATTERN_LABEL } from "@/lib/queries/forecast";
import type { TsSeries } from "@/components/charts/chartOption";
type Fc = { ym: string | null; method: string | null; value: number | null; lower: number | null; upper: number | null }[];
type Cls = { pattern: string | null; abc: string | null; xyz: string | null; champion_method: string | null; cv: number | null; adi: number | null } | null;
export function ItemDetail({ d, forecast = [], cls = null }: { d: D; forecast?: Fc; cls?: Cls }) {
  const m = d.master!;
  const histMonths = useMemo(() => d.monthly.map(r => r.ym!), [d.monthly]);
  const fcMonths = useMemo(() => forecast.map(r => r.ym!), [forecast]);
  const months = useMemo(() => [...histMonths, ...fcMonths.filter(x => !histMonths.includes(x))], [histMonths, fcMonths]);
  const series = useMemo<TsSeries[]>(() => {
    const hist = new Map(d.monthly.map(r => [r.ym!, Number(r.qty)]));
    const fc = new Map(forecast.map(r => [r.ym!, r]));
    const out: TsSeries[] = [{ name: "실제 출고", role: "actual", data: months.map(x => hist.has(x) ? hist.get(x)! : null) }];
    if (forecast.length) out.push({ name: `기준예측 (${METHOD_LABEL[forecast[0].method ?? ""] ?? forecast[0].method})`, role: "forecast",
      data: months.map(x => fc.has(x) ? Number(fc.get(x)!.value) : null),
      band: { lower: months.map(x => fc.has(x) ? Number(fc.get(x)!.lower ?? fc.get(x)!.value) : 0), upper: months.map(x => fc.has(x) ? Number(fc.get(x)!.upper ?? fc.get(x)!.value) : 0) } });
    return out;
  }, [d.monthly, forecast, months]);
  const gridMonths = useMemo(() => [...histMonths.slice(-12), ...fcMonths.filter(x => !histMonths.includes(x))], [histMonths, fcMonths]);
  const treeRows = useMemo(() => {
    const rows = [{ id: "ship", label: "실제 출고", level: 0, values: Object.fromEntries(d.monthly.map(r => [r.ym!, Number(r.qty)])) }];
    if (forecast.length) rows.push({ id: "fc", label: "기준예측", level: 0, values: Object.fromEntries(forecast.map(r => [r.ym!, Number(r.value)])) });
    return rows;
  }, [d.monthly, forecast]);
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2"><h1 className="font-mono text-xl font-semibold">{m.key_code}</h1><Badge variant="outline">{m.category}</Badge>{m.family && <Badge variant="secondary">{m.family}</Badge>}</div>
        <p className="text-sm text-muted-foreground">{m.description ?? "(설명 없음)"} · 최근 출고 {m.last_ship_ym ?? "-"}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DrillCard label="현재고 (정상)" value={fmtInt(m.on_hand)} hint={`기준일 ${fmtDate(m.snap_date)}${m.stock_is_dummy ? " · 더미" : ""}`} href="#snapshots" tone={m.stock_is_dummy ? "warn" : "default"} />
        <DrillCard label="입고예정" value={fmtInt(m.inbound_qty)} hint="창고 입고 완료 전 (R-INV-02)" href="#inbound" />
        <DrillCard label="DoS (일)" value={fmtInt(m.dos_days)} hint={`6M 평균 ${fmtNum(m.avg_6m)} / 월`} href="#chart" tone={m.target_dos_days != null && m.dos_days != null && m.dos_days < m.target_dos_days ? "danger" : "default"} />
        <DrillCard label="목표 DoS · MOQ" value={`${fmtInt(m.target_dos_days)} · ${fmtInt(m.moq)}`} hint={m.setting_is_dummy ? "더미 설정 — 승인 필요" : `상태 ${m.setting_status ?? "-"}`} href={drillHref("/admin/item-settings", { item: m.key_code! })} tone={m.target_dos_days == null ? "danger" : m.setting_is_dummy ? "warn" : "default"} />
      </div>
      {cls && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DrillCard label="수요 패턴" value={PATTERN_LABEL[cls.pattern ?? ""] ?? cls.pattern ?? "-"} hint={`ADI ${cls.adi?.toFixed(2) ?? "-"} · CV ${cls.cv?.toFixed(2) ?? "-"}`} href={drillHref("/items", { pattern: cls.pattern ?? undefined })} />
        <DrillCard label="ABC-XYZ" value={`${cls.abc ?? "-"}${cls.xyz ?? "-"}`} hint="금액 기여도 × 변동성 (R-FC-35)" href={drillHref("/items", { abc: cls.abc ?? undefined, xyz: cls.xyz ?? undefined })} />
        <DrillCard label="챔피언 기법" value={METHOD_LABEL[cls.champion_method ?? ""] ?? cls.champion_method ?? "-"} hint="최신 백테스트 WAPE 최소 (R-FC-31)" href="/forecast" />
        <DrillCard label="예측 지평선" value={forecast.length ? `${forecast.length}개월` : "-"} hint={forecast.length ? `${fcMonths[0]} ~ ${fcMonths[fcMonths.length - 1]}` : "프로덕션 런 필요"} href="/forecast/runs" tone={forecast.length ? "default" : "warn"} />
      </div>}
      <section id="chart" className="rounded-md border p-3">
        <h2 className="mb-2 text-sm font-medium">월별 출고 (HOC 합산) + 기준예측 (80% 구간)</h2>
        <TimeSeriesChart months={months} series={series} forecastFrom={fcMonths[0]} height={300} />
      </section>
      <section className="rounded-md border p-3">
        <h2 className="mb-2 text-sm font-medium">재고전개 (SP3 에서 재고·발주 행 추가)</h2>
        <TreeGrid months={gridMonths} rows={treeRows} pastUntil={histMonths[histMonths.length - 1] ?? ""} />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {m.category === "PART" && (
          <section className="rounded-md border p-3"><h2 className="mb-2 text-sm font-medium">XCN 연계 코드 ({d.xcn.length}) — 출고·재고 합산 대상 (R-XCN-01)</h2>
            <div className="flex flex-wrap gap-1">{d.xcn.map(x => <Badge key={x.related_item!} variant={x.related_item === m.key_code ? "default" : "outline"} className="font-mono">{x.related_item}</Badge>)}</div></section>
        )}
        {(m.category === "OPTION" || m.category === "SW") && (
          <section className="rounded-md border p-3"><h2 className="mb-2 text-sm font-medium">연결 기종 ({d.models.length}) — R-BOM-11</h2>
            <div className="flex flex-wrap gap-1">{d.models.map((x, i) => <Badge key={i} variant="outline">{x.model_base ?? "(없음)"} <span className="ml-1 text-muted-foreground">{x.link_source}</span></Badge>)}{d.models[0]?.is_sw && <Badge variant="destructive">SW 라이선스 — 예측 제외</Badge>}</div></section>
        )}
        <section id="snapshots" className="rounded-md border p-3"><h2 className="mb-2 text-sm font-medium">재고 스냅샷</h2>
          <table className="w-full text-sm"><thead><tr className="text-muted-foreground"><th className="text-left">기준일</th><th className="text-left">구분</th><th className="text-right">수량</th></tr></thead>
            <tbody>{d.snapshots.map((s, i) => <tr key={i} className="border-t"><td>{s.snap_date}</td><td>{s.stock_class}{s.is_dummy && <Badge variant="secondary" className="ml-1 text-[10px]">더미</Badge>}</td><td className="text-right tabular-nums">{fmtInt(Number(s.qty))}</td></tr>)}
            {d.snapshots.length === 0 && <tr><td colSpan={3} className="py-3 text-center text-muted-foreground">없음 — <Link className="underline" href="/upload">업로드</Link></td></tr>}</tbody></table></section>
        <section id="inbound" className="rounded-md border p-3"><h2 className="mb-2 text-sm font-medium">입고예정</h2>
          <table className="w-full text-sm"><thead><tr className="text-muted-foreground"><th className="text-left">PO</th><th className="text-left">공급처</th><th className="text-left">계획일</th><th className="text-left">실제일</th><th className="text-left">상태</th><th className="text-right">수량</th></tr></thead>
            <tbody>{d.inbound.map(r => { const sup = r.supplier as unknown as { code: string; name: string } | null; return <tr key={r.id} className="border-t"><td>{r.po_no}{r.is_dummy && <Badge variant="secondary" className="ml-1 text-[10px]">더미</Badge>}</td><td>{sup?.name ?? "-"}</td><td>{r.planned_date}</td><td>{fmtDate(r.actual_date)}</td><td>{r.status}</td><td className="text-right tabular-nums">{fmtInt(Number(r.qty))}</td></tr>; })}
            {d.inbound.length === 0 && <tr><td colSpan={6} className="py-3 text-center text-muted-foreground">없음</td></tr>}</tbody></table></section>
      </div>
    </div>
  );
}
