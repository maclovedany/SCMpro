-- ============================================================
-- 20260913002000_order.sql — SP3 발주량 산출 (spec docs/specs/2026-09-13-sp3-order-design.md)
-- ============================================================
do $$ begin create type app.extra_kind as enum ('confirmed_order','meeting_approval','bulkdeal');
exception when duplicate_object then null; end $$;
do $$ begin create type app.extra_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;
do $$ begin create type app.plan_status as enum ('draft','confirmed','approved','rejected');
exception when duplicate_object then null; end $$;

alter table app.item_setting add column if not exists supplier_id int references app.supplier(id);
insert into app.system_settings(key, value, description) values ('default_lead_time_days', '30', '공급처 미지정 품목 리드타임 (R-SCH-02)') on conflict (key) do nothing;

create table if not exists app.extra_demand (
  id uuid primary key default gen_random_uuid(),
  kind app.extra_kind not null, item_code text not null, need_ym char(7) not null, qty numeric not null check (qty > 0),
  order_no text, customer text, model_base text, reason text,
  status app.extra_status not null default 'approved', approval_id uuid,
  created_by uuid, created_at timestamptz default now()
);
create index if not exists ix_extra_item on app.extra_demand(item_code, need_ym, status);
comment on table app.extra_demand is '추가 수요: 수주확정(주문번호 필수, 자동 반영) · 수급회의 승인 · Bulkdeal(팀장 승인) (R-OQ-20~25)';

create table if not exists app.order_plan (
  id uuid primary key default gen_random_uuid(), plan_ym char(7) not null, status app.plan_status not null default 'draft',
  note text, summary jsonb, approval_id uuid,
  created_by uuid, created_at timestamptz default now(), confirmed_by uuid, confirmed_at timestamptz, approved_by uuid, approved_at timestamptz
);
create index if not exists ix_plan_ym on app.order_plan(plan_ym, created_at desc);

create table if not exists app.order_plan_line (
  id bigserial primary key, plan_id uuid not null references app.order_plan(id) on delete cascade,
  key_code text not null, category text, supplier_id int, need_ym char(7) not null, lead_months int,
  forecast_need numeric, extras_need numeric, on_hand numeric, inbound_until_need numeric, start_need numeric, target_stock numeric,
  avg_6m numeric, target_dos_days int, required_qty numeric, flex_base numeric, flex_pct numeric, flex_min numeric, flex_max numeric, flex_hit boolean default false,
  chosen_qty numeric, moq int, final_qty numeric, override_qty numeric, override_reason text, override_by uuid, override_at timestamptz,
  end_after numeric, dos_after numeric, stockout_risk boolean default false, blocked boolean default false,
  unit_price numeric, amount numeric, rationale jsonb, projection jsonb,
  unique (plan_id, key_code)
);
create index if not exists ix_line_flags on app.order_plan_line(plan_id, stockout_risk, blocked);

create table if not exists app.ol_submission (
  id bigserial primary key, plan_id uuid references app.order_plan(id), item_code text not null, target_ym char(7) not null, qty numeric not null,
  submitted_at timestamptz default now(), unique (plan_id, item_code)
);
create index if not exists ix_ols_item on app.ol_submission(item_code, target_ym, submitted_at desc);

do $$ declare t text; begin
  foreach t in array array['extra_demand','order_plan','order_plan_line','ol_submission'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('drop policy if exists p_read on app.%I', t);
    execute format('create policy p_read on app.%I for select to authenticated using (true)', t);
  end loop;
  foreach t in array array['extra_demand','order_plan','order_plan_line'] loop
    execute format('drop trigger if exists trg_audit on app.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on app.%I for each row execute function app.fn_audit()', t);
  end loop; end $$;

-- 계산 입력 (품목별 묶음). 예측 = 최신 프로덕션 챔피언, 없으면 6M 평균 flat.
drop function if exists app.fn_order_inputs(char);
create or replace function app.fn_order_inputs(p_plan_ym char(7), p_category text default null) returns jsonb
language sql stable security definer set search_path = app, analytics, public as $$
with s as (select key, value from app.system_settings),
lat as (select id, train_to from analytics.v_forecast_latest_run where run_type = 'production'),
fc as (select key_code, jsonb_object_agg(ym, round(value, 3)) as f from analytics.v_forecast_latest group by key_code),
inb as (select item_code, jsonb_object_agg(ym, q) as i from (select item_code, to_char(planned_date, 'YYYY-MM') ym, sum(qty) q from app.inbound where status <> 'received' group by 1, 2) x group by item_code),
ex as (select item_code, jsonb_object_agg(ym, q) as e from (select item_code, need_ym ym, sum(qty) q from app.extra_demand where status = 'approved' group by 1, 2) x group by item_code),
base as (select o.item_code, jsonb_object_agg(o.target_ym, o.qty) as b from (
           select distinct on (item_code, target_ym) item_code, target_ym, qty from app.ol_submission order by item_code, target_ym, submitted_at desc) o group by o.item_code)
select jsonb_build_object(
  'plan_ym', p_plan_ym,
  'data_last_ym', (select train_to from lat),
  'settings', (select jsonb_object_agg(key, value) from s),
  'items', coalesce((select jsonb_agg(jsonb_build_object(
      'key_code', m.key_code, 'category', m.category, 'avg_6m', m.avg_6m, 'on_hand', m.on_hand, 'target_dos_days', m.target_dos_days, 'moq', m.moq,
      'unit_price', st.unit_price, 'supplier_id', st.supplier_id, 'lead_time_days', sp.lead_time_days,
      'forecast', coalesce(fc.f, '{}'::jsonb), 'inbound', coalesce(inb.i, '{}'::jsonb), 'extras', coalesce(ex.e, '{}'::jsonb), 'flex_base', coalesce(base.b, '{}'::jsonb)))
    from analytics.v_item_master m
    left join app.item_setting st on st.item_code = m.key_code left join app.supplier sp on sp.id = st.supplier_id
    left join fc on fc.key_code = m.key_code left join inb on inb.item_code = m.key_code left join ex on ex.item_code = m.key_code left join base on base.item_code = m.key_code
    where m.category <> 'SW' and (p_category is null or m.category = p_category)), '[]'::jsonb)
) $$;

-- 파라미터로 인한 일반화 계획(generic plan) 이 5초 이상 걸리는 문제 → 항상 맞춤 계획 (0.7초)
alter function app.fn_order_inputs(char, text) set plan_cache_mode = force_custom_plan;

-- 계획 저장 (draft 생성/교체). 서버(service role)에서 호출하므로 p_user 로 호출자 전달. 라인은 fn_append_plan_lines 로 청크 저장 (authenticated 8s 제한 회피)
create or replace function app.fn_save_order_plan(p_plan_ym char(7), p_note text, p_user uuid) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare v_id uuid; v_role app.role;
begin
  select role into v_role from app.profiles where user_id = p_user;
  if v_role is null or v_role not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  delete from app.order_plan where plan_ym = p_plan_ym and status = 'draft';
  insert into app.order_plan(plan_ym, note, created_by) values (p_plan_ym, p_note, p_user) returning id into v_id;
  return v_id;
end $$;

create or replace function app.fn_append_plan_lines(p_plan_id uuid, p_lines jsonb) returns int
language plpgsql security definer set search_path = app, public as $$
declare n int;
begin
  insert into app.order_plan_line(plan_id, key_code, category, supplier_id, need_ym, lead_months, forecast_need, extras_need, on_hand, inbound_until_need, start_need, target_stock,
    avg_6m, target_dos_days, required_qty, flex_base, flex_pct, flex_min, flex_max, flex_hit, chosen_qty, moq, final_qty, end_after, dos_after, stockout_risk, blocked, unit_price, amount, rationale, projection)
  select p_plan_id, l->>'key_code', l->>'category', (l->>'supplier_id')::int, l->>'need_ym', (l->>'lead_months')::int, (l->>'forecast_need')::numeric, (l->>'extras_need')::numeric,
    (l->>'on_hand')::numeric, (l->>'inbound_until_need')::numeric, (l->>'start_need')::numeric, (l->>'target_stock')::numeric, (l->>'avg_6m')::numeric, (l->>'target_dos_days')::int,
    (l->>'required_qty')::numeric, (l->>'flex_base')::numeric, (l->>'flex_pct')::numeric, (l->>'flex_min')::numeric, (l->>'flex_max')::numeric, coalesce((l->>'flex_hit')::boolean, false),
    (l->>'chosen_qty')::numeric, (l->>'moq')::int, (l->>'final_qty')::numeric, (l->>'end_after')::numeric, (l->>'dos_after')::numeric,
    coalesce((l->>'stockout_risk')::boolean, false), coalesce((l->>'blocked')::boolean, false), (l->>'unit_price')::numeric, (l->>'amount')::numeric, l->'rationale', l->'projection'
  from jsonb_array_elements(p_lines) l;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function app.fn_finalize_order_plan(p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare v_sum jsonb;
begin
  select jsonb_build_object('lines', count(*), 'amount', coalesce(sum(coalesce(override_qty, final_qty) * coalesce(unit_price, 0)), 0),
      'qty', coalesce(sum(coalesce(override_qty, final_qty)), 0), 'stockout', count(*) filter (where stockout_risk), 'blocked', count(*) filter (where blocked), 'flex_hit', count(*) filter (where flex_hit), 'overrides', count(*) filter (where override_qty is not null))
  into v_sum from app.order_plan_line where plan_id = p_plan_id;
  update app.order_plan set summary = v_sum where id = p_plan_id;
  return v_sum;
end $$;

create or replace function app.fn_override_line(p_line_id bigint, p_qty numeric, p_reason text) returns void
language plpgsql security definer set search_path = app, public as $$
declare v_role app.role := app.current_role(); v_plan uuid; v_status app.plan_status;
begin
  if v_role is null or v_role not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  if p_qty is not null and (p_reason is null or length(trim(p_reason)) = 0) then raise exception 'REASON_REQUIRED'; end if;
  select plan_id into v_plan from app.order_plan_line where id = p_line_id;
  select status into v_status from app.order_plan where id = v_plan;
  if v_status <> 'draft' then raise exception 'PLAN_NOT_DRAFT'; end if;
  update app.order_plan_line l set override_qty = p_qty, override_reason = p_reason, override_by = auth.uid(), override_at = now(),
    amount = coalesce(p_qty, final_qty) * coalesce(unit_price, 0),
    end_after = start_need + coalesce(p_qty, final_qty) - coalesce(forecast_need, 0) - coalesce(extras_need, 0),
    dos_after = case when avg_6m > 0 then round((start_need + coalesce(p_qty, final_qty) - coalesce(forecast_need, 0) - coalesce(extras_need, 0)) / avg_6m * 30) end
  where id = p_line_id;
  update app.order_plan p set summary = (select jsonb_build_object('lines', count(*), 'amount', coalesce(sum(coalesce(override_qty, final_qty) * coalesce(unit_price, 0)), 0),
      'qty', coalesce(sum(coalesce(override_qty, final_qty)), 0), 'stockout', count(*) filter (where stockout_risk), 'blocked', count(*) filter (where blocked), 'flex_hit', count(*) filter (where flex_hit), 'overrides', count(*) filter (where override_qty is not null))
      from app.order_plan_line where plan_id = v_plan) where p.id = v_plan;
end $$;

-- 확정 (품목담당자) → 승인 요청 (R-OQ-40). blocked 라인이 있으면 거부 (R-OQ-03)
create or replace function app.fn_confirm_order_plan(p_plan_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare v_role app.role := app.current_role(); v_blocked int; v_appr uuid; v_ym char(7);
begin
  if v_role is null or v_role not in ('item_manager','admin') then raise exception 'FORBIDDEN'; end if;
  select count(*) filter (where blocked), max(plan_ym) into v_blocked, v_ym from app.order_plan_line l join app.order_plan p on p.id = l.plan_id where l.plan_id = p_plan_id;
  if v_blocked > 0 then raise exception 'BLOCKED_LINES %', v_blocked; end if;
  v_appr := app.fn_request_approval('order_plan', 'app.order_plan', p_plan_id::text, (select summary from app.order_plan where id = p_plan_id), coalesce(p_reason, '발주 계획 ' || v_ym || ' 확정'));
  update app.order_plan set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now(), approval_id = v_appr where id = p_plan_id;
  return v_appr;
end $$;

-- 추가 수요 등록 (R-OQ-20~25)
drop function if exists app.fn_add_extra_demand(text, text, char, numeric, text, text, text, text);
create or replace function app.fn_add_extra_demand(p_kind text, p_item text, p_need_ym char(7), p_qty numeric, p_order_no text, p_customer text, p_model text, p_reason text) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare v_id uuid; v_role app.role := app.current_role(); v_appr uuid; v_dup jsonb := null;
begin
  p_order_no := nullif(trim(p_order_no), ''); p_customer := nullif(trim(p_customer), ''); p_model := nullif(trim(p_model), ''); p_reason := nullif(trim(p_reason), '');
  if v_role is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from raw.dim_item where item_code = p_item) then raise exception 'UNKNOWN_ITEM %', p_item; end if;
  if p_kind = 'confirmed_order' and (p_order_no is null or length(trim(p_order_no)) = 0) then raise exception 'ORDER_NO_REQUIRED'; end if;
  if p_kind = 'meeting_approval' and v_role not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  if p_kind = 'bulkdeal' and (p_reason is null or p_customer is null or p_model is null) then raise exception 'BULKDEAL_FIELDS_REQUIRED'; end if;
  insert into app.extra_demand(kind, item_code, need_ym, qty, order_no, customer, model_base, reason, status, created_by)
  values (p_kind::app.extra_kind, p_item, p_need_ym, p_qty, p_order_no, p_customer, p_model, p_reason, (case when p_kind = 'bulkdeal' then 'pending' else 'approved' end)::app.extra_status, auth.uid()) returning id into v_id;
  if p_kind = 'bulkdeal' then
    v_appr := app.fn_request_approval('bulkdeal', 'app.extra_demand', v_id::text, jsonb_build_object('item_code', p_item, 'qty', p_qty, 'need_ym', p_need_ym, 'customer', p_customer, 'model', p_model), p_reason);
    update app.extra_demand set approval_id = v_appr where id = v_id;
  end if;
  -- R-OQ-26: 수주확정 등록 시 같은 품목·필요월의 승인 Bulkdeal 이 있으면 이중 계상 경고
  if p_kind = 'confirmed_order' then
    select jsonb_agg(jsonb_build_object('id', id, 'qty', qty, 'customer', customer, 'model', model_base, 'order_no', order_no)) into v_dup
    from app.extra_demand where kind = 'bulkdeal' and status = 'approved' and item_code = p_item and need_ym = p_need_ym;
  end if;
  return jsonb_build_object('id', v_id, 'bulkdeal_overlap', coalesce(v_dup, '[]'::jsonb));
end $$;

-- fn_decide_approval: order_plan / bulkdeal 분기 추가
create or replace function app.fn_decide_approval(p_id uuid, p_decision text, p_comment text)
returns void language plpgsql security definer set search_path = app, public as $$
declare a app.approval; v_role app.role := app.current_role(); v_plan uuid;
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
  elsif a.kind = 'forecast_tuning' then
    perform app.fn_apply_tuning(a, p_decision);
  elsif a.kind = 'order_plan' then
    v_plan := a.target_pk::uuid;
    if p_decision = 'approved' then
      update app.order_plan set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = v_plan;
      insert into app.ol_submission(plan_id, item_code, target_ym, qty)
      select v_plan, key_code, need_ym, coalesce(override_qty, final_qty) from app.order_plan_line where plan_id = v_plan and coalesce(override_qty, final_qty) > 0
      on conflict (plan_id, item_code) do nothing;
    else
      update app.order_plan set status = 'draft', confirmed_by = null, confirmed_at = null, approval_id = null where id = v_plan;
    end if;
  elsif a.kind = 'bulkdeal' then
    update app.extra_demand set status = case when p_decision = 'approved' then 'approved' else 'rejected' end::app.extra_status where id = a.target_pk::uuid;
  end if;
  -- priority_alloc 분기는 SP4

  update app.approval set status = p_decision::app.approval_status, approver = auth.uid(), comment = p_comment, decided_at = now() where id = p_id;
  perform app.notify_user(a.requested_by, 'approval_decided', case when p_decision = 'approved' then '승인됨: ' else '반려됨: ' end || a.kind::text,
    a.target_pk || coalesce(' — ' || p_comment, ''), jsonb_build_object('approval_id', p_id, 'decision', p_decision));
end $$;

create or replace view analytics.v_order_plan_summary as
select p.id, p.plan_ym, p.status, p.created_at, p.approved_at, p.summary,
       (select count(*) from app.order_plan_line l where l.plan_id = p.id) as n_lines,
       (select coalesce(sum(coalesce(l.override_qty, l.final_qty) * coalesce(l.unit_price, 0)), 0) from app.order_plan_line l where l.plan_id = p.id) as amount
from app.order_plan p;

-- 대시보드에 발주 카드
create or replace function app.fn_dashboard_summary() returns jsonb
language sql stable security definer set search_path = app, analytics, public as $$
  select jsonb_build_object(
    'items_by_category', coalesce((select jsonb_object_agg(category, n) from (select category, count(*) n from analytics.v_item_master group by 1) c), '{}'::jsonb),
    'dummy_ratio', (select round(avg(case when is_dummy then 1 else 0 end), 3) from app.item_setting),
    'pending_approvals', (select count(*) from app.approval where status = 'pending'),
    'last_upload', (select to_jsonb(u) from (select file_name, uploaded_at, ok_count, error_count from app.upload_log order by uploaded_at desc limit 1) u),
    'snapshot_date', (select max(snap_date) from app.inventory_snapshot where stock_class = 'normal'),
    'missing_target_dos', (select count(*) from analytics.v_item_master m where m.target_dos_days is null and m.category <> 'SW'),
    'forecast', (select jsonb_build_object('production_run', (select to_jsonb(x) from (select id, train_to, horizon, finished_at from analytics.v_forecast_latest_run where run_type = 'production') x),
                                            'backtest_run', (select to_jsonb(x) from (select id, eval_fy, finished_at, summary from analytics.v_forecast_latest_run where run_type = 'backtest') x),
                                            'pending_proposals', (select count(*) from app.forecast_tuning_proposal where status in ('pending','requested')))),
    'order', (select to_jsonb(x) from (select id, plan_ym, status, summary, amount from analytics.v_order_plan_summary order by plan_ym desc, created_at desc limit 1) x)
  ) $$;

-- 카테고리별 월 전개 합계 (트리 그리드 상위 행). projection jsonb 를 unnest 해 집계
create or replace function app.fn_plan_cat_projection(p_plan_id uuid) returns jsonb
language sql stable security definer set search_path = app, public as $$
  with x as (
    select l.category, p->>'ym' as ym, (p->>'forecast')::numeric f, (p->>'inbound')::numeric i, (p->>'extras')::numeric e, (p->>'end')::numeric en, (p->>'order')::numeric o,
           case when p->>'ym' = l.need_ym then coalesce(l.override_qty, l.final_qty) else 0 end as fo
    from app.order_plan_line l, jsonb_array_elements(coalesce(l.projection, '[]'::jsonb)) p where l.plan_id = p_plan_id
  )
  select coalesce(jsonb_object_agg(category, m), '{}'::jsonb) from (
    select coalesce(category, '기타') category, jsonb_object_agg(ym, jsonb_build_object('forecast', round(sf, 1), 'inbound', si, 'extras', se, 'end', round(sen, 1), 'order', so, 'final', sfo, 'n', n)) m
    from (select category, ym, sum(f) sf, sum(i) si, sum(e) se, sum(en) sen, sum(o) so, sum(fo) sfo, count(*) n from x group by 1, 2) y group by category) z $$;
alter function app.fn_plan_cat_projection(uuid) set plan_cache_mode = force_custom_plan;
