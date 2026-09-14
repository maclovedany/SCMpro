-- 웹 "AI 오차 분석 요청" (D-052): queued 제안 행 생성. 테이블 쓰기 정책 대신 역할 검사 RPC
create or replace function app.fn_request_tuning(p_run_id uuid) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare v_role app.role := app.current_role(); v_id uuid; v_model text;
begin
  if v_role is null or v_role not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from app.forecast_run where id = p_run_id and run_type = 'backtest' and status = 'done') then raise exception 'RUN_NOT_DONE'; end if;
  if exists (select 1 from app.forecast_tuning_proposal where run_id = p_run_id and status = 'queued') then raise exception 'ALREADY_QUEUED'; end if;
  v_model := coalesce((select value #>> '{}' from app.system_settings where key = 'ai_model'), 'gpt-5-nano');
  insert into app.forecast_tuning_proposal(run_id, model, status) values (p_run_id, v_model, 'queued') returning id into v_id;
  return v_id;
end $$;
grant execute on function app.fn_request_tuning(uuid) to authenticated;
