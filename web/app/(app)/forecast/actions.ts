"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canUpload, canWriteMaster } from "@/lib/auth/roles";
type R = { ok: true; id?: string } | { ok: false; error: string };
export async function requestRun(runType: "backtest" | "production", evalFy?: number, horizon?: number): Promise<R> {
  const p = await getProfile(); if (!p || !canUpload(p.role)) return { ok: false, error: "권한이 없습니다" };
  const sb = await createServerSupabase();
  const { data, error } = await sb.schema("app").rpc("fn_request_forecast_run", { p_run_type: runType, p_eval_fy: evalFy ?? null as never, p_horizon: horizon ?? null as never });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/forecast/runs"); return { ok: true, id: data as string };
}
export async function requestTuningApproval(proposalId: string, reason: string): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  if (!reason.trim()) return { ok: false, error: "사유를 입력하세요" };
  const sb = await createServerSupabase();
  const { data, error } = await sb.schema("app").rpc("fn_request_tuning_approval", { p_proposal_id: proposalId, p_reason: reason });
  if (error) return { ok: false, error: error.message.includes("ALREADY_PENDING") ? "이미 승인 대기 중입니다" : error.message };
  revalidatePath("/forecast/runs"); revalidatePath("/approvals"); return { ok: true, id: data as string };
}
/** AI 오차 분석 요청 (D-052): RPC 가 queued 행을 만들고 엔진 tick 이 10분 내 채운다 */
export async function requestTuning(runId: string): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  const sb = await createServerSupabase();
  const { data, error } = await sb.schema("app").rpc("fn_request_tuning", { p_run_id: runId });
  if (error) return { ok: false, error: error.message.includes("ALREADY_QUEUED") ? "이미 분석 대기 중입니다" : error.message.includes("RUN_NOT_DONE") ? "완료된 백테스트 런에서만 요청할 수 있습니다" : error.message };
  revalidatePath(`/forecast/runs/${runId}`); return { ok: true, id: data as string };
}
export async function toggleMethod(key: string, enabled: boolean): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").from("forecast_method").update({ enabled, updated_by: p.user_id, updated_at: new Date().toISOString() }).eq("key", key).eq("is_baseline", false);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/forecast-methods"); return { ok: true };
}
export async function updateMethodParams(key: string, paramsJson: string): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  let params: unknown; try { params = JSON.parse(paramsJson); if (typeof params !== "object" || params === null || Array.isArray(params)) throw new Error(); } catch { return { ok: false, error: "params 는 JSON 객체여야 합니다" }; }
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").from("forecast_method").update({ params: params as never, updated_by: p.user_id, updated_at: new Date().toISOString() }).eq("key", key);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/forecast-methods"); return { ok: true };
}
export async function updatePolicy(cell: string, methods: string[]): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  if (!methods.includes("baseline6")) methods = ["baseline6", ...methods];
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").from("forecast_policy").update({ methods, updated_by: p.user_id, updated_at: new Date().toISOString() }).eq("cell", cell);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/forecast-methods"); return { ok: true };
}
