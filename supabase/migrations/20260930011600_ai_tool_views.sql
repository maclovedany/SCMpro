-- AI Agent 도구용 뷰 (D-081, R-AI-09). 화면과 같은 자료를 도구가 한 번에 읽도록 조인·집계해 둔다. 재실행 안전.
-- 발주 계획 라인 + 품명·ABC·제품군 (품절 위험 목록, 계획 비교)
create or replace view analytics.v_plan_line_item as
select l.plan_id, l.key_code, s.description, l.category, c.abc, c.xyz, s.family, l.need_ym, l.on_hand, l.inbound_until_need, l.forecast_need, l.extras_need, l.start_need,
       l.target_stock, l.target_dos_days, l.required_qty, l.final_qty, l.override_qty, l.override_reason, l.end_after, l.dos_after, l.amount, l.stockout_risk, l.blocked, l.flex_hit
from app.order_plan_line l
left join app.item_class c on c.key_code = l.key_code
left join analytics.mv_item_stats s on s.key_code = l.key_code;
comment on view analytics.v_plan_line_item is '발주 계획 라인 + 품명·ABC-XYZ·제품군 (AI Agent 도구). D-081';
grant select on analytics.v_plan_line_item to authenticated, service_role;

-- 입고 지연(계획일 경과 미입고) 공급처별 집계 — 대시보드의 "입고 지연 PO" 와 같은 조건
create or replace view analytics.v_inbound_delay as
select coalesce(s.name, '(공급처 없음)') as supplier, count(*)::int as n, sum(i.qty) as qty, count(distinct i.item_code)::int as n_items,
       min(i.planned_date) as oldest_planned, max(current_date - i.planned_date)::int as max_days_late
from app.inbound i left join app.supplier s on s.id = i.supplier_id
where i.status <> 'received' and i.planned_date < current_date
group by 1;
comment on view analytics.v_inbound_delay is '입고 지연 PO 공급처별 집계 (AI Agent 도구). D-081';
grant select on analytics.v_inbound_delay to authenticated, service_role;

-- 품목 재고 위험 표시 (재고 0 · 목표 DoS 미달 · 과잉) — 열끼리 비교하는 조건은 API 로 걸 수 없어 뷰에 둔다
create or replace view analytics.v_item_risk as
select m.key_code, m.description, m.category, m.family, m.abc, m.xyz, m.avg_6m, m.total_12m, m.on_hand, m.inbound_qty, m.dos_days, m.target_dos_days,
       (coalesce(m.on_hand, 0) <= 0) as is_zero_stock,
       coalesce(m.target_dos_days > 0 and m.dos_days is not null and m.dos_days < m.target_dos_days, false) as is_below_target,
       m.is_excess
from analytics.v_item_master m;
comment on view analytics.v_item_risk is '품목별 재고 위험 표시 (AI Agent 도구). D-081';
grant select on analytics.v_item_risk to authenticated, service_role;
