-- ============================================================
-- 20260913000400_app_schema.sql — 업무 데이터 스키마 (재실행 가능)
--   spec: docs/specs/2026-09-13-sp1-foundation-design.md §3.2
--   공통 컬럼: source / is_dummy / updated_by / updated_at (D-007)
-- ============================================================
create schema if not exists app;

do $$ begin create type app.role as enum ('item_manager','scm_lead','sales','marketing','service','biz_enable','admin');
exception when duplicate_object then null; end $$;
do $$ begin create type app.allocation_mode as enum ('auto','manual');
exception when duplicate_object then null; end $$;
do $$ begin create type app.setting_status as enum ('draft','pending','approved');
exception when duplicate_object then null; end $$;
do $$ begin create type app.stock_class as enum ('normal','inspection','defect','service_center','partner','in_transit');
exception when duplicate_object then null; end $$;
do $$ begin create type app.inbound_status as enum ('ordered','shipped','received');
exception when duplicate_object then null; end $$;
do $$ begin create type app.approval_kind as enum ('item_setting','target_dos','allocation_mode','order_plan','priority_alloc','bulkdeal');
exception when duplicate_object then null; end $$;
do $$ begin create type app.approval_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;
do $$ begin create type app.notify_channel as enum ('system','email');
exception when duplicate_object then null; end $$;

create table if not exists app.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text, name text, role app.role not null default 'sales', dept text,
  created_at timestamptz default now()
);
comment on table app.profiles is '사용자 프로필·역할 (01-business-process §4)';

create table if not exists app.system_settings (
  key text primary key, value jsonb not null, description text,
  updated_by uuid, updated_at timestamptz default now()
);
comment on table app.system_settings is '하드코딩 금지 설정값 (CLAUDE.md 규칙 6)';

create table if not exists app.supplier (
  id serial primary key, code text unique not null, name text not null, country text,
  prep_days int not null default 7, lead_time_days int not null default 30, sailing_rule jsonb,
  source text not null default 'manual' check (source in ('upload','manual','seed','parsed')),
  is_dummy boolean not null default false, updated_by uuid, updated_at timestamptz default now()
);
comment on table app.supplier is '공급처 5곳 (D-001, R-SCH-02/06)';

create table if not exists app.item_setting (
  item_code text primary key,
  target_dos_days int, moq int not null default 1, pack_unit int, min_order_amount numeric,
  unit_price numeric, currency text default 'KRW',
  allocation_mode app.allocation_mode not null default 'auto',
  status app.setting_status not null default 'draft', approved_by uuid, approved_at timestamptz,
  source text not null default 'manual' check (source in ('upload','manual','seed','parsed')),
  is_dummy boolean not null default false, updated_by uuid, updated_at timestamptz default now()
);
comment on table app.item_setting is '품목별 목표 DoS·MOQ·단가·배정방식 (R-OQ-02/30~33, R-AL-10)';

create table if not exists app.inventory_snapshot (
  id bigserial primary key, item_code text not null, snap_date date not null,
  qty numeric not null, stock_class app.stock_class not null default 'normal',
  source text not null default 'manual' check (source in ('upload','manual','seed','parsed')),
  is_dummy boolean not null default false, updated_by uuid, updated_at timestamptz default now(),
  unique (item_code, snap_date, stock_class)
);
create index if not exists ix_inv_item_date on app.inventory_snapshot(item_code, snap_date desc);
comment on table app.inventory_snapshot is '재고 스냅샷. 현재고 = stock_class normal 최신 (R-INV-01)';

create table if not exists app.inbound (
  id bigserial primary key, item_code text not null, supplier_id int references app.supplier(id),
  po_no text, qty numeric not null, planned_date date not null, actual_date date,
  status app.inbound_status not null default 'ordered',
  source text not null default 'manual' check (source in ('upload','manual','seed','parsed')),
  is_dummy boolean not null default false, updated_by uuid, updated_at timestamptz default now()
);
create index if not exists ix_inbound_item on app.inbound(item_code, planned_date);
comment on table app.inbound is '입고예정/실적. received 만 재고 계산 반영 (R-INV-02), 계획-실제 차이 (R-SCH-10)';

create table if not exists app.attach_rate (
  id bigserial primary key, model_base text not null, option_item_code text not null,
  rate numeric(6,4) not null check (rate >= 0 and rate <= 1), effective_ym char(7) not null,
  source text not null default 'manual' check (source in ('upload','manual','seed','parsed')),
  is_dummy boolean not null default false, updated_by uuid, updated_at timestamptz default now(),
  unique (model_base, option_item_code, effective_ym)
);
comment on table app.attach_rate is '기종×옵션 장착률 (R-BOM-04/05, D-004)';

create table if not exists app.eol_eos (
  model_base text primary key, launch_date date, eol_date date, eos_date date,
  source text not null default 'manual' check (source in ('upload','manual','seed','parsed')),
  is_dummy boolean not null default false, updated_by uuid, updated_at timestamptz default now()
);

create table if not exists app.holiday (
  date date primary key, name text not null, country text not null default 'KR'
);

create table if not exists app.shipment_extra (
  item_code text not null, ym char(7) not null, qty numeric not null, item_type text not null,
  source text not null default 'upload' check (source in ('upload','manual','seed','parsed')),
  updated_by uuid, updated_at timestamptz default now(), primary key (item_code, ym)
);
comment on table app.shipment_extra is 'raw 수정 금지 원칙에 따른 추가월 출고. v_item_monthly 가 UNION';

create table if not exists app.upload_log (
  id uuid primary key default gen_random_uuid(), file_name text, target text not null,
  row_count int not null default 0, ok_count int not null default 0, error_count int not null default 0,
  errors jsonb not null default '[]'::jsonb, status text not null default 'done',
  uploaded_by uuid, uploaded_at timestamptz default now()
);

create table if not exists app.audit_log (
  id bigserial primary key, table_name text not null, row_pk text, action text not null,
  before jsonb, after jsonb, actor uuid, at timestamptz default now()
);
create index if not exists ix_audit_table_pk on app.audit_log(table_name, row_pk, at desc);

create table if not exists app.approval (
  id uuid primary key default gen_random_uuid(),
  kind app.approval_kind not null, target_table text not null, target_pk text not null,
  payload jsonb not null default '{}'::jsonb,
  requested_by uuid not null, requested_at timestamptz default now(),
  approver uuid, status app.approval_status not null default 'pending',
  reason text not null, comment text, decided_at timestamptz
);
create index if not exists ix_approval_status on app.approval(status, requested_at desc);
comment on table app.approval is '범용 승인함 (R-OQ-40, R-AL-15 등). SP3/4 가 kind 추가';

create table if not exists app.notification (
  id bigserial primary key, recipient uuid not null, channel app.notify_channel not null default 'system',
  kind text not null, title text not null, body text, payload jsonb,
  created_at timestamptz default now(), sent_at timestamptz, read_at timestamptz, result text
);
create index if not exists ix_notification_recipient on app.notification(recipient, read_at, created_at desc);

insert into app.system_settings(key, value, description) values
 ('ol_lead_months', '1', 'Supplier OL 제출 선행 개월 (D-003, R-OQ-11)'),
 ('flex_ranges', '[{"offset":1,"pct":20},{"offset":2,"pct":30},{"offset":3,"pct":30}]', 'Flex rule (R-OQ-10). offset≥4 제한 없음'),
 ('dos_avg_months', '6', 'DoS 월평균 기간 (R-FC-03)'),
 ('ship_lead_days', '7', '선적 리드타임 (R-SCH-05)'),
 ('submit_deadline_rule', '"last_day-1"', '수요자료 제출 마감 (R-SCH-20)'),
 ('reminder_interval_min', '10', '반복 알림 간격 (R-SCH-21, R-AL-17)'),
 ('projection_past_months', '12', '재고전개 과거 열 수 (R-UI-04)'),
 ('projection_future_months', '6', '재고전개 미래 열 수 (R-UI-04)'),
 ('fiscal_year_start_month', '4', '회계연도 시작월. FY25 = 2025-04 ~ 2026-03 (D-015, R-FC-08)'),
 ('ai_model', '"gpt-5-nano"', 'AI 모델 (D-017, R-AI-01)')
on conflict (key) do nothing;
