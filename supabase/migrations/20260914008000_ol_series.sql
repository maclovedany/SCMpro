-- OL 시계열 연결 (D-040, R-FC-13): ① 기종 OL/ACT 는 raw 파일 + 업로드 추가분(app.mc_plan_extra) 의 UNION(core.v_mc_plan_actual)
--   ② 품목은 시스템이 제출한 OL(app.ol_submission) 이 SCM OL 시계열 → analytics.v_item_ol, 실적 대비 정확도 v_item_ol_accuracy
create table if not exists app.mc_plan_extra (
  model_base text not null, ym char(7) not null, sales_ol numeric, scm_ol numeric, act numeric,
  source text not null default 'upload' check (source in ('upload','manual','seed','parsed')),
  updated_by uuid, updated_at timestamptz default now(), primary key (model_base, ym)
);
comment on table app.mc_plan_extra is '기종 OL/ACT 추가분 (FY26~ 파일). raw 수정 금지 → core.v_mc_plan_actual 에서 raw 와 합침, 같은 기종·월은 추가분 우선 (D-040)';
alter table app.mc_plan_extra enable row level security;
drop policy if exists p_read on app.mc_plan_extra;
create policy p_read on app.mc_plan_extra for select to authenticated using (true);
grant select on app.mc_plan_extra to authenticated; grant all on app.mc_plan_extra to service_role;

-- 기종·월로 합산한 raw + 추가분 (같은 키는 추가분이 raw 를 덮음). 엔진·v_mc_compare 의 단일 소스
create or replace view core.v_mc_plan_actual as
with r as (
  select p.model_base, max(coalesce(p.biz, m.biz)) as biz, p.ym,
         case when count(p.sales_ol) > 0 then sum(p.sales_ol) end as sales_ol,
         case when count(p.scm_ol) > 0 then sum(p.scm_ol) end as scm_ol,
         case when count(p.act) > 0 then sum(p.act) end as act
  from raw.fact_mc_plan_actual p
  left join (select model_base, max(biz) biz from raw.dim_model where biz is not null group by 1) m on m.model_base = p.model_base
  where p.model_base is not null group by p.model_base, p.ym
)
select coalesce(x.model_base, r.model_base) as model_base, coalesce(r.biz, m.biz) as biz, coalesce(x.ym, r.ym) as ym,
       coalesce(x.sales_ol, r.sales_ol) as sales_ol, coalesce(x.scm_ol, r.scm_ol) as scm_ol, coalesce(x.act, r.act) as act,
       case when x.model_base is not null then 'extra' else 'raw' end as source
from r full join app.mc_plan_extra x on x.model_base = r.model_base and x.ym = r.ym
left join (select model_base, max(biz) biz from raw.dim_model where biz is not null group by 1) m on m.model_base = coalesce(x.model_base, r.model_base);
comment on view core.v_mc_plan_actual is '기종×월 Sales OL·SCM OL·ACT = raw(변형 합산) ∪ app.mc_plan_extra (추가분 우선). D-040';
grant select on core.v_mc_plan_actual to authenticated, service_role;

-- 기종 비교 뷰를 단일 소스로 재정의 (컬럼 동일)
create or replace view analytics.v_mc_compare as
with p as (select model_base, biz, ym, sales_ol, scm_ol, act from core.v_mc_plan_actual),
bt as (
  select r.key_code as model_base, r.ym, r.value as system_fc, r.method, r.run_id
  from app.forecast_result r join analytics.v_forecast_latest_run l on l.id = r.run_id and l.run_type = 'backtest'
  where r.level = 'model' and r.is_champion
), pr as (
  select r.key_code as model_base, r.ym, r.value as system_fc, r.lower, r.upper, r.method
  from app.forecast_result r join analytics.v_forecast_latest_run l on l.id = r.run_id and l.run_type = 'production'
  where r.level = 'model' and r.is_champion
)
select coalesce(p.model_base, bt.model_base, pr.model_base) as model_base, p.biz, coalesce(p.ym, bt.ym, pr.ym) as ym,
       p.sales_ol, p.scm_ol, p.act, coalesce(bt.system_fc, pr.system_fc) as system_fc, coalesce(bt.method, pr.method) as method,
       pr.lower, pr.upper,
       case when to_number(substr(coalesce(p.ym, bt.ym, pr.ym), 6, 2), '99') >= 4 then to_number(substr(coalesce(p.ym, bt.ym, pr.ym), 1, 4), '9999') else to_number(substr(coalesce(p.ym, bt.ym, pr.ym), 1, 4), '9999') - 1 end as fy
from p full join bt on bt.model_base = p.model_base and bt.ym = p.ym
full join pr on pr.model_base = coalesce(p.model_base, bt.model_base) and pr.ym = coalesce(p.ym, bt.ym);

-- 품목 OL 시계열: 시스템 제출 OL (계획 승인 시 ol_submission). 같은 품목·월은 최신 제출
create or replace view analytics.v_item_ol as
select distinct on (o.item_code, o.target_ym) o.item_code as key_code, o.target_ym as ym, o.qty, o.submitted_at, o.plan_id, 'system'::text as source
from app.ol_submission o order by o.item_code, o.target_ym, o.submitted_at desc;
comment on view analytics.v_item_ol is '품목 SCM OL 시계열 = 시스템 제출 OL (D-040). Flex 기준값(R-FC-20)·정확도 채점·ol_bias 입력';
grant select on analytics.v_item_ol to authenticated, service_role;

-- 제출 OL vs 실적 (실적 있는 달만). 품목별 + 카테고리/전체
create or replace view analytics.v_item_ol_accuracy as
with lastm as (select max(ym) as ym from analytics.v_item_monthly where qty > 0),
j as (
  select o.key_code, m.category, o.ym, o.qty as ol, m.qty as act
  from analytics.v_item_ol o join analytics.v_item_monthly m on m.key_code = o.key_code and m.ym = o.ym, lastm
  where o.ym <= lastm.ym
)
select key_code, max(category) as category, count(*)::int as n, min(ym) as first_ym, max(ym) as last_ym,
       round(sum(act), 1) as sum_actual,
       round(sum(abs(ol - act)) / nullif(sum(act), 0), 4) as wape,
       round(sum(ol - act) / nullif(sum(act), 0), 4) as bias
from j group by key_code;
comment on view analytics.v_item_ol_accuracy is '품목별 제출 OL 정확도 (WAPE·Bias, 실적 있는 달만). D-040';
grant select on analytics.v_item_ol_accuracy to authenticated, service_role;

create or replace view analytics.v_item_ol_accuracy_summary as
with lastm as (select max(ym) as ym from analytics.v_item_monthly where qty > 0),
j as (
  select o.key_code, m.category, o.ym, o.qty as ol, m.qty as act
  from analytics.v_item_ol o join analytics.v_item_monthly m on m.key_code = o.key_code and m.ym = o.ym, lastm
  where o.ym <= lastm.ym
)
select 'category' as level, category as key, count(distinct key_code)::int as n_items, count(*)::int as n, round(sum(act), 1) as sum_actual,
       round(sum(abs(ol - act)) / nullif(sum(act), 0), 4) as wape, round(sum(ol - act) / nullif(sum(act), 0), 4) as bias
from j group by category
union all
select 'total', 'item', count(distinct key_code)::int, count(*)::int, round(sum(act), 1), round(sum(abs(ol - act)) / nullif(sum(act), 0), 4), round(sum(ol - act) / nullif(sum(act), 0), 4) from j;
grant select on analytics.v_item_ol_accuracy_summary to authenticated, service_role;

-- 업로드 대상에 mc_plan_actual 추가 (fn_apply_upload 전체 재정의 — 000500 과 동일 + 분기 1개)
create or replace function app.fn_apply_upload(p_target text, p_rows jsonb, p_mode text, p_file_name text)
returns jsonb language plpgsql security definer set search_path = app, public as $$
declare r jsonb; i int := 0; ok int := 0; errs jsonb := '[]'::jsonb; v_id uuid; v_role app.role := app.current_role();
begin
  if v_role is null or v_role not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  if p_target not in ('inventory_snapshot','inbound','item_setting','attach_rate','supplier','eol_eos','holiday','shipment_extra','mc_plan_actual') then
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
      end case;
      ok := ok + 1;
    exception when others then
      errs := errs || jsonb_build_object('row', i, 'message', sqlerrm);
    end;
  end loop;

  insert into app.upload_log(file_name, target, row_count, ok_count, error_count, errors, uploaded_by)
  values (p_file_name, p_target, i, ok, i - ok, errs, auth.uid()) returning id into v_id;
  return jsonb_build_object('upload_id', v_id, 'ok_count', ok, 'error_count', i - ok, 'errors', errs);
end $$;
