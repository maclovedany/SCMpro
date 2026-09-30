-- 업무 날짜 = 한국 시간 (D-082)
-- DB 기본 시간대가 UTC 라 current_date · date_trunc · to_char(now()) · timestamptz::date 가 한국 오전 9시 전에는 하루 전 날짜(월초에는 이전 달)를 돌려줬다.
-- 함수·뷰를 하나씩 고치지 않고 DB 기본 시간대를 바꾼다 — 날짜를 쓰는 함수 14개·뷰 5개와 앞으로 만들 것까지 한 번에 같은 기준이 된다.
-- 저장된 시각(timestamptz)은 절대 시각이라 값이 바뀌지 않는다. 보이는 표기만 +09:00 이 된다. timestamp(시간대 없음) 열은 app/raw/core/analytics 에 없다.
-- 이미 열려 있는 연결은 이전 시간대를 유지한다 — 적용 뒤 새 연결부터 반영 (docs/10-operations.md).
-- pg_cron 의 일정(cron.timezone)은 별개 설정이라 그대로다.
do $$ begin execute format('alter database %I set timezone to %L', current_database(), 'Asia/Seoul'); end $$;
