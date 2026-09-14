"use server";
import { createServerSupabase } from "@/lib/supabase/server";
/** AI 감시 이벤트 피드백 (유용함 / 불필요) — R-AI-14 */
export async function agentFeedback(id: string, feedback: "useful" | "not_useful"): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").rpc("fn_agent_feedback", { p_id: id, p_feedback: feedback });
  return error ? { ok: false, error: error.message } : { ok: true };
}
