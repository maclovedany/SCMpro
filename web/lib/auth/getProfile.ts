import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Role } from "./roles";
import { withRetry } from "@/lib/supabase/retry";
export type Profile = { user_id: string; email: string | null; name: string | null; role: Role; dept: string | null };
/** 요청당 1회 캐시 (layout + page 에서 중복 호출 방지) */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await withRetry(() => sb.schema("app").from("profiles").select("user_id,email,name,role,dept").eq("user_id", user.id).single());
  return (data as Profile | null) ?? null;
});
