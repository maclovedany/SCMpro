# 데이터 카탈로그

최종 갱신: 2026-09-14 · 출처: 데이터 설명.docx, `supabase/migrations/*`, 적재 후 실제 행수 확인
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
| 고객사 마스터 (고객코드·이름·세그먼트·담당 영업·전략 고객) | 고객사별 배정현황·강제배정 (R-AL-51~54) | Q-022 · 업로드 대상 `customer` + 관리 › 고객사, 더미 시드 (D-058) |
| 수요자료 상세 (부서 × 고객사 × 품목 × 필요월 × 수량) | 고객사 필요 대비 배정 부족 (R-SCH-32) | 업로드 대상 `demand_line` + 일정·제출 화면 입력, 더미 시드 (D-058) |
| 품목 → 제품군 → 담당 부서 매핑 | 부서별 담당 품목 재고 (R-INV-09) | Q-024 · 업로드 대상 `item_group` + 관리 › 품목 그룹, 더미 시드 (D-058) |
| PO 진행 이벤트 (접수·출하·출항·입항·통관) | 긴급발주 진행 단계 (R-SCH-33) | Q-020 · 업로드 대상 `inbound_event` + 추가 수요 화면 입력, 더미 시드 (D-058) |
| 기기(MACHINE) 재고 | 고객사별 기기 배정 | Q-022 · 기존 `inventory_snapshot` 업로드로 반입, 더미 시드 (D-058) |

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
| `20260913001000_forecast.sql` | SP2 예측: 기법 레지스트리·정책·런·결과·정확도·분류·AI 제안, 뷰 |
| `20260913002000_order.sql` | SP3 발주: 추가수요·계획·라인·제출 OL·산출 RPC |
| `20260913003000_allocation.sql` | SP4 주문·배정 상태머신 |
| `20260913004000_schedule.sql` | SP5 일정·제출·입고 차이·이메일 복제·`fn_tick` |
| `20260913005000_ai.sql` | SP6 AI 대화·통계·사이드바 배지 |
| `20260913006000_dashboard.sql` | 대시보드 RPC `fn_dashboard_v2`(+charts) (D-031/032) |
| `20260913007000_forecast_overview.sql` | 예측 화면 개요 RPC + `v_item_master.is_excess` (D-034) |
| `20260913007100_plan_overview.sql` | 발주 계획 개요 RPC (D-035) |
| `20260913007200_allocation_overview.sql` | 재고 배정 개요 RPC (D-036) |
| `20260914008000_ol_series.sql` | OL 시계열: `mc_plan_extra`·`core.v_mc_plan_actual`·`v_item_ol*`, 업로드 대상 추가 (D-040) |
| `20260914008100_auto_run.sql` | 자동 런 기록·설정 (D-041) |
| `20260914008200_agent.sql` | AI 감시: 신호 RPC·`agent_event`·승인 트리거·통계 (D-042) |
| `20260914008300_order_feedback.sql` | 사후 채점·오버라이드 패턴·DoS 조정 적용 (D-044) |
| `20260914008500_notify_switch.sql` | 알림 on/off 게이트·이메일 복제·tick 가드 (D-046) |
| `20260914008400_retention.sql` | 보존 정책 `fn_prune_runs`·설정·감사 트리거 축소 (D-045) |
| `20260916009000_analytics_passthrough.sql` | `analytics.v_model`·`analytics.v_option_model_link` pass-through — 화면의 core 직접 조회 3곳 제거 (D-056) |
| `20260916009100_unschedule_scm_tick.sql` | pg_cron `scm-tick` 해제 — fn_tick 은 Railway `engine tick` 만 호출. `scm-refresh` 유지 (D-057) |
| `20260917010000_enum_additions.sql` | enum 값 추가: `extra_kind.urgent`, `approval_kind.urgent_order` (사용 전 커밋 필요해 분리, D-058) |
| `20260917010100_customer_demand.sql` | 고객사·수요 라인·품목 그룹·PO 이벤트 테이블, 강제배정·긴급발주 RPC, `fn_dashboard_ext`, analytics 뷰 5종, 업로드 대상 4종 (D-058) |
| `20260913999900_grants.sql` | 권한. **항상 마지막** — 파일명 순서상 앞서지만 `migrate.sh` 가 마지막에 따로 실행한다. 그래도 새 마이그레이션은 자기 객체에 직접 `grant` 를 쓴다 |

raw 데이터 적재: `engine export-raw` (scm.db → `data/export/*.csv`) → `supabase/scripts/load-raw.sh` (\copy). 구 `02-data-*.sql`, `03-verify.sql`, `07-*.sql` 은 `supabase/legacy/` 참고용.

### raw 테이블

| 테이블 | 행수 | 키/주요 컬럼 | 주의 |
|---|---|---|---|
| `raw.dim_item` | 93,881 | item_code PK, hoc_code, family, item_type(PART/SUPPLY/OPTION/BOM/MACHINE), source_types | 익명화 코드 (Q-013) |
| `raw.dim_model` | 156 | model_key PK, model_base, biz(DT/GC/PRT), iot_code | model_base 빈 8행은 기종 아님 → `core.v_model` |
| `raw.fact_shipment` | 103,795 | item_code, ym('YYYY-MM'), qty, item_type, source_file | **0 인 달 미저장.** PART 2023-04~2026-07, OPTION 2020-01~2026-07 |
| `raw.fact_mc_plan_actual` | 2,765 | fy_sheet, model_key, model_base, biz, ym, sales_ol, scm_ol, act | Bias 양수 = 과대예측. **FY26 이후 새 시트는 업로드 대상 `mc_plan_actual` → `app.mc_plan_extra`**, 단일 소스는 `core.v_mc_plan_actual`(raw 변형 합산 ∪ 추가분, 추가분 우선; 엔진·`v_mc_compare` 가 읽음, D-040). `v_ol_accuracy(_fy)` 는 raw 파일 기준선 그대로 |
| `raw.bridge_bom` | 7,170 | model_key, model_base, bom_group, item_code, qty, active(O/X/△), start/end_date(text) | active·date 는 GC 만 |
| `raw.bridge_scc_config` | 88 | neutral_item_code → scc_item_code, qty | GC SCC 시트 |
| `raw.bridge_mc_cap` | 106 | model_key, predecessor_model, cap_item_code, neutral_item_code | 전임기 정보 있음 (EOL 전환 분석에 활용 가능) |
| `raw.bridge_cap_option` | 646 | cap_item_code → option_item_code, role(MUST_OPTION 340 / SCC/LABEL 306) | 필수옵션 전개 기준 |
| `raw.bridge_option_model` | 972 | item_code, model_base, link_type, cat, common(COMMON 597 / UNIQUE 375) | Common 판정 |
| `raw.bridge_xcn` | 20,760 | related_item → hoc_item, family | 부품 합산 기준 |

### core 뷰 (정제 규칙 한 곳)

| 뷰 | 역할 | 관련 규칙 |
|---|---|---|
| `core.v_ym_calendar` | 데이터에 존재하는 모든 월 (79: 2020-01~2026-07). 희소 저장 보완용 LEFT JOIN | R-FC-03 |
| `core.v_item` | hoc_code 빈값 → 자기 자신 보정 | R-XCN-04 |
| `core.v_model` | 기종 아닌 8행 제거 (148) | R-BOM-09 |
| `core.v_part_linkage` | 구코드 → 대표코드 | R-XCN-01 |
| `core.v_shipment_by_hoc` | **XCN 합산 월별 출고. 부품 조회는 항상 이것** | R-XCN-01 |
| `core.v_option_commonality` | 옵션이 몇 기종에 공용인지 | R-BOM-06 |

### analytics 뷰 (화면·Tool 전용)

`v_shipment_trend`, `v_item_demand_profile`, `v_item_demand_kpi`, `v_ol_accuracy`, `v_ol_accuracy_fy`, `v_bom_requirement`, `v_bom_requirement_x`, `v_part_linkage`, `v_realdata_kpi`, `v_model`·`v_option_model_link`(core pass-through — 화면은 이것만, D-056)
(5회차 더미 뷰 `v_stockout_risk`·`v_stockout_kpi`·`v_leadtime_gap` 은 **삭제 완료**. 현재 analytics 는 뷰 33 + 물리화 뷰 2 — D-058 로 `v_item_name`·`v_customer`·`v_customer_allocation`·`v_demand_line`·`v_urgent_progress`·`v_inbound_event`·`v_group_stock`·`v_force_alloc_pool` 추가)

## 3. `app` 스키마 (SP1 구현, migrations 000400~000700)

공통 컬럼(마스터): `source`(upload/manual/seed/parsed) · `is_dummy` · `updated_by` · `updated_at`. 감사 트리거 `trg_audit` 부착 테이블은 ★.

| 테이블 | 용도 | 규칙 |
|---|---|---|
| `app.profiles` | 사용자·역할(enum `app.role` 7종). auth.users 가입 트리거로 생성 | 01-business-process §4 |
| `app.system_settings` ★ | key/value(jsonb) 32개. 발주·일정: ol_lead_months, flex_ranges, dos_avg_months, default_lead_time_days, ship_lead_days, submit_deadline_rule, submission_depts, reminder_interval_min, temp_alloc_days, expiry_reminder_days, projection_past/future_months, fiscal_year_start_month · AI: ai_model · **알림**: notify_enabled/notify_email_enabled/notify_reminders_enabled (D-046) · **자동 런**: auto_run_enabled/day/hour/backtest/tune (D-041) · **AI 감시**: agent_mode/dos_ratio/lead_days/surge_pct/cooldown_hours/max_per_tick (D-042) · **보존·부하**: run_retention/audit_retention_days/engine_n_jobs (D-045) · 내부 플래그 matview_refresh_requested | R-OQ-10/11, R-SCH-05/20/21/31, R-UI-04/10 |
| `app.supplier` ★ | 공급처 5곳: prep_days, lead_time_days, sailing_rule(SP5) | R-SCH-02/06 |
| `app.item_setting` ★ | 목표 DoS, MOQ, pack_unit·min_order_amount(미사용), 단가, 배정방식, 승인상태 | R-OQ-02/30~33, R-AL-10 |
| `app.inventory_snapshot` ★ | 품목·기준일·수량·재고구분(normal/inspection/defect/service_center/partner/in_transit) | R-INV-01/08 |
| `app.inbound` ★ | 입고예정: 공급처, PO, 수량, 계획일/실제일, 상태(ordered/shipped/received) | R-INV-02, R-SCH-10 |
| `app.attach_rate` ★ | 기종×옵션 장착률, 적용월 | R-BOM-04/05 |
| `app.eol_eos` ★ | 기종 출시/EOL/EOS | R-FC-07 |
| `app.holiday` ★ | 공휴일 | R-SCH-04 |
| `app.shipment_extra` | 추가 출고 실적(과거 연도·최신 월). 업로드는 긴 형식 또는 회사 파일 넓은 형식 자동 변환. v_item_monthly 가 부품은 HOC 귀속·옵션 SW 분리해 UNION. 반영 후 `fn_request_refresh` → pg_cron `scm-refresh`(매분) 갱신 | D-030 |
| `app.upload_log` | 업로드 이력·오류 행 | D-007 |
| `app.audit_log` | 전 테이블 before/after/actor 이력 | 이력 요구 전부 |
| `app.approval` ★ | 범용 승인함 kind 8종(item_setting/target_dos/allocation_mode/order_plan/priority_alloc/bulkdeal/forecast_tuning/agent_order) | R-OQ-40, R-AL-15, R-FC-42, R-AI-13 |
| `app.notification` | 수신자·채널(system/email)·읽음·발송결과. `trg_notify_gate`(전체 off)·`trg_email_copy`(이메일 복제) | R-SCH-30/31 |
| `app.mc_plan_extra` | 기종 OL·실적 추가분(FY26~). `core.v_mc_plan_actual` 이 raw 와 합침 | R-FC-13, D-040 |
| `app.auto_run_log` | 월 1회 자동 런 기록(백테스트/프로덕션 run id·summary·error) | R-FC-43, D-041 |
| `app.agent_event` | AI 감시 이벤트(신호별 1행, 상태·판단·근거·피드백·승인 연결) | R-AI-14, D-042 |

### 뷰·물리화 뷰

| 객체 | 내용 |
|---|---|
| `analytics.v_item_monthly` (MV) | 품목(HOC)×월 출고, 0 채움, SW 는 category='SW', shipment_extra 포함. **SP2 예측 입력** |
| `analytics.mv_item_stats` (MV) | 품목 출고 통계: 카테고리·설명·6M평균·12M합·최근출고월. 출고 데이터 변경 시 refresh |
| `analytics.v_item_master` (뷰) | 품목 목록·상세 소스 = mv_item_stats + 설정·현재고·입고예정·DoS·`is_excess`(DoS ≥ 목표 2배, D-034) **실시간 조인** (승인·업로드 즉시 반영). PART 5,964 / SUPPLY 634 / OPTION 3,074 / SW 522 |
| `core.v_option_model_link` | 옵션↔기종 (bridge/parsed/none), is_sw |
| `app.v_item_setting` | 단가 마스킹 뷰 (관리 역할만 단가) |
| `app.v_available_stock` | 가용재고 = 현재고 − 배정 (SP4 전 배정 0) |
| `app.v_my_approvals` | 승인함 (요청자 본인 또는 팀장/관리자) |

### RPC (security definer)

`app.current_role()`, `fn_request_approval`, `fn_decide_approval`, `fn_apply_upload(target, rows, mode, file_name)`, `fn_dashboard_summary()`, `fn_dashboard_v2()`, `fn_refresh_matviews()`, `fn_request_refresh()`, `fn_mark_read(ids)`, `fn_unread_count()`, `fn_sidebar_badges()`, `notify_role/notify_user`. app 스키마 함수는 현재 59개

### Supabase 대시보드 수동 설정
Project Settings → Data API → **Exposed schemas**: `public, graphql_public, app, analytics, core`. 없으면 supabase-js `.schema('app')` 조회가 빈 배열/오류.

### 예측 (SP2, migration 001000)
| 객체 | 내용 |
|---|---|
| `app.forecast_method` ★ | 기법 레지스트리 13종: enabled·params·patterns·abc_scope·level·min_history (D-018) |
| `app.forecast_policy` ★ | ABC-XYZ 9셀별 후보 기법 (R-FC-35) |
| `app.forecast_run` | 런: backtest(eval_fy) / production(horizon), status requested→running→done/failed, summary |
| `app.forecast_result` | 런×레벨(item/model)×품목×월×기법 예측값·밴드·is_champion·actual |
| `app.forecast_accuracy` | 레벨(item/model/total/category/biz/abcxyz/pattern)×기법 Bias/WAPE/MAPE |
| `app.item_class` | 품목 분류: pattern(SBC)·ABC·XYZ·CV·챔피언 기법 (v_item_master 조인) |
| `app.forecast_tuning_proposal` ★ | gpt-5-nano 진단·제안(JSON), status pending→requested→applied/rejected |
| `analytics.v_forecast_latest_run` / `v_forecast_latest` | 최신 완료 런 / 프로덕션 챔피언 예측 |
| `analytics.v_mc_compare` | 기종×월: sales_ol·scm_ol·act·system_fc·밴드·fy (기종 변형 합산) |
| `analytics.v_accuracy_summary`, `v_abc_xyz_matrix` | 화면 요약 |
| RPC | `fn_request_forecast_run`, `fn_request_tuning_approval`, `fn_apply_tuning` (fn_decide_approval 분기) |
엔진 CLI: `engine forecast backtest --eval-fy 2025` · `run --horizon 6` · `pending` · `tune --run-id X`

### 발주 (SP3, migration 002000)
`app.extra_demand`(수주확정·수급회의·Bulkdeal, 빈 문자열은 NULL 정규화) · `app.order_plan` / `order_plan_line`(근거·전개 jsonb) · `app.ol_submission`(승인 시 제출 OL) · `item_setting.supplier_id` · 뷰 `analytics.v_order_plan_summary`(summary jsonb 기반)
RPC `fn_order_inputs(plan_ym, category)`(force_custom_plan, 카테고리별 호출), `fn_save_order_plan`, `fn_append_plan_lines`(500행 청크), `fn_finalize_order_plan`, `fn_override_line`, `fn_confirm_order_plan`, `fn_add_extra_demand`(→ jsonb {id, bulkdeal_overlap}), `fn_plan_cat_projection`, `fn_plan_overview(plan_id)`(카테고리·공급처·필요월·상위 10 품목·품절 리스크 집계, force_custom_plan, migration 007100, D-035). 계산은 `web/lib/order/calc.ts`. (D-022, D-026, D-027)

### 학습 루프 (migration 008000·008100·008300)
| 객체 | 내용 |
|---|---|
| `app.mc_plan_extra` + `core.v_mc_plan_actual` | 기종 OL·ACT = raw(변형 합산) ∪ 업로드 추가분(추가분 우선). 엔진·`v_mc_compare` 의 단일 소스 (D-040) |
| `analytics.v_item_ol` / `v_item_ol_accuracy` / `v_item_ol_accuracy_summary` | 품목 제출 OL 시계열(최신 `ol_submission`)과 실적 대비 WAPE·Bias (D-040) |
| `app.auto_run_log` + 설정 `auto_run_*` 5개 | 월 1회 자동 백테스트·프로덕션·AI 분석 기록 (D-041, R-FC-43) |
| RPC `fn_plan_scorecard(plan)` · `fn_recent_scorecards(months)` · `fn_override_patterns(months)` | 사후 채점(제안 vs 실제 발주 vs 결과)·오버라이드 패턴 → AI 튜닝 입력 (D-044, R-OQ-42/43) |
| `fn_request_tuning(run_id)` | 웹 "AI 오차 분석 요청" → queued 제안 행 (tick 의 process_pending 이 채움, migration 008600, D-052) |
| `fn_request_tuning_approval` / `fn_apply_tuning` | 제안 payload 에 `dos_adjustments` 포함, 승인 시 목표 DoS 5~180일 가드로 적용 (D-044) |

### 자율 모드 AI 감시 (migration 008200)
`app.agent_event`(신호별 1행·쿨다운·피드백·승인 연결) · approval_kind `agent_order` · 트리거 `trg_agent_order_decided`(승인 → `extra_demand` 반영) · RPC `fn_agent_signals(dos_ratio, lead_days, surge_pct)`(force_custom_plan, 신호 5종)·`fn_agent_feedback`·`fn_agent_stats` · 설정 `agent_*` 6개 (D-042, R-AI-10~15). 엔진 `scm_engine/agent.py`, CLI `engine agent --mode --no-llm`.

### 운영 (migration 008400·008500)
`fn_prune_runs(keep)` + 설정 `run_retention`·`audit_retention_days`·`engine_n_jobs`, 대량 테이블(`order_plan_line`·`forecast_result`·`forecast_accuracy`) 감사 트리거 제거 (D-045) · 알림 설정 `notify_*` 3개 + `trg_notify_gate`, 이메일 복제·tick 가드 (D-046).

### 배정 (SP4, migration 003000)
`app.sales_order` · `app.allocation`(temp/firm/hold) · 뷰 `app.v_sales_order`, `v_available_stock`(재정의), `v_allocation_queue` · RPC `fn_available_stock`, `fn_create_sales_order`, `fn_confirm_sales_order`, `fn_cancel_sales_order`, `fn_receive_inbound`, `fn_auto_allocate`, `fn_manual_allocate`, `fn_set_priority`, `fn_allocation_tick`, `fn_allocation_overview`(배정 구성·대기 부족 상위 10·임시배정 만료 예정 30일·입고 예정 월×공급처·90일 주문 상태·30일 요청 추이, migration 007200, D-036).
### 일정·알림 (SP5, migration 004000)
`app.demand_submission` · `supplier.sailing_rule` · RPC `fn_business_day`, `fn_sailing_dates`, `fn_order_calendar`, `fn_submission_deadline/status`, `fn_submit_demand`, `fn_submission_reminder_tick`, `fn_tick`(pg_cron `scm-tick` */10) · 이메일 복제 트리거 `trg_email_copy` · 뷰 `analytics.v_inbound_gap(_summary)`.
### AI Agent (SP6, migration 005000)
`app.ai_conversation` · `app.ai_message` · 뷰 `analytics.v_ai_stats_daily`, `v_ai_message_log` · RPC `fn_ai_stats`(force_custom_plan), `fn_sidebar_badges`(미읽음·승인 대기 배지, D-028) · 화면 개요 RPC: `fn_forecast_overview`(예측 화면 개요: ABC-XYZ 매트릭스(재고·DoS 포함)·등급별 재고·최근 12개월 카테고리 추이·챔피언 분포, migration 007000, D-034), `fn_dashboard_v2`(SCM 대시보드 5묶음 + 데이터 준비 + charts 집계: stock_by_cat·risk_by_cat_abc·plan_history·alloc_mix·accuracy_rounds, migration 006000, D-031/D-032; 구 `fn_dashboard_summary` 는 유지).

### 향후 확장 후보
| 영역 | 후보 테이블 | 규칙 |
|---|---|---|
| 예측 | 옵션 장착률 전개 결과(attach_rate 수령 후), EOL 수렴 파라미터 | R-BOM-04, R-FC-07 |
| AI | 스트리밍 응답, 대화 공유 | R-AI |
