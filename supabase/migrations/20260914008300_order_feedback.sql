-- 발주 피드백 루프 (D-044, R-OQ-42/43): 지난 계획 사후 채점(제안 vs 실제 발주 vs 결과) + 오버라이드 패턴 → AI 튜닝 입력(목표 DoS 조정 제안) + 승인 적용
-- 채점 규칙: 필요월 실적이 있는 라인만. 실현 기말 = 기초(필요월) + 발주량 − 실제 출고. 결품 = 기말 < 0, 과잉 = 기말 > 목표재고×2, 나머지 적정.
create or replace function app.fn_plan_scorecard(p_plan_id uuid) returns jsonb
language sql stable security definer set search_path = app, analytics, public as $$
  with lastm as (select max(ym) as ym from analytics.v_item_monthly where qty > 0),
  l as (
    select l.key_code, l.category, c.abc, l.need_ym, coalesce(l.final_qty, 0) as proposed, coalesce(l.override_qty, l.final_qty, 0) as ordered, l.override_qty, l.override_reason,
           coalesce(m.qty, 0) as actual, coalesce(l.start_need, 0) as start_need, coalesce(l.target_stock, 0) as target_stock
    from app.order_plan_line l join lastm on l.need_ym <= lastm.ym
    left join analytics.v_item_monthly m on m.key_code = l.key_code and m.ym = l.need_ym
    left join app.item_class c on c.key_code = l.key_code
    where l.plan_id = p_plan_id
  ), s as (
    select *, start_need + ordered - actual as realized_end, start_need + proposed - actual as sys_end from l
  ), o as (
    select *,
      case when realized_end < 0 then 'stockout' when realized_end > 2 * target_stock and target_stock > 0 then 'excess' else 'ok' end as outcome_h,
      case when sys_end < 0 then 'stockout' when sys_end > 2 * target_stock and target_stock > 0 then 'excess' else 'ok' end as outcome_s
    from s
  )
  select jsonb_build_object(
    'scored', (select count(*) from o), 'last_ym', (select ym from lastm),
    'human', jsonb_build_object('stockout', (select count(*) from o where outcome_h = 'stockout'), 'excess', (select count(*) from o where outcome_h = 'excess'), 'ok', (select count(*) from o where outcome_h = 'ok')),
    'system', jsonb_build_object('stockout', (select count(*) from o where outcome_s = 'stockout'), 'excess', (select count(*) from o where outcome_s = 'excess'), 'ok', (select count(*) from o where outcome_s = 'ok')),
    'overrides', jsonb_build_object('n', (select count(*) from o where override_qty is not null),
        'improved', (select count(*) from o where override_qty is not null and outcome_h = 'ok' and outcome_s <> 'ok'),
        'worsened', (select count(*) from o where override_qty is not null and outcome_h <> 'ok' and outcome_s = 'ok'),
        'same', (select count(*) from o where override_qty is not null and (outcome_h = 'ok') = (outcome_s = 'ok'))),
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'scored', n, 'h_stockout', hs, 'h_excess', he, 's_stockout', ss, 's_excess', se) order by category) from (
        select coalesce(category, '기타') category, count(*) n, count(*) filter (where outcome_h = 'stockout') hs, count(*) filter (where outcome_h = 'excess') he,
               count(*) filter (where outcome_s = 'stockout') ss, count(*) filter (where outcome_s = 'excess') se from o group by 1) x), '[]'::jsonb),
    'worst', coalesce((select jsonb_agg(jsonb_build_object('key_code', key_code, 'category', category, 'abc', abc, 'need_ym', need_ym, 'proposed', proposed, 'ordered', ordered, 'actual', actual,
                 'realized_end', round(realized_end, 1), 'sys_end', round(sys_end, 1), 'outcome_h', outcome_h, 'outcome_s', outcome_s, 'override_reason', override_reason) order by rank desc)
              from (select *, case when outcome_h = 'stockout' then -realized_end when outcome_h = 'excess' then realized_end - 2 * target_stock else 0 end as rank from o where outcome_h <> 'ok' order by rank desc limit 15) w), '[]'::jsonb)
  ) $$;
alter function app.fn_plan_scorecard(uuid) set plan_cache_mode = force_custom_plan;
grant execute on function app.fn_plan_scorecard(uuid) to authenticated, service_role;

-- 최근 N개월 승인 계획의 채점 요약 (AI 튜닝 입력)
create or replace function app.fn_recent_scorecards(p_months int) returns jsonb
language sql stable security definer set search_path = app, analytics, public as $$
  select jsonb_build_object('plans', coalesce((select jsonb_agg(x order by x->>'plan_ym') from (
    select (app.fn_plan_scorecard(p.id) - 'worst' - 'by_category') || jsonb_build_object('plan_ym', p.plan_ym, 'plan_id', p.id,
             'worst_cells', (select coalesce(jsonb_agg(jsonb_build_object('cell', cell, 'stockout', so, 'excess', ex, 'n', n) order by so + ex desc), '[]'::jsonb) from (
                select coalesce(c.abc, '?') || coalesce(c.xyz, '?') cell, count(*) n,
                       count(*) filter (where (w->>'outcome_h') = 'stockout') so, count(*) filter (where (w->>'outcome_h') = 'excess') ex
                from jsonb_array_elements(app.fn_plan_scorecard(p.id)->'worst') w left join app.item_class c on c.key_code = w->>'key_code' group by 1 limit 9) cc)) x
    from app.order_plan p where p.status = 'approved' and p.plan_ym >= to_char(current_date - (p_months || ' months')::interval, 'YYYY-MM')
      and (app.fn_plan_scorecard(p.id)->>'scored')::int > 0) y), '[]'::jsonb)) $$;
alter function app.fn_recent_scorecards(int) set plan_cache_mode = force_custom_plan;
grant execute on function app.fn_recent_scorecards(int) to authenticated, service_role;

-- 오버라이드 패턴: 최근 N개월 승인 계획에서 같은 방향으로 3회 이상 조정한 품목·셀 (담당자 지식 → 파라미터 제안 근거)
create or replace function app.fn_override_patterns(p_months int) returns jsonb
language sql stable security definer set search_path = app, analytics, public as $$
  with l as (
    select l.key_code, l.category, c.abc || c.xyz as cell, l.override_qty, coalesce(l.final_qty, 0) as proposed, l.override_reason
    from app.order_plan_line l join app.order_plan p on p.id = l.plan_id left join app.item_class c on c.key_code = l.key_code
    where p.status = 'approved' and p.plan_ym >= to_char(current_date - (p_months || ' months')::interval, 'YYYY-MM') and l.override_qty is not null and l.final_qty > 0
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object('key_code', key_code, 'category', category, 'cell', cell, 'n', n, 'avg_ratio', r, 'direction', dir, 'reasons', reasons) order by n desc) from (
        select key_code, max(category) category, max(cell) cell, count(*) n, round(avg(override_qty / proposed), 2) r,
               case when bool_and(override_qty > proposed) then 'up' when bool_and(override_qty < proposed) then 'down' else 'mixed' end dir,
               (array_agg(distinct left(override_reason, 60)))[1:3] reasons
        from l group by key_code having count(*) >= 3 and (bool_and(override_qty > proposed) or bool_and(override_qty < proposed)) order by n desc limit 30) i), '[]'::jsonb),
    'cells', coalesce((select jsonb_agg(jsonb_build_object('cell', cell, 'n', n, 'avg_ratio', r, 'up', up, 'down', down) order by n desc) from (
        select cell, count(*) n, round(avg(override_qty / proposed), 2) r, count(*) filter (where override_qty > proposed) up, count(*) filter (where override_qty < proposed) down
        from l where cell is not null group by cell) c), '[]'::jsonb)) $$;
alter function app.fn_override_patterns(int) set plan_cache_mode = force_custom_plan;
grant execute on function app.fn_override_patterns(int) to authenticated, service_role;

-- 승인 요청 payload 에 dos_adjustments 포함
create or replace function app.fn_request_tuning_approval(p_proposal_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare pr app.forecast_tuning_proposal; v_id uuid;
begin
  select * into pr from app.forecast_tuning_proposal where id = p_proposal_id;
  if pr.id is null then raise exception 'NOT_FOUND'; end if;
  v_id := app.fn_request_approval('forecast_tuning', 'app.forecast_tuning_proposal', p_proposal_id::text,
            jsonb_build_object('proposal_id', p_proposal_id, 'proposals', pr.response->'proposals', 'dos_adjustments', coalesce(pr.response->'dos_adjustments', '[]'::jsonb)), p_reason);
  update app.forecast_tuning_proposal set status = 'requested', approval_id = v_id where id = p_proposal_id;
  return v_id;
end $$;

-- 승인 적용: 기법 파라미터(기존) + 목표 DoS 조정 (품목 / ABC-XYZ 셀, 5~180일 가드)
create or replace function app.fn_apply_tuning(p_approval app.approval, p_decision text) returns void
language plpgsql security definer set search_path = app, public as $$
declare pr jsonb; pid uuid := (p_approval.payload->>'proposal_id')::uuid; d jsonb; v_days int;
begin
  if p_decision = 'approved' then
    for pr in select * from jsonb_array_elements(coalesce(p_approval.payload->'proposals', '[]'::jsonb)) loop
      if pr->>'method_key' is not null and exists (select 1 from app.forecast_method where key = pr->>'method_key')
         and not ((pr->>'enabled')::boolean is false and exists (
              select 1 from app.forecast_result r join analytics.v_forecast_latest_run l on l.id = r.run_id and l.run_type = 'backtest'
              where r.is_champion and r.method = pr->>'method_key' limit 1)) then
        update app.forecast_method set params = params || coalesce(pr->'param_patch', '{}'::jsonb), enabled = coalesce((pr->>'enabled')::boolean, enabled),
          updated_by = auth.uid(), updated_at = now() where key = pr->>'method_key';
      end if;
    end loop;
    for d in select * from jsonb_array_elements(coalesce(p_approval.payload->'dos_adjustments', '[]'::jsonb)) loop
      v_days := (d->>'target_dos_days')::int;
      if v_days is null or v_days < 5 or v_days > 180 then continue; end if;   -- 가드레일 (R-OQ-43)
      if d->>'scope' = 'item' then
        update app.item_setting set target_dos_days = v_days, status = 'approved', approved_by = auth.uid(), approved_at = now(), source = 'manual', is_dummy = false, updated_by = auth.uid(), updated_at = now()
        where item_code = d->>'key';
      elsif d->>'scope' = 'cell' then
        update app.item_setting s set target_dos_days = v_days, status = 'approved', approved_by = auth.uid(), approved_at = now(), source = 'manual', is_dummy = false, updated_by = auth.uid(), updated_at = now()
        from app.item_class c where c.key_code = s.item_code and c.abc || c.xyz = d->>'key';
      end if;
    end loop;
    update app.forecast_tuning_proposal set status = 'applied', applied_at = now() where id = pid;
  else
    update app.forecast_tuning_proposal set status = 'rejected' where id = pid;
  end if;
end $$;
