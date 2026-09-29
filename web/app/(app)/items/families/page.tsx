import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchFamilySummary, byModel } from "@/lib/queries/families";
import { CATEGORIES } from "@/lib/queries/items";
import { KpiTile, type KpiTileProps } from "@/components/cards/KpiTile";
import { drillHref } from "@/lib/drill";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FamilyChart, FamilyTable } from "./FamilyTable";
/** 품목 › 제품군 · 기종별 보기 (R-UI-18, D-076): 제품군(Family) 또는 기종 묶음으로 묶은 재고·출고 요약. KPI → 차트 → 근거 표, 행을 누르면 품목 목록 */
export default async function FamiliesPage({ searchParams }: { searchParams: Promise<{ by?: string; category?: string; zero?: string; below?: string }> }) {
  const sp = await searchParams;
  const by = sp.by === "model" ? "model" as const : "family" as const;
  const category = (CATEGORIES as readonly string[]).includes(sp.category ?? "") ? sp.category : undefined;
  const sb = await createServerSupabase();
  const all = byModel(await fetchFamilySummary(sb, by, category));
  const rows = all.filter(r => (sp.zero !== "true" || r.n_zero_stock > 0) && (sp.below !== "true" || r.n_below_target > 0));
  const unit = by === "model" ? "기종" : "제품군";
  const here = (o: Record<string, string | boolean | undefined>) => drillHref("/items/families", { by: by === "model" ? "model" : undefined, category, ...o });
  const zero = all.filter(r => r.n_zero_stock > 0), below = all.filter(r => r.n_below_target > 0);
  const kpis: KpiTileProps[] = [
    { label: `${unit} 수`, value: fmtInt(all.length), sub: category ? `카테고리 ${category}` : "전체 카테고리", href: here({}) + "#family-table", accent: "stock", icon: "Layers" },
    { label: by === "model" ? "연결 품목 수 (기종마다 셈)" : "품목 수", value: fmtInt(all.reduce((a, r) => a + r.n_items, 0)), sub: by === "model" ? "한 품목이 여러 기종에 연결되면 중복" : "제품군이 있는 품목", href: drillHref("/items", { category }), accent: "stock", icon: "Package" },
    { label: `재고 0 품목이 있는 ${unit}`, value: fmtInt(zero.length), sub: `재고 0 품목 ${fmtInt(zero.reduce((a, r) => a + r.n_zero_stock, 0))}개`, href: here({ zero: true }) + "#family-table", accent: "risk", icon: "AlertTriangle", tone: zero.length > 0 ? "warn" : "default" },
    { label: `목표 DoS 미달 품목이 있는 ${unit}`, value: fmtInt(below.length), sub: `목표 미달 품목 ${fmtInt(below.reduce((a, r) => a + r.n_below_target, 0))}개`, href: here({ below: true }) + "#family-table", accent: "ops", icon: "Gauge", tone: below.length > 0 ? "warn" : "default" },
  ];
  const chip = (on: boolean) => cn("rounded-full border px-2.5 py-0.5 text-xs", on ? "bg-primary text-primary-foreground" : "hover:bg-muted");
  const top = rows.slice(0, 10);
  return (
    <div className="space-y-6">
      <div><div className="flex items-center gap-3"><h1 className="text-xl font-semibold">제품군 · 기종별 품목</h1><Link href="/items" className="text-sm text-muted-foreground underline-offset-2 hover:underline">← 품목 목록</Link></div>
        <p className="text-sm text-muted-foreground">품목을 제품군(Family) 또는 기종으로 묶어 재고와 출고를 봅니다. 이름은 실제 이름, 품목코드는 익명 코드입니다 (D-075 · D-076). 행을 누르면 그 범위의 품목 목록으로 이동합니다.</p></div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="family-filters">
        <div className="flex flex-wrap items-center gap-1"><span className="mr-1 text-xs text-muted-foreground">묶는 기준</span>
          <Link scroll={false} href={drillHref("/items/families", { category })} className={chip(by === "family")}>제품군별</Link>
          <Link scroll={false} href={drillHref("/items/families", { by: "model", category })} className={chip(by === "model")}>기종별</Link></div>
        <div className="flex flex-wrap items-center gap-1"><span className="mr-1 text-xs text-muted-foreground">카테고리</span>
          {["", ...CATEGORIES].map(c => <Link scroll={false} key={c || "all"} href={drillHref("/items/families", { by: by === "model" ? "model" : undefined, category: c || undefined })} className={chip((category ?? "") === c)}>{c || "전체"}</Link>)}</div>
        {(sp.zero === "true" || sp.below === "true") && <Link scroll={false} href={here({})} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{sp.zero === "true" ? "재고 0 품목 있음" : "목표 DoS 미달 품목 있음"} ✕</Link>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="family-kpi">{kpis.map(k => <KpiTile key={k.label} {...k} />)}</div>
      <FamilyChart by={by} category={category} labels={top.map(r => r.name)} keys={top.map(r => by === "model" ? r.key : r.name)} values={top.map(r => Math.round(r.total_12m))}
        insight={top[0] ? `${top[0].name} 가 12개월 출고 ${fmtInt(top[0].total_12m)} 로 가장 많음 — 현재고 ${fmtInt(top[0].on_hand)} · DoS ${top[0].dos_days ?? "-"}일` : "데이터 없음"} />
      <FamilyTable by={by} category={category} rows={rows} />
    </div>
  );
}
