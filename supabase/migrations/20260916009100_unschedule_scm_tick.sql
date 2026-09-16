-- pg_cron `scm-tick` 해제 (D-057). fn_tick 은 Railway Cron 의 `engine tick` 이 10분마다 호출한다 (D-049) —
-- pg_cron 과 동시에 두면 10분마다 두 번 돌고(9/14~16 349회 확인), 정각 동시 발화 시 알림 `not exists` 가드에 경합 창이 생긴다.
-- `scm-refresh`(물리화 뷰 매분 갱신, fn_refresh_if_requested) 는 Railway tick 이 하지 않으므로 유지한다.
-- 004000_schedule.sql 이 재실행마다 scm-tick 을 다시 등록하므로, 이 파일이 항상 그 뒤에 와서 해제한다 (재실행 안전).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('scm-tick') where exists (select 1 from cron.job where jobname = 'scm-tick');
  end if;
end $$;
