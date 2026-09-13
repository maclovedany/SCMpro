-- ============================================================
-- 20260913006000_dashboard.sql — SCM 관점 대시보드 (D-031). 한 번의 RPC 로 5묶음 + 데이터 준비 현황
-- ============================================================
create or replace function app.fn_dashboard_v2() returns jsonb
language plpgsql stable security definer set search_path = app, analytics, public as $$
declare v_plan record; v_prev record; today date := current_date; r jsonb := '{}'::jsonb;
        v_next record; v_sub jsonb; v_bt record; v_pr record;
begin
  -- 최신 발주 계획 (승인 > 확정 > 초안 순이 아니라 가장 최근 생성)
  select * into v_plan from app.order_plan order by created_at desc limit 1;
  select * into v_prev from app.order_plan where status = 'approved' and (v_plan.id is null or id <> v_plan.id) order by plan_ym desc, approved_at desc limit 1;
  select * into v_next from app.fn_order_calendar(to_char(today, 'YYYY-MM'), 2) c where c.order_date >= today order by c.order_date limit 1;
  v_sub := app.fn_submission_status(to_char(date_trunc('month', today) + interval '1 month', 'YYYY-MM'));
  select * into v_bt from analytics.v_forecast_latest_run where run_type = 'backtest';
  select * into v_pr from analytics.v_forecast_latest_run where run_type = 'production';

  r := r || jsonb_build_object('stock', (select jsonb_build_object(
      'expected_end_amount', coalesce(sum(coalesce(l.end_after, 0) * coalesce(l.unit_price, 0)) filter (where l.end_after > 0), 0),
      'target_amount', coalesce(sum(coalesce(l.target_stock, 0) * coalesce(l.unit_price, 0)), 0),
      'current_amount', coalesce(sum(coalesce(l.on_hand, 0) * coalesce(l.unit_price, 0)), 0))
    from app.order_plan_line l where l.plan_id = v_plan.id));
  r := r || jsonb_build_object('dos', (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'avg_dos', avg_dos, 'avg_target', avg_target, 'n', n) order by category), '[]'::jsonb)
    from (select category, round(avg(dos_days)) avg_dos, round(avg(target_dos_days)) avg_target, count(*) n
          from analytics.v_item_master where category <> 'SW' and dos_days is not null group by category) x));
  r := r || jsonb_build_object('excess', (select jsonb_build_object('n', count(*), 'amount', coalesce(sum(coalesce(m.on_hand, 0) * coalesce(s.unit_price, 0)), 0))
    from analytics.v_item_master m left join app.item_setting s on s.item_code = m.key_code
    where m.category <> 'SW' and m.target_dos_days is not null and m.dos_days >= 2 * m.target_dos_days and m.on_hand > 0));
  r := r || jsonb_build_object('risk', jsonb_build_object(
      'stockout', (select count(*) from app.order_plan_line l where l.plan_id = v_plan.id and l.stockout_risk),
      'stockout_a', (select count(*) from app.order_plan_line l join app.item_class c on c.key_code = l.key_code where l.plan_id = v_plan.id and l.stockout_risk and c.abc = 'A'),
      'out_of_stock_with_orders', (select count(distinct o.item_code) from app.sales_order o where o.status in ('partial','waiting') and app.fn_available_stock(o.item_code) <= 0),
      'inbound_delayed', (select jsonb_build_object('n', count(*), 'qty', coalesce(sum(qty), 0)) from app.inbound where status <> 'received' and planned_date < today)));
  r := r || jsonb_build_object('cycle', jsonb_build_object(
      'plan', case when v_plan.id is null then null else jsonb_build_object('id', v_plan.id, 'plan_ym', v_plan.plan_ym, 'status', v_plan.status, 'amount', (v_plan.summary->>'amount')::numeric, 'created_at', v_plan.created_at) end,
      'prev_amount', case when v_prev.id is null then null else (v_prev.summary->>'amount')::numeric end,
      'ol_base_amount', (select coalesce(sum(coalesce(l.flex_base, 0) * coalesce(l.unit_price, 0)), 0) from app.order_plan_line l where l.plan_id = v_plan.id and l.flex_base is not null),
      'next_order', case when v_next.order_date is null then null else jsonb_build_object('date', v_next.order_date, 'supplier', v_next.supplier_name, 'eta', v_next.eta, 'days', v_next.order_date - today) end,
      'submission', v_sub));
  r := r || jsonb_build_object('forecast', jsonb_build_object(
      'backtest', case when v_bt.id is null then null else jsonb_build_object('id', v_bt.id, 'eval_fy', v_bt.eval_fy, 'finished_at', v_bt.finished_at, 'model_wape', v_bt.summary->>'model_wape', 'item_wape', v_bt.summary->>'item_wape', 'scm_ol_wape', v_bt.summary->>'scm_ol_wape', 'sales_ol_wape', v_bt.summary->>'sales_ol_wape') end,
      'production', case when v_pr.id is null then null else jsonb_build_object('id', v_pr.id, 'train_to', v_pr.train_to, 'finished_at', v_pr.finished_at, 'age_days', (today - v_pr.finished_at::date)) end,
      'pending_proposals', (select count(*) from app.forecast_tuning_proposal where status in ('pending','requested'))));
  r := r || jsonb_build_object('ops', jsonb_build_object(
      'approvals', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'n', n) order by n desc), '[]'::jsonb) from (select kind, count(*) n from app.approval where status = 'pending' group by kind) a),
      'approvals_total', (select count(*) from app.approval where status = 'pending'),
      'oldest_pending_hours', (select round(extract(epoch from (now() - min(requested_at))) / 3600) from app.approval where status = 'pending'),
      'expiring_7d', (select count(*) from app.sales_order where status in ('review_requested','partial') and expires_at between now() and now() + interval '7 days'),
      'waiting', (select jsonb_build_object('n', count(*), 'shortage', coalesce(sum(shortage), 0)) from app.v_sales_order where status in ('partial','waiting'))));
  r := r || jsonb_build_object('data', jsonb_build_object(
      'items_by_category', coalesce((select jsonb_object_agg(category, n) from (select category, count(*) n from analytics.v_item_master group by 1) c), '{}'::jsonb),
      'dummy_items', (select count(*) from app.item_setting where is_dummy),
      'dummy_stock', (select count(distinct item_code) from app.inventory_snapshot where is_dummy),
      'missing_target_dos', (select count(*) from analytics.v_item_master m where m.target_dos_days is null and m.category <> 'SW'),
      'snapshot_date', (select max(snap_date) from app.inventory_snapshot where stock_class = 'normal'),
      'last_upload', (select to_jsonb(u) from (select file_name, uploaded_at, ok_count, error_count from app.upload_log order by uploaded_at desc limit 1) u)));
  return r;
end $$;
