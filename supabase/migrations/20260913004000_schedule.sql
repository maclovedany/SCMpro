-- ============================================================
-- 20260913004000_schedule.sql — SP5 일정·알림 (R-SCH-*, R-AL-17/30)
-- ============================================================
create table if not exists app.demand_submission (
  id bigserial primary key, dept app.role not null, ym char(7) not null, submitted_by uuid, submitted_at timestamptz default now(), note text, unique (dept, ym)
);
alter table app.demand_submission enable row level security;
drop policy if exists p_read on app.demand_submission; create policy p_read on app.demand_submission for select to authenticated using (true);
drop trigger if exists trg_audit on app.demand_submission; create trigger trg_audit after insert or update or delete on app.demand_submission for each row execute function app.fn_audit();
insert into app.system_settings(key, value, description) values ('submission_depts', '["marketing","sales","service","biz_enable"]', '수요자료 제출 부서 (R-SCH-20)') on conflict (key) do nothing;
update app.supplier set sailing_rule = jsonb_build_object('weekday', 1 + (id % 5), 'weeks', case when id % 2 = 0 then '[1,3]'::jsonb else '[2,4]'::jsonb end) where sailing_rule is null;

-- 영업일 보정: 주말·공휴일이면 이전 영업일 (R-SCH-04)
create or replace function app.fn_business_day(d date) returns date
language plpgsql stable set search_path = app, public as $$
declare x date := d; i int := 0;
begin
  while (extract(isodow from x) in (6, 7) or exists (select 1 from app.holiday h where h.date = x)) and i < 14 loop x := x - 1; i := i + 1; end loop;
  return x;
end $$;

-- 공급처 출항일: 해당 월의 weekday 요일 중 weeks 번째 (1..5)
create or replace function app.fn_sailing_dates(p_rule jsonb, p_ym char(7)) returns setof date
language sql stable as $$
  with days as (select d::date d from generate_series(to_date(p_ym || '-01', 'YYYY-MM-DD'), (to_date(p_ym || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date, '1 day') d),
  wk as (select d, row_number() over (order by d) as nth from days where extract(isodow from d) = coalesce((p_rule->>'weekday')::int, 3))
  select d from wk where nth in (select jsonb_array_elements_text(coalesce(p_rule->'weeks', '[1,3]'::jsonb))::int) $$;

-- 발주 캘린더 (R-SCH-01~05): 출항일 − 준비기간 = 발주일(영업일 보정), 출항일 + 선적 리드타임 = 입고예정(영업일 보정)
create or replace function app.fn_order_calendar(p_from char(7), p_months int) returns table(supplier_id int, supplier_code text, supplier_name text, ym char(7), sailing_date date, order_date date, eta date)
language sql stable security definer set search_path = app, public as $$
  with ms as (select to_char(to_date(p_from || '-01', 'YYYY-MM-DD') + (g || ' months')::interval, 'YYYY-MM') ym from generate_series(0, greatest(p_months, 1) - 1) g),
  lead as (select coalesce((value)::int, 7) v from app.system_settings where key = 'ship_lead_days')
  select s.id, s.code, s.name, ms.ym::char(7), sd,
         app.fn_business_day(sd - s.prep_days) as order_date,
         app.fn_business_day(sd + (select v from lead)) as eta
  from app.supplier s cross join ms cross join lateral app.fn_sailing_dates(coalesce(s.sailing_rule, '{"weekday":3,"weeks":[1,3]}'::jsonb), ms.ym::char(7)) sd
  order by s.code, sd $$;

-- 제출 마감 = 전월 말일 − 1 (R-SCH-20). 대상 월 p_ym 의 수요자료는 (p_ym − 1개월) 말일 −1 까지
create or replace function app.fn_submission_deadline(p_ym char(7)) returns date
language sql immutable as $$ select (to_date(p_ym || '-01', 'YYYY-MM-DD') - 2)::date $$;

create or replace function app.fn_submission_status(p_ym char(7)) returns jsonb
language sql stable security definer set search_path = app, public as $$
  select jsonb_build_object('ym', p_ym, 'deadline', app.fn_submission_deadline(p_ym), 'overdue', current_date > app.fn_submission_deadline(p_ym),
    'depts', (select jsonb_agg(jsonb_build_object('dept', d, 'submitted', s.submitted_at is not null, 'submitted_at', s.submitted_at, 'by', p.name) order by d)
              from jsonb_array_elements_text((select value from app.system_settings where key = 'submission_depts')) d
              left join app.demand_submission s on s.dept = d::app.role and s.ym = p_ym left join app.profiles p on p.user_id = s.submitted_by)) $$;

create or replace function app.fn_submit_demand(p_ym char(7), p_dept text, p_note text) returns void
language plpgsql security definer set search_path = app, public as $$
declare r app.role := app.current_role();
begin
  if r is null then raise exception 'AUTH_REQUIRED'; end if;
  if r::text <> p_dept and r not in ('admin','item_manager','scm_lead') then raise exception 'FORBIDDEN'; end if;
  insert into app.demand_submission(dept, ym, submitted_by, note) values (p_dept::app.role, p_ym, auth.uid(), p_note)
  on conflict (dept, ym) do update set submitted_by = auth.uid(), submitted_at = now(), note = p_note;
end $$;

-- 미제출 부서 10분 반복 알림 (R-SCH-21): 마감 경과한 다음 달분
create or replace function app.fn_submission_reminder_tick() returns int
language plpgsql security definer set search_path = app, public as $$
declare ym char(7) := to_char(date_trunc('month', current_date) + interval '1 month', 'YYYY-MM'); d text; n int := 0; iv int;
begin
  iv := coalesce((select (value)::int from app.system_settings where key = 'reminder_interval_min'), 10);
  if current_date <= app.fn_submission_deadline(ym) then return 0; end if;
  for d in select jsonb_array_elements_text(value) from app.system_settings where key = 'submission_depts' loop
    if not exists (select 1 from app.demand_submission s where s.dept = d::app.role and s.ym = ym)
       and not exists (select 1 from app.notification x where x.kind = 'submission_reminder' and x.payload->>'ym' = ym and x.payload->>'dept' = d and x.created_at > now() - (iv || ' minutes')::interval) then
      perform app.notify_role(d::app.role, 'submission_reminder', format('[반복] %s 수요자료 미제출 — 마감 %s', ym, app.fn_submission_deadline(ym)), '제출 완료 시까지 ' || iv || '분마다 알림됩니다 (R-SCH-21)', jsonb_build_object('ym', ym, 'dept', d));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- 이메일 채널 복제 (R-SCH-30, D-017): system 알림 생성 시 email 행 추가 (발송은 engine notify)
create or replace function app.fn_notification_email_copy() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  if new.channel = 'system' then
    insert into app.notification(recipient, channel, kind, title, body, payload, created_at)
    values (new.recipient, 'email', new.kind, new.title, new.body, coalesce(new.payload, '{}'::jsonb) || jsonb_build_object('system_notification_id', new.id), new.created_at);
  end if;
  return new;
end $$;
drop trigger if exists trg_email_copy on app.notification;
create trigger trg_email_copy after insert on app.notification for each row execute function app.fn_notification_email_copy();
create index if not exists ix_notification_email_pending on app.notification(channel, sent_at) where channel = 'email' and sent_at is null;

-- 통합 tick (pg_cron 10분)
create or replace function app.fn_tick() returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare a jsonb; s int;
begin
  a := app.fn_allocation_tick(); s := app.fn_submission_reminder_tick();
  return a || jsonb_build_object('submission_reminders', s);
end $$;

-- 입고 차이 (R-SCH-10/11): 조기/지연 구분 없이 diff 하나
create or replace view analytics.v_inbound_gap as
select i.id, i.item_code, i.supplier_id, s.code as supplier_code, s.name as supplier_name, i.po_no, i.qty, i.planned_date, i.actual_date,
       (i.actual_date - i.planned_date) as diff_days, to_char(i.actual_date, 'YYYY-MM') as ym, d.item_type
from app.inbound i left join app.supplier s on s.id = i.supplier_id left join raw.dim_item d on d.item_code = i.item_code
where i.status = 'received' and i.actual_date is not null;
create or replace view analytics.v_inbound_gap_summary as
select supplier_code, ym, count(*) n, round(avg(diff_days), 1) avg_diff, min(diff_days) min_diff, max(diff_days) max_diff, round(stddev_samp(diff_days), 1) sd_diff
from analytics.v_inbound_gap group by 1, 2;

-- pg_cron (Supabase 확장). 권한 없으면 무시하고 engine tick 사용
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule('scm-tick') where exists (select 1 from cron.job where jobname = 'scm-tick');
  perform cron.schedule('scm-tick', '*/10 * * * *', 'select app.fn_tick()');
exception when others then raise notice 'pg_cron 미사용: %', sqlerrm; end $$;
