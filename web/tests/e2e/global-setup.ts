import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
/** e2e 픽스처 리셋 (D-036): 이전 실행이 남긴 E2E 주문·배정을 정리하고, 배정 시나리오가 쓰는 더미 입고(556K59129, seed)를 다시 '입고 대기'로 되돌린다.
 *  engine/.env 의 SUPABASE_DB_URL + psql 이 있을 때만 동작 — 없으면 경고 후 건너뜀 (UI 만으로는 소진된 픽스처를 복구할 수 없음) */
export default async function globalSetup() {
  const envPath = resolve(__dirname, "../../../engine/.env");
  if (!existsSync(envPath)) { console.warn("[e2e] engine/.env 없음 — 픽스처 리셋 건너뜀"); return; }
  const url = readFileSync(envPath, "utf8").split("\n").map(l => l.trim()).find(l => l.startsWith("SUPABASE_DB_URL="))?.slice("SUPABASE_DB_URL=".length).replace(/^["']|["']$/g, "");
  if (!url) { console.warn("[e2e] SUPABASE_DB_URL 없음 — 픽스처 리셋 건너뜀"); return; }
  const sql = `
    update app.allocation set released_at = now(), release_reason = 'e2e reset' where released_at is null
      and order_id in (select id from app.sales_order where customer like 'E2E%' and status not in ('cancelled','rejected','expired'));
    update app.sales_order set status = 'cancelled', cancel_reason = 'e2e reset', decided_at = now() where customer like 'E2E%' and status not in ('cancelled','rejected','expired');
    update app.inbound set status = 'ordered', actual_date = null where item_code = '556K59129' and is_dummy and source = 'seed';
    delete from app.mc_plan_extra where model_base like 'E2E%';
    delete from app.shipment_extra where ym between '2022-01' and '2022-06' and item_code in ('556K59129','041K90296','EC136270') and source = 'upload';   -- upload-wide 픽스처 (학습 구간 오염 방지)
    update app.approval set status = 'rejected', comment = 'e2e reset', decided_at = now() where kind = 'agent_order' and status = 'pending';
    delete from app.extra_demand where reason like 'AI 감시 제안 승인%';
    delete from app.agent_event;
    delete from app.notification where kind in ('agent_digest') and created_at < now() - interval '1 hour';
    select app.fn_request_refresh();
    select (select count(*) from app.sales_order where customer like 'E2E%' and status = 'cancelled') as cancelled_e2e, (select count(*) from app.inbound where item_code = '556K59129' and status <> 'received') as open_inbound;`;
  try { const out = execFileSync("psql", [url, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" }); console.log("[e2e] 픽스처 리셋:", out.trim().split("\n").pop()); }
  catch (e) { const err = e as { stderr?: string; code?: string }; console.warn("[e2e] 픽스처 리셋 실패 (psql 필요):", err.code ?? "", (err.stderr ?? "").trim().split("\n").slice(-2).join(" ")); }   // 접속 문자열(비밀번호)은 절대 출력하지 않는다
}
