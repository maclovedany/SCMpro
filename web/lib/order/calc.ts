/** 발주량 산출 단일 구현 (spec SP3 §2). 규칙: R-OQ-01/03/04/10~13/20/30/31, R-INV-02.
 *  호출처는 계획 생성 서버 액션(orders/actions.ts) 하나. 화면 what-if(라인 편집)는 fn_override_line RPC 가 재계산한다 — 07-architecture §2. */
export type Settings = { flex_ranges: { offset: number; pct: number }[]; default_lead_time_days: number; projection_future_months: number; dos_avg_months: number };
export type ItemInput = { key_code: string; category: string | null; avg_6m: number | null; on_hand: number | null; target_dos_days: number | null; moq: number | null; unit_price: number | null;
  supplier_id: number | null; lead_time_days: number | null; forecast: Record<string, number>; inbound: Record<string, number>; extras: Record<string, number>; flex_base: Record<string, number> };
export type Projection = { ym: string; forecast: number; inbound: number; extras: number; start: number; end: number; order: number };
export type Line = { key_code: string; category: string | null; supplier_id: number | null; need_ym: string; lead_months: number; forecast_need: number; extras_need: number; on_hand: number; inbound_until_need: number;
  start_need: number; target_stock: number; avg_6m: number; target_dos_days: number | null; required_qty: number; flex_base: number | null; flex_pct: number | null; flex_min: number | null; flex_max: number | null; flex_hit: boolean;
  chosen_qty: number; moq: number; final_qty: number; end_after: number; dos_after: number | null; stockout_risk: boolean; blocked: boolean; unit_price: number | null; amount: number; rationale: Record<string, unknown>; projection: Projection[] };
export function addMonths(ym: string, n: number): string {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}`;
}
const r1 = (x: number) => Math.round(x * 1000) / 1000;
export function computeLine(it: ItemInput, planYm: string, dataLastYm: string, s: Settings): Line {
  const avg = Math.max(0, Number(it.avg_6m ?? 0));
  const leadDays = it.lead_time_days ?? s.default_lead_time_days;
  const lead = Math.max(1, Math.ceil(leadDays / 30));
  const needYm = addMonths(planYm, lead);
  const horizonEnd = addMonths(planYm, lead + s.projection_future_months);
  const fc = (ym: string) => Number(it.forecast[ym] ?? avg);           // 예측 없으면 6M 평균 (R-FC-31)
  const inb = (ym: string) => Number(it.inbound[ym] ?? 0), ex = (ym: string) => Number(it.extras[ym] ?? 0);
  // 1. 전개
  const projection: Projection[] = [];
  let start = Number(it.on_hand ?? 0), ym = addMonths(dataLastYm, 1), inbUntil = 0;
  while (ym <= horizonEnd) {
    const end = start + inb(ym) - fc(ym) - ex(ym);
    projection.push({ ym, forecast: r1(fc(ym)), inbound: inb(ym), extras: ex(ym), start: r1(start), end: r1(end), order: 0 });
    if (ym <= needYm) inbUntil += inb(ym);
    start = end; ym = addMonths(ym, 1);
  }
  const pNeed = projection.find(p => p.ym === needYm)!;
  // 2~3. 목표재고·필요량
  const blocked = it.target_dos_days == null;
  const targetStock = blocked ? 0 : (it.target_dos_days! / 30) * avg;
  const required = Math.max(0, targetStock + pNeed.forecast + pNeed.extras - pNeed.start);
  // 4. Flex
  const baseQ = it.flex_base[needYm] != null ? Number(it.flex_base[needYm]) : null;
  const pct = s.flex_ranges.find(f => f.offset === 1)?.pct ?? null;
  let chosen = required, flexMin: number | null = null, flexMax: number | null = null, flexHit = false;
  if (baseQ != null && pct != null) {
    flexMin = r1(baseQ * (1 - pct / 100)); flexMax = r1(baseQ * (1 + pct / 100));
    if (required < flexMin) { chosen = flexMin; flexHit = true; }        // ③ 범위 내 최소 (재고금액 최소)
    else if (required > flexMax) { chosen = flexMax; flexHit = true; }   // ① 품절 최소화: 상한까지
  }
  // 5. MOQ
  const moq = Math.max(1, Math.floor(Number(it.moq ?? 1)));
  const final = chosen > 0 ? Math.ceil(chosen / moq - 1e-9) * moq : 0;
  // 6. after
  const endAfter = pNeed.start + final - pNeed.forecast - pNeed.extras;
  const dosAfter = avg > 0 ? Math.round(endAfter / avg * 30) : null;
  pNeed.order = final;
  const carry = final; for (const p of projection) { if (p.ym >= needYm) { p.start = r1(p.start + carry); p.end = r1(p.end + carry); } }
  return { key_code: it.key_code, category: it.category, supplier_id: it.supplier_id, need_ym: needYm, lead_months: lead, forecast_need: pNeed.forecast, extras_need: pNeed.extras,
    on_hand: Number(it.on_hand ?? 0), inbound_until_need: inbUntil, start_need: r1(pNeed.start - final), target_stock: r1(targetStock), avg_6m: avg, target_dos_days: it.target_dos_days,
    required_qty: r1(required), flex_base: baseQ, flex_pct: baseQ != null ? pct : null, flex_min: flexMin, flex_max: flexMax, flex_hit: flexHit, chosen_qty: r1(chosen), moq, final_qty: final,
    end_after: r1(endAfter), dos_after: dosAfter, stockout_risk: pNeed.start - final < 0 || (pNeed.start - final) < pNeed.forecast + pNeed.extras, blocked, unit_price: it.unit_price, amount: r1(final * Number(it.unit_price ?? 0)),
    rationale: { rule: "R-OQ-04→10→30", target_stock: r1(targetStock), required: r1(required), flex: baseQ != null ? { base: baseQ, pct, min: flexMin, max: flexMax, hit: flexHit } : null, moq, lead_days: leadDays }, projection };
}
export function computePlan(items: ItemInput[], planYm: string, dataLastYm: string, s: Settings): Line[] {
  return items.map(it => computeLine(it, planYm, dataLastYm, s));
}
export function parseSettings(raw: Record<string, unknown>): Settings {
  return { flex_ranges: (raw.flex_ranges as Settings["flex_ranges"]) ?? [{ offset: 1, pct: 20 }], default_lead_time_days: Number(raw.default_lead_time_days ?? 30),
    projection_future_months: Number(raw.projection_future_months ?? 6), dos_avg_months: Number(raw.dos_avg_months ?? 6) };
}
