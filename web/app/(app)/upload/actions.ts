"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/getProfile";
import { canUpload } from "@/lib/auth/roles";
import { UPLOAD_TARGETS, type TargetKey } from "@/lib/upload/templates";
export type ApplyResult = { ok: true; upload_id: string; ok_count: number; error_count: number; errors: { row: number; message: string }[] } | { ok: false; error: string };
const CHUNK = 2000;
/** fn_apply_upload 호출 (청크 단위) → shipment_extra 면 물리화 뷰 갱신 */
export async function applyUpload(target: TargetKey, rows: Record<string, unknown>[], fileName: string): Promise<ApplyResult> {
  const p = await getProfile(); if (!p || !canUpload(p.role)) return { ok: false, error: "업로드 권한이 없습니다" };
  if (!(target in UPLOAD_TARGETS)) return { ok: false, error: "잘못된 대상" };
  if (rows.length === 0) return { ok: false, error: "반영할 행이 없습니다" };
  const sb = await createServerSupabase();
  let okc = 0, errc = 0; const errors: { row: number; message: string }[] = []; let uploadId = "";
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await sb.schema("app").rpc("fn_apply_upload", { p_target: target, p_rows: chunk as never, p_mode: i === 0 ? UPLOAD_TARGETS[target].mode : "upsert", p_file_name: fileName });
    if (error) return { ok: false, error: error.message };
    const d = data as { upload_id: string; ok_count: number; error_count: number; errors: { row: number; message: string }[] };
    okc += d.ok_count; errc += d.error_count; uploadId = d.upload_id;
    errors.push(...d.errors.map(e => ({ row: e.row + i, message: e.message })));
  }
  if (target === "shipment_extra") {   // 물리화 뷰 재계산은 8초 제한을 넘기므로 플래그만 세움 → pg_cron 이 1분 내 DB 안에서 갱신 (D-030)
    await createAdminClient().schema("app").rpc("fn_request_refresh");
  }
  revalidatePath("/items"); revalidatePath("/dashboard"); revalidatePath("/upload");
  return { ok: true, upload_id: uploadId, ok_count: okc, error_count: errc, errors };
}
