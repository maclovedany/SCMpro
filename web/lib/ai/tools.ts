/** AI Agent 도구 (R-AI-05): 사용자 세션 supabase 클라이언트로만 조회 → RLS 그대로 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
type SB = SupabaseClient<Database>;
export type ToolDef = { name: string; description: string; parameters: Record<string, unknown>; run: (sb: SB, args: Record<string, unknown>) => Promise<unknown> };
const str = (v: unknown) => String(v ?? "").trim();
export const TOOLS: ToolDef[] = [
  { name: "search_items", description: "품목 코드/설명으로 예측 대상 품목 검색 (최대 10개)", parameters: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
    run: async (sb, a) => (await sb.schema("analytics").from("v_item_master").select("key_code,description,category,family,avg_6m,on_hand,dos_days,target_dos_days,abc,xyz,pattern").or(`key_code.ilike.%${str(a.q)}%,description.ilike.%${str(a.q)}%`).limit(10)).data },
  { name: "get_item", description: "품목 마스터·설정·현재고·DoS·분류(ABC-XYZ, 수요패턴)·챔피언 기법", parameters: { type: "object", properties: { code: { type: "string", description: "품목 코드(HOC)" } }, required: ["code"] },
    run: async (sb, a) => { const code = str(a.code); const [m, s] = await Promise.all([sb.schema("analytics").from("v_item_master").select("*").eq("key_code", code).maybeSingle(), sb.schema("app").from("v_item_setting").select("*").eq("item_code", code).maybeSingle()]); return m.data ? { ...m.data, setting: s.data } : { error: `품목 ${code} 없음 (SW 라이선스/미출고 품목은 대상 아님)` }; } },
  { name: "get_item_forecast", description: "품목의 최신 프로덕션 기준예측(월별 값·80% 구간·기법)과 최근 12개월 실제 출고", parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
    run: async (sb, a) => { const code = str(a.code); const [f, h] = await Promise.all([sb.schema("analytics").from("v_forecast_latest").select("ym,method,value,lower,upper").eq("key_code", code).order("ym"), sb.schema("analytics").from("v_item_monthly").select("ym,qty").eq("key_code", code).order("ym", { ascending: false }).limit(12)]); return { forecast: f.data, recent_actual: (h.data ?? []).reverse() }; } },
  { name: "get_available_stock", description: "가용재고 = 현재고 − 임시배정 − 확정배정 − 승인대기 확보 (R-INV-03)", parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
    run: async (sb, a) => (await sb.schema("app").from("v_available_stock").select("*").eq("item_code", str(a.code)).maybeSingle()).data ?? { error: "없음" } },
  { name: "get_order_plan", description: "최신 발주 계획 요약(상태·금액·품절위험) 과 특정 품목 라인(필요량·Flex·MOQ·최종 발주량·근거)", parameters: { type: "object", properties: { code: { type: "string", description: "선택: 품목 코드" } } },
    run: async (sb, a) => { const p = (await sb.schema("analytics").from("v_order_plan_summary").select("*").order("plan_ym", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle()).data; if (!p) return { error: "발주 계획 없음" }; const line = a.code ? (await sb.schema("app").from("order_plan_line").select("key_code,need_ym,forecast_need,extras_need,on_hand,inbound_until_need,start_need,target_stock,required_qty,flex_base,flex_min,flex_max,flex_hit,moq,final_qty,override_qty,override_reason,dos_after,stockout_risk,blocked,rationale").eq("plan_id", p.id!).eq("key_code", str(a.code)).maybeSingle()).data : null; return { plan: p, line }; } },
  { name: "get_forecast_accuracy", description: "최신 백테스트 정확도: 시스템 기준예측 vs Sales OL vs SCM OL (WAPE·Bias), 카테고리별", parameters: { type: "object", properties: {} },
    run: async (sb) => (await sb.schema("analytics").from("v_accuracy_summary").select("level,key,method,wape,bias,n").in("level", ["total", "category", "biz"])).data },
  { name: "list_pending_approvals", description: "내가 볼 수 있는 승인 대기 목록", parameters: { type: "object", properties: {} },
    run: async (sb) => (await sb.schema("app").from("v_my_approvals").select("kind,target_pk,payload,reason,requested_at,requester_name").eq("status", "pending").limit(20)).data },
  { name: "get_schedule", description: "향후 발주 캘린더(공급처별 발주일·입고예정)와 다음 달 수요자료 제출 현황", parameters: { type: "object", properties: {} },
    run: async (sb) => { const now = new Date(); const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; const m = now.getMonth() + 2; const next = `${now.getFullYear() + Math.floor((m - 1) / 12)}-${String(((m - 1) % 12) + 1).padStart(2, "0")}`; const [c, s] = await Promise.all([sb.schema("app").rpc("fn_order_calendar", { p_from: ym, p_months: 2 }), sb.schema("app").rpc("fn_submission_status", { p_ym: next })]); return { calendar: c.data, submission: s.data }; } },
  { name: "list_my_sales_orders", description: "영업 주문 목록(상태·배정·부족·만료일)", parameters: { type: "object", properties: {} },
    run: async (sb) => (await sb.schema("app").from("v_sales_order").select("order_no,item_code,qty,status,temp_qty,firm_qty,shortage,expires_at,customer").order("requested_at", { ascending: false }).limit(20)).data },
];
export const toolSpecs = () => TOOLS.map(t => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
export async function runTool(sb: SB, name: string, args: Record<string, unknown>) {
  const t = TOOLS.find(x => x.name === name); if (!t) return { error: `unknown tool ${name}` };
  try { return await t.run(sb, args); } catch (e) { return { error: String(e) }; }
}
