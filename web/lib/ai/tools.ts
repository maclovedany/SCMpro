/** AI Agent 도구 (R-AI-05 · R-AI-09): 사용자 세션 supabase 클라이언트로만 조회 → RLS 그대로. 전부 조회 전용.
 *  도구마다 roles 가 있어 질문한 사용자의 역할에 맞는 도구만 모델에 넘긴다 (D-081). 역할별 업무 도구는 roleTools.ts */
import { thisYmKst, nextYmKst } from "@/lib/date";
import { catLabel } from "@/lib/design/category";
import { fetchAliasMap, realName, type AliasMap } from "@/lib/names";
import { inList } from "@/lib/queries/families";
import { fetchMcFys, fetchMcOlAct, fyLabel } from "@/lib/queries/mcPlan";
import { mcTotalsOf, mcFamilyOf, likeValue, familiesLike } from "./mcTools";
import { ALL_ROLES, str, type ToolDef, type ToolCtx, type SB } from "./toolTypes";
import { ROLE_TOOLS } from "./roleTools";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";
export type { ToolDef, ToolCtx } from "./toolTypes";
/** 품목 · 예측 · 발주 · 기종 — 전 역할 공통 */
const BASE_TOOLS: Omit<ToolDef, "roles">[] = [
  { name: "search_items", label: "품목 검색", description: "품목(SPAREPARTS · CONSUMABLE · OPTION · SW) 검색: 품목 코드 · 품명 · 제품군 이름으로 찾는다 (최대 10개). 기종(MC) Family 는 search_mc_families 를 쓴다", parameters: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
    run: async (sb, a) => { const q = str(a.q); const fams = familiesLike(await fetchAliasMap(sb), q);      // 제품군은 실제 이름으로 보이므로 실제 이름으로도 찾는다 (D-080)
      return (await sb.schema("analytics").from("v_item_master").select("key_code,description,category,family,avg_6m,on_hand,dos_days,target_dos_days,abc,xyz,pattern")
        .or([`key_code.ilike.${likeValue(q)}`, `description.ilike.${likeValue(q)}`, `family.ilike.${likeValue(q)}`, ...(fams.length ? [`family.in.${inList(fams)}`] : [])].join(",")).order("total_12m", { ascending: false, nullsFirst: false }).limit(10)).data; } },
  // ── 기종(MC) — Family 는 회사 약자, Item Code 는 익명 코드, 구분 = DT · GC · PRT (R-FC-16, D-080)
  { name: "search_mc_families", label: "기종(MC) Family 검색", description: "기종(MC) Family 찾기·순위: Family 이름(예: 회사 약자)이나 Item Code 일부로 찾거나, 구분(DT/GC/PRT)별로 최근 12개월 실적이 큰 순으로 나열한다. 전임기·후속기·최근월 Sales OL/SCM OL/실적 포함. '기종 OL · 실적' 화면의 Family 에 대한 질문은 이 도구부터",
    parameters: { type: "object", properties: { q: { type: "string", description: "Family 이름 또는 Item Code 일부 (없으면 전체)" }, biz: { type: "string", enum: ["DT", "GC", "PRT"], description: "MC 구분 (선택)" }, top: { type: "integer", description: "개수, 기본 10 · 최대 30" } } },
    run: async (sb, a) => { const q = str(a.q); const biz = str(a.biz).toUpperCase(); const top = Math.max(1, Math.min(30, Number(a.top) || 10));
      let r = sb.schema("analytics").from("v_mc_item").select("family_key,biz,item_code,codename,predecessor,successor,last_ym,act_12m,act_avg_6m,last_sales_ol,last_scm_ol,last_act,last_act_ym");
      if (["DT", "GC", "PRT"].includes(biz)) r = r.eq("biz", biz);
      if (q) r = r.or(`family_key.ilike.${likeValue(q)},item_code.ilike.${likeValue(q)}`);
      const { data } = await r.order("act_12m", { ascending: false, nullsFirst: false }).limit(top);
      return (data ?? []).length ? (data ?? []).map(({ family_key, codename, ...x }) => ({ family: family_key, machine: codename, ...x })) : { error: `기종(MC) Family 에 '${q}' 없음 — 이름 일부만 넣어 다시 찾거나 biz 로 목록을 본다` }; } },
  { name: "get_mc_family", label: "기종(MC) Family 상세", description: "기종(MC) Family 하나의 월별 Sales OL · SCM OL · 실적 · 실적/Sales OL 과 합계, 구분·Item Code·전임기·후속기. fy 를 주면 그 회계연도(4월 시작), 없으면 가장 최근 회계연도",
    parameters: { type: "object", properties: { family: { type: "string", description: "Family 이름 (화면의 Family 열 값)" }, fy: { type: "integer", description: "회계연도 시작 연도, 예: 2026 = FY26 (선택)" } }, required: ["family"] },
    run: async (sb, a) => { const fys = await fetchMcFys(sb); const fy = fys.includes(Number(a.fy)) ? Number(a.fy) : fys[0]; if (fy == null) return { error: "기종(MC) 자료 없음" };
      const f = mcFamilyOf(await fetchMcOlAct(sb, fy), str(a.family));
      return f ? { fy: fyLabel(fy), fy_with_data: fys.map(fyLabel), ...f } : { error: `${fyLabel(fy)} 에 Family '${str(a.family)}' 없음 — search_mc_families 로 이름을 확인하거나 다른 fy 로 조회 (자료 있는 회계연도: ${fys.map(fyLabel).join(", ")})` }; } },
  { name: "get_mc_totals", label: "기종(MC) 집계", description: "기종(MC) 전체 집계: 회계연도의 합계, 묶음별 소계(DT/GC 소계 — DT · GC, PRINTER 소계), 실적이 큰 순 Family 목록. 'Family 중 실적이 가장 높은 것', '구분별 실적' 같은 질문에 쓴다",
    parameters: { type: "object", properties: { fy: { type: "integer", description: "회계연도 시작 연도, 예: 2026 = FY26 (없으면 가장 최근)" }, biz: { type: "string", enum: ["DT", "GC", "PRT"], description: "MC 구분 (선택)" }, top: { type: "integer", description: "순위 개수, 기본 10 · 최대 30" } } },
    run: async (sb, a) => { const fys = await fetchMcFys(sb); const fy = fys.includes(Number(a.fy)) ? Number(a.fy) : fys[0]; if (fy == null) return { error: "기종(MC) 자료 없음" };
      const biz = str(a.biz).toUpperCase();
      return { fy: fyLabel(fy), fy_with_data: fys.map(fyLabel), ...mcTotalsOf(await fetchMcOlAct(sb, fy), Number(a.top) || 10, ["DT", "GC", "PRT"].includes(biz) ? biz : undefined) }; } },
  { name: "get_item", label: "품목 상세", description: "품목 마스터·설정·현재고·DoS·분류(ABC-XYZ, 수요패턴)·챔피언 기법", parameters: { type: "object", properties: { code: { type: "string", description: "품목 코드(HOC)" } }, required: ["code"] },
    run: async (sb, a) => { const code = str(a.code); const [m, s] = await Promise.all([sb.schema("analytics").from("v_item_master").select("*").eq("key_code", code).maybeSingle(), sb.schema("app").from("v_item_setting").select("*").eq("item_code", code).maybeSingle()]); return m.data ? { ...m.data, setting: s.data } : { error: `품목 ${code} 없음 (SW 라이선스/미출고 품목은 대상 아님)` }; } },
  { name: "get_item_forecast", label: "품목 예측", description: "품목의 최신 프로덕션 기준예측(월별 값·80% 구간·기법)과 최근 12개월 실제 출고", parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
    run: async (sb, a) => { const code = str(a.code); const [f, h] = await Promise.all([sb.schema("analytics").from("v_forecast_latest").select("ym,method,value,lower,upper").eq("key_code", code).order("ym"), sb.schema("analytics").from("v_item_monthly").select("ym,qty").eq("key_code", code).order("ym", { ascending: false }).limit(12)]); return { forecast: f.data, recent_actual: (h.data ?? []).reverse() }; } },
  { name: "get_available_stock", label: "가용재고", description: "가용재고 = 현재고 − 임시배정 − 확정배정 − 승인대기 확보 (R-INV-03)", parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
    run: async (sb, a) => (await sb.schema("app").from("v_available_stock").select("*").eq("item_code", str(a.code)).maybeSingle()).data ?? { error: "없음" } },
  { name: "get_order_plan", label: "발주 계획", description: "최신 발주 계획 요약(상태·금액·품절위험) 과 특정 품목 라인(필요량·Flex·MOQ·최종 발주량·근거)", parameters: { type: "object", properties: { code: { type: "string", description: "선택: 품목 코드" } } },
    run: async (sb, a) => { const p = (await sb.schema("analytics").from("v_order_plan_summary").select("*").order("plan_ym", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle()).data; if (!p) return { error: "발주 계획 없음" }; const line = a.code ? (await sb.schema("app").from("order_plan_line").select("key_code,need_ym,forecast_need,extras_need,on_hand,inbound_until_need,start_need,target_stock,required_qty,flex_base,flex_min,flex_max,flex_hit,moq,final_qty,override_qty,override_reason,dos_after,stockout_risk,blocked,rationale").eq("plan_id", p.id!).eq("key_code", str(a.code)).maybeSingle()).data : null; return { plan: p, line }; } },
  { name: "get_forecast_accuracy", label: "예측 정확도", description: "최신 백테스트 정확도: 시스템 기준예측 vs Sales OL vs SCM OL (WAPE·Bias), 카테고리별", parameters: { type: "object", properties: {} },
    run: async (sb) => (await sb.schema("analytics").from("v_accuracy_summary").select("level,key,method,wape,bias,n").in("level", ["total", "category", "biz"])).data },
  { name: "get_schedule", label: "발주 일정", description: "향후 발주 캘린더(공급처별 발주일·입고예정)와 다음 달 수요자료 제출 현황", parameters: { type: "object", properties: {} },
    run: async (sb) => { const ym = thisYmKst(), next = nextYmKst(); const [c, s] = await Promise.all([sb.schema("app").rpc("fn_order_calendar", { p_from: ym, p_months: 2 }), sb.schema("app").rpc("fn_submission_status", { p_ym: next })]); return { calendar: c.data, submission: s.data }; } },
];
export const TOOLS: ToolDef[] = [...BASE_TOOLS.map(t => ({ ...t, roles: ALL_ROLES })), ...ROLE_TOOLS];
/** 이 역할의 대화에 넘길 도구 */
export const toolsForRole = (role: Role): ToolDef[] => TOOLS.filter(t => t.roles.includes(role));
/** 이 역할이 볼 수 없는 자료 이름 — 그런 질문에는 추측하지 말고 볼 수 없다고 답하게 한다 */
export const hiddenFor = (role: Role): string[] => TOOLS.filter(t => !t.roles.includes(role)).map(t => t.label);
export const toolSpecs = (role?: Role) => (role ? toolsForRole(role) : TOOLS).map(t => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
/** 도구 결과의 제품군(family)은 실제 이름으로(D-075), 카테고리는 회사 표기로(D-077). 품목코드는 그대로 */
export function withRealNames(out: unknown, names: AliasMap): unknown {
  if (Array.isArray(out)) return out.map(x => withRealNames(x, names));
  if (out && typeof out === "object") return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, typeof v === "string" && k === "family" ? realName(names, "family", v) : typeof v === "string" && k === "category" ? catLabel(v) : withRealNames(v, names)]));
  return out;
}
/** 도구 실행. 역할에 없는 도구는 실행하지 않는다 — DB 의 읽기 권한이 넓어 역할 구분은 여기서 지킨다 (D-081) */
export async function runTool(sb: SB, name: string, args: Record<string, unknown>, ctx: ToolCtx) {
  const t = TOOLS.find(x => x.name === name); if (!t) return { error: `unknown tool ${name}` };
  if (!t.roles.includes(ctx.role)) return { error: `${ROLE_LABEL[ctx.role]} 역할에는 이 자료를 볼 권한이 없습니다 (${name})` };
  try { return withRealNames(await t.run(sb, args, ctx), await fetchAliasMap(sb)); } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
}
