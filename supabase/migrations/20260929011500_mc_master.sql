-- 기종(MC) 마스터 · 제품 단위 OL 실적 (D-077, R-FC-16). `engine load-mc --src <회사 정리본> --key <치환표>` 가 로컬에서 변환해 채운다. 재실행 안전.
-- family_key = 회사가 준 보안용 제품군 약자(약자가 없는 제품군만 회사 파일의 이름 그대로, D-078), item_code = 익명 Item Code. 실코드는 넣지 않는다.
create table if not exists app.mc_family (
  family_key text primary key,
  biz text check (biz in ('DT','GC','PRT')),          -- MC 안의 구분 (R-FC-16)
  item_code text,                                      -- 익명 Item Code (IOT)
  model_key text,                                      -- raw 의 익명 Product 이름 (연결용)
  model_base text,                                     -- 기종 묶음 (MDLnnn)
  predecessor text,                                    -- 전임기 family_key (회사 '전임 후속기' 시트)
  has_alias boolean not null default true,             -- false = 회사 약자가 없어 회사 파일의 이름을 그대로 쓴다 (D-078)
  sort_no int not null default 0,                      -- 회사 파일의 행 순서
  updated_at timestamptz not null default now());
create table if not exists app.mc_plan_item (
  family_key text not null references app.mc_family(family_key) on delete cascade,
  ym char(7) not null, sales_ol numeric(18,4), scm_ol numeric(18,4), act numeric(18,4),
  primary key (family_key, ym));
comment on table app.mc_family is '기종(MC) 제품군 마스터: 보안용 약자·구분(DT/GC/PRT)·익명 Item Code·전임기. D-077';
comment on table app.mc_plan_item is '기종(MC) 제품군 × 월 Sales OL·SCM OL·실적 (회사 정리본). D-077';
alter table app.mc_family enable row level security; alter table app.mc_plan_item enable row level security;
drop policy if exists p_read on app.mc_family;    create policy p_read on app.mc_family for select to authenticated using (true);
drop policy if exists p_read on app.mc_plan_item; create policy p_read on app.mc_plan_item for select to authenticated using (true);
grant select on app.mc_family, app.mc_plan_item to authenticated; grant all on app.mc_family, app.mc_plan_item to service_role;

-- 기종 OL · 실적 화면: 회사 정리본이 적재돼 있으면 그것을, 없으면 raw(익명 파일)를 읽는다. 앞의 11개 열은 그대로, 뒤에 4개 추가
create or replace view analytics.v_mc_ol_act as
with src as (
  select f.family_key as model_key, f.model_base, f.biz, f.item_code as iot_code, i.ym, i.sales_ol, i.scm_ol, i.act,
         f.family_key as product_name, f.predecessor, f.has_alias, f.sort_no
  from app.mc_plan_item i join app.mc_family f on f.family_key = i.family_key
  union all
  select p.model_key, p.model_base, coalesce(p.biz, m.biz), m.iot_code, p.ym, p.sales_ol, p.scm_ol, p.act,
         app.fn_real_name('family', p.model_key), null::text, false, 0
  from raw.fact_mc_plan_actual p left join raw.dim_model m on m.model_key = p.model_key
  where not exists (select 1 from app.mc_plan_item)
), suc as (select predecessor, string_agg(family_key, ', ' order by sort_no) as successor from app.mc_family where predecessor is not null group by predecessor)
select s.model_key, s.model_base, s.biz, s.iot_code, s.ym,
       (case when substr(s.ym, 6, 2)::int >= 4 then substr(s.ym, 1, 4)::int else substr(s.ym, 1, 4)::int - 1 end) as fy,
       s.sales_ol, s.scm_ol, s.act, s.product_name, app.fn_real_name('codename', s.model_base) as codename,
       s.predecessor, suc.successor, s.has_alias, s.sort_no
from src s left join suc on suc.predecessor = s.model_key;
comment on view analytics.v_mc_ol_act is '기종 OL·실적 (Item Code × Family × 월). 회사 정리본 우선, 없으면 raw. Family = 보안용 약자. D-075 · D-077';
grant select on analytics.v_mc_ol_act to authenticated, service_role;

-- MC 품목 목록 (품목 › MC): 제품군마다 한 줄 — 구분·전임/후속·최근 실적
create or replace view analytics.v_mc_item as
with last as (select max(ym) as ym from app.mc_plan_item where act is not null),
agg as (
  select i.family_key,
         sum(i.act) filter (where i.ym > to_char(to_date(l.ym || '-01', 'YYYY-MM-DD') - interval '12 months', 'YYYY-MM')) as act_12m,
         sum(i.act) filter (where i.ym > to_char(to_date(l.ym || '-01', 'YYYY-MM-DD') - interval '6 months', 'YYYY-MM')) / 6.0 as act_avg_6m,
         sum(i.sales_ol) filter (where i.ym = l.ym) as last_sales_ol, sum(i.scm_ol) filter (where i.ym = l.ym) as last_scm_ol, sum(i.act) filter (where i.ym = l.ym) as last_act,
         min(i.ym) as first_ym, max(i.ym) filter (where coalesce(i.act, 0) > 0) as last_act_ym
  from app.mc_plan_item i cross join last l group by i.family_key),
suc as (select predecessor, string_agg(family_key, ', ' order by sort_no) as successor from app.mc_family where predecessor is not null group by predecessor)
select f.family_key, f.biz, f.item_code, f.model_base, app.fn_real_name('codename', f.model_base) as codename, f.predecessor, suc.successor, f.has_alias, f.sort_no,
       (select ym from last) as last_ym, a.act_12m, round(a.act_avg_6m, 1) as act_avg_6m, a.last_sales_ol, a.last_scm_ol, a.last_act, a.first_ym, a.last_act_ym
from app.mc_family f left join agg a on a.family_key = f.family_key left join suc on suc.predecessor = f.family_key;
comment on view analytics.v_mc_item is 'MC 품목 목록: 제품군(약자)·구분·전임/후속·최근 12개월 실적. D-077';
grant select on analytics.v_mc_item to authenticated, service_role;
