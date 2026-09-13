-- 예측 화면 개요 (D-034): ABC-XYZ 매트릭스 + 등급별 재고 금액·DoS + 최근 12개월 카테고리 출고 추이 + 챔피언 분포 를 한 번에
create or replace function app.fn_forecast_overview() returns jsonb
language sql stable security definer set search_path = app, analytics, public as $$
  with im as (
    select m.key_code, m.category, m.abc, m.xyz, m.on_hand, m.dos_days, m.target_dos_days, m.champion_method,
           coalesce(m.on_hand, 0) * coalesce(s.unit_price, 0) as stock_value
    from analytics.v_item_master m left join app.item_setting s on s.item_code = m.key_code
    where m.category <> 'SW'
  ), lastm as (select max(ym) as ym from analytics.v_item_monthly where qty > 0)
  select jsonb_build_object(
    'matrix', (select coalesce(jsonb_agg(jsonb_build_object('abc', abc, 'xyz', xyz, 'n_items', n_items, 'value_share', value_share,
                 'stock_value', (select sum(stock_value) from im where im.abc = x.abc and im.xyz = x.xyz),
                 'avg_dos', (select round(avg(dos_days)) from im where im.abc = x.abc and im.xyz = x.xyz and dos_days is not null)) order by abc, xyz), '[]'::jsonb)
               from analytics.v_abc_xyz_matrix x),
    'grade', (select coalesce(jsonb_agg(jsonb_build_object('abc', abc, 'n_items', n, 'stock_value', sv, 'avg_dos', dos, 'target_dos', tdos, 'excess', ex, 'stockout', so) order by abc), '[]'::jsonb) from (
                select abc, count(*) n, sum(stock_value) sv, round(avg(dos_days)) dos, round(avg(target_dos_days)) tdos,
                       count(*) filter (where target_dos_days is not null and dos_days >= 2 * target_dos_days) ex,
                       count(*) filter (where coalesce(on_hand, 0) <= 0) so
                from im where abc is not null group by abc) g),
    'trend', (select coalesce(jsonb_agg(jsonb_build_object('ym', ym, 'category', category, 'qty', qty) order by ym, category), '[]'::jsonb) from (
                select v.ym, v.category, sum(v.qty) qty from analytics.v_item_monthly v, lastm
                where v.category in ('PART','SUPPLY','OPTION') and v.ym > to_char(to_date(lastm.ym, 'YYYY-MM') - interval '12 months', 'YYYY-MM') and v.ym <= lastm.ym
                group by 1, 2) t),
    'champion', (select coalesce(jsonb_agg(jsonb_build_object('method', method, 'n', n) order by n desc), '[]'::jsonb) from (
                select coalesce(champion_method, '(없음)') method, count(*) n from app.item_class group by 1) c),
    'last_ym', (select ym from lastm)
  ) $$;
comment on function app.fn_forecast_overview is '예측 화면 개요 (D-034): 매트릭스·등급별 재고·12개월 추이·챔피언 분포';
grant execute on function app.fn_forecast_overview() to authenticated, service_role;

-- v_item_master 에 과잉 플래그 추가 (컬럼 끝에 append → create or replace 가능). 품목 목록 드릴다운 excess=true (D-034)
create or replace view analytics.v_item_master as
with inv as (
  select distinct on (item_code) item_code, qty, snap_date, is_dummy
  from app.inventory_snapshot where stock_class = 'normal' order by item_code, snap_date desc
), inb as (select item_code, sum(qty) qty from app.inbound where status <> 'received' group by 1)
select m.key_code, m.category, m.description, m.family, m.avg_6m, m.total_12m, m.last_ship_ym,
       s.target_dos_days, s.moq, s.allocation_mode, s.status as setting_status, coalesce(s.is_dummy, false) as setting_is_dummy,
       inv.qty as on_hand, inv.snap_date, coalesce(inv.is_dummy, false) as stock_is_dummy, coalesce(inb.qty, 0) as inbound_qty,
       case when m.avg_6m > 0 and inv.qty is not null then round(inv.qty / m.avg_6m * 30) end as dos_days,
       ic.pattern, ic.abc, ic.xyz, ic.champion_method,
       coalesce(s.target_dos_days > 0 and m.avg_6m > 0 and inv.qty is not null and round(inv.qty / m.avg_6m * 30) >= 2 * s.target_dos_days, false) as is_excess
from analytics.mv_item_stats m
left join app.item_setting s on s.item_code = m.key_code
left join inv on inv.item_code = m.key_code left join inb on inb.item_code = m.key_code
left join app.item_class ic on ic.key_code = m.key_code;
