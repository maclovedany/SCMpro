# 데이터 카탈로그

최종 갱신: 2026-09-13 · 출처: 데이터 설명.docx, 01-schema.sql, 03-verify.sql, 04/05-views.sql, 파일 직접 확인
새 파일이 들어오면 **먼저 여기에 등록**하고 정제 규칙을 적는다.

## 1. 원본 파일

| 파일 | 시트/구조 | 내용 | 기간 | 정제 규칙 | 적재 테이블 |
|---|---|---|---|---|---|
| `data/raw/MC_OL_vs_ACT.xlsx` | Summary, FY23, FY24, FY25, FY26-to202606 | 기종별 월 Sales OL / SCM OL / ACT | FY23 ~ 2026-06 | model_base 로 정규화. Bias = SUM(ol−act)/SUM(act) | `raw.fact_mc_plan_actual` (2,765행) |
| `data/raw/TOTAL_BOM_LIST__CAP.xlsx` | `MC CAP BOM` + 기종별 15시트 (MDL222, MDL116, … MDL218), Sheet3 | DT/PRT 기종 BOM, CAP 부번, 필수옵션, 연관 소모품 | — | 15시트 통합. bom_group(STANDARD/FAX KIT/단품Option/소모품 KIT…) 보존 | `raw.bridge_bom`, `raw.bridge_mc_cap`, `raw.bridge_cap_option` |
| `data/raw/GC-BOM_item_Manage_sheet.xlsx` | `Option MAP`, 기종별 13시트, `SCC` | GC 기종 BOM, 옵션↔기종 MAP, SCC 교체 구성 | — | `SCC` 시트만 6열 구조라 별도 테이블. Option MAP 헤더 행이 dim_model 에 8행 섞임 → `core.v_model` 로 제외. `(업데이트필요)`/`(영업종료)` 시트 처리 Q-011 | `raw.bridge_bom`, `raw.bridge_scc_config`(88), `raw.bridge_option_model`(972) |
| `data/raw/옵션_출고_Trend.xlsx` | `출고 Trend(수출,폐각 제외)` | 옵션 월별 출고 | 2020-01 ~ 2026-07 | **이미 수출·폐각 제외됨** (R-BOM-10) | `raw.fact_shipment` (item_type=OPTION) |
| `data/raw/소모품_출고_트렌드.xlsx` | `Historical` | 소모품 월별 출고 | 3년 | 재수출·기타출고 제외 여부 확인 필요 (Q-006). 드물게 HOC 존재 (R-XCN-06) | `raw.fact_shipment` (item_type=SUPPLY) |
| `data/raw/부품_Part_Tool_3년사용량.csv` | 컬럼: Item, HOC, Description, Family, 07-2026 … 04-2023 (와이드) | 부품 월별 출고 | 2023-04 ~ 2026-07 | 와이드→롱. 0 인 달 미저장. HOC 열은 bridge_xcn 보다 오래됐을 수 있음 (R-XCN-07) | `raw.fact_shipment` (item_type=PART), `raw.dim_item` |
| `data/raw/부품_XCN.xlsx` | Sheet1, 정의, `XCN list` | 설계변경 코드 연계 (related_item → hoc_item) | — | 출고·재고는 hoc_item 합산, 발주는 hoc_item (R-XCN) | `raw.bridge_xcn` (20,760) |
| `data/raw/scm.db` | SQLite | 벤더가 준 원본 DB (위 파일들의 SQLite 적재본) | — | Supabase 이관 시 참고용. 앱은 쓰지 않음 | — |
| `데이터 설명.docx` | 텍스트 + 표 | 용어, 특수 고려사항, 카테고리별 산출 방식, 월간 절차 | — | 원본, 수정 금지 | → `00-glossary.md`, `01-business-process.md` |
| `회의록.docx` | 녹취 | 킥오프 미팅 | 2026-09-01 파일 | 원본, 수정 금지 | → `meetings/2026-09-01-kickoff.md` |
| `stage1.md` | md | 1단계 문제 정의 인터뷰 | 2026-09-10 | 원본, 수정 금지 | → `02-domain-rules/*` |

### 아직 없는 데이터 (필요)
| 데이터 | 용도 | 상태 |
|---|---|---|
| 장착률 이력 | 선택 옵션 소요 | Q-001 · 업로드 경로 예정 (D-004) |
| 공급처 마스터 (5곳, 출항일, 준비기간, 리드타임) | 발주 일정 | D-007 · 업로드+관리자 입력, 더미 시드 |
| MOQ | 발주량 올림 | D-007 · 업로드+관리자 입력, 더미 시드 |
| 품목 단가 | 재고금액 KPI | D-007 · 업로드+관리자 입력, 더미 시드 |
| 현재고 · 입고예정 | 발주 산출 시작값 | D-007 · 업로드+관리자 입력, 더미 시드 |
| EOL/EOS 일정 | 수명주기 예측 조정 | Q-008 |
| 공휴일 캘린더 | 영업일 보정 | Q-009 |

## 2. Supabase 스키마 (migrations 실행 순서)

`supabase/scripts/migrate.sh` 가 `supabase/migrations/*.sql` 을 파일명 순으로 psql 적용한다. 각 파일은 재실행 가능.

| 파일 | 만드는 것 |
|---|---|
| `20260913000100_raw_schema.sql` | `raw` 테이블 10개 (구 01-schema). RLS 켜고 정책 없음 → 앱에서 직접 못 읽음 |
| `20260913000200_core_views.sql` | `core` 정제 뷰 (구 04) + R-XCN-08 `v_part_linkage`, R-BOM-11 `v_option_model_link` |
| `20260913000300_analytics_views.sql` | `analytics` 뷰 (구 05) |
| `20260913000400_app_schema.sql` | `app` enum + 테이블 |
| `20260913000500_app_functions.sql` | 감사 트리거, 승인/업로드/대시보드 RPC |
| `20260913000600_app_views.sql` | `analytics` 물리화 뷰, `app` 뷰 |
| `20260913000700_rls.sql` | RLS 정책 |
| `20260913000900_grants.sql` | 권한. **항상 마지막** |

raw 데이터 적재: `engine export-raw` (scm.db → `data/export/*.csv`) → `supabase/scripts/load-raw.sh` (\copy). 구 `02-data-*.sql`, `03-verify.sql`, `07-*.sql` 은 `supabase/legacy/` 참고용.

### raw 테이블

| 테이블 | 행수 | 키/주요 컬럼 | 주의 |
|---|---|---|---|
| `raw.dim_item` | 93,868 | item_code PK, hoc_code, family, item_type(PART/SUPPLY/OPTION/BOM/MACHINE), source_types | 익명화 코드 (Q-013) |
| `raw.dim_model` | 145 | model_key PK, model_base, biz(DT/GC/PRT), iot_code | model_base 빈 8행은 기종 아님 → `core.v_model` |
| `raw.fact_shipment` | 103,795 | item_code, ym('YYYY-MM'), qty, item_type, source_file | **0 인 달 미저장.** PART 2023-04~2026-07, OPTION 2020-01~2026-07 |
| `raw.fact_mc_plan_actual` | 2,765 | fy_sheet, model_key, model_base, biz, ym, sales_ol, scm_ol, act | Bias 양수 = 과대예측 |
| `raw.bridge_bom` | 7,157 | model_key, model_base, bom_group, item_code, qty, active(O/X/△), start/end_date(text) | active·date 는 GC 만 |
| `raw.bridge_scc_config` | 88 | neutral_item_code → scc_item_code, qty | GC SCC 시트 |
| `raw.bridge_mc_cap` | 106 | model_key, predecessor_model, cap_item_code, neutral_item_code | 전임기 정보 있음 (EOL 전환 분석에 활용 가능) |
| `raw.bridge_cap_option` | 646 | cap_item_code → option_item_code, role(MUST_OPTION 340 / SCC/LABEL 306) | 필수옵션 전개 기준 |
| `raw.bridge_option_model` | 972 | item_code, model_base, link_type, cat, common(COMMON 597 / UNIQUE 375) | Common 판정 |
| `raw.bridge_xcn` | 20,760 | related_item → hoc_item, family | 부품 합산 기준 |

### core 뷰 (정제 규칙 한 곳)

| 뷰 | 역할 | 관련 규칙 |
|---|---|---|
| `core.v_ym_calendar` | 데이터에 존재하는 모든 월 (79). 희소 저장 보완용 LEFT JOIN | R-FC-03 |
| `core.v_item` | hoc_code 빈값 → 자기 자신 보정 | R-XCN-04 |
| `core.v_model` | 기종 아닌 8행 제거 (137) | R-BOM-09 |
| `core.v_part_linkage` | 구코드 → 대표코드 | R-XCN-01 |
| `core.v_shipment_by_hoc` | **XCN 합산 월별 출고. 부품 조회는 항상 이것** | R-XCN-01 |
| `core.v_option_commonality` | 옵션이 몇 기종에 공용인지 | R-BOM-06 |

### analytics 뷰 (화면·Tool 전용)

`v_shipment_trend`, `v_item_demand_profile`, `v_item_demand_kpi`, `v_ol_accuracy`, `v_ol_accuracy_fy`, `v_bom_requirement`, `v_bom_requirement_x`, `v_part_linkage`, `v_realdata_kpi`
(5회차 더미 뷰 `v_stockout_risk`, `v_stockout_kpi`, `v_leadtime_gap` 은 폐기 예정 — 07 파일 참조)

## 3. 앞으로 추가될 테이블 (설계 예정, 규칙 ID 참조)

| 영역 | 후보 테이블 | 규칙 |
|---|---|---|
| 설정 | supplier, supplier_sailing_schedule, system_settings(ol_lead_months 등), item_setting(target_dos, moq, allocation_mode, pack_unit, min_order_amount) | R-OQ-02/11/30/32, R-SCH-02 |
| 예측 | forecast_run(version), forecast_result(item, ym, method, value), forecast_accuracy | R-FC-11/21 |
| 발주 | order_plan, order_plan_line(근거 컬럼 포함), approval_log | R-OQ-40/41 |
| 추가수요 | confirmed_order, meeting_approval, bulkdeal | R-OQ-20~25 |
| 재고 | inventory_snapshot(category 구분), inbound(planned/actual date) | R-INV, R-SCH-10 |
| 배정 | sales_order, allocation, allocation_priority, notification_log | R-AL |
| 업로드 | attach_rate(장착률), eol_eos_schedule, holiday | D-004, Q-008, Q-009 |
| 공통 | 위 설정·마스터 테이블 전부 `source`(upload/manual/seed) + `is_dummy` + `updated_by/at` 컬럼. 업로드 이력 테이블 upload_log | D-007 |
