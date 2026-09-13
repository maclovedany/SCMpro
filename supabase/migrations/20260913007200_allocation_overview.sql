-- 재고 배정 화면 개요 (D-036): 배정 구성·대기 부족 상위 품목·임시배정 만료 예정·입고 예정(월×공급처)·주문 상태·30일 요청 추이 를 한 번에
create or replace function app.fn_allocation_overview() returns jsonb
language sql stable security definer set search_path = app, analytics, raw, public as $$
  select jsonb_build_object(
    'alloc_mix', jsonb_build_object(
        'temp', (select coalesce(sum(qty), 0) from app.allocation where released_at is null and kind = 'temp'),
        'firm', (select coalesce(sum(qty), 0) from app.allocation where released_at is null and kind = 'firm'),
        'hold', (select coalesce(sum(qty), 0) from app.allocation where released_at is null and kind = 'hold'),
        'waiting', (select coalesce(sum(shortage), 0) from app.v_sales_order where status in ('partial','waiting'))),
    'queue_top', (select coalesce(jsonb_agg(jsonb_build_object('item_code', item_code, 'description', description, 'shortage', shortage, 'n_orders', n, 'available', available) order by shortage desc), '[]'::jsonb) from (
        select q.item_code, max(q.description) description, sum(q.shortage) shortage, count(*) n, max(q.available) available
        from app.v_allocation_queue q group by q.item_code order by 3 desc limit 10) x),
    'expiring', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'n', n, 'qty', qty) order by d), '[]'::jsonb) from (
        select expires_at::date d, count(distinct order_id) n, sum(qty) qty from app.allocation
        where released_at is null and kind = 'temp' and expires_at is not null and expires_at::date between current_date and current_date + 30 group by 1) x),   -- 임시배정 30일 (R-AL-02)
    'inbound_plan', (select coalesce(jsonb_agg(jsonb_build_object('ym', ym, 'supplier', sup, 'qty', qty, 'n', n) order by ym, sup), '[]'::jsonb) from (
        select to_char(i.planned_date, 'YYYY-MM') ym, coalesce(s.name, s.code, '미지정') sup, sum(i.qty) qty, count(*) n
        from app.inbound i left join app.supplier s on s.id = i.supplier_id where i.status <> 'received' group by 1, 2) x),
    'status_mix', (select coalesce(jsonb_agg(jsonb_build_object('status', status, 'n', n) order by n desc), '[]'::jsonb) from (
        select status::text status, count(*) n from app.sales_order where requested_at >= now() - interval '90 days' group by 1) x),
    'daily_requests', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'n', n) order by d), '[]'::jsonb) from (
        select requested_at::date d, count(*) n from app.sales_order where requested_at >= current_date - 29 group by 1) x)
  ) $$;
comment on function app.fn_allocation_overview is '재고 배정 개요 (D-036): 배정 구성·대기 부족 상위·만료 예정·입고 예정·주문 상태·요청 추이';
grant execute on function app.fn_allocation_overview() to authenticated, service_role;
