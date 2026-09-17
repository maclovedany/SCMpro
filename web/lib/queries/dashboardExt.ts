import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { drillHref } from "@/lib/drill";
import { fmtInt, fmtPct, fmtDate } from "@/lib/format";
import { withRetry } from "@/lib/supabase/retry";
import type { Role } from "@/lib/auth/roles";
import type { Section, CardSpec } from "@/lib/queries/dashboard";
import { URGENT_STAGES, STAGE_LABEL } from "@/lib/queries/urgent";
/** 대시보드 확장 묶음 (R-UI-16, D-058): 재고 현황(전 역할) · 담당 품목 재고 · 긴급발주 진행 · 고객사 배정. RPC fn_dashboard_ext 한 번 */
export type DashboardExt = {
  inventory: { snapshot_date: string | null; n_items: number; zero_stock: number; zero_available: number; low_dos: number; by_cat: { category: string; on_hand: number; allocated: number; available: number; n_items: number }[] };
  groups: { group_code: string; group_name: string; owner_dept: string | null; is_dummy: boolean; n_items: number; on_hand: number; available: number; zero_available: number;
    items: { item_code: string; description: string | null; on_hand: number; available: number; dos_days: number | null }[] | null }[];
  urgent: { open: number; delayed: number; pending_approval: number; received_30d: number; mine_open: number; stages: { stage: string; n: number }[];
    recent: { id: string; item_code: string; description: string | null; qty: number; stage: string; delayed: boolean; planned_date: string | null; need_date: string | null; requested_dept: string | null; po_no: string | null }[] };
  customer: { customers: number; need: number; allocated: number; shortage: number; short_customers: number; top: { customer_code: string; customer_name: string | null; need: number; allocated: number; shortage: number }[] };
};
export async function fetchDashboardExt(sb: SupabaseClient<Database>): Promise<DashboardExt> {
  const { data, error } = await withRetry(() => sb.schema("app").rpc("fn_dashboard_ext"));
  if (error) throw new Error(`대시보드 확장 조회 실패 [${error.code}] ${error.message}`);
  return data as unknown as DashboardExt;
}
const N = (v: unknown) => Number(v ?? 0);
function buildExt(x: DashboardExt): Record<string, Section> {
  const inv = x.inventory, u = x.urgent, c = x.customer;
  const fill = N(c.need) > 0 ? N(c.allocated) / N(c.need) : null;
  const gCards: CardSpec[] = x.groups.slice(0, 3).map(g => ({ label: `${g.group_name} 재고`, value: fmtInt(N(g.on_hand)), hint: `가용 ${fmtInt(N(g.available))} · 품목 ${fmtInt(N(g.n_items))}개 · 가용 0 품목 ${fmtInt(N(g.zero_available))}${g.is_dummy ? " · 더미" : ""}`,
    href: drillHref("/items/groups", { group: g.group_code }), tone: N(g.zero_available) > 0 ? "warn" : "default" }));
  const gZero = x.groups.reduce((a, g) => a + N(g.zero_available), 0), gItems = x.groups.reduce((a, g) => a + N(g.n_items), 0);
  if (gCards.length < 3) gCards.push({ label: "가용 0 담당 품목", value: fmtInt(gZero), hint: "재고가 없거나 전량 배정된 담당 품목", href: "/items/groups", tone: gZero > 0 ? "warn" : "default" });
  if (gCards.length < 3) gCards.push({ label: "담당 품목 수", value: fmtInt(gItems), hint: `그룹 ${x.groups.length}개 · 그룹 구성은 관리 › 품목 그룹`, href: "/items/groups" });
  return {
    inv: { key: "inv", accent: "stock", title: "재고 현황 (전 부서 공통)", cards: [
      { label: "재고 보유 품목", value: fmtInt(N(inv.n_items)), hint: `재고 스냅샷 ${fmtDate(inv.snapshot_date)} 기준 · 재고 0 품목 ${fmtInt(N(inv.zero_stock))}개`, href: "/items" },
      { label: "가용재고 0 (전량 배정)", value: fmtInt(N(inv.zero_available)), hint: "재고는 있으나 전부 배정됨 — 새 주문은 입고까지 대기", href: drillHref("/sales-orders/customers", { short: 1 }), tone: N(inv.zero_available) > 0 ? "warn" : "default" },
      { label: "DoS 목표 미달 품목", value: fmtInt(N(inv.low_dos)), hint: "남은 일수가 목표보다 짧은 품목 — 눌러서 짧은 순으로 보기", href: drillHref("/items", { sort: "dos_days.asc" }), tone: N(inv.low_dos) > 0 ? "warn" : "default" },
    ] },
    mygroup: { key: "mygroup", accent: "stock", title: "담당 품목 재고", cards: gCards.slice(0, 3) },
    urgent: { key: "urgent", accent: "risk", title: "긴급발주 진행", cards: [
      { label: "진행 중 긴급발주", value: fmtInt(N(u.open)), hint: `내 요청 ${fmtInt(N(u.mine_open))}건 · 승인 대기 ${fmtInt(N(u.pending_approval))}건`, href: "/extra-demand#urgent" },
      { label: "지연 긴급발주", value: fmtInt(N(u.delayed)), hint: "계획 입고일(또는 필요일)이 지났는데 미입고", href: "/extra-demand#urgent", tone: N(u.delayed) > 0 ? "danger" : "default" },
      { label: "최근 30일 입고 완료", value: fmtInt(N(u.received_30d)), hint: "긴급발주로 들어온 건", href: "/extra-demand#urgent" },
    ] },
    custalloc: { key: "custalloc", accent: "ops", title: "고객사 배정 현황", cards: [
      { label: "고객사 필요 대비 충족률", value: fmtPct(fill), hint: `필요 ${fmtInt(N(c.need))} · 배정 ${fmtInt(N(c.allocated))} · 고객사 ${fmtInt(N(c.customers))}곳`, href: "/sales-orders/customers", tone: fill != null && fill < 0.7 ? "warn" : "default" },
      { label: "부족 고객사", value: `${fmtInt(N(c.short_customers))}곳`, hint: "필요 수량만큼 배정받지 못한 고객사", href: drillHref("/sales-orders/customers", { short: 1 }), tone: N(c.short_customers) > 0 ? "warn" : "default" },
      { label: "부족 수량 합계", value: fmtInt(N(c.shortage)), hint: "입고 자동배정 또는 사업강화부 강제배정 대상", href: drillHref("/sales-orders/customers", { short: 1 }) },
    ] },
  };
}
/** 역할별 배치 (R-UI-16): top 은 기존 묶음 앞, bottom 은 뒤. 재고 현황은 전 역할 맨 위 */
const ORDER: Record<Role, { top: string[]; bottom: string[] }> = {
  sales: { top: ["inv", "custalloc"], bottom: ["urgent"] }, biz_enable: { top: ["inv", "custalloc"], bottom: ["urgent"] },
  marketing: { top: ["inv", "mygroup"], bottom: ["urgent"] }, service: { top: ["inv", "urgent", "mygroup"], bottom: [] },
  item_manager: { top: ["inv"], bottom: ["urgent", "custalloc", "mygroup"] }, scm_lead: { top: ["inv"], bottom: ["urgent", "custalloc", "mygroup"] }, admin: { top: ["inv"], bottom: ["urgent", "custalloc", "mygroup"] },
};
export type ExtSections = { top: Section[]; bottom: Section[] };
export function extSections(role: Role, x: DashboardExt): ExtSections {
  const s = buildExt(x); const keep = (k: string) => k !== "mygroup" || x.groups.length > 0;
  return { top: ORDER[role].top.filter(keep).map(k => s[k]), bottom: ORDER[role].bottom.filter(keep).map(k => s[k]) };
}
export const mergeSections = (ext: ExtSections, base: Section[]): Section[] => [...ext.top, ...base, ...ext.bottom];
const share = (part: unknown, whole: unknown) => N(whole) > 0 ? Math.round(N(part) / N(whole) * 1000) / 10 : 0;
export function extCharts(x: DashboardExt) {
  const cats = [...x.inventory.by_cat].sort((a, b) => a.category.localeCompare(b.category));
  const busiest = [...cats].filter(c => N(c.on_hand) > 0).sort((a, b) => N(b.allocated) / N(b.on_hand) - N(a.allocated) / N(a.on_hand))[0];
  const items = x.groups.flatMap(g => (g.items ?? []).map(i => ({ ...i, group: g.group_name }))).sort((a, b) => N(a.available) - N(b.available) || a.item_code.localeCompare(b.item_code)).slice(0, 10);
  const top = x.customer.top;
  return {
    // 카테고리 간 수량 차이가 커서(소모품 수만 vs 기기 수백) 수량 막대는 작은 쪽이 안 보인다 → 카테고리 안에서의 비율(%)로 그린다
    inv: { categories: cats.map(c => c.category), series: [{ name: "가용", data: cats.map(c => share(c.available, c.on_hand)) }, { name: "배정", data: cats.map(c => share(c.allocated, c.on_hand)) }],
      insight: `${busiest && N(busiest.allocated) > 0 ? `${busiest.category} 재고의 ${fmtPct(N(busiest.allocated) / N(busiest.on_hand))} 가 이미 배정됨 — 가장 높음` : "배정된 재고 없음 — 전량 가용"} · 현재고 ${cats.map(c => `${c.category} ${fmtInt(N(c.on_hand))}`).join(" / ")}` },
    mygroup: { labels: items.map(i => `${i.item_code} ${i.description ?? ""}`.trim()), values: items.map(i => N(i.available)), codes: items.map(i => i.item_code),
      insight: items.length ? `가용이 가장 적은 담당 품목: ${items[0].description ?? items[0].item_code} (${fmtInt(N(items[0].available))})` : "담당 품목 없음" },
    urgent: { labels: URGENT_STAGES.map(s => STAGE_LABEL[s]), values: URGENT_STAGES.map(s => N(x.urgent.stages.find(t => t.stage === s)?.n)),
      insight: N(x.urgent.delayed) > 0 ? `지연 ${fmtInt(N(x.urgent.delayed))}건 — 공급처 확인 필요` : N(x.urgent.open) > 0 ? `진행 중 ${fmtInt(N(x.urgent.open))}건 · 지연 없음` : "진행 중인 긴급발주 없음" },
    custalloc: { categories: top.map(t => t.customer_name ?? t.customer_code), series: [{ name: "배정", data: top.map(t => N(t.allocated)) }, { name: "부족", data: top.map(t => N(t.shortage)) }], codes: top.map(t => t.customer_code),
      insight: top[0] && N(top[0].shortage) > 0 ? `${top[0].customer_name ?? top[0].customer_code} 부족 ${fmtInt(N(top[0].shortage))} — 가장 큼` : "부족 고객사 없음" },
  };
}
export type ExtCharts = ReturnType<typeof extCharts>;
