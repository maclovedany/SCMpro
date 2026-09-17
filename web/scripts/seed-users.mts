// 실행: cd web && npm run seed:users   (SEED_USER_PASSWORD 없으면 'Scm!2026test')
// 실사용 계정 7개 (2026-09-13 사용자 지정, 09-17 품목담당자 추가). 기존 *@scm.test 테스트 계정은 삭제.
// SEED_ONLY=이메일 을 주면 그 계정만 만들거나 갱신한다 — 다른 사람 비밀번호를 건드리지 않고 한 명만 추가할 때
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const pw = process.env.SEED_USER_PASSWORD ?? "1q2w3e";
const users = [
  { email: "insightdany@naver.com", name: "insightdany", dept: "SCM", title: "SCM_PLANNER", role: "admin" },
  { email: "insightcha@daum.net", name: "SCM 품목담당자", dept: "SCM", title: "ITEM_MANAGER", role: "item_manager" },   // 2026-09-17 추가 — 확정·요청(품목담당)과 승인(팀장)을 분리
  { email: "upflash@naver.com", name: "SCM팀장", dept: "SCM", title: "SCM_LEAD", role: "scm_lead" },
  { email: "insightcha0624@gmail.com", name: "영업담당자", dept: "SALES", title: "SALES_REP", role: "sales" },
  { email: "pro-worker@daum.net", name: "사업강화부", dept: "BIZ_DEV", title: "BIZ_DEV", role: "biz_enable" },
  { email: "alltest@nate.com", name: "마케팅부", dept: "MARKETING", title: "MARKETING", role: "marketing" },
  { email: "imagineworld@kakao.com", name: "서비스부", dept: "SERVICE", title: "SERVICE", role: "service" },
];
const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
for (const u of existing?.users ?? []) if (u.email?.endsWith("@scm.test")) { await admin.auth.admin.deleteUser(u.id); console.log("deleted", u.email); }
const only = process.env.SEED_ONLY?.trim();
for (const u of users.filter(x => !only || x.email === only)) {
  const found = existing?.users.find(x => x.email === u.email);
  const { data, error } = found
    ? await admin.auth.admin.updateUserById(found.id, { password: pw, email_confirm: true, user_metadata: { name: u.name, role: u.role } })
    : await admin.auth.admin.createUser({ email: u.email, password: pw, email_confirm: true, user_metadata: { name: u.name, role: u.role } });
  if (error) throw error;
  const id = data.user!.id;
  await admin.schema("app").from("profiles").upsert({ user_id: id, email: u.email, name: u.name, role: u.role as never, dept: `${u.dept} / ${u.title}` });
  console.log(u.email, u.role, found ? "(updated)" : "(created)");
}
