-- 발주 계획 화면 개요 (D-035): 한 계획의 카테고리·공급처·필요월·상위 품목·리스크 집계를 한 번에
create or replace function app.fn_plan_overview(p_plan_id uuid) returns jsonb
language sql stable security definer set search_path = app, public as $$
  with l as (
    select l.*, coalesce(l.override_qty, l.final_qty, 0) as q, c.abc
    from app.order_plan_line l left join app.item_class c on c.key_code = l.key_code where l.plan_id = p_plan_id
  )
  select jsonb_build_object(
    'by_category', (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'n', n, 'qty', qty, 'amount', amount, 'stockout', so, 'blocked', bl, 'flex_hit', fh, 'ol_base_amount', ob, 'required_amount', ra) order by category), '[]'::jsonb) from (
        select coalesce(category, '기타') category, count(*) n, sum(q) qty, coalesce(sum(amount), 0) amount, count(*) filter (where stockout_risk) so, count(*) filter (where blocked) bl, count(*) filter (where flex_hit) fh,
               coalesce(sum(coalesce(flex_base, 0) * coalesce(unit_price, 0)), 0) ob, coalesce(sum(coalesce(required_qty, 0) * coalesce(unit_price, 0)), 0) ra
        from l group by 1) x),
    'by_supplier', (select coalesce(jsonb_agg(jsonb_build_object('supplier', sup, 'n', n, 'amount', amount) order by amount desc), '[]'::jsonb) from (
        select coalesce(s.name, s.code, '미지정') sup, count(*) n, coalesce(sum(l.amount), 0) amount from l left join app.supplier s on s.id = l.supplier_id group by 1) x),
    'by_need_ym', (select coalesce(jsonb_agg(jsonb_build_object('need_ym', need_ym, 'category', category, 'n', n, 'amount', amount) order by need_ym, category), '[]'::jsonb) from (
        select need_ym, coalesce(category, '기타') category, count(*) n, coalesce(sum(amount), 0) amount from l group by 1, 2) x),
    'top_items', (select coalesce(jsonb_agg(jsonb_build_object('key_code', key_code, 'category', category, 'qty', q, 'amount', amount, 'stockout_risk', stockout_risk, 'overridden', override_qty is not null) order by amount desc nulls last), '[]'::jsonb) from (
        select key_code, category, q, amount, stockout_risk, override_qty from l order by amount desc nulls last limit 10) x),
    'risk_by_cat_abc', (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'abc', abc, 'n', n) order by category, abc), '[]'::jsonb) from (
        select coalesce(category, '기타') category, coalesce(abc, 'C') abc, count(*) n from l where stockout_risk group by 1, 2) x)
  ) $$;
alter function app.fn_plan_overview(uuid) set plan_cache_mode = force_custom_plan;
comment on function app.fn_plan_overview is '발주 계획 개요 집계 (D-035): 카테고리·공급처·필요월·상위 10 품목·품절 리스크(카테고리×ABC)';
grant execute on function app.fn_plan_overview(uuid) to authenticated, service_role;
