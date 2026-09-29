/** 평가용 접속: web/.env.local 의 키로 역할별 계정에 로그인한다 (계정은 scripts/seed-users.mts) */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { Role } from "@/lib/auth/roles";
import type { ToolCtx } from "@/lib/ai/toolTypes";
export const ENV = Object.fromEntries(fs.readFileSync(path.resolve(__dirname, "../../.env.local"), "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
  .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]));
export const ACCOUNTS: Record<Role, string> = { admin: "insightdany@naver.com", item_manager: "insightcha@daum.net", scm_lead: "upflash@naver.com", sales: "insightcha0624@gmail.com", biz_enable: "pro-worker@daum.net", marketing: "alltest@nate.com", service: "imagineworld@kakao.com" };
export const ROLES = Object.keys(ACCOUNTS) as Role[];
export async function signIn(role: Role) {
  const sb = createClient<Database>(ENV.NEXT_PUBLIC_SUPABASE_URL, ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: ACCOUNTS[role], password: process.env.E2E_PASSWORD ?? "1q2w3e" }); if (error) throw error;
  const p = (await sb.schema("app").from("profiles").select("user_id,name,role,dept").eq("user_id", data.user!.id).single()).data!;
  if (p.role !== role) throw new Error(`${ACCOUNTS[role]} 의 역할이 ${p.role} (기대 ${role})`);
  return { sb, ctx: { role, userId: p.user_id, dept: p.dept, name: p.name } as ToolCtx };
}
