-- 표시 이름 (D-075, R-UI-17): 익명 제품군·기종 이름 → 실제 이름. `engine load-names --key <치환표>` 가 채운다. 재실행 안전.
-- 품목코드·IOT 코드의 복원 쌍은 넣지 않는다 — 코드는 익명 체계 그대로 (D-059).
create table if not exists app.name_alias (
  kind text not null check (kind in ('family','codename')),   -- family = 제품군·Product 전체 이름, codename = 기종 묶음(MDLnnn)
  anon text not null,                                          -- 시스템에 저장된 익명 이름
  anon_key text not null,                                      -- upper(btrim(anon)) — 대소문자 차이를 무시한 조회용
  real_name text not null,
  updated_at timestamptz not null default now(),
  primary key (kind, anon));
create index if not exists ix_name_alias_key on app.name_alias(kind, anon_key);
comment on table app.name_alias is '표시 이름: 익명 제품군·기종 이름 → 실제 이름 (D-075). 코드 복원 쌍은 없음';

alter table app.name_alias enable row level security;
drop policy if exists p_read on app.name_alias; create policy p_read on app.name_alias for select to authenticated using (true);
grant select on app.name_alias to authenticated; grant all on app.name_alias to service_role;

-- 익명 이름 → 표시 이름. 쌍이 없으면 받은 값을 그대로 돌려준다.
create or replace function app.fn_real_name(p_kind text, p_anon text) returns text
language sql stable security definer set search_path = app, public as $$
  select coalesce((select a.real_name from app.name_alias a where a.kind = p_kind and a.anon_key = upper(btrim(p_anon))
                   order by (a.anon = p_anon) desc, a.real_name limit 1), p_anon)
$$;
grant execute on function app.fn_real_name(text, text) to authenticated, service_role;

-- 기종 OL · 실적 화면 (R-FC-15): 원본 파일과 같은 단위(IOT × Product × 월). 업로드 추가분(app.mc_plan_extra)은 기종 묶음 단위라 여기에 없다.
create or replace view analytics.v_mc_ol_act as
select p.model_key, p.model_base, coalesce(p.biz, m.biz) as biz, m.iot_code, p.ym,
       (case when substr(p.ym, 6, 2)::int >= 4 then substr(p.ym, 1, 4)::int else substr(p.ym, 1, 4)::int - 1 end) as fy,
       p.sales_ol, p.scm_ol, p.act,
       app.fn_real_name('family', p.model_key) as product_name,
       app.fn_real_name('codename', p.model_base) as codename
from raw.fact_mc_plan_actual p
left join raw.dim_model m on m.model_key = p.model_key;
comment on view analytics.v_mc_ol_act is '기종 OL·실적 (IOT × Product × 월) + 표시 이름. D-075';
grant select on analytics.v_mc_ol_act to authenticated, service_role;
