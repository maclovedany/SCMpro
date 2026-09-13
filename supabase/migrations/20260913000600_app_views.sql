-- ============================================================
-- 20260913000600_app_views.sql — analytics 물리화 뷰(화면 소스) + app 뷰
--   물리화 뷰는 app.fn_refresh_matviews() 로 갱신 (업로드·시드·엔진 실행 후)
-- ============================================================
drop materialized view if exists analytics.v_item_master;
drop materialized view if exists analytics.v_item_monthly;

-- 월별 시계열 (HOC 기준, 0 채움, SW 옵션은 category='SW', shipment_extra UNION). R-XCN-01, R-BOM-11
create materialized view analytics.v_item_monthly as
with base as (
  select hoc_item as key_code, 'PART'::text as category, ym, qty from core.v_shipment_by_hoc where item_type = 'PART'
  union all
  select f.item_code, case when f.item_type = 'OPTION' and coalesce(l.is_sw, false) then 'SW' else f.item_type end, f.ym, f.qty
  from raw.fact_shipment f
  left join (select distinct item_code, is_sw from core.v_option_model_link) l on l.item_code = f.item_code
  where f.item_type in ('SUPPLY','OPTION')
  union all
  select item_code, item_type, ym, qty from app.shipment_extra
), agg as (
  select key_code, max(category) as category, ym, sum(qty) as qty from base group by key_code, ym
), keys as (select key_code, max(category) as category from agg group by key_code),
cal as (select distinct ym from agg)
select k.key_code, k.category, c.ym, coalesce(a.qty, 0)::numeric as qty
from keys k cross join cal c left join agg a on a.key_code = k.key_code and a.ym = c.ym;
create unique index on analytics.v_item_monthly(key_code, ym);
create index on analytics.v_item_monthly(category);
comment on materialized view analytics.v_item_monthly is '품목(HOC)×월 출고. 0 채움. SP2 예측 입력';

-- 품목 마스터 (품목 목록 화면 소스)
create materialized view analytics.v_item_master as
with lastm as (select max(ym) as ym from analytics.v_item_monthly where qty > 0),
m as (
  select v.key_code, max(v.category) as category,
         sum(case when v.ym > to_char((to_date(l.ym,'YYYY-MM') - interval '6 months'), 'YYYY-MM') then v.qty end) / 6.0 as avg_6m,
         sum(case when v.ym > to_char((to_date(l.ym,'YYYY-MM') - interval '12 months'), 'YYYY-MM') then v.qty end) as total_12m,
         max(case when v.qty > 0 then v.ym end) as last_ship_ym
  from analytics.v_item_monthly v cross join lastm l group by v.key_code
), inv as (
  select item_code, qty, snap_date, is_dummy from (
    select item_code, qty, snap_date, is_dummy, row_number() over (partition by item_code order by snap_date desc) rn
    from app.inventory_snapshot where stock_class = 'normal') x where rn = 1
), inb as (select item_code, sum(qty) qty from app.inbound where status <> 'received' group by 1)
select m.key_code, m.category, d.description, d.family, round(m.avg_6m, 2) as avg_6m, m.total_12m, m.last_ship_ym,
       s.target_dos_days, s.moq, s.allocation_mode, s.status as setting_status, coalesce(s.is_dummy, false) as setting_is_dummy,
       inv.qty as on_hand, inv.snap_date, coalesce(inv.is_dummy, false) as stock_is_dummy, coalesce(inb.qty, 0) as inbound_qty,
       case when m.avg_6m > 0 and inv.qty is not null then round(inv.qty / m.avg_6m * 30) end as dos_days
from m left join raw.dim_item d on d.item_code = m.key_code
left join app.item_setting s on s.item_code = m.key_code
left join inv on inv.item_code = m.key_code left join inb on inb.item_code = m.key_code;
create unique index on analytics.v_item_master(key_code);
create index on analytics.v_item_master(category);
create index on analytics.v_item_master(total_12m desc nulls last);
comment on materialized view analytics.v_item_master is '품목 목록. avg_6m/total_12m 은 데이터 최종월 기준 (R-FC-03)';

-- 단가 마스킹 (품목담당자/팀장/관리자만 단가)
create or replace view app.v_item_setting as
select item_code, target_dos_days, moq, pack_unit, min_order_amount,
       case when app.current_role() in ('item_manager','scm_lead','admin') then unit_price end as unit_price,
       currency, allocation_mode, status, approved_by, approved_at, source, is_dummy, updated_by, updated_at
from app.item_setting;

-- 가용재고 (R-INV-03). SP4 전까지 배정 0
create or replace view app.v_available_stock as
select key_code as item_code, on_hand, 0::numeric as temp_allocated, 0::numeric as firm_allocated,
       coalesce(on_hand, 0) as available from analytics.v_item_master;

create or replace view app.v_my_approvals as
select a.*, p.name as requester_name, ap.name as approver_name
from app.approval a left join app.profiles p on p.user_id = a.requested_by left join app.profiles ap on ap.user_id = a.approver
where a.requested_by = auth.uid() or app.current_role() in ('scm_lead','admin');

-- 물리화 뷰에 의존하는 함수 (language sql 은 생성 시 검증되므로 뷰 뒤에 정의)
-- 대시보드 요약 (R-UI-01: 카드 6개, 한 번의 왕복)
create or replace function app.fn_dashboard_summary() returns jsonb
language sql stable security definer set search_path = app, analytics, public as $$
  select jsonb_build_object(
    'items_by_category', coalesce((select jsonb_object_agg(category, n) from (select category, count(*) n from analytics.v_item_master group by 1) c), '{}'::jsonb),
    'dummy_ratio', (select round(avg(case when is_dummy then 1 else 0 end), 3) from app.item_setting),
    'pending_approvals', (select count(*) from app.approval where status = 'pending'),
    'last_upload', (select to_jsonb(u) from (select file_name, uploaded_at, ok_count, error_count from app.upload_log order by uploaded_at desc limit 1) u),
    'snapshot_date', (select max(snap_date) from app.inventory_snapshot where stock_class = 'normal'),
    'missing_target_dos', (select count(*) from analytics.v_item_master m where m.target_dos_days is null and m.category <> 'SW')
  ) $$;

create or replace function app.fn_refresh_matviews() returns void
language plpgsql security definer set search_path = app, analytics, public as $$
begin
  refresh materialized view analytics.v_item_monthly;
  refresh materialized view analytics.v_item_master;
end $$;

