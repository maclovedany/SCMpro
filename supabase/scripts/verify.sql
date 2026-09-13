-- 행수 (scm.db 실측 기준 + scc 88)
with expected(t, n) as (values
  ('dim_item',93881),('dim_model',156),('fact_shipment',103795),('fact_mc_plan_actual',2765),
  ('bridge_bom',7170),('bridge_scc_config',88),('bridge_mc_cap',106),('bridge_cap_option',646),
  ('bridge_option_model',972),('bridge_xcn',20760)),
actual as (
  select 'dim_item' t, count(*) n from raw.dim_item union all select 'dim_model', count(*) from raw.dim_model
  union all select 'fact_shipment', count(*) from raw.fact_shipment union all select 'fact_mc_plan_actual', count(*) from raw.fact_mc_plan_actual
  union all select 'bridge_bom', count(*) from raw.bridge_bom union all select 'bridge_scc_config', count(*) from raw.bridge_scc_config
  union all select 'bridge_mc_cap', count(*) from raw.bridge_mc_cap union all select 'bridge_cap_option', count(*) from raw.bridge_cap_option
  union all select 'bridge_option_model', count(*) from raw.bridge_option_model union all select 'bridge_xcn', count(*) from raw.bridge_xcn)
select e.t, e.n expected, a.n actual, case when e.n = a.n then 'OK' else 'MISMATCH' end as chk
from expected e join actual a using (t) order by 1;
-- v_part_linkage 는 related_item 당 1행
select 'v_part_linkage dup' as chk, count(*) from (select related_item from core.v_part_linkage group by 1 having count(*) > 1) x;
-- SW 옵션 비중 (D-009 검증: 약 40%)
select 'sw share' as chk, round(sum(case when l.is_sw then f.qty else 0 end) / sum(f.qty), 3)
from raw.fact_shipment f left join (select distinct item_code, is_sw from core.v_option_model_link) l on l.item_code = f.item_code
where f.item_type = 'OPTION' and f.qty > 0;   -- Common 옵션은 뷰에 기종 수만큼 행이 있으므로 distinct
