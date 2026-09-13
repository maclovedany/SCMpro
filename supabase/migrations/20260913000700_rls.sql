-- ============================================================
-- 20260913000700_rls.sql — app RLS (spec §3.6)
--   읽기: 로그인 사용자 전부 (item_setting/audit_log 는 관리 역할, approval/notification 은 본인)
--   쓰기: admin 전부, item_manager 마스터 테이블, 나머지는 RPC 로만
-- ============================================================
do $$ declare t text; begin
  foreach t in array array['profiles','system_settings','supplier','item_setting','inventory_snapshot','inbound','attach_rate','eol_eos','holiday','shipment_extra','upload_log','audit_log','approval','notification'] loop
    execute format('alter table app.%I enable row level security', t);
  end loop; end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','system_settings','supplier','inventory_snapshot','inbound','attach_rate','eol_eos','holiday','shipment_extra','upload_log'] loop
    execute format('drop policy if exists p_read on app.%I', t);
    execute format('create policy p_read on app.%I for select to authenticated using (true)', t);
  end loop; end $$;
drop policy if exists p_read on app.item_setting;
create policy p_read on app.item_setting for select to authenticated using (app.current_role() in ('item_manager','scm_lead','admin'));
drop policy if exists p_read on app.audit_log;
create policy p_read on app.audit_log for select to authenticated using (app.current_role() in ('item_manager','scm_lead','admin'));
drop policy if exists p_read on app.approval;
create policy p_read on app.approval for select to authenticated using (requested_by = auth.uid() or app.current_role() in ('scm_lead','admin'));
drop policy if exists p_read on app.notification;
create policy p_read on app.notification for select to authenticated using (recipient = auth.uid());

do $$ declare t text; begin
  foreach t in array array['supplier','item_setting','inventory_snapshot','inbound','attach_rate','eol_eos','holiday'] loop
    execute format('drop policy if exists p_write on app.%I', t);
    execute format('create policy p_write on app.%I for all to authenticated using (app.current_role() in (''admin'',''item_manager'')) with check (app.current_role() in (''admin'',''item_manager''))', t);
  end loop; end $$;
drop policy if exists p_write on app.system_settings;
create policy p_write on app.system_settings for all to authenticated using (app.current_role() = 'admin') with check (app.current_role() = 'admin');
drop policy if exists p_self on app.profiles;
create policy p_self on app.profiles for update to authenticated using (user_id = auth.uid() or app.current_role() = 'admin') with check (user_id = auth.uid() or app.current_role() = 'admin');
