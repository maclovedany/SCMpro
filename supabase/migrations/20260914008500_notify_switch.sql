-- 알림 on/off (D-046): 전체 알림 · 이메일 발송 · 반복 알림(독촉) 을 시스템 설정으로 제어
insert into app.system_settings(key, value, description) values
 ('notify_enabled', 'true', '알림 전체 (false 면 시스템 알림 생성 안 함) (D-046)'),
 ('notify_email_enabled', 'true', '이메일 발송 (false 면 이메일 복제·발송 안 함) (D-046)'),
 ('notify_reminders_enabled', 'true', '반복 알림: 승인 독촉·미제출 독촉·만료 예고 (D-046)')
on conflict (key) do nothing;

-- 게이트: notify_enabled=false 면 시스템 알림 insert 자체를 건너뜀 (모든 경로: notify_role/notify_user/notify_order)
create or replace function app.fn_notification_gate() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  if new.channel = 'system' and coalesce((select value::text = 'false' from app.system_settings where key = 'notify_enabled'), false) then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_gate on app.notification;
create trigger trg_notify_gate before insert on app.notification for each row execute function app.fn_notification_gate();

-- 이메일 복제: notify_email_enabled=false 면 복제하지 않음
create or replace function app.fn_notification_email_copy() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  if new.channel = 'system' and coalesce((select value::text <> 'false' from app.system_settings where key = 'notify_email_enabled'), true) then
    insert into app.notification(recipient, channel, kind, title, body, payload, created_at)
    values (new.recipient, 'email', new.kind, new.title, new.body, coalesce(new.payload, '{}'::jsonb) || jsonb_build_object('system_notification_id', new.id), new.created_at);
  end if;
  return new;
end $$;

-- 반복 알림 가드: 배정 tick(예고·승인 독촉) + 제출 독촉
create or replace function app.fn_allocation_tick() returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare r record; expired int := 0; reminded int := 0; repeated int := 0; d int; days int[];
  v_rem boolean := coalesce((select value::text = 'true' from app.system_settings where key = 'notify_reminders_enabled'), true);   -- D-046
begin
  days := coalesce((select array(select jsonb_array_elements_text(value)::int) from app.system_settings where key = 'expiry_reminder_days'), array[10,5,3,2,1]);
  -- 만료
  for r in select o.* from app.sales_order o where o.status in ('review_requested','partial') and o.expires_at is not null and o.expires_at <= now() loop
    update app.allocation set released_at = now(), release_reason = '30일 자동 만료' where order_id = r.id and released_at is null and kind = 'temp';
    update app.sales_order set status = 'expired', decided_at = now() where id = r.id;
    perform app.notify_order(r.id, 'alloc_expired', '임시배정이 자동 해제되었습니다: ' || r.order_no, r.item_code || ' — 재진행은 새 검토 요청 등록', '{}'::jsonb);
    expired := expired + 1;
  end loop;
  -- 예고 (중복 방지: 같은 주문·일수 알림 존재 시 skip) — 반복 알림 설정 off 면 건너뜀 (D-046)
  if v_rem then for r in select o.* from app.sales_order o where o.status in ('review_requested','partial') and o.expires_at is not null loop
    foreach d in array days loop
      if r.expires_at - (d || ' days')::interval <= now() and r.expires_at > now()
         and not exists (select 1 from app.notification where kind = 'alloc_expiry_reminder' and (payload->>'order_id')::uuid = r.id and (payload->>'days_before')::int = d) then
        perform app.notify_order(r.id, 'alloc_expiry_reminder', format('임시배정 만료 %s일 전: %s', d, r.order_no), format('%s 만료 %s', r.item_code, to_char(r.expires_at, 'YYYY-MM-DD')), jsonb_build_object('days_before', d));
        reminded := reminded + 1;
      end if;
    end loop;
  end loop; end if;
  -- 우선배정 승인 10분 반복 (R-AL-17)
  if v_rem then for r in select a.* from app.approval a where a.kind = 'priority_alloc' and a.status = 'pending'
           and not exists (select 1 from app.notification n where n.kind = 'approval_reminder' and (n.payload->>'approval_id')::uuid = a.id and n.created_at > now() - interval '10 minutes') loop
    perform app.notify_role('scm_lead', 'approval_reminder', '[반복] 우선 배정 승인 대기: ' || (r.payload->>'order_no'), format('%s %s개 · 가용 %s · 사유: %s', r.payload->>'item_code', r.payload->>'qty', r.payload->>'available', r.reason), jsonb_build_object('approval_id', r.id));
    repeated := repeated + 1;
  end loop; end if;
  return jsonb_build_object('expired', expired, 'reminders', reminded, 'approval_repeats', repeated, 'at', now());
end $$;

create or replace function app.fn_tick() returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare a jsonb; s int := 0;
begin
  a := app.fn_allocation_tick();
  if coalesce((select value::text <> 'false' from app.system_settings where key = 'notify_reminders_enabled'), true) then s := app.fn_submission_reminder_tick(); end if;
  return a || jsonb_build_object('submission_reminders', s);
end $$;
