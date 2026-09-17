-- 부서 추가 요청 6건 (D-058): 고객사별 배정현황·강제배정·긴급발주 진행·담당 품목 재고·전 부서 재고·품명 병기
-- 규칙: R-AL-51~54, R-SCH-32·33, R-OQ-44, R-INV-09, R-UI-15·16. enum 값은 010000 에서 먼저 추가. 재실행 안전.

-- ── 1. 테이블 ────────────────────────────────────────────────────────────
create table if not exists app.customer (                       -- R-AL-51
  code text primary key, name text not null, segment text, sales_rep uuid references app.profiles(user_id),
  is_strategic boolean not null default false,
  source text not null default 'manual' check (source in ('upload','manual','seed')), is_dummy boolean not null default false,
  updated_by uuid, updated_at timestamptz not null default now());

create table if not exists app.demand_line (                    -- R-SCH-32
  id bigserial primary key, ym char(7) not null, dept app.role not null,
  customer_code text not null references app.customer(code) on update cascade,
  item_code text not null, qty numeric not null check (qty > 0), note text,
  submitted_by uuid, source text not null default 'manual' check (source in ('upload','manual','seed')), is_dummy boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (ym, dept, customer_code, item_code));
create index if not exists ix_demand_line_cust_item on app.demand_line(customer_code, item_code, ym);

create table if not exists app.item_group (                     -- R-INV-09
  code text primary key, name text not null, owner_dept app.role,
  source text not null default 'manual' check (source in ('upload','manual','seed')), is_dummy boolean not null default false,
  updated_by uuid, updated_at timestamptz not null default now());
create table if not exists app.item_group_item (
  item_code text primary key, group_code text not null references app.item_group(code) on update cascade on delete cascade);
create index if not exists ix_item_group_item_group on app.item_group_item(group_code);

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app' and t.typname = 'inbound_stage') then
    create type app.inbound_stage as enum ('po_accepted','shipped','departed','arrived','customs','received');   -- 선언 순서 = 진행 순서 (R-SCH-33)
  end if;
end $$;
create table if not exists app.inbound_event (                  -- R-SCH-33
  id bigserial primary key, inbound_id bigint not null references app.inbound(id) on delete cascade,
  stage app.inbound_stage not null, event_date date not null default current_date, note text,
  source text not null default 'manual' check (source in ('upload','manual','seed')), is_dummy boolean not null default false,
  created_by uuid, created_at timestamptz not null default now(),
  unique (inbound_id, stage));

-- 기존 테이블 컬럼 추가. v_sales_order 가 o.* 라 컬럼 순서가 바뀌므로 의존 뷰를 내렸다가 아래에서 다시 만든다.
drop view if exists app.v_allocation_queue;
drop view if exists app.v_sales_order;
alter table app.sales_order add column if not exists customer_code text references app.customer(code) on update cascade;
alter table app.sales_order add column if not exists is_dummy boolean not null default false;
create index if not exists ix_sales_order_customer on app.sales_order(customer_code, item_code);
alter table app.allocation add column if not exists forced boolean not null default false;          -- R-AL-54
alter table app.allocation add column if not exists forced_reason text;
alter table app.allocation add column if not exists forced_by_dept app.role;
alter table app.extra_demand add column if not exists need_date date;                                -- R-OQ-44
alter table app.extra_demand add column if not exists requested_dept app.role;
alter table app.extra_demand add column if not exists inbound_id bigint references app.inbound(id) on delete set null;
alter table app.extra_demand add column if not exists is_dummy boolean not null default false;

create view app.v_sales_order as
select o.*, p.name as sales_rep_name, d.description,
       coalesce((select sum(qty) from app.allocation a where a.order_id = o.id and a.released_at is null and a.kind = 'temp'), 0) as temp_qty,
       coalesce((select sum(qty) from app.allocation a where a.order_id = o.id and a.released_at is null and a.kind = 'firm'), 0) as firm_qty,
       coalesce((select sum(qty) from app.allocation a where a.order_id = o.id and a.released_at is null and a.kind = 'hold'), 0) as hold_qty,
       o.qty - coalesce((select sum(qty) from app.allocation a where a.order_id = o.id and a.released_at is null), 0) as shortage
from app.sales_order o left join app.profiles p on p.user_id = o.sales_rep left join raw.dim_item d on d.item_code = o.item_code;
create view app.v_allocation_queue as
select v.*, app.fn_available_stock(v.item_code) as available, s.allocation_mode,
       row_number() over (partition by v.item_code order by v.priority, v.requested_at, v.id) as queue_pos
from app.v_sales_order v left join app.item_setting s on s.item_code = v.item_code
where v.status in ('partial','waiting') and v.shortage > 0;

-- 설정 (절대 규칙 6: 한도는 하드코딩하지 않는다)
insert into app.system_settings(key, value, description) values
  ('force_alloc_max_pct', '30', '강제배정 품목 한도 — 품목 현재고의 몇 %까지 사업강화부가 큐를 건너뛰어 배정할 수 있는가 (R-AL-53, Q-023)')
on conflict (key) do nothing;

-- ── 2. RLS: 읽기는 로그인 사용자, 마스터 쓰기는 관리자·품목담당, 나머지 쓰기는 RPC 만 ─────────────
do $$ declare t text; begin
  foreach t in array array['customer','demand_line','item_group','item_group_item','inbound_event'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('drop policy if exists p_read on app.%I', t);
    execute format('create policy p_read on app.%I for select to authenticated using (true)', t);
  end loop;
  foreach t in array array['customer','item_group','item_group_item'] loop
    execute format('drop policy if exists p_write on app.%I', t);
    execute format('create policy p_write on app.%I for all to authenticated using (app.current_role() in (''admin'',''item_manager'')) with check (app.current_role() in (''admin'',''item_manager''))', t);
  end loop;
end $$;

-- ── 3. RPC ──────────────────────────────────────────────────────────────
-- 주문 등록: 고객코드 인자 추가 (R-AL-51). 기존 5인자 시그니처는 제거(PostgREST 오버로드 모호성 방지)
drop function if exists app.fn_create_sales_order(text, numeric, text, text, uuid);
create or replace function app.fn_create_sales_order(p_item text, p_qty numeric, p_customer text, p_mode text, p_prev uuid, p_customer_code text default null) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare v_id uuid; v_avail numeric; v_alloc numeric := 0; v_days int; v_status app.so_status; v_exp timestamptz; v_cname text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from raw.dim_item where item_code = p_item) then raise exception 'UNKNOWN_ITEM %', p_item; end if;
  if p_mode not in ('partial','wait') then raise exception 'BAD_MODE'; end if;
  p_customer_code := nullif(btrim(p_customer_code), '');
  if p_customer_code is not null then
    select name into v_cname from app.customer where code = p_customer_code;
    if v_cname is null then raise exception 'UNKNOWN_CUSTOMER %', p_customer_code; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext(p_item));
  v_days := coalesce((select (value)::int from app.system_settings where key = 'temp_alloc_days'), 30);
  v_avail := app.fn_available_stock(p_item);
  v_exp := now() + (v_days || ' days')::interval;
  if v_avail >= p_qty then v_alloc := p_qty; v_status := 'review_requested';
  elsif p_mode = 'partial' and v_avail > 0 then v_alloc := v_avail; v_status := 'partial';
  else v_alloc := 0; v_status := 'waiting'; end if;
  insert into app.sales_order(item_code, qty, customer, customer_code, sales_rep, status, alloc_mode, expires_at, prev_order_id, note)
  values (p_item, p_qty, coalesce(nullif(btrim(p_customer), ''), v_cname), p_customer_code, auth.uid(), v_status, p_mode::app.alloc_mode_choice, case when v_alloc > 0 then v_exp end, p_prev,
          case when v_status <> 'review_requested' then format('가용 %s / 요청 %s → %s 선택', v_avail, p_qty, p_mode) end) returning id into v_id;
  if v_alloc > 0 then
    insert into app.allocation(order_id, item_code, qty, kind, expires_at, created_by) values (v_id, p_item, v_alloc, 'temp', v_exp, auth.uid());
  end if;
  return jsonb_build_object('order_id', v_id, 'status', v_status, 'allocated', v_alloc, 'shortage', p_qty - v_alloc, 'available_before', v_avail, 'expires_at', case when v_alloc > 0 then v_exp end);
end $$;

-- 수요자료 상세 라인 저장 (R-SCH-32): 본인 부서만, SCM 역할은 대리 입력. qty ≤ 0 이면 그 라인 삭제
create or replace function app.fn_save_demand_lines(p_ym char(7), p_dept text, p_lines jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare v_role app.role := app.current_role(); r jsonb; n_up int := 0; n_del int := 0; v_qty numeric;
begin
  if v_role is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_role::text <> p_dept and v_role not in ('admin','item_manager','scm_lead') then raise exception 'FORBIDDEN'; end if;
  if p_ym !~ '^\d{4}-\d{2}$' then raise exception 'BAD_YM %', p_ym; end if;
  for r in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    if not exists (select 1 from app.customer where code = r->>'customer_code') then raise exception 'UNKNOWN_CUSTOMER %', r->>'customer_code'; end if;
    if not exists (select 1 from raw.dim_item where item_code = r->>'item_code') then raise exception 'UNKNOWN_ITEM %', r->>'item_code'; end if;
    v_qty := coalesce((r->>'qty')::numeric, 0);
    if v_qty <= 0 then
      delete from app.demand_line where ym = p_ym and dept = p_dept::app.role and customer_code = r->>'customer_code' and item_code = r->>'item_code';
      n_del := n_del + 1;
    else
      insert into app.demand_line(ym, dept, customer_code, item_code, qty, note, submitted_by, source, is_dummy)
      values (p_ym, p_dept::app.role, r->>'customer_code', r->>'item_code', v_qty, nullif(btrim(r->>'note'), ''), auth.uid(), 'manual', false)
      on conflict (ym, dept, customer_code, item_code) do update set qty = excluded.qty, note = excluded.note, submitted_by = auth.uid(), source = 'manual', is_dummy = false, updated_at = now();
      n_up := n_up + 1;
    end if;
  end loop;
  return jsonb_build_object('saved', n_up, 'deleted', n_del);
end $$;

-- 강제배정 (R-AL-53/54): 사업강화부가 큐 순서와 무관하게 고객사 주문에 가용재고 일부를 임시배정. 팀장 승인 생략, 한도 2종 + 즉시 알림
create or replace function app.fn_force_allocate(p_order uuid, p_qty numeric, p_reason text) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare o app.sales_order; v_role app.role := app.current_role(); v_avail numeric; v_short numeric; v_onhand numeric; v_pct numeric; v_quota numeric;
        v_item_forced numeric; v_need numeric; v_cust_forced numeric; v_days int; v_exp timestamptz; v_cname text;
begin
  if v_role is null or v_role not in ('biz_enable','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then raise exception 'REASON_REQUIRED'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'BAD_QTY'; end if;
  select * into o from app.sales_order where id = p_order for update;
  if o.id is null then raise exception 'NOT_FOUND'; end if;
  if o.status not in ('partial','waiting') then raise exception 'BAD_STATUS %', o.status; end if;
  if o.customer_code is null then raise exception 'CUSTOMER_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtext(o.item_code));
  v_avail := app.fn_available_stock(o.item_code);
  if p_qty > v_avail then raise exception 'INSUFFICIENT available %', v_avail; end if;
  v_short := o.qty - coalesce((select sum(qty) from app.allocation where order_id = o.id and released_at is null), 0);
  if p_qty > v_short then raise exception 'EXCEEDS_SHORTAGE %', v_short; end if;
  -- 품목 한도: 활성 강제배정 누계 ≤ 현재고 × 설정 %
  v_onhand := coalesce((select qty from app.inventory_snapshot where item_code = o.item_code and stock_class = 'normal' order by snap_date desc limit 1), 0);
  v_pct := coalesce((select (value)::numeric from app.system_settings where key = 'force_alloc_max_pct'), 30);
  v_quota := floor(v_onhand * v_pct / 100.0);
  v_item_forced := coalesce((select sum(qty) from app.allocation where item_code = o.item_code and released_at is null and forced), 0);
  if v_item_forced + p_qty > v_quota then raise exception 'ITEM_QUOTA_EXCEEDED quota % used %', v_quota, v_item_forced; end if;
  -- 고객사 한도: 수요자료 라인이 있으면 그 필요 수량까지만
  select sum(qty) into v_need from app.demand_line where customer_code = o.customer_code and item_code = o.item_code and ym >= to_char(current_date, 'YYYY-MM');
  if v_need is not null then
    v_cust_forced := coalesce((select sum(a.qty) from app.allocation a join app.sales_order s on s.id = a.order_id
                               where s.customer_code = o.customer_code and a.item_code = o.item_code and a.released_at is null and a.forced), 0);
    if v_cust_forced + p_qty > v_need then raise exception 'CUSTOMER_NEED_EXCEEDED need % forced %', v_need, v_cust_forced; end if;
  end if;
  v_days := coalesce((select (value)::int from app.system_settings where key = 'temp_alloc_days'), 30);
  v_exp := coalesce(o.expires_at, now() + (v_days || ' days')::interval);
  insert into app.allocation(order_id, item_code, qty, kind, expires_at, created_by, forced, forced_reason, forced_by_dept)
  values (o.id, o.item_code, p_qty, 'temp', v_exp, auth.uid(), true, btrim(p_reason), v_role);
  update app.sales_order set expires_at = v_exp, status = (case when p_qty >= v_short then 'review_requested' else 'partial' end)::app.so_status,
         note = coalesce(note, '') || format(' [강제배정 %s개: %s]', p_qty, btrim(p_reason)) where id = o.id;
  select name into v_cname from app.customer where code = o.customer_code;
  perform app.notify_order(o.id, 'force_allocated', '강제배정: ' || o.order_no, format('%s · %s %s개 · 사유: %s', v_cname, o.item_code, p_qty, btrim(p_reason)),
                           jsonb_build_object('qty', p_qty, 'customer_code', o.customer_code, 'by_dept', v_role));
  perform app.notify_role('scm_lead', 'force_allocated', '강제배정: ' || o.order_no, format('%s · %s %s개 · 사유: %s', v_cname, o.item_code, p_qty, btrim(p_reason)),
                          jsonb_build_object('order_id', o.id, 'qty', p_qty, 'customer_code', o.customer_code, 'by_dept', v_role));
  return jsonb_build_object('result', 'forced', 'qty', p_qty, 'remaining_shortage', v_short - p_qty, 'item_quota', v_quota, 'item_forced', v_item_forced + p_qty);
end $$;

-- 긴급발주 요청 (R-OQ-44): 전 부서 → 팀장 승인 → 추가수요
create or replace function app.fn_request_urgent(p_item text, p_qty numeric, p_need_date date, p_reason text) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare v_role app.role := app.current_role(); v_id uuid; v_appr uuid;
begin
  if v_role is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from raw.dim_item where item_code = p_item) then raise exception 'UNKNOWN_ITEM %', p_item; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'BAD_QTY'; end if;
  if p_need_date is null then raise exception 'NEED_DATE_REQUIRED'; end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then raise exception 'REASON_REQUIRED'; end if;
  insert into app.extra_demand(kind, item_code, need_ym, qty, reason, status, created_by, need_date, requested_dept)
  values ('urgent', p_item, to_char(p_need_date, 'YYYY-MM'), p_qty, btrim(p_reason), 'pending', auth.uid(), p_need_date, v_role) returning id into v_id;
  v_appr := app.fn_request_approval('urgent_order', 'app.extra_demand', v_id::text,
     jsonb_build_object('item_code', p_item, 'qty', p_qty, 'need_date', p_need_date, 'dept', v_role), btrim(p_reason));
  update app.extra_demand set approval_id = v_appr where id = v_id;
  return jsonb_build_object('id', v_id, 'approval_id', v_appr);
end $$;

-- PO 진행 이벤트 기록 (R-SCH-33). 같은 PO·단계는 갱신. 출하 이후 단계면 입고예정 상태를 shipped 로
create or replace function app.fn_add_inbound_event(p_inbound_id bigint, p_stage text, p_date date, p_note text) returns void
language plpgsql security definer set search_path = app, public as $$
declare v_role app.role := app.current_role(); r record;
begin
  if v_role is null or v_role not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  if p_inbound_id is null or not exists (select 1 from app.inbound where id = p_inbound_id) then raise exception 'UNKNOWN_PO'; end if;
  insert into app.inbound_event(inbound_id, stage, event_date, note, source, is_dummy, created_by)
  values (p_inbound_id, p_stage::app.inbound_stage, coalesce(p_date, current_date), nullif(btrim(p_note), ''), 'manual', false, auth.uid())
  on conflict (inbound_id, stage) do update set event_date = excluded.event_date, note = excluded.note, created_by = auth.uid(), is_dummy = false;
  if p_stage in ('shipped','departed','arrived','customs') then
    update app.inbound set status = 'shipped', updated_by = auth.uid(), updated_at = now() where id = p_inbound_id and status = 'ordered';
  end if;
  for r in select created_by, item_code from app.extra_demand where inbound_id = p_inbound_id and kind = 'urgent' and created_by is not null loop
    perform app.notify_user(r.created_by, 'urgent_progress', '긴급발주 진행: ' || r.item_code, format('단계 %s · %s', p_stage, to_char(coalesce(p_date, current_date), 'YYYY-MM-DD')),
                            jsonb_build_object('inbound_id', p_inbound_id, 'stage', p_stage));
  end loop;
end $$;

-- 승인된 긴급발주에 PO 연결 (R-OQ-44). 연결 시 '접수' 이벤트가 없으면 만든다
create or replace function app.fn_link_urgent_inbound(p_extra uuid, p_inbound_id bigint) returns void
language plpgsql security definer set search_path = app, public as $$
declare v_role app.role := app.current_role(); e app.extra_demand;
begin
  if v_role is null or v_role not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  select * into e from app.extra_demand where id = p_extra for update;
  if e.id is null or e.kind <> 'urgent' then raise exception 'NOT_FOUND'; end if;
  if e.status <> 'approved' then raise exception 'NOT_APPROVED'; end if;
  if not exists (select 1 from app.inbound where id = p_inbound_id and item_code = e.item_code) then raise exception 'PO_ITEM_MISMATCH'; end if;
  update app.extra_demand set inbound_id = p_inbound_id where id = p_extra;
  if not exists (select 1 from app.inbound_event where inbound_id = p_inbound_id) then
    perform app.fn_add_inbound_event(p_inbound_id, 'po_accepted', current_date, '긴급발주 연결');
  end if;
end $$;

CREATE OR REPLACE FUNCTION app.fn_decide_approval(p_id uuid, p_decision text, p_comment text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
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
  elsif a.kind = 'urgent_order' then   -- 긴급발주 승인 → 추가수요 확정 (R-OQ-44, D-058)
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
end $function$;

CREATE OR REPLACE FUNCTION app.fn_apply_upload(p_target text, p_rows jsonb, p_mode text, p_file_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
declare r jsonb; i int := 0; ok int := 0; errs jsonb := '[]'::jsonb; v_id uuid; v_role app.role := app.current_role();
begin
  if v_role is null or v_role not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  if p_target not in ('inventory_snapshot','inbound','item_setting','attach_rate','supplier','eol_eos','holiday','shipment_extra','mc_plan_actual','customer','item_group','demand_line','inbound_event') then
    raise exception 'BAD_TARGET %', p_target; end if;
  if p_mode = 'replace' and p_target = 'inventory_snapshot' and jsonb_array_length(p_rows) > 0 then
    delete from app.inventory_snapshot where snap_date = (p_rows->0->>'snap_date')::date; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    begin
      if p_target in ('inventory_snapshot','inbound','item_setting','shipment_extra')
         and not exists (select 1 from raw.dim_item where item_code = r->>'item_code') then
        raise exception 'UNKNOWN_ITEM %', r->>'item_code'; end if;

      case p_target
      when 'inventory_snapshot' then
        insert into app.inventory_snapshot(item_code, snap_date, qty, stock_class, source, updated_by)
        values (r->>'item_code', (r->>'snap_date')::date, (r->>'qty')::numeric, coalesce((r->>'stock_class')::app.stock_class,'normal'), 'upload', auth.uid())
        on conflict (item_code, snap_date, stock_class) do update set qty = excluded.qty, source = 'upload', is_dummy = false, updated_by = auth.uid(), updated_at = now();
      when 'inbound' then
        insert into app.inbound(item_code, supplier_id, po_no, qty, planned_date, actual_date, status, source, updated_by)
        values (r->>'item_code', (select id from app.supplier where code = r->>'supplier_code'), r->>'po_no', (r->>'qty')::numeric,
                (r->>'planned_date')::date, (r->>'actual_date')::date, coalesce((r->>'status')::app.inbound_status,'ordered'), 'upload', auth.uid());
      when 'item_setting' then
        insert into app.item_setting(item_code, target_dos_days, moq, unit_price, allocation_mode, status, source, updated_by)
        values (r->>'item_code', (r->>'target_dos_days')::int, coalesce((r->>'moq')::int,1), (r->>'unit_price')::numeric,
                coalesce((r->>'allocation_mode')::app.allocation_mode,'auto'), 'approved', 'upload', auth.uid())
        on conflict (item_code) do update set
          target_dos_days = coalesce(excluded.target_dos_days, app.item_setting.target_dos_days),
          moq = excluded.moq, unit_price = coalesce(excluded.unit_price, app.item_setting.unit_price),
          allocation_mode = excluded.allocation_mode, source = 'upload', is_dummy = false, updated_by = auth.uid(), updated_at = now();
      when 'attach_rate' then
        insert into app.attach_rate(model_base, option_item_code, rate, effective_ym, source, updated_by)
        values (r->>'model_base', r->>'option_item_code', (r->>'rate')::numeric, r->>'effective_ym', 'upload', auth.uid())
        on conflict (model_base, option_item_code, effective_ym) do update set rate = excluded.rate, source = 'upload', is_dummy = false, updated_at = now();
      when 'supplier' then
        insert into app.supplier(code, name, country, prep_days, lead_time_days, source, updated_by)
        values (r->>'code', r->>'name', r->>'country', coalesce((r->>'prep_days')::int, 7), coalesce((r->>'lead_time_days')::int, 30), 'upload', auth.uid())
        on conflict (code) do update set name = excluded.name, country = excluded.country, prep_days = excluded.prep_days,
          lead_time_days = excluded.lead_time_days, source = 'upload', is_dummy = false, updated_at = now();
      when 'eol_eos' then
        insert into app.eol_eos(model_base, launch_date, eol_date, eos_date, source, updated_by)
        values (r->>'model_base', (r->>'launch_date')::date, (r->>'eol_date')::date, (r->>'eos_date')::date, 'upload', auth.uid())
        on conflict (model_base) do update set launch_date = excluded.launch_date, eol_date = excluded.eol_date, eos_date = excluded.eos_date, source='upload', is_dummy=false, updated_at = now();
      when 'holiday' then
        insert into app.holiday(date, name, country) values ((r->>'date')::date, r->>'name', coalesce(r->>'country','KR'))
        on conflict (date) do update set name = excluded.name;
      when 'shipment_extra' then
        insert into app.shipment_extra(item_code, ym, qty, item_type, updated_by)
        values (r->>'item_code', r->>'ym', (r->>'qty')::numeric, r->>'item_type', auth.uid())
        on conflict (item_code, ym) do update set qty = excluded.qty, updated_at = now();
      when 'mc_plan_actual' then   -- 기종 OL/ACT 추가 (D-040): raw 수정 금지 → app.mc_plan_extra, core.v_mc_plan_actual 이 UNION
        if coalesce(r->>'model_base', '') = '' then raise exception 'MODEL_REQUIRED'; end if;
        insert into app.mc_plan_extra(model_base, ym, sales_ol, scm_ol, act, updated_by)
        values (btrim(r->>'model_base'), r->>'ym', (r->>'sales_ol')::numeric, (r->>'scm_ol')::numeric, (r->>'act')::numeric, auth.uid())
        on conflict (model_base, ym) do update set sales_ol = coalesce(excluded.sales_ol, app.mc_plan_extra.sales_ol), scm_ol = coalesce(excluded.scm_ol, app.mc_plan_extra.scm_ol),
          act = coalesce(excluded.act, app.mc_plan_extra.act), updated_by = auth.uid(), updated_at = now();
      when 'customer' then          -- 고객사 마스터 (R-AL-51, D-058)
        if coalesce(btrim(r->>'code'), '') = '' or coalesce(btrim(r->>'name'), '') = '' then raise exception 'CODE_NAME_REQUIRED'; end if;
        insert into app.customer(code, name, segment, is_strategic, source, is_dummy, updated_by)
        values (btrim(r->>'code'), btrim(r->>'name'), nullif(btrim(r->>'segment'), ''), coalesce((r->>'is_strategic')::boolean, false), 'upload', false, auth.uid())
        on conflict (code) do update set name = excluded.name, segment = coalesce(excluded.segment, app.customer.segment), is_strategic = excluded.is_strategic,
          source = 'upload', is_dummy = false, updated_by = auth.uid(), updated_at = now();
      when 'item_group' then        -- 품목 → 제품군 → 담당 부서 (R-INV-09, D-058)
        if coalesce(btrim(r->>'group_code'), '') = '' then raise exception 'GROUP_REQUIRED'; end if;
        if not exists (select 1 from raw.dim_item where item_code = r->>'item_code') then raise exception 'UNKNOWN_ITEM %', r->>'item_code'; end if;
        insert into app.item_group(code, name, owner_dept, source, is_dummy, updated_by)
        values (btrim(r->>'group_code'), coalesce(nullif(btrim(r->>'group_name'), ''), btrim(r->>'group_code')), nullif(r->>'owner_dept', '')::app.role, 'upload', false, auth.uid())
        on conflict (code) do update set name = excluded.name, owner_dept = coalesce(excluded.owner_dept, app.item_group.owner_dept), source = 'upload', is_dummy = false, updated_by = auth.uid(), updated_at = now();
        insert into app.item_group_item(item_code, group_code) values (r->>'item_code', btrim(r->>'group_code'))
        on conflict (item_code) do update set group_code = excluded.group_code;
      when 'demand_line' then       -- 수요자료 상세 라인 (R-SCH-32, D-058)
        if not exists (select 1 from app.customer where code = r->>'customer_code') then raise exception 'UNKNOWN_CUSTOMER %', r->>'customer_code'; end if;
        if not exists (select 1 from raw.dim_item where item_code = r->>'item_code') then raise exception 'UNKNOWN_ITEM %', r->>'item_code'; end if;
        if coalesce((r->>'qty')::numeric, 0) <= 0 then raise exception 'BAD_QTY'; end if;
        insert into app.demand_line(ym, dept, customer_code, item_code, qty, note, submitted_by, source, is_dummy)
        values (r->>'ym', (r->>'dept')::app.role, r->>'customer_code', r->>'item_code', (r->>'qty')::numeric, nullif(r->>'note', ''), auth.uid(), 'upload', false)
        on conflict (ym, dept, customer_code, item_code) do update set qty = excluded.qty, note = excluded.note, submitted_by = auth.uid(), source = 'upload', is_dummy = false, updated_at = now();
      when 'inbound_event' then     -- PO 진행 이벤트 (R-SCH-33, D-058)
        perform app.fn_add_inbound_event((select id from app.inbound where po_no = r->>'po_no' order by id desc limit 1), r->>'stage', (r->>'event_date')::date, nullif(r->>'note', ''));
      end case;
      ok := ok + 1;
    exception when others then
      errs := errs || jsonb_build_object('row', i, 'message', sqlerrm);
    end;
  end loop;

  insert into app.upload_log(file_name, target, row_count, ok_count, error_count, errors, uploaded_by)
  values (p_file_name, p_target, i, ok, i - ok, errs, auth.uid()) returning id into v_id;
  return jsonb_build_object('upload_id', v_id, 'ok_count', ok, 'error_count', i - ok, 'errors', errs);
end $function$;

-- ── 4. analytics 뷰 (화면은 analytics 만 읽는다, D-056) ─────────────────────
create or replace view analytics.v_item_name as                 -- R-UI-15: 전 품목 코드 → 품명
select item_code, description, item_type, family from core.v_item;

create or replace view analytics.v_customer as
select c.code, c.name, c.segment, c.is_strategic, c.is_dummy, c.sales_rep, p.name as sales_rep_name from app.customer c left join app.profiles p on p.user_id = c.sales_rep;

create or replace view analytics.v_customer_allocation as       -- R-AL-52
with need as (
  select customer_code, item_code, sum(qty) as need_qty, string_agg(distinct dept::text, ',' order by dept::text) as depts, bool_or(is_dummy) as is_dummy
  from app.demand_line where ym >= to_char(current_date, 'YYYY-MM') group by 1, 2),
ord as (
  select o.customer_code, o.item_code, sum(o.qty) as order_qty, count(*) as n_orders,
         sum(coalesce(a.temp_qty, 0)) as temp_qty, sum(coalesce(a.firm_qty, 0)) as firm_qty, sum(coalesce(a.hold_qty, 0)) as hold_qty, sum(coalesce(a.forced_qty, 0)) as forced_qty
  from app.sales_order o
  left join lateral (select sum(qty) filter (where kind = 'temp') as temp_qty, sum(qty) filter (where kind = 'firm') as firm_qty,
                            sum(qty) filter (where kind = 'hold') as hold_qty, sum(qty) filter (where forced) as forced_qty
                     from app.allocation al where al.order_id = o.id and al.released_at is null) a on true
  where o.customer_code is not null and o.status in ('review_requested','partial','waiting','confirmed') group by 1, 2)
select coalesce(n.customer_code, o.customer_code) as customer_code, c.name as customer_name, c.segment, coalesce(c.is_strategic, false) as is_strategic,
       coalesce(n.item_code, o.item_code) as item_code, i.description, i.item_type,
       coalesce(n.need_qty, o.order_qty, 0) as need_qty, (n.need_qty is not null) as has_demand_line, n.depts,
       coalesce(o.order_qty, 0) as order_qty, coalesce(o.n_orders, 0) as n_orders,
       coalesce(o.temp_qty, 0) as temp_qty, coalesce(o.firm_qty, 0) as firm_qty, coalesce(o.hold_qty, 0) as hold_qty, coalesce(o.forced_qty, 0) as forced_qty,
       coalesce(o.temp_qty, 0) + coalesce(o.firm_qty, 0) as allocated_qty,
       greatest(coalesce(n.need_qty, o.order_qty, 0) - (coalesce(o.temp_qty, 0) + coalesce(o.firm_qty, 0)), 0) as shortage_qty,
       case when coalesce(n.need_qty, o.order_qty, 0) > 0
            then round(least((coalesce(o.temp_qty, 0) + coalesce(o.firm_qty, 0)) / coalesce(n.need_qty, o.order_qty), 1), 4) end as fill_rate,
       app.fn_available_stock(coalesce(n.item_code, o.item_code)) as available,
       (coalesce(n.is_dummy, false) or coalesce(c.is_dummy, false)) as is_dummy
from need n full outer join ord o on o.customer_code = n.customer_code and o.item_code = n.item_code
left join app.customer c on c.code = coalesce(n.customer_code, o.customer_code)
left join core.v_item i on i.item_code = coalesce(n.item_code, o.item_code);

create or replace view analytics.v_demand_line as               -- R-SCH-32: 일정·제출 화면
select d.id, d.ym, d.dept::text as dept, d.customer_code, c.name as customer_name, d.item_code, i.description, d.qty, d.note, d.is_dummy, d.updated_at, p.name as submitted_by_name
from app.demand_line d left join app.customer c on c.code = d.customer_code left join core.v_item i on i.item_code = d.item_code left join app.profiles p on p.user_id = d.submitted_by;

create or replace view analytics.v_urgent_progress as           -- R-SCH-33
select e.id, e.item_code, i.description, e.qty, e.need_ym, e.need_date, e.reason, e.status::text as status, e.requested_dept::text as requested_dept,
       p.name as requested_by_name, e.created_by, e.created_at, e.is_dummy, e.approval_id,
       e.inbound_id, b.po_no, b.planned_date, b.actual_date, b.status::text as inbound_status, s.name as supplier_name,
       ev.stage::text as last_event_stage, ev.event_date as last_event_date,
       case when e.status = 'pending' then 'requested' when e.status = 'rejected' then 'rejected'
            when e.inbound_id is null then 'approved' when b.status = 'received' then 'received'
            else coalesce(ev.stage::text, 'po_accepted') end as stage,
       ((b.id is not null and b.status <> 'received' and b.planned_date < current_date)
        or (e.status = 'approved' and e.inbound_id is null and e.need_date is not null and e.need_date < current_date)) as delayed
from app.extra_demand e
left join core.v_item i on i.item_code = e.item_code
left join app.profiles p on p.user_id = e.created_by
left join app.inbound b on b.id = e.inbound_id left join app.supplier s on s.id = b.supplier_id
left join lateral (select x.stage, x.event_date from app.inbound_event x where x.inbound_id = e.inbound_id order by x.stage desc limit 1) ev on true
where e.kind = 'urgent';

create or replace view analytics.v_inbound_event as
select x.id, x.inbound_id, x.stage::text as stage, x.event_date, x.note, x.is_dummy, b.po_no, b.item_code from app.inbound_event x join app.inbound b on b.id = x.inbound_id;

create or replace view analytics.v_group_stock as               -- R-INV-09
select g.code as group_code, g.name as group_name, g.owner_dept::text as owner_dept, g.is_dummy, m.item_code, i.description, i.item_type,
       coalesce((select qty from app.inventory_snapshot s where s.item_code = m.item_code and s.stock_class = 'normal' order by snap_date desc limit 1), 0) as on_hand,
       app.fn_available_stock(m.item_code) as available, im.dos_days, im.target_dos_days, im.avg_6m
from app.item_group g join app.item_group_item m on m.group_code = g.code
left join core.v_item i on i.item_code = m.item_code left join analytics.v_item_master im on im.key_code = m.item_code;

create or replace view analytics.v_force_alloc_pool as          -- R-AL-53: 강제배정 대상 주문과 한도
select o.id as order_id, o.order_no, o.item_code, i.description, i.item_type, o.customer_code, c.name as customer_name, c.is_strategic,
       o.qty, o.status::text as status, o.priority, o.requested_at, o.is_dummy,
       o.qty - coalesce(al.total, 0) as shortage, coalesce(al.forced, 0) as order_forced_qty,
       app.fn_available_stock(o.item_code) as available, coalesce(oh.qty, 0) as on_hand,
       nd.need_qty as customer_need, nd.depts, coalesce(cf.q, 0) as customer_forced_qty, coalesce(itf.q, 0) as item_forced_qty,
       floor(coalesce(oh.qty, 0) * st.pct / 100.0) as item_quota, st.pct as quota_pct
from app.sales_order o
cross join (select coalesce((select (value)::numeric from app.system_settings where key = 'force_alloc_max_pct'), 30) as pct) st
join app.customer c on c.code = o.customer_code
left join core.v_item i on i.item_code = o.item_code
left join lateral (select sum(qty) as total, sum(qty) filter (where forced) as forced from app.allocation a where a.order_id = o.id and a.released_at is null) al on true
left join lateral (select qty from app.inventory_snapshot s where s.item_code = o.item_code and s.stock_class = 'normal' order by snap_date desc limit 1) oh on true
left join lateral (select sum(qty) as need_qty, string_agg(distinct dept::text, ',') as depts from app.demand_line d
                   where d.customer_code = o.customer_code and d.item_code = o.item_code and d.ym >= to_char(current_date, 'YYYY-MM')) nd on true
left join lateral (select sum(a.qty) as q from app.allocation a join app.sales_order s2 on s2.id = a.order_id
                   where s2.customer_code = o.customer_code and a.item_code = o.item_code and a.released_at is null and a.forced) cf on true
left join lateral (select sum(a.qty) as q from app.allocation a where a.item_code = o.item_code and a.released_at is null and a.forced) itf on true
where o.status in ('partial','waiting') and o.qty - coalesce(al.total, 0) > 0;

-- ── 5. 대시보드 확장 (R-UI-16). fn_dashboard_v2 는 건드리지 않는다 ───────────────
create or replace function app.fn_dashboard_ext() returns jsonb
language plpgsql stable security definer set search_path = app, analytics, public as $$
declare v_role app.role := app.current_role(); r jsonb := '{}'::jsonb;
begin
  if v_role is null then raise exception 'AUTH_REQUIRED'; end if;
  -- ① 재고 현황 (전 역할)
  r := r || jsonb_build_object('inventory', (
    with latest as (select distinct on (item_code) item_code, qty, snap_date from app.inventory_snapshot where stock_class = 'normal' order by item_code, snap_date desc),
         alloc as (select item_code, sum(qty) as q from app.allocation where released_at is null group by 1),
         x as (select coalesce(i.item_type, 'ETC') as category, l.qty, coalesce(a.q, 0) as allocated
               from latest l left join core.v_item i on i.item_code = l.item_code left join alloc a on a.item_code = l.item_code)
    select jsonb_build_object(
      'snapshot_date', (select max(snap_date) from latest),
      'n_items', (select count(*) from x where qty > 0),
      'zero_stock', (select count(*) from x where qty <= 0),
      'zero_available', (select count(*) from x where qty > 0 and qty - allocated <= 0),
      'low_dos', (select count(*) from analytics.v_item_master m where m.category <> 'SW' and m.target_dos_days is not null and m.dos_days is not null and m.dos_days < m.target_dos_days),
      'by_cat', (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'on_hand', on_hand, 'allocated', allocated, 'available', available, 'n_items', n) order by category), '[]'::jsonb)
                 from (select category, sum(qty) as on_hand, sum(least(allocated, qty)) as allocated, sum(greatest(qty - allocated, 0)) as available, count(*) filter (where qty > 0) as n from x group by 1) c))));
  -- ② 담당 품목 재고 (그룹 담당 부서, SCM·관리자는 전체)
  r := r || jsonb_build_object('groups', (
    select coalesce(jsonb_agg(g order by g->>'group_name'), '[]'::jsonb) from (
      select jsonb_build_object('group_code', group_code, 'group_name', group_name, 'owner_dept', owner_dept, 'is_dummy', bool_or(is_dummy),
               'n_items', count(*), 'on_hand', sum(on_hand), 'available', sum(greatest(available, 0)),
               'zero_available', count(*) filter (where available <= 0),
               'items', (select jsonb_agg(jsonb_build_object('item_code', item_code, 'description', description, 'on_hand', on_hand, 'available', available, 'dos_days', dos_days) order by available, item_code)
                         from (select * from analytics.v_group_stock s2 where s2.group_code = s.group_code order by available, item_code limit 8) t)) as g
      from analytics.v_group_stock s
      where s.owner_dept = v_role::text or v_role in ('item_manager','scm_lead','admin')
      group by group_code, group_name, owner_dept) q));
  -- ③ 긴급발주 진행 (전 역할)
  r := r || jsonb_build_object('urgent', (
    select jsonb_build_object(
      'open', count(*) filter (where stage not in ('received','rejected')),
      'delayed', count(*) filter (where delayed and stage not in ('received','rejected')),
      'pending_approval', count(*) filter (where stage = 'requested'),
      'received_30d', count(*) filter (where stage = 'received' and actual_date >= current_date - 30),
      'mine_open', count(*) filter (where created_by = auth.uid() and stage not in ('received','rejected')),
      'stages', (select coalesce(jsonb_agg(jsonb_build_object('stage', stage, 'n', n)), '[]'::jsonb) from (select stage, count(*) as n from analytics.v_urgent_progress where stage <> 'rejected' group by 1) s),
      'recent', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'item_code', item_code, 'description', description, 'qty', qty, 'stage', stage, 'delayed', delayed,
                        'planned_date', planned_date, 'need_date', need_date, 'requested_dept', requested_dept, 'po_no', po_no) order by created_at desc), '[]'::jsonb)
                 from (select * from analytics.v_urgent_progress where stage not in ('received','rejected') order by delayed desc, created_at desc limit 6) t))
    from analytics.v_urgent_progress));
  -- ④ 고객사 배정 (R-AL-52)
  r := r || jsonb_build_object('customer', (
    select jsonb_build_object(
      'customers', count(distinct customer_code), 'need', coalesce(sum(need_qty), 0), 'allocated', coalesce(sum(least(allocated_qty, need_qty)), 0), 'shortage', coalesce(sum(shortage_qty), 0),
      'short_customers', count(distinct customer_code) filter (where shortage_qty > 0),
      'top', (select coalesce(jsonb_agg(jsonb_build_object('customer_code', customer_code, 'customer_name', customer_name, 'need', need, 'allocated', allocated, 'shortage', shortage) order by shortage desc, customer_name), '[]'::jsonb)
              from (select customer_code, customer_name, sum(need_qty) as need, sum(least(allocated_qty, need_qty)) as allocated, sum(shortage_qty) as shortage
                    from analytics.v_customer_allocation group by 1, 2 order by sum(shortage_qty) desc, customer_name limit 8) t))
    from analytics.v_customer_allocation));
  return r;
end $$;
