-- 제품군·기종 기준으로 보기 (D-076, R-UI-18). 재실행 안전. 앞 파일(011300) 의 app.fn_real_name 을 쓴다.
-- 품목 ↔ 기종 묶음 연결: ① 제품군 이름에 들어 있는 기종 표기(MDLnnn) ② BOM ③ 옵션-기종 연결
create or replace view analytics.v_item_model as
select distinct item_code, model_base, link_source from (
  select m.key_code as item_code, (regexp_matches(m.family, 'MDL[0-9]{3}', 'g'))[1] as model_base, 'family'::text as link_source
  from analytics.mv_item_stats m where m.family is not null
  union all
  select b.item_code, b.model_base, 'bom' from raw.bridge_bom b where b.model_base is not null and b.model_base <> ''
  union all
  select o.item_code, o.model_base, 'option' from analytics.v_option_model_link o where o.model_base is not null
) t;
comment on view analytics.v_item_model is '품목 ↔ 기종 묶음 연결 (제품군 이름 · BOM · 옵션 연결). D-076';
grant select on analytics.v_item_model to authenticated, service_role;

create or replace view analytics.v_item_links as
select item_code, array_agg(distinct model_base order by model_base) as link_models from analytics.v_item_model group by item_code;
grant select on analytics.v_item_links to authenticated, service_role;

-- 품목 목록 + 연결 기종 (기종 필터용). v_item_master 의 열이 바뀌면 다시 만들어야 하므로 drop 후 create
drop view if exists analytics.v_item_master_x;
create view analytics.v_item_master_x as
select m.*, coalesce(l.link_models, '{}'::text[]) as link_models
from analytics.v_item_master m left join analytics.v_item_links l on l.item_code = m.key_code;
comment on view analytics.v_item_master_x is 'v_item_master + 연결 기종(link_models). D-076';
grant select on analytics.v_item_master_x to authenticated, service_role;

-- 제품군별 요약 (품목 › 제품군별)
create or replace view analytics.v_family_summary as
select m.family, app.fn_real_name('family', m.family) as family_name, m.category,
       count(*)::int as n_items, sum(m.on_hand) as on_hand, sum(m.inbound_qty) as inbound_qty, sum(m.avg_6m) as avg_6m, sum(m.total_12m) as total_12m,
       (count(*) filter (where coalesce(m.on_hand, 0) <= 0))::int as n_zero_stock,
       (count(*) filter (where m.target_dos_days > 0 and m.dos_days is not null and m.dos_days < m.target_dos_days))::int as n_below_target,
       case when sum(m.avg_6m) > 0 then round(sum(coalesce(m.on_hand, 0)) / sum(m.avg_6m) * 30) end as dos_days
from analytics.v_item_master m where m.family is not null
group by m.family, m.category;
comment on view analytics.v_family_summary is '제품군 × 카테고리 요약: 품목 수·현재고·입고예정·평균 출고·재고 0·목표 미달. D-076';
grant select on analytics.v_family_summary to authenticated, service_role;

-- 발주 계획 라인 + 제품군·연결 기종 (필터용), 제품군별 요약
drop view if exists analytics.v_order_plan_line_x;
create view analytics.v_order_plan_line_x as
select l.*, s.family, coalesce(k.link_models, '{}'::text[]) as link_models
from app.order_plan_line l
left join analytics.mv_item_stats s on s.key_code = l.key_code
left join analytics.v_item_links k on k.item_code = l.key_code;
comment on view analytics.v_order_plan_line_x is '발주 계획 라인 + 제품군·연결 기종. D-076';
grant select on analytics.v_order_plan_line_x to authenticated, service_role;

create or replace view analytics.v_order_plan_family as
select l.plan_id, s.family, app.fn_real_name('family', s.family) as family_name, l.category,
       count(*)::int as n_lines, sum(coalesce(l.override_qty, l.final_qty)) as qty, sum(l.amount) as amount,
       (count(*) filter (where l.stockout_risk))::int as n_stockout, (count(*) filter (where l.flex_hit))::int as n_flex
from app.order_plan_line l left join analytics.mv_item_stats s on s.key_code = l.key_code
group by l.plan_id, s.family, l.category;
comment on view analytics.v_order_plan_family is '발주 계획의 제품군 × 카테고리 요약. D-076';
grant select on analytics.v_order_plan_family to authenticated, service_role;

-- 기종 묶음별 요약 (품목 › 기종별). 한 품목이 여러 기종에 연결되면 기종마다 센다 — 기종 사이 합계는 품목 수와 다르다
create or replace view analytics.v_model_item_summary as
select l.model_base, app.fn_real_name('codename', l.model_base) as codename, m.category,
       count(*)::int as n_items, sum(m.on_hand) as on_hand, sum(m.inbound_qty) as inbound_qty, sum(m.avg_6m) as avg_6m, sum(m.total_12m) as total_12m,
       (count(*) filter (where coalesce(m.on_hand, 0) <= 0))::int as n_zero_stock,
       (count(*) filter (where m.target_dos_days > 0 and m.dos_days is not null and m.dos_days < m.target_dos_days))::int as n_below_target,
       case when sum(m.avg_6m) > 0 then round(sum(coalesce(m.on_hand, 0)) / sum(m.avg_6m) * 30) end as dos_days
from (select distinct item_code, model_base from analytics.v_item_model) l
join analytics.v_item_master m on m.key_code = l.item_code
group by l.model_base, m.category;
comment on view analytics.v_model_item_summary is '기종 묶음 × 카테고리 요약 (연결 품목 기준). D-076';
grant select on analytics.v_model_item_summary to authenticated, service_role;

-- 발주 계획의 기종 묶음 × 카테고리 요약. 뷰로 두면 API(PostgREST)에서 8초 제한에 걸린다 → 함수 + force_custom_plan (D-027)
drop view if exists analytics.v_order_plan_model;
create or replace function app.fn_plan_model_summary(p_plan_id uuid)
returns table(model_base text, codename text, category text, n_lines int, qty numeric, amount numeric, n_stockout int, n_flex int)
language sql stable security definer set search_path = app, analytics, public set plan_cache_mode = force_custom_plan as $$
  with l as materialized (select distinct item_code, model_base from analytics.v_item_model),
       p as materialized (select key_code, category, coalesce(override_qty, final_qty) as q, amount, stockout_risk, flex_hit from app.order_plan_line where plan_id = p_plan_id)
  select l.model_base, app.fn_real_name('codename', l.model_base), p.category, count(*)::int, sum(p.q), sum(p.amount),
         (count(*) filter (where p.stockout_risk))::int, (count(*) filter (where p.flex_hit))::int
  from p join l on l.item_code = p.key_code
  group by l.model_base, p.category
$$;
comment on function app.fn_plan_model_summary(uuid) is '발주 계획의 기종 묶음 × 카테고리 요약 (연결 품목 기준). D-076';
grant execute on function app.fn_plan_model_summary(uuid) to authenticated, service_role;
