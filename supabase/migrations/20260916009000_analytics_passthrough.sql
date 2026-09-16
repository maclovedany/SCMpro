-- 화면이 core 를 직접 읽던 3곳을 analytics 로 옮기기 위한 pass-through 뷰 (D-056).
-- CLAUDE.md 데이터 원칙 "앱/화면은 analytics 뷰만 읽는다" 를 코드가 지키게 한다.
-- core.v_part_linkage 는 analytics.v_part_linkage 가 이미 감싸고 있어 여기서는 두 개만 추가.
-- 정제 로직은 여전히 core 한 곳에만 있고, 여기서는 컬럼을 그대로 노출한다 (R-BOM-09, R-BOM-11).

create or replace view analytics.v_model as
select model_key, model_base, biz, iot_code, sources
from core.v_model;

create or replace view analytics.v_option_model_link as
select item_code, model_base, link_source, is_sw
from core.v_option_model_link;

comment on view analytics.v_model is '기종 마스터(core.v_model pass-through). 관리자 EOL 화면 등 화면용 (D-056)';
comment on view analytics.v_option_model_link is '옵션↔기종 연결(core.v_option_model_link pass-through). 품목 상세 연결 기종 (D-056)';
