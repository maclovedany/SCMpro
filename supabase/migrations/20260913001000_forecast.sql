-- ============================================================
-- 20260913001000_forecast.sql — SP2 예측 엔진 (spec docs/specs/2026-09-13-sp2-forecast-design.md §7)
-- ============================================================
do $$ begin create type app.run_type as enum ('backtest','production');
exception when duplicate_object then null; end $$;
do $$ begin create type app.run_status as enum ('requested','running','done','failed');
exception when duplicate_object then null; end $$;
alter type app.approval_kind add value if not exists 'forecast_tuning';

-- 기법 레지스트리 (D-018, R-FC-34)
create table if not exists app.forecast_method (
  key text primary key, name text not null, family text not null,
  patterns text[] not null default '{smooth,erratic,intermittent,lumpy}',   -- 적용 수요 패턴
  abc_scope text[] not null default '{A,B,C}',                               -- 적용 ABC 등급 (무거운 기법은 A/B)
  level text not null default 'item' check (level in ('item','model','both')),
  min_history int not null default 6, enabled boolean not null default true, is_baseline boolean not null default false,
  params jsonb not null default '{}'::jsonb, sort int not null default 100, description text,
  updated_by uuid, updated_at timestamptz default now()
);
insert into app.forecast_method(key,name,family,patterns,abc_scope,level,min_history,is_baseline,params,sort,description) values
 ('baseline6','6개월 평균 (기준선)','simple','{smooth,erratic,intermittent,lumpy}','{A,B,C}','both',3,true,'{"window":6}',1,'R-FC-31 기준선. 항상 on'),
 ('ma3','이동평균 3M','simple','{smooth,erratic,intermittent,lumpy}','{A,B,C}','both',3,false,'{"window":3}',10,null),
 ('ma12','이동평균 12M','simple','{smooth,erratic,intermittent,lumpy}','{A,B,C}','both',12,false,'{"window":12}',11,null),
 ('snaive','전년동월×추세','simple','{smooth,erratic,intermittent,lumpy}','{A,B,C}','both',24,false,'{"trend_window":6}',12,'FY 계절성 (R-FC-08)'),
 ('ses','단순지수평활','ets','{smooth,erratic}','{A,B,C}','both',6,false,'{}',20,null),
 ('holt','Holt 추세(감쇠)','ets','{smooth}','{A,B,C}','both',12,false,'{"damped":true}',21,null),
 ('hw','Holt-Winters 가법 12','ets','{smooth,erratic}','{A,B}','both',24,false,'{"seasonal":"add","period":12}',22,null),
 ('croston','Croston','intermittent','{intermittent,lumpy}','{A,B,C}','item',6,false,'{"alpha":0.1}',30,null),
 ('sba','SBA (Syntetos-Boylan)','intermittent','{intermittent,lumpy}','{A,B,C}','item',6,false,'{"alpha":0.1}',31,null),
 ('arima','AutoARIMA','stat','{smooth,erratic}','{A,B}','both',24,false,'{"season_length":12}',40,'statsforecast'),
 ('prophet','Prophet','stat','{smooth,erratic}','{A}','both',24,false,'{"yearly_seasonality":true}',41,'느림 — A 등급만'),
 ('lgbm','LightGBM 전역 회귀','ml','{smooth,erratic,intermittent,lumpy}','{A,B,C}','item',12,false,'{"lags":12,"n_estimators":300,"learning_rate":0.05}',50,'전 품목 1회 학습'),
 ('ol_bias','OL 편향 보정 (기종)','mc','{smooth,erratic,intermittent,lumpy}','{A,B,C}','model',6,false,'{"source":"scm_ol"}',60,'scm_ol × (1 − 과거 FY bias). D-002')
on conflict (key) do nothing;

-- ABC-XYZ 셀별 정책 (R-FC-35)
create table if not exists app.forecast_policy (
  cell text primary key,                      -- 'AX' … 'CZ'
  methods text[] not null, min_history int not null default 6, note text,
  updated_by uuid, updated_at timestamptz default now()
);
insert into app.forecast_policy(cell, methods, note) values
 ('AX','{baseline6,ma3,ma12,snaive,ses,holt,hw,arima,prophet,lgbm}','전체'),('AY','{baseline6,ma3,ma12,snaive,ses,holt,hw,arima,prophet,lgbm}','전체'),
 ('AZ','{baseline6,ma3,ma12,snaive,croston,sba,lgbm}','간헐+ML'),
 ('BX','{baseline6,ma3,ma12,snaive,ses,holt,hw,arima,lgbm}',null),('BY','{baseline6,ma3,ma12,snaive,ses,holt,hw,arima,lgbm}',null),
 ('BZ','{baseline6,ma3,ma12,snaive,croston,sba,lgbm}',null),
 ('CX','{baseline6,ma3,ma12,snaive,ses,holt}',null),('CY','{baseline6,ma3,ma12,snaive,ses,holt,croston,sba}',null),
 ('CZ','{baseline6,ma3,croston,sba}','단순')
on conflict (cell) do nothing;

create table if not exists app.forecast_run (
  id uuid primary key default gen_random_uuid(),
  run_type app.run_type not null, eval_fy int, train_from char(7), train_to char(7), horizon int,
  status app.run_status not null default 'requested', params_snapshot jsonb, summary jsonb, error text,
  requested_by uuid, created_at timestamptz default now(), started_at timestamptz, finished_at timestamptz
);
create index if not exists ix_run_status on app.forecast_run(status, created_at desc);

create table if not exists app.forecast_result (
  run_id uuid not null references app.forecast_run(id) on delete cascade,
  level text not null check (level in ('item','model')), key_code text not null, category text,
  ym char(7) not null, method text not null, value numeric, lower numeric, upper numeric,
  is_champion boolean not null default false, actual numeric,
  primary key (run_id, level, key_code, method, ym)
);
create index if not exists ix_fr_champion on app.forecast_result(run_id, is_champion, key_code);
create index if not exists ix_fr_key on app.forecast_result(key_code, ym);

create table if not exists app.forecast_accuracy (
  id bigserial primary key, run_id uuid not null references app.forecast_run(id) on delete cascade,
  level text not null,             -- item | model | category | abcxyz | pattern | biz | total | ol
  key text not null, method text not null, bias numeric, wape numeric, mape numeric, n int, sum_actual numeric, extra jsonb
);
create index if not exists ix_fa_run on app.forecast_accuracy(run_id, level, method);

create table if not exists app.forecast_tuning_proposal (
  id uuid primary key default gen_random_uuid(), run_id uuid references app.forecast_run(id) on delete cascade,
  model text not null, prompt text, response jsonb, status text not null default 'pending',
  approval_id uuid, created_at timestamptz default now(), applied_at timestamptz, comment text
);

-- 감사 트리거
do $$ declare t text; begin
  foreach t in array array['forecast_method','forecast_policy','forecast_tuning_proposal'] loop
    execute format('drop trigger if exists trg_audit on app.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on app.%I for each row execute function app.fn_audit()', t);
  end loop; end $$;

-- RLS
do $$ declare t text; begin
  foreach t in array array['forecast_method','forecast_policy','forecast_run','forecast_result','forecast_accuracy','item_class','forecast_tuning_proposal'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('drop policy if exists p_read on app.%I', t);
    execute format('create policy p_read on app.%I for select to authenticated using (true)', t);
  end loop; end $$;
drop policy if exists p_write on app.forecast_method;
create policy p_write on app.forecast_method for all to authenticated using (app.current_role() in ('admin','item_manager')) with check (app.current_role() in ('admin','item_manager'));
drop policy if exists p_write on app.forecast_policy;
create policy p_write on app.forecast_policy for all to authenticated using (app.current_role() in ('admin','item_manager')) with check (app.current_role() in ('admin','item_manager'));

-- 런 요청 (엔진이 `engine forecast pending` 으로 처리)
create or replace function app.fn_request_forecast_run(p_run_type text, p_eval_fy int, p_horizon int)
returns uuid language plpgsql security definer set search_path = app, public as $$
declare v_id uuid; v_role app.role := app.current_role();
begin
  if v_role is null or v_role not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  insert into app.forecast_run(run_type, eval_fy, horizon, requested_by) values (p_run_type::app.run_type, p_eval_fy, p_horizon, auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- AI 제안 승인 요청 (kind=forecast_tuning). payload = {proposal_id, patches:[{method_key, param_patch, enabled?}]}
create or replace function app.fn_request_tuning_approval(p_proposal_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare pr app.forecast_tuning_proposal; v_id uuid;
begin
  select * into pr from app.forecast_tuning_proposal where id = p_proposal_id;
  if pr.id is null then raise exception 'NOT_FOUND'; end if;
  v_id := app.fn_request_approval('forecast_tuning', 'app.forecast_tuning_proposal', p_proposal_id::text,
            jsonb_build_object('proposal_id', p_proposal_id, 'proposals', pr.response->'proposals'), p_reason);
  update app.forecast_tuning_proposal set status = 'requested', approval_id = v_id where id = p_proposal_id;
  return v_id;
end $$;

-- 승인 적용: forecast_tuning 분기 (fn_decide_approval 확장)
create or replace function app.fn_apply_tuning(p_approval app.approval, p_decision text) returns void
language plpgsql security definer set search_path = app, public as $$
declare pr jsonb; pid uuid := (p_approval.payload->>'proposal_id')::uuid;
begin
  if p_decision = 'approved' then
    for pr in select * from jsonb_array_elements(coalesce(p_approval.payload->'proposals', '[]'::jsonb)) loop
      if pr->>'method_key' is not null and exists (select 1 from app.forecast_method where key = pr->>'method_key')
         -- 가드: 최신 백테스트에서 챔피언(레벨 total)인 기법은 off 불가 (D-021)
         and not ((pr->>'enabled')::boolean is false and exists (
              select 1 from app.forecast_result r join analytics.v_forecast_latest_run l on l.id = r.run_id and l.run_type = 'backtest'
              where r.is_champion and r.method = pr->>'method_key' limit 1)) then
        update app.forecast_method set
          params = params || coalesce(pr->'param_patch', '{}'::jsonb),
          enabled = coalesce((pr->>'enabled')::boolean, enabled),
          updated_by = auth.uid(), updated_at = now()
        where key = pr->>'method_key';
      end if;
    end loop;
    update app.forecast_tuning_proposal set status = 'applied', applied_at = now() where id = pid;
  else
    update app.forecast_tuning_proposal set status = 'rejected' where id = pid;
  end if;
end $$;

create or replace function app.fn_decide_approval(p_id uuid, p_decision text, p_comment text)
returns void language plpgsql security definer set search_path = app, public as $$
declare a app.approval; v_role app.role := app.current_role();
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
        target_dos_days  = coalesce((a.payload->>'target_dos_days')::int, s.target_dos_days),
        moq              = coalesce((a.payload->>'moq')::int, s.moq),
        unit_price       = coalesce((a.payload->>'unit_price')::numeric, s.unit_price),
        allocation_mode  = coalesce((a.payload->>'allocation_mode')::app.allocation_mode, s.allocation_mode),
        status = 'approved', approved_by = auth.uid(), approved_at = now(),
        source = 'manual', is_dummy = false, updated_by = auth.uid(), updated_at = now()
      where s.item_code = a.target_pk;
    else
      update app.item_setting set status = case when approved_at is null then 'draft' else 'approved' end,
        updated_by = auth.uid(), updated_at = now() where item_code = a.target_pk;
    end if;
  elsif a.kind = 'forecast_tuning' then
    perform app.fn_apply_tuning(a, p_decision);
  end if;
  -- order_plan / priority_alloc / bulkdeal 분기는 SP3/SP4

  update app.approval set status = p_decision::app.approval_status, approver = auth.uid(), comment = p_comment, decided_at = now() where id = p_id;
  perform app.notify_user(a.requested_by, 'approval_decided',
    case when p_decision = 'approved' then '승인됨: ' else '반려됨: ' end || a.kind::text,
    a.target_pk || coalesce(' — ' || p_comment, ''), jsonb_build_object('approval_id', p_id, 'decision', p_decision));
end $$;

-- ------------------------------------------------------------
-- 뷰
-- ------------------------------------------------------------
-- 최신 완료 런 (타입별)
create or replace view analytics.v_forecast_latest_run as
select distinct on (run_type) id, run_type, eval_fy, train_from, train_to, horizon, summary, finished_at
from app.forecast_run where status = 'done' order by run_type, finished_at desc;

-- 최신 프로덕션 런 챔피언 예측 (품목)
create or replace view analytics.v_forecast_latest as
select r.key_code, r.category, r.ym, r.method, r.value, r.lower, r.upper, r.run_id
from app.forecast_result r join analytics.v_forecast_latest_run l on l.id = r.run_id and l.run_type = 'production'
where r.level = 'item' and r.is_champion;

-- 기종 비교: 실적 + Sales OL + SCM OL + 기준예측(최신 백테스트 챔피언, 평가 FY 구간) (R-FC-10, D-002)
drop view if exists analytics.v_mc_compare cascade;
create view analytics.v_mc_compare as
with p as (   -- 기종 변형(model_key) 을 기종·월로 합산. 전부 null 이면 null 유지
  select p.model_base, max(coalesce(p.biz, m.biz)) as biz, p.ym,
         case when count(p.sales_ol) > 0 then sum(p.sales_ol) end as sales_ol,
         case when count(p.scm_ol) > 0 then sum(p.scm_ol) end as scm_ol,
         case when count(p.act) > 0 then sum(p.act) end as act
  from raw.fact_mc_plan_actual p
  left join (select model_base, max(biz) biz from raw.dim_model where biz is not null group by 1) m on m.model_base = p.model_base
  where p.model_base is not null group by p.model_base, p.ym
), bt as (
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

-- 최신 백테스트 정확도 요약
create or replace view analytics.v_accuracy_summary as
select a.* from app.forecast_accuracy a join analytics.v_forecast_latest_run l on l.id = a.run_id and l.run_type = 'backtest';

-- ABC-XYZ 매트릭스
create or replace view analytics.v_abc_xyz_matrix as
select abc, xyz, count(*) as n_items, sum(value_12m) as value_12m,
       round(sum(value_12m) / nullif((select sum(value_12m) from app.item_class), 0), 4) as value_share
from app.item_class where abc is not null group by abc, xyz;

-- 대시보드 요약에 예측 항목 추가
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
                                            'pending_proposals', (select count(*) from app.forecast_tuning_proposal where status in ('pending','requested'))))
  ) $$;
