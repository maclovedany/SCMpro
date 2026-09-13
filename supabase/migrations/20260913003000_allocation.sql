-- ============================================================
-- 20260913003000_allocation.sql — SP4 주문·배정 (stage1 §2, R-AL-*)
-- ============================================================
do $$ begin create type app.so_status as enum ('review_requested','partial','waiting','confirmed','rejected','cancelled','expired');
exception when duplicate_object then null; end $$;
do $$ begin create type app.alloc_kind as enum ('temp','firm','hold');
exception when duplicate_object then null; end $$;
do $$ begin create type app.alloc_mode_choice as enum ('partial','wait');
exception when duplicate_object then null; end $$;
insert into app.system_settings(key, value, description) values
 ('temp_alloc_days', '30', '임시배정 유효기간 (R-AL-01)'), ('expiry_reminder_days', '[10,5,3,2,1]', '만료 예고 알림 (R-AL-30)')
on conflict (key) do nothing;

create sequence if not exists app.sales_order_seq;
create table if not exists app.sales_order (
  id uuid primary key default gen_random_uuid(), order_no text not null unique default ('SO-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('app.sales_order_seq')::text, 5, '0')),
  item_code text not null, qty numeric not null check (qty > 0), customer text, sales_rep uuid not null,
  status app.so_status not null default 'review_requested', alloc_mode app.alloc_mode_choice not null default 'partial', priority int not null default 100,
  requested_at timestamptz not null default now(), expires_at timestamptz, confirmed_at timestamptz, decided_at timestamptz, cancel_reason text, prev_order_id uuid, note text
);
create index if not exists ix_so_item_status on app.sales_order(item_code, status, priority, requested_at);
create table if not exists app.allocation (
  id bigserial primary key, order_id uuid not null references app.sales_order(id), item_code text not null, qty numeric not null check (qty > 0),
  kind app.alloc_kind not null, created_at timestamptz default now(), expires_at timestamptz, released_at timestamptz, release_reason text, approval_id uuid, created_by uuid
);
create index if not exists ix_alloc_item_active on app.allocation(item_code) where released_at is null;
do $$ declare t text; begin
  foreach t in array array['sales_order','allocation'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('drop policy if exists p_read on app.%I', t);
    execute format('create policy p_read on app.%I for select to authenticated using (true)', t);
    execute format('drop trigger if exists trg_audit on app.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on app.%I for each row execute function app.fn_audit()', t);
  end loop; end $$;

-- 가용재고 (R-INV-03, R-AL-16)
create or replace function app.fn_available_stock(p_item text) returns numeric
language sql stable security definer set search_path = app, public as $$
  select coalesce((select qty from app.inventory_snapshot where item_code = p_item and stock_class = 'normal' order by snap_date desc limit 1), 0)
       - coalesce((select sum(qty) from app.allocation where item_code = p_item and released_at is null), 0) $$;

drop view if exists app.v_available_stock;
create view app.v_available_stock as
select m.key_code as item_code, m.description, m.category, coalesce(m.on_hand, 0) as on_hand,
       coalesce((select sum(qty) from app.allocation a where a.item_code = m.key_code and a.released_at is null and a.kind = 'temp'), 0) as temp_allocated,
       coalesce((select sum(qty) from app.allocation a where a.item_code = m.key_code and a.released_at is null and a.kind = 'firm'), 0) as firm_allocated,
       coalesce((select sum(qty) from app.allocation a where a.item_code = m.key_code and a.released_at is null and a.kind = 'hold'), 0) as hold_qty,
       coalesce(m.on_hand, 0) - coalesce((select sum(qty) from app.allocation a where a.item_code = m.key_code and a.released_at is null), 0) as available
from analytics.v_item_master m;

create or replace view app.v_sales_order as
select o.*, p.name as sales_rep_name, d.description,
       coalesce((select sum(qty) from app.allocation a where a.order_id = o.id and a.released_at is null and a.kind = 'temp'), 0) as temp_qty,
       coalesce((select sum(qty) from app.allocation a where a.order_id = o.id and a.released_at is null and a.kind = 'firm'), 0) as firm_qty,
       coalesce((select sum(qty) from app.allocation a where a.order_id = o.id and a.released_at is null and a.kind = 'hold'), 0) as hold_qty,
       o.qty - coalesce((select sum(qty) from app.allocation a where a.order_id = o.id and a.released_at is null), 0) as shortage
from app.sales_order o left join app.profiles p on p.user_id = o.sales_rep left join raw.dim_item d on d.item_code = o.item_code;

create or replace view app.v_allocation_queue as
select v.*, app.fn_available_stock(v.item_code) as available, s.allocation_mode,
       row_number() over (partition by v.item_code order by v.priority, v.requested_at, v.id) as queue_pos
from app.v_sales_order v left join app.item_setting s on s.item_code = v.item_code
where v.status in ('partial','waiting') and v.shortage > 0;

-- 알림 helper: 주문 관련자(영업담당 + SCM 품목담당자 전원)
create or replace function app.notify_order(p_order uuid, p_kind text, p_title text, p_body text, p_payload jsonb) returns void
language plpgsql security definer set search_path = app, public as $$
declare rep uuid;
begin
  select sales_rep into rep from app.sales_order where id = p_order;
  perform app.notify_user(rep, p_kind, p_title, p_body, p_payload || jsonb_build_object('order_id', p_order));
  perform app.notify_role('item_manager', p_kind, p_title, p_body, p_payload || jsonb_build_object('order_id', p_order));
end $$;

-- 주문 등록 → 임시배정 (R-AL-01/03/05). 품목 advisory lock 으로 동시성 제어
create or replace function app.fn_create_sales_order(p_item text, p_qty numeric, p_customer text, p_mode text, p_prev uuid) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare v_id uuid; v_avail numeric; v_alloc numeric := 0; v_days int; v_status app.so_status; v_exp timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from raw.dim_item where item_code = p_item) then raise exception 'UNKNOWN_ITEM %', p_item; end if;
  if p_mode not in ('partial','wait') then raise exception 'BAD_MODE'; end if;
  perform pg_advisory_xact_lock(hashtext(p_item));
  v_days := coalesce((select (value)::int from app.system_settings where key = 'temp_alloc_days'), 30);
  v_avail := app.fn_available_stock(p_item);
  v_exp := now() + (v_days || ' days')::interval;
  if v_avail >= p_qty then v_alloc := p_qty; v_status := 'review_requested';
  elsif p_mode = 'partial' and v_avail > 0 then v_alloc := v_avail; v_status := 'partial';
  else v_alloc := 0; v_status := 'waiting'; end if;
  insert into app.sales_order(item_code, qty, customer, sales_rep, status, alloc_mode, expires_at, prev_order_id, note)
  values (p_item, p_qty, p_customer, auth.uid(), v_status, p_mode::app.alloc_mode_choice, case when v_alloc > 0 then v_exp end, p_prev,
          case when v_status <> 'review_requested' then format('가용 %s / 요청 %s → %s 선택', v_avail, p_qty, p_mode) end) returning id into v_id;
  if v_alloc > 0 then
    insert into app.allocation(order_id, item_code, qty, kind, expires_at, created_by) values (v_id, p_item, v_alloc, 'temp', v_exp, auth.uid());
  end if;
  return jsonb_build_object('order_id', v_id, 'status', v_status, 'allocated', v_alloc, 'shortage', p_qty - v_alloc, 'available_before', v_avail, 'expires_at', case when v_alloc > 0 then v_exp end);
end $$;

-- 수주 확정 → 임시배정을 확정배정으로 (R-AL-04)
create or replace function app.fn_confirm_sales_order(p_id uuid) returns void
language plpgsql security definer set search_path = app, public as $$
declare o app.sales_order;
begin
  select * into o from app.sales_order where id = p_id for update;
  if o.id is null then raise exception 'NOT_FOUND'; end if;
  if o.status not in ('review_requested','partial','waiting') then raise exception 'BAD_STATUS %', o.status; end if;
  if o.sales_rep <> auth.uid() and app.current_role() not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  update app.allocation set kind = 'firm', expires_at = null where order_id = p_id and released_at is null and kind = 'temp';
  update app.sales_order set status = 'confirmed', confirmed_at = now(), expires_at = null where id = p_id;
  perform app.notify_order(p_id, 'order_confirmed', '수주 확정: ' || o.order_no, o.item_code || ' ' || o.qty || '개 확정배정 전환', '{}'::jsonb);
end $$;

-- 반려/취소 → 배정 해제 (R-AL-40~42). 확정배정 해제도 여기 (사유 필수, 주문 취소)
create or replace function app.fn_cancel_sales_order(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = app, public as $$
declare o app.sales_order; released numeric;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'REASON_REQUIRED'; end if;
  select * into o from app.sales_order where id = p_id for update;
  if o.id is null then raise exception 'NOT_FOUND'; end if;
  if o.status in ('cancelled','rejected','expired') then raise exception 'ALREADY_CLOSED'; end if;
  if o.status = 'confirmed' and app.current_role() not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  if o.status <> 'confirmed' and o.sales_rep <> auth.uid() and app.current_role() not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  select coalesce(sum(qty), 0) into released from app.allocation where order_id = p_id and released_at is null;
  update app.allocation set released_at = now(), release_reason = p_reason where order_id = p_id and released_at is null;
  update app.sales_order set status = 'cancelled', decided_at = now(), cancel_reason = p_reason where id = p_id;
  perform app.notify_order(p_id, 'order_cancelled', '주문 취소: ' || o.order_no, format('%s 해제 %s개 · 사유: %s', o.item_code, released, p_reason), jsonb_build_object('released', released, 'reason', p_reason));
end $$;

-- 자동 배정 (R-AL-11/12/13): 품목의 대기 주문에 우선순위→검토요청→id 순으로 가용재고 배정
create or replace function app.fn_auto_allocate(p_item text) returns int
language plpgsql security definer set search_path = app, public as $$
declare r record; v_avail numeric; give numeric; n int := 0; v_days int; v_short numeric;
begin
  perform pg_advisory_xact_lock(hashtext(p_item));
  v_days := coalesce((select (value)::int from app.system_settings where key = 'temp_alloc_days'), 30);
  for r in select o.* from app.sales_order o where o.item_code = p_item and o.status in ('partial','waiting') order by o.priority, o.requested_at, o.id loop
    v_avail := app.fn_available_stock(p_item);
    if v_avail <= 0 then exit; end if;
    v_short := r.qty - coalesce((select sum(qty) from app.allocation where order_id = r.id and released_at is null), 0);
    if v_short <= 0 then continue; end if;
    give := least(v_avail, v_short);
    insert into app.allocation(order_id, item_code, qty, kind, expires_at) values (r.id, p_item, give, 'temp', coalesce(r.expires_at, now() + (v_days || ' days')::interval));
    update app.sales_order set expires_at = coalesce(expires_at, now() + (v_days || ' days')::interval), status = (case when give >= v_short then 'review_requested' else 'partial' end)::app.so_status where id = r.id;
    perform app.notify_order(r.id, 'auto_allocated', '자동 배정: ' || r.order_no, format('%s %s개 배정, 남은 부족 %s · %s', p_item, give, v_short - give, to_char(now(), 'YYYY-MM-DD HH24:MI')),
                             jsonb_build_object('item_code', p_item, 'allocated', give, 'remaining', v_short - give));
    n := n + 1;
  end loop;
  return n;
end $$;

-- 입고 처리 (R-INV-02): received + 재고 스냅샷 반영 + 자동배정(auto 품목) / 수동 품목은 담당자 알림
create or replace function app.fn_receive_inbound(p_inbound_id bigint, p_actual date) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare i app.inbound; mode app.allocation_mode; cur numeric; n int := 0;
begin
  if app.current_role() not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  select * into i from app.inbound where id = p_inbound_id for update;
  if i.id is null then raise exception 'NOT_FOUND'; end if;
  if i.status = 'received' then raise exception 'ALREADY_RECEIVED'; end if;
  update app.inbound set status = 'received', actual_date = coalesce(p_actual, current_date), updated_by = auth.uid(), updated_at = now() where id = p_inbound_id;
  cur := coalesce((select qty from app.inventory_snapshot where item_code = i.item_code and stock_class = 'normal' order by snap_date desc limit 1), 0);
  insert into app.inventory_snapshot(item_code, snap_date, qty, stock_class, source, is_dummy, updated_by)
  values (i.item_code, coalesce(p_actual, current_date), cur + i.qty, 'normal', 'manual', false, auth.uid())
  on conflict (item_code, snap_date, stock_class) do update set qty = app.inventory_snapshot.qty + i.qty, updated_at = now();
  select coalesce(s.allocation_mode, 'auto') into mode from app.item_setting s where s.item_code = i.item_code;
  if coalesce(mode, 'auto') = 'auto' then n := app.fn_auto_allocate(i.item_code);
  else perform app.notify_role('item_manager', 'inbound_manual', '입고 — 수동 배정 필요: ' || i.item_code, format('%s개 입고. 대기 주문 %s건', i.qty, (select count(*) from app.sales_order where item_code = i.item_code and status in ('partial','waiting'))), jsonb_build_object('item_code', i.item_code));
  end if;
  return jsonb_build_object('item_code', i.item_code, 'qty', i.qty, 'mode', coalesce(mode, 'auto'), 'auto_allocated_orders', n);
end $$;

-- 수동 배정 (R-AL-14~17): 큐 선두면 즉시 확정배정, 건너뛰면 사유 필수 + hold + 팀장 승인
create or replace function app.fn_manual_allocate(p_order uuid, p_qty numeric, p_reason text) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare o app.sales_order; v_avail numeric; v_first uuid; v_appr uuid; v_short numeric;
begin
  if app.current_role() not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  select * into o from app.sales_order where id = p_order for update;
  if o.id is null then raise exception 'NOT_FOUND'; end if;
  if o.status not in ('partial','waiting','review_requested') then raise exception 'BAD_STATUS %', o.status; end if;
  perform pg_advisory_xact_lock(hashtext(o.item_code));
  v_avail := app.fn_available_stock(o.item_code);
  if p_qty > v_avail then raise exception 'INSUFFICIENT available %', v_avail; end if;
  v_short := o.qty - coalesce((select sum(qty) from app.allocation where order_id = o.id and released_at is null), 0);
  if p_qty > v_short then raise exception 'EXCEEDS_SHORTAGE %', v_short; end if;
  select id into v_first from app.sales_order where item_code = o.item_code and status in ('partial','waiting') order by priority, requested_at, id limit 1;
  if v_first is null or v_first = o.id then
    insert into app.allocation(order_id, item_code, qty, kind, created_by) values (o.id, o.item_code, p_qty, 'firm', auth.uid());
    update app.sales_order set status = (case when p_qty >= v_short then 'confirmed' else 'partial' end)::app.so_status, confirmed_at = case when p_qty >= v_short then now() end where id = o.id;
    perform app.notify_order(o.id, 'manual_allocated', '수동 확정배정: ' || o.order_no, format('%s %s개', o.item_code, p_qty), jsonb_build_object('qty', p_qty));
    return jsonb_build_object('result', 'firm', 'qty', p_qty);
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'REASON_REQUIRED'; end if;
  v_appr := app.fn_request_approval('priority_alloc', 'app.sales_order', o.id::text,
     jsonb_build_object('order_no', o.order_no, 'item_code', o.item_code, 'qty', p_qty, 'available', v_avail, 'skipped_order', v_first), p_reason);
  insert into app.allocation(order_id, item_code, qty, kind, approval_id, created_by) values (o.id, o.item_code, p_qty, 'hold', v_appr, auth.uid());
  return jsonb_build_object('result', 'hold_pending_approval', 'approval_id', v_appr, 'qty', p_qty);
end $$;

-- 우선순위 변경 (R-AL-20)
create or replace function app.fn_set_priority(p_order uuid, p_priority int, p_reason text) returns void
language plpgsql security definer set search_path = app, public as $$
begin
  if app.current_role() not in ('biz_enable','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  update app.sales_order set priority = p_priority, note = coalesce(note, '') || format(' [우선순위 %s → %s: %s]', priority, p_priority, coalesce(p_reason, '')) where id = p_order and status in ('review_requested','partial','waiting');
end $$;

-- 만료 처리·예고·반복 알림 (R-AL-02/17/30). pg_cron 또는 engine tick 이 주기 호출
create or replace function app.fn_allocation_tick() returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare r record; expired int := 0; reminded int := 0; repeated int := 0; d int; days int[];
begin
  days := coalesce((select array(select jsonb_array_elements_text(value)::int) from app.system_settings where key = 'expiry_reminder_days'), array[10,5,3,2,1]);
  -- 만료
  for r in select o.* from app.sales_order o where o.status in ('review_requested','partial') and o.expires_at is not null and o.expires_at <= now() loop
    update app.allocation set released_at = now(), release_reason = '30일 자동 만료' where order_id = r.id and released_at is null and kind = 'temp';
    update app.sales_order set status = 'expired', decided_at = now() where id = r.id;
    perform app.notify_order(r.id, 'alloc_expired', '임시배정이 자동 해제되었습니다: ' || r.order_no, r.item_code || ' — 재진행은 새 검토 요청 등록', '{}'::jsonb);
    expired := expired + 1;
  end loop;
  -- 예고 (중복 방지: 같은 주문·일수 알림 존재 시 skip)
  for r in select o.* from app.sales_order o where o.status in ('review_requested','partial') and o.expires_at is not null loop
    foreach d in array days loop
      if r.expires_at - (d || ' days')::interval <= now() and r.expires_at > now()
         and not exists (select 1 from app.notification where kind = 'alloc_expiry_reminder' and (payload->>'order_id')::uuid = r.id and (payload->>'days_before')::int = d) then
        perform app.notify_order(r.id, 'alloc_expiry_reminder', format('임시배정 만료 %s일 전: %s', d, r.order_no), format('%s 만료 %s', r.item_code, to_char(r.expires_at, 'YYYY-MM-DD')), jsonb_build_object('days_before', d));
        reminded := reminded + 1;
      end if;
    end loop;
  end loop;
  -- 우선배정 승인 10분 반복 (R-AL-17)
  for r in select a.* from app.approval a where a.kind = 'priority_alloc' and a.status = 'pending'
           and not exists (select 1 from app.notification n where n.kind = 'approval_reminder' and (n.payload->>'approval_id')::uuid = a.id and n.created_at > now() - interval '10 minutes') loop
    perform app.notify_role('scm_lead', 'approval_reminder', '[반복] 우선 배정 승인 대기: ' || (r.payload->>'order_no'), format('%s %s개 · 가용 %s · 사유: %s', r.payload->>'item_code', r.payload->>'qty', r.payload->>'available', r.reason), jsonb_build_object('approval_id', r.id));
    repeated := repeated + 1;
  end loop;
  return jsonb_build_object('expired', expired, 'reminders', reminded, 'approval_repeats', repeated, 'at', now());
end $$;

-- fn_decide_approval: priority_alloc 분기
create or replace function app.fn_decide_approval(p_id uuid, p_decision text, p_comment text)
returns void language plpgsql security definer set search_path = app, public as $$
declare a app.approval; v_role app.role := app.current_role(); v_plan uuid; o app.sales_order; v_short numeric; v_q numeric;
begin
  if v_role is null or v_role not in ('scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  select * into a from app.approval where id = p_id for update;
  if a.id is null then raise exception 'NOT_FOUND'; end if;
  if a.status <> 'pending' then raise exception 'ALREADY_DECIDED'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'BAD_DECISION'; end if;
  if p_decision = 'rejected' and (p_comment is null or length(trim(p_comment)) = 0) then raise exception 'COMMENT_REQUIRED'; end if;

  if a.kind = 'item_setting' then
    if p_decision = 'approved' then
      update app.item_setting s set
        target_dos_days = coalesce((a.payload->>'target_dos_days')::int, s.target_dos_days), moq = coalesce((a.payload->>'moq')::int, s.moq),
        unit_price = coalesce((a.payload->>'unit_price')::numeric, s.unit_price), allocation_mode = coalesce((a.payload->>'allocation_mode')::app.allocation_mode, s.allocation_mode),
        status = 'approved', approved_by = auth.uid(), approved_at = now(), source = 'manual', is_dummy = false, updated_by = auth.uid(), updated_at = now()
      where s.item_code = a.target_pk;
    else
      update app.item_setting set status = case when approved_at is null then 'draft' else 'approved' end, updated_by = auth.uid(), updated_at = now() where item_code = a.target_pk;
    end if;
  elsif a.kind = 'forecast_tuning' then perform app.fn_apply_tuning(a, p_decision);
  elsif a.kind = 'order_plan' then
    v_plan := a.target_pk::uuid;
    if p_decision = 'approved' then
      update app.order_plan set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = v_plan;
      insert into app.ol_submission(plan_id, item_code, target_ym, qty) select v_plan, key_code, need_ym, coalesce(override_qty, final_qty) from app.order_plan_line where plan_id = v_plan and coalesce(override_qty, final_qty) > 0 on conflict (plan_id, item_code) do nothing;
    else update app.order_plan set status = 'draft', confirmed_by = null, confirmed_at = null, approval_id = null where id = v_plan; end if;
  elsif a.kind = 'bulkdeal' then
    update app.extra_demand set status = case when p_decision = 'approved' then 'approved' else 'rejected' end::app.extra_status where id = a.target_pk::uuid;
  elsif a.kind = 'priority_alloc' then
    select * into o from app.sales_order where id = a.target_pk::uuid for update;
    if p_decision = 'approved' then
      update app.allocation set kind = 'firm', expires_at = null where approval_id = a.id and released_at is null and kind = 'hold';
      v_short := o.qty - coalesce((select sum(qty) from app.allocation where order_id = o.id and released_at is null), 0);
      update app.sales_order set status = (case when v_short <= 0 then 'confirmed' else 'partial' end)::app.so_status, confirmed_at = case when v_short <= 0 then now() end where id = o.id;
    else
      update app.allocation set released_at = now(), release_reason = '우선 배정 반려: ' || p_comment where approval_id = a.id and released_at is null and kind = 'hold';
    end if;
    select (a.payload->>'qty')::numeric into v_q;
    perform app.notify_order(o.id, 'priority_alloc_decided', case when p_decision = 'approved' then '우선 배정 승인: ' else '우선 배정 반려: ' end || o.order_no,
      format('%s %s개 · 팀장 의견: %s', o.item_code, v_q, coalesce(p_comment, '-')), jsonb_build_object('decision', p_decision, 'qty', v_q));
  end if;

  update app.approval set status = p_decision::app.approval_status, approver = auth.uid(), comment = p_comment, decided_at = now() where id = p_id;
  perform app.notify_user(a.requested_by, 'approval_decided', case when p_decision = 'approved' then '승인됨: ' else '반려됨: ' end || a.kind::text,
    a.target_pk || coalesce(' — ' || p_comment, ''), jsonb_build_object('approval_id', p_id, 'decision', p_decision));
end $$;

-- 승인 요청 시 즉시 알림 (R-AL-17 첫 발송은 fn_request_approval 의 notify_role 로 이미 처리)
