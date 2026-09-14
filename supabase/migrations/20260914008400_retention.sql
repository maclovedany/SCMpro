-- 보존 정책 (D-045): 디스크 가득 참 장애(2026-09-14) 재발 방지 — 런 결과·감사 로그 보존 한도, 엔진 병렬도 설정
insert into app.system_settings(key, value, description) values
 ('run_retention', '3', '예측 런 결과 보존 개수 (백테스트/프로덕션 각각 최근 N개, 나머지 결과 삭제) (D-045)'),
 ('audit_retention_days', '90', '감사 로그 보존 일수 — 대량 테이블(계획 라인·예측 결과) 변경 로그는 제외 (D-045)'),
 ('engine_n_jobs', '3', '엔진 병렬 프로세스 수 (DB 부하 제한, D-045)')
on conflict (key) do nothing;
-- 대량 테이블은 감사 트리거 제외 (라인 단위 로그가 264MB 까지 커졌음)
drop trigger if exists trg_audit on app.order_plan_line;
drop trigger if exists trg_audit on app.forecast_result;
drop trigger if exists trg_audit on app.forecast_accuracy;
-- 런 정리 함수 (엔진·tick 에서 호출)
create or replace function app.fn_prune_runs(p_keep int) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare v_del int; v_res int; v_aud int;
begin
  with ranked as (select id, row_number() over (partition by run_type order by finished_at desc nulls last) rn from app.forecast_run where status = 'done'),
  victims as (select id from ranked where rn > greatest(p_keep, 1)
              union select id from app.forecast_run where status = 'failed' and created_at < now() - interval '7 days')
  delete from app.forecast_result where run_id in (select id from victims);
  get diagnostics v_res = row_count;
  with ranked as (select id, row_number() over (partition by run_type order by finished_at desc nulls last) rn from app.forecast_run where status = 'done'),
  victims as (select id from ranked where rn > greatest(p_keep, 1)
              union select id from app.forecast_run where status = 'failed' and created_at < now() - interval '7 days')
  delete from app.forecast_accuracy where run_id in (select id from victims);
  with ranked as (select id, row_number() over (partition by run_type order by finished_at desc nulls last) rn from app.forecast_run where status = 'done'),
  victims as (select id from ranked where rn > greatest(p_keep, 1)
              union select id from app.forecast_run where status = 'failed' and created_at < now() - interval '7 days')
  delete from app.forecast_run r where r.id in (select id from victims) and not exists (select 1 from app.forecast_tuning_proposal p where p.run_id = r.id and p.status in ('pending','requested'));
  get diagnostics v_del = row_count;
  delete from app.audit_log where at < now() - ((select coalesce(value::int, 90) from app.system_settings where key = 'audit_retention_days') || ' days')::interval;
  get diagnostics v_aud = row_count;
  return jsonb_build_object('runs_deleted', v_del, 'results_deleted', v_res, 'audit_deleted', v_aud);
end $$;
grant execute on function app.fn_prune_runs(int) to service_role;
