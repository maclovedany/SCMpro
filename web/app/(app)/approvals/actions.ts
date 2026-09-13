"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canApprove } from "@/lib/auth/roles";
import { validateDecision } from "@/lib/queries/approvals";
type R = { ok: true } | { ok: false; error: string };
const MSG: Record<string, string> = { FORBIDDEN: "승인 권한이 없습니다", ALREADY_DECIDED: "이미 처리된 요청입니다", COMMENT_REQUIRED: "반려 사유를 입력하세요", NOT_FOUND: "요청을 찾을 수 없습니다" };
export async function decideApproval(id: string, decision: "approved" | "rejected", comment: string): Promise<R> {
  const p = await getProfile(); if (!p || !canApprove(p.role)) return { ok: false, error: "승인 권한이 없습니다" };
  const v = validateDecision(decision, comment); if (!v.ok) return v;
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").rpc("fn_decide_approval", { p_id: id, p_decision: decision, p_comment: comment });
  if (error) { const key = Object.keys(MSG).find(k => error.message.includes(k)); return { ok: false, error: key ? MSG[key] : error.message }; }
  revalidatePath("/approvals"); revalidatePath("/admin/item-settings"); revalidatePath("/items"); return { ok: true };
}
export async function markRead(ids: number[]): Promise<R> {
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").rpc("fn_mark_read", { p_ids: ids });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications"); revalidatePath("/", "layout"); return { ok: true };
}
