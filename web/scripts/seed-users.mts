// 실행: cd web && npx tsx scripts/seed-users.ts   (SEED_USER_PASSWORD 없으면 'Scm!2026test')
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const pw = process.env.SEED_USER_PASSWORD ?? "Scm!2026test";
const users = [
  { email: "admin@scm.test", name: "관리자", role: "admin" },
  { email: "lead@scm.test", name: "SCM팀장", role: "scm_lead" },
  { email: "manager@scm.test", name: "품목담당자", role: "item_manager" },
  { email: "sales@scm.test", name: "영업담당", role: "sales" },
  { email: "biz@scm.test", name: "사업강화", role: "biz_enable" },
];
for (const u of users) {
  const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: pw, email_confirm: true, user_metadata: { name: u.name, role: u.role } });
  if (error && !/already|exists/i.test(error.message)) throw error;
  console.log(u.email, data?.user?.id ?? "(exists)");
}
