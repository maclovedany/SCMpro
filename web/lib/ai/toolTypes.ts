/** AI Agent 도구의 형태 (R-AI-05 · R-AI-09, D-081). 도구는 조회만 한다 — 데이터를 바꾸는 도구는 두지 않는다 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { Role } from "@/lib/auth/roles";
export type SB = SupabaseClient<Database>;
/** 질문한 사용자 — 도구를 고르고(역할) "내 것"을 거르는 데 쓴다 */
export type ToolCtx = { role: Role; userId: string; dept: string | null; name: string | null };
/** label = 사람이 읽는 자료 이름 — 이 역할이 볼 수 없는 자료를 안내할 때 쓴다 */
export type ToolDef = { name: string; label: string; description: string; parameters: Record<string, unknown>; roles: readonly Role[]; run: (sb: SB, args: Record<string, unknown>, ctx: ToolCtx) => Promise<unknown> };
export const ALL_ROLES: readonly Role[] = ["item_manager", "scm_lead", "sales", "marketing", "service", "biz_enable", "admin"];
export const SCM_ROLES: readonly Role[] = ["item_manager", "scm_lead", "admin"];
export const str = (v: unknown) => String(v ?? "").trim();
export const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
export const topN = (v: unknown, def = 10, max = 30) => Math.max(1, Math.min(max, Number(v) || def));
export const obj = (properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: "object", properties, ...(required.length ? { required } : {}) });
