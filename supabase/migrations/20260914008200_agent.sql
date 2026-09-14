-- 자율 모드 — AI 감시 파이프라인 (D-042, R-AI-10~15): 감지(SQL) → 판단(LLM/규칙) → 행동(알림·발주 제안 승인) → 기록·피드백
alter type app.approval_kind add value if not exists 'agent_order';

create table if not exists app.agent_event (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                     -- signal:item_code | signal:supplier
  signal text not null, item_code text, category text, supplier text, severity int,
  status text not null default 'open' check (status in ('open','notified','proposed','accepted','dismissed','resolved')),
  first_seen timestamptz not null default now(), last_seen timestamptz not null default now(),
  last_notified_at timestamptz, notified_count int not null default 0,
  evidence jsonb, judgment jsonb, approval_id uuid,
  feedback text check (feedback in ('useful','not_useful')), feedback_by uuid, feedback_at timestamptz, resolved_at timestamptz
);
create index if not exists ix_agent_event_status on app.agent_event(status, severity desc, last_seen desc);
comment on table app.agent_event is 'AI 감시 이벤트 (D-042): 신호별 1행, 쿨다운·피드백·승인 연결';
alter table app.agent_event enable row level security;
drop policy if exists p_read on app.agent_event;
create policy p_read on app.agent_event for select to authenticated using (true);
grant select on app.agent_event to authenticated; grant all on app.agent_event to service_role;

insert into app.system_settings(key, value, description) values
 ('agent_mode', '"off"', 'AI 감시 자율 모드: off / dryrun(기록만) / notify(알림) / propose(알림+발주 제안 승인 요청) (D-042)'),
 ('agent_dos_ratio', '50', '재고 부족 신호: DoS < 목표 DoS × N% (R-AI-11)'),
 ('agent_lead_days', '7', '리드타임 임박 신호: 다음 발주일 D-N 이내인데 계획 미승인 (R-AI-11)'),
 ('agent_surge_pct', '50', '수요 급증 신호: 최근 월 출고 > 6개월 평균 × (1+N%) (R-AI-11)'),
 ('agent_cooldown_hours', '24', '같은 신호 재알림 간격 (시간) (R-AI-13)'),
 ('agent_max_per_tick', '30', '한 번의 주기 작업에서 판단·알림하는 최대 건수 (R-AI-13)')
on conflict (key) do nothing;

-- 감지 (결정론적 SQL). 임계값은 설정에서 인자로
create or replace function app.fn_agent_signals(p_dos_ratio numeric, p_lead_days int, p_surge_pct numeric) returns jsonb
language sql stable security definer set search_path = app, analytics, public as $$
  with plan as (select id, plan_ym from app.order_plan order by created_at desc limit 1),
  stockout as (
    select jsonb_build_object('signal', 'stockout', 'item_code', l.key_code, 'category', l.category,
             'evidence', jsonb_build_object('plan_ym', (select plan_ym from plan), 'need_ym', l.need_ym, 'on_hand', l.on_hand, 'inbound', l.inbound_until_need,
               'forecast_need', l.forecast_need, 'extras', l.extras_need, 'start_need', l.start_need, 'end_after', l.end_after, 'dos_after', l.dos_after,
               'final_qty', coalesce(l.override_qty, l.final_qty), 'moq', l.moq, 'abc', c.abc, 'amount', l.amount, 'unit_price', l.unit_price,
               'shortage', greatest(0, ceil(coalesce(l.forecast_need, 0) + coalesce(l.extras_need, 0) - coalesce(l.start_need, 0) - coalesce(l.override_qty, l.final_qty, 0))))) j,
           coalesce(l.amount, 0) rank
    from app.order_plan_line l left join app.item_class c on c.key_code = l.key_code
    where l.plan_id = (select id from plan) and (l.stockout_risk or coalesce(l.end_after, 0) < 0) order by rank desc limit 100),
  low_dos as (
    select jsonb_build_object('signal', 'low_dos', 'item_code', m.key_code, 'category', m.category,
             'evidence', jsonb_build_object('on_hand', m.on_hand, 'avg_6m', round(m.avg_6m, 1), 'dos_days', m.dos_days, 'target_dos_days', m.target_dos_days, 'inbound_qty', m.inbound_qty, 'abc', m.abc, 'moq', m.moq,
               'shortage', greatest(0, ceil((m.target_dos_days - coalesce(m.dos_days, 0)) / 30.0 * m.avg_6m - coalesce(m.inbound_qty, 0))))) j,
           coalesce(m.avg_6m, 0) rank
    from analytics.v_item_master m
    where m.category <> 'SW' and m.target_dos_days > 0 and m.avg_6m > 0 and m.dos_days is not null
      and m.dos_days < m.target_dos_days * (p_dos_ratio / 100.0) and coalesce(m.inbound_qty, 0) < m.avg_6m order by rank desc limit 100),
  inbound_delay as (
    select jsonb_build_object('signal', 'inbound_delay', 'item_code', i.item_code, 'category', d.item_type,
             'evidence', jsonb_build_object('po_no', i.po_no, 'supplier', sp.name, 'qty', i.qty, 'planned_date', i.planned_date, 'days_late', current_date - i.planned_date, 'status', i.status)) j,
           (current_date - i.planned_date)::numeric rank
    from app.inbound i left join app.supplier sp on sp.id = i.supplier_id left join raw.dim_item d on d.item_code = i.item_code
    where i.status <> 'received' and i.planned_date < current_date order by rank desc limit 100),
  lead_imminent as (
    select jsonb_build_object('signal', 'lead_imminent', 'item_code', null, 'category', null, 'supplier', c.supplier_code,
             'evidence', jsonb_build_object('supplier', c.supplier_name, 'order_date', c.order_date, 'days_left', c.order_date - current_date, 'plan_ym', c.ym,
               'plan_status', (select p.status::text from app.order_plan p where p.plan_ym = c.ym order by p.created_at desc limit 1))) j, 0::numeric rank
    from app.fn_order_calendar(to_char(current_date, 'YYYY-MM')::char(7), 2) c
    where c.order_date >= current_date and c.order_date - current_date <= p_lead_days
      and not exists (select 1 from app.order_plan p where p.plan_ym = c.ym and p.status = 'approved')),
  surge as (
    with lastm as (select max(ym) ym from analytics.v_item_monthly where qty > 0)
    select jsonb_build_object('signal', 'demand_surge', 'item_code', v.key_code, 'category', v.category,
             'evidence', jsonb_build_object('ym', v.ym, 'actual', v.qty, 'avg_6m', round(m.avg_6m, 1), 'ratio', round(v.qty / nullif(m.avg_6m, 0), 2), 'abc', m.abc)) j, v.qty rank
    from analytics.v_item_monthly v join lastm on v.ym = lastm.ym join analytics.v_item_master m on m.key_code = v.key_code
    where v.category <> 'SW' and m.avg_6m > 0 and v.qty >= 10 and v.qty > m.avg_6m * (1 + p_surge_pct / 100.0) order by v.qty desc limit 50)
  select coalesce(jsonb_agg(j), '[]'::jsonb) from (
    select j from stockout union all select j from low_dos union all select j from inbound_delay union all select j from lead_imminent union all select j from surge) x $$;
alter function app.fn_agent_signals(numeric, int, numeric) set plan_cache_mode = force_custom_plan;
grant execute on function app.fn_agent_signals(numeric, int, numeric) to service_role, authenticated;

-- 피드백 (유용함 / 불필요) — 누구나 자기 판단으로
create or replace function app.fn_agent_feedback(p_id uuid, p_feedback text) returns void
language sql security definer set search_path = app, public as $$
  update app.agent_event set feedback = p_feedback, feedback_by = auth.uid(), feedback_at = now() where id = p_id $$;
grant execute on function app.fn_agent_feedback(uuid, text) to authenticated;

-- 발주 제안 승인/반려 → 추가수요 반영 / 이벤트 상태 (fn_decide_approval 의 update 에 트리거)
create or replace function app.fn_agent_order_decided() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  if new.kind = 'agent_order' and old.status = 'pending' and new.status <> 'pending' then
    if new.status = 'approved' then
      insert into app.extra_demand(kind, item_code, need_ym, qty, reason, status, created_by, approval_id)
      values ('meeting_approval', new.payload->>'item_code', (new.payload->>'need_ym')::char(7), (new.payload->>'qty')::numeric,
              'AI 감시 제안 승인: ' || coalesce(new.payload->>'reason', ''), 'approved', coalesce(auth.uid(), new.approver, new.requested_by), new.id);
      update app.agent_event set status = 'accepted' where id = new.target_pk::uuid;
    else
      update app.agent_event set status = 'dismissed' where id = new.target_pk::uuid;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_agent_order_decided on app.approval;
create trigger trg_agent_order_decided after update of status on app.approval for each row execute function app.fn_agent_order_decided();

-- 통계 (채택률·오탐률)
create or replace function app.fn_agent_stats(p_days int) returns jsonb
language sql stable security definer set search_path = app, public as $$
  with e as (select * from app.agent_event where last_seen > now() - (p_days || ' days')::interval)
  select jsonb_build_object(
    'open', (select count(*) from e where status in ('open','notified')),
    'proposed', (select count(*) from e where status = 'proposed'),
    'accepted', (select count(*) from e where status = 'accepted'),
    'dismissed', (select count(*) from e where status = 'dismissed'),
    'resolved', (select count(*) from e where status = 'resolved'),
    'useful', (select count(*) from e where feedback = 'useful'),
    'not_useful', (select count(*) from e where feedback = 'not_useful'),
    'by_signal', coalesce((select jsonb_agg(jsonb_build_object('signal', signal, 'n', n) order by n desc) from (select signal, count(*) n from e group by 1) s), '[]'::jsonb),
    'severe', (select count(*) from e where severity >= 3 and status in ('open','notified','proposed'))) $$;
alter function app.fn_agent_stats(int) set plan_cache_mode = force_custom_plan;
grant execute on function app.fn_agent_stats(int) to authenticated;
