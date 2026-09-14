-- 자동 런 스케줄 (D-041, R-FC-43): 월 1회 백테스트·프로덕션 자동 실행 기록 + 관리자 설정
create table if not exists app.auto_run_log (
  month char(7) primary key, started_at timestamptz default now(), finished_at timestamptz,
  backtest_run_id uuid, production_run_id uuid, summary jsonb, error text
);
comment on table app.auto_run_log is '자동 런 실행 기록 (월 1회). tick 이 auto_run_* 설정을 보고 실행 (D-041)';
alter table app.auto_run_log enable row level security;
drop policy if exists p_read on app.auto_run_log;
create policy p_read on app.auto_run_log for select to authenticated using (true);
grant select on app.auto_run_log to authenticated; grant all on app.auto_run_log to service_role;
insert into app.system_settings(key, value, description) values
 ('auto_run_enabled', 'false', '자동 런 (월 1회 백테스트+프로덕션) 활성화 (D-041, R-FC-43)'),
 ('auto_run_day', '5', '자동 런 실행일 (매월 N일, 1~28)'),
 ('auto_run_hour', '2', '자동 런 실행 시각 (KST, 0~23)'),
 ('auto_run_backtest', 'true', '자동 런에 백테스트 포함 (false 면 프로덕션만)'),
 ('auto_run_tune', 'true', '자동 런 후 AI 오차 분석·조정 제안 생성 (승인은 결재)')
on conflict (key) do nothing;
