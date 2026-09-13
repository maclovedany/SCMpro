-- ============================================================
-- 20260913000500_app_functions.sql — 역할, 감사 트리거, 알림, 승인/업로드/대시보드 RPC
-- ============================================================

-- 현재 사용자 역할 (auth.uid 기준). 미로그인/프로필 없음 → null
create or replace function app.current_role() returns app.role
language sql stable security definer set search_path = app, public as
$$ select role from app.profiles where user_id = auth.uid() $$;

-- 가입 시 profiles 자동 생성 (user_metadata.role 있으면 반영)
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  insert into app.profiles(user_id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          coalesce((new.raw_user_meta_data->>'role')::app.role, 'sales'))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- 범용 감사 트리거 — 모든 설정·확정·승인 변경 이력 (stage1 "이력 관리" 요구)
create or replace function app.fn_audit() returns trigger
language plpgsql security definer set search_path = app, public as $$
declare pk text; j jsonb;
begin
  j := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  pk := coalesce(j->>'id', j->>'item_code', j->>'key', j->>'model_base', j->>'date');
  insert into app.audit_log(table_name, row_pk, action, before, after, actor)
  values (tg_table_name, pk, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end, auth.uid());
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['system_settings','supplier','item_setting','inventory_snapshot','inbound','attach_rate','eol_eos','holiday','approval'] loop
    execute format('drop trigger if exists trg_audit on app.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on app.%I for each row execute function app.fn_audit()', t);
  end loop; end $$;

-- 알림 helper (R-SCH-30). SP1 은 system 채널만; email 은 SP4/5
create or replace function app.notify_role(p_role app.role, p_kind text, p_title text, p_body text, p_payload jsonb)
returns void language sql security definer set search_path = app, public as $$
  insert into app.notification(recipient, kind, title, body, payload)
  select user_id, p_kind, p_title, p_body, p_payload from app.profiles where role = p_role $$;

create or replace function app.notify_user(p_user uuid, p_kind text, p_title text, p_body text, p_payload jsonb)
returns void language sql security definer set search_path = app, public as $$
  insert into app.notification(recipient, kind, title, body, payload) values (p_user, p_kind, p_title, p_body, p_payload) $$;

-- 승인 요청 (R-OQ-02/40, R-AL-10/15). 사유 필수.
create or replace function app.fn_request_approval(p_kind text, p_target_table text, p_target_pk text, p_payload jsonb, p_reason text)
returns uuid language plpgsql security definer set search_path = app, public as $$
declare v_id uuid; v_role app.role := app.current_role();
begin
  if v_role is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'REASON_REQUIRED'; end if;
  if p_kind = 'item_setting' and exists (select 1 from app.approval where kind = 'item_setting' and target_pk = p_target_pk and status = 'pending') then
    raise exception 'ALREADY_PENDING'; end if;
  insert into app.approval(kind, target_table, target_pk, payload, requested_by, reason)
  values (p_kind::app.approval_kind, p_target_table, p_target_pk, p_payload, auth.uid(), p_reason) returning id into v_id;
  if p_kind = 'item_setting' then
    insert into app.item_setting(item_code, status, updated_by) values (p_target_pk, 'pending', auth.uid())
    on conflict (item_code) do update set status = 'pending', updated_by = auth.uid(), updated_at = now();
  end if;
  perform app.notify_role('scm_lead', 'approval_requested', '승인 요청: ' || p_kind, p_target_pk || ' — ' || p_reason,
                          jsonb_build_object('approval_id', v_id, 'kind', p_kind, 'target_pk', p_target_pk));
  return v_id;
end $$;

-- 승인/반려 (SCM팀장·관리자). 승인 시 payload 를 대상 테이블에 적용.
-- order_plan / priority_alloc / bulkdeal 분기는 SP3/SP4 에서 추가.
create or replace function app.fn_decide_approval(p_id uuid, p_decision text, p_comment text)
returns void language plpgsql security definer set search_path = app, public as $$
declare a app.approval; v_role app.role := app.current_role();
begin
  if v_role is null or v_role not in ('scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  select * into a from app.approval where id = p_id for update;
  if a.id is null then raise exception 'NOT_FOUND'; end if;
  if a.status <> 'pending' then raise exception 'ALREADY_DECIDED'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'BAD_DECISION'; end if;
  if p_decision = 'rejected' and (p_comment is null or length(trim(p_comment)) = 0) then raise exception 'COMMENT_REQUIRED'; end if;

  if a.kind = 'item_setting' then
    if p_decision = 'approved' then
      update app.item_setting s set
        target_dos_days  = coalesce((a.payload->>'target_dos_days')::int, s.target_dos_days),
        moq              = coalesce((a.payload->>'moq')::int, s.moq),
        unit_price       = coalesce((a.payload->>'unit_price')::numeric, s.unit_price),
        allocation_mode  = coalesce((a.payload->>'allocation_mode')::app.allocation_mode, s.allocation_mode),
        status = 'approved', approved_by = auth.uid(), approved_at = now(),
        source = 'manual', is_dummy = false, updated_by = auth.uid(), updated_at = now()
      where s.item_code = a.target_pk;
    else
      update app.item_setting set status = case when approved_at is null then 'draft' else 'approved' end,
        updated_by = auth.uid(), updated_at = now() where item_code = a.target_pk;
    end if;
  end if;

  update app.approval set status = p_decision::app.approval_status, approver = auth.uid(), comment = p_comment, decided_at = now() where id = p_id;
  perform app.notify_user(a.requested_by, 'approval_decided',
    case when p_decision = 'approved' then '승인됨: ' else '반려됨: ' end || a.kind::text,
    a.target_pk || coalesce(' — ' || p_comment, ''), jsonb_build_object('approval_id', p_id, 'decision', p_decision));
end $$;

-- 업로드 반영 (D-007). 행 단위 오류 격리 → upload_log.errors
create or replace function app.fn_apply_upload(p_target text, p_rows jsonb, p_mode text, p_file_name text)
returns jsonb language plpgsql security definer set search_path = app, public as $$
declare r jsonb; i int := 0; ok int := 0; errs jsonb := '[]'::jsonb; v_id uuid; v_role app.role := app.current_role();
begin
  if v_role is null or v_role not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  if p_target not in ('inventory_snapshot','inbound','item_setting','attach_rate','supplier','eol_eos','holiday','shipment_extra') then
    raise exception 'BAD_TARGET %', p_target; end if;
  if p_mode = 'replace' and p_target = 'inventory_snapshot' and jsonb_array_length(p_rows) > 0 then
    delete from app.inventory_snapshot where snap_date = (p_rows->0->>'snap_date')::date; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    begin
      if p_target in ('inventory_snapshot','inbound','item_setting','shipment_extra')
         and not exists (select 1 from raw.dim_item where item_code = r->>'item_code') then
        raise exception 'UNKNOWN_ITEM %', r->>'item_code'; end if;

      case p_target
      when 'inventory_snapshot' then
        insert into app.inventory_snapshot(item_code, snap_date, qty, stock_class, source, updated_by)
        values (r->>'item_code', (r->>'snap_date')::date, (r->>'qty')::numeric, coalesce((r->>'stock_class')::app.stock_class,'normal'), 'upload', auth.uid())
        on conflict (item_code, snap_date, stock_class) do update set qty = excluded.qty, source = 'upload', is_dummy = false, updated_by = auth.uid(), updated_at = now();
      when 'inbound' then
        insert into app.inbound(item_code, supplier_id, po_no, qty, planned_date, actual_date, status, source, updated_by)
        values (r->>'item_code', (select id from app.supplier where code = r->>'supplier_code'), r->>'po_no', (r->>'qty')::numeric,
                (r->>'planned_date')::date, (r->>'actual_date')::date, coalesce((r->>'status')::app.inbound_status,'ordered'), 'upload', auth.uid());
      when 'item_setting' then
        insert into app.item_setting(item_code, target_dos_days, moq, unit_price, allocation_mode, status, source, updated_by)
        values (r->>'item_code', (r->>'target_dos_days')::int, coalesce((r->>'moq')::int,1), (r->>'unit_price')::numeric,
                coalesce((r->>'allocation_mode')::app.allocation_mode,'auto'), 'approved', 'upload', auth.uid())
        on conflict (item_code) do update set
          target_dos_days = coalesce(excluded.target_dos_days, app.item_setting.target_dos_days),
          moq = excluded.moq, unit_price = coalesce(excluded.unit_price, app.item_setting.unit_price),
          allocation_mode = excluded.allocation_mode, source = 'upload', is_dummy = false, updated_by = auth.uid(), updated_at = now();
      when 'attach_rate' then
        insert into app.attach_rate(model_base, option_item_code, rate, effective_ym, source, updated_by)
        values (r->>'model_base', r->>'option_item_code', (r->>'rate')::numeric, r->>'effective_ym', 'upload', auth.uid())
        on conflict (model_base, option_item_code, effective_ym) do update set rate = excluded.rate, source = 'upload', is_dummy = false, updated_at = now();
      when 'supplier' then
        insert into app.supplier(code, name, country, prep_days, lead_time_days, source, updated_by)
        values (r->>'code', r->>'name', r->>'country', coalesce((r->>'prep_days')::int, 7), coalesce((r->>'lead_time_days')::int, 30), 'upload', auth.uid())
        on conflict (code) do update set name = excluded.name, country = excluded.country, prep_days = excluded.prep_days,
          lead_time_days = excluded.lead_time_days, source = 'upload', is_dummy = false, updated_at = now();
      when 'eol_eos' then
        insert into app.eol_eos(model_base, launch_date, eol_date, eos_date, source, updated_by)
        values (r->>'model_base', (r->>'launch_date')::date, (r->>'eol_date')::date, (r->>'eos_date')::date, 'upload', auth.uid())
        on conflict (model_base) do update set launch_date = excluded.launch_date, eol_date = excluded.eol_date, eos_date = excluded.eos_date, source='upload', is_dummy=false, updated_at = now();
      when 'holiday' then
        insert into app.holiday(date, name, country) values ((r->>'date')::date, r->>'name', coalesce(r->>'country','KR'))
        on conflict (date) do update set name = excluded.name;
      when 'shipment_extra' then
        insert into app.shipment_extra(item_code, ym, qty, item_type, updated_by)
        values (r->>'item_code', r->>'ym', (r->>'qty')::numeric, r->>'item_type', auth.uid())
        on conflict (item_code, ym) do update set qty = excluded.qty, updated_at = now();
      end case;
      ok := ok + 1;
    exception when others then
      errs := errs || jsonb_build_object('row', i, 'message', sqlerrm);
    end;
  end loop;

  insert into app.upload_log(file_name, target, row_count, ok_count, error_count, errors, uploaded_by)
  values (p_file_name, p_target, i, ok, i - ok, errs, auth.uid()) returning id into v_id;
  return jsonb_build_object('upload_id', v_id, 'ok_count', ok, 'error_count', i - ok, 'errors', errs);
end $$;

create or replace function app.fn_mark_read(p_ids bigint[]) returns void
language sql security definer set search_path = app, public as
$$ update app.notification set read_at = now() where id = any(p_ids) and recipient = auth.uid() and read_at is null $$;

create or replace function app.fn_unread_count() returns int
language sql stable security definer set search_path = app, public as
$$ select count(*)::int from app.notification where recipient = auth.uid() and read_at is null $$;
