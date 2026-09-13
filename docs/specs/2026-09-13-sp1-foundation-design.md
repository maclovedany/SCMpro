# SP1 기반(Foundation) 설계

작성: 2026-09-13 · 상태: 사용자 검토 대기 · 근거: D-011, D-012, D-007, 02-domain-rules/*
후속: SP2 예측 엔진, SP3 발주량 산출, SP4 주문·배정, SP5 일정·알림

## 1. 목표

이후 4개 서브프로젝트가 올라탈 토대를 만든다.
- Supabase 에 실데이터(raw/core/analytics) 적재 + 업무 데이터용 `app` 스키마
- 인증·역할·이력·승인·알림의 **공통 메커니즘** (각 SP 가 재사용)
- 파일 업로드와 관리자 입력 이중 경로 (D-007) + 더미 시드
- Next.js 앱 뼈대: 즉시 전환·드릴다운·ECharts 패턴 확립 (R-UI)
- Python 엔진 뼈대: DB 어댑터, 로더, 검증 CLI

SP1 에서 **하지 않는 것**: 예측 계산, 발주량 산출, 주문 배정, 이메일 발송, 발주일 캘린더.

## 2. 레포 구조

```
SCMpro/
├── CLAUDE.md, stage1.md, 회의록.docx, 데이터 설명.docx     (원본 3개 루트 유지)
├── docs/
├── data/raw/            xlsx·csv·scm.db (이동)
├── supabase/
│   ├── config.toml
│   ├── migrations/      20260913000001_raw_schema.sql … (기존 01,03~07 이관) + app 스키마
│   ├── seed/            02-data-*.sql (raw 데이터), app_seed.sql (더미)
│   └── scripts/         verify.sql
├── engine/              Python (uv)
│   ├── pyproject.toml
│   ├── scm_engine/      db/(sqlite.py, postgres.py, base.py), loaders.py, verify.py, cli.py
│   └── tests/
└── web/                 Next.js 15
    ├── app/             (auth)/login, (app)/dashboard, admin/*, upload, items/[code]
    ├── components/      ui(shadcn), charts(echarts wrappers), tables(tanstack), cards(DrillCard)
    ├── lib/             supabase/(client, server, middleware), queries/, types/(generated)
    └── tests/           vitest + playwright
```

## 3. 데이터베이스

### 3.1 기존 스키마 이관
- `01-schema.sql` → migration `raw`. `02-data-*.sql` → `supabase/seed/raw/` (seed 로 취급, 25개). `03-verify` → scripts. `04,05` → migrations `core`,`analytics`. `06` grants → **항상 마지막 migration** 으로 유지되도록 번호를 가장 뒤로. `07` → agent 테이블은 이번 범위 밖이므로 폐기 표시 부분만 이관.
- 행수 불일치(06-data-profile §6): `scm.db` 를 기준으로 02-data 를 재생성하는 스크립트 `engine verify --regen-seed` 제공. 기대 행수는 scm.db 실측값으로 갱신.
- core 뷰 수정 2건: `v_part_linkage` 에 R-XCN-08(다중 HOC 귀속) 적용, 신규 `v_option_model_link`(R-BOM-11: bridge_option_model 우선, 없으면 family 파싱, LICENSE 제외 플래그).

### 3.2 `app` 스키마 (신규)

공통 컬럼(마스터 테이블): `source text check in ('upload','manual','seed','parsed')`, `is_dummy bool default false`, `updated_by uuid`, `updated_at timestamptz`.

| 테이블 | 주요 컬럼 | 비고 |
|---|---|---|
| `role` (enum) | item_manager, scm_lead, sales, marketing, service, biz_enable, admin | |
| `profiles` | user_id PK(auth.users), name, role, dept, email | 가입 시 트리거로 생성, role 기본 sales |
| `system_settings` | key PK, value jsonb, description | 초기값 §3.4 |
| `supplier` | id, code, name, country, prep_days int, lead_time_days int, sailing_rule jsonb(SP5 에서 정의), 공통 | 5행 더미 |
| `item_setting` | item_code PK(→raw.dim_item), target_dos_days int, moq int default 1, pack_unit int null, min_order_amount numeric null, unit_price numeric, currency, allocation_mode enum(auto,manual) default auto, status enum(draft,pending,approved), approved_by, approved_at, 공통 | R-OQ-02/30~33, R-AL-10 |
| `inventory_snapshot` | id, item_code, snap_date, qty numeric, stock_class enum(normal,inspection,defect,service_center,partner,in_transit), 공통 | R-INV-01. 현재고 = stock_class='normal' 최신 snap_date |
| `inbound` | id, item_code, supplier_id, po_no, qty, planned_date, actual_date null, status enum(ordered,shipped,received), 공통 | R-INV-02, R-SCH-10 |
| `attach_rate` | id, model_base, option_item_code, rate numeric(6,4), effective_ym char(7), 공통 | R-BOM-04/05 |
| `eol_eos` | model_base PK, launch_date, eol_date, eos_date, 공통 | R-FC-07 |
| `holiday` | date PK, name, country default 'KR' | R-SCH-04 |
| `upload_log` | id, file_name, target, row_count, ok_count, error_count, errors jsonb, status, uploaded_by, uploaded_at | D-007 |
| `audit_log` | id, table_name, row_pk, action, before jsonb, after jsonb, actor uuid, at | 트리거 `fn_audit()` 를 모든 app 테이블에 부착 |
| `approval` | id, kind enum(target_dos, allocation_mode, order_plan, priority_alloc, bulkdeal, item_setting), target_table, target_pk, payload jsonb, requested_by, requested_at, approver uuid null, status enum(pending,approved,rejected), reason text not null, comment text, decided_at | 범용 승인함. SP3/4 가 kind 추가 |
| `notification` | id, recipient uuid, channel enum(system,email), kind, title, body, payload jsonb, created_at, sent_at, read_at, result | SP1 은 system 채널만. email 은 SP4/5 |

### 3.3 뷰 (app / analytics)
- `analytics.mv_item_stats`(물리화: 출고 통계) + `analytics.v_item_master`(일반 뷰: + item_setting + 최신 현재고 + 입고예정) — 품목 목록 화면 소스. 설정·재고는 실시간 (D-014 로 변경).
- `analytics.v_item_monthly` : `core.v_shipment_by_hoc` ∪ OPTION/SUPPLY 를 달력 LEFT JOIN 해 0 채운 월별 시계열 (HOC 기준). 물리화.
- `app.v_available_stock` : 현재고 − 배정(SP4 전까지 0) — 영업 역할용.
- `app.v_my_approvals` : 승인함.

### 3.4 system_settings 초기값
```
ol_lead_months=1 · flex_ranges=[{"offset":1,"pct":20},{"offset":2,"pct":30},{"offset":3,"pct":30}] (offset≥4 제한 없음)
dos_avg_months=6 · ship_lead_days=7 · submit_deadline_rule="last_day-1" · reminder_interval_min=10
projection_past_months=12 · projection_future_months=6
```

### 3.5 더미 시드 (`app_seed.sql`, 전부 is_dummy=true, source='seed')
- supplier 5행 (SUP-VN, SUP-CN, SUP-JP, SUP-HK, SUP-KR), prep 7~14일, lead 30~60일
- item_setting: 출고 이력 있는 전 품목. target_dos 30, moq: PART 1 / SUPPLY 10 / OPTION 5 / MACHINE 1, unit_price 카테고리별 난수(seed 고정)
- inventory_snapshot: 2026-08-31 기준, normal = 최근 6개월 평균 × U(0.5, 2.0) 반올림, 10% 품목은 inspection/in_transit 소량
- inbound: 상위 300 품목 각 1건 ordered, planned 2026-09~10
- holiday: 2026 한국 공휴일
- eol_eos: bridge_mc_cap 의 predecessor 관계로 EOL 추정 없음 → 비워두고 화면에서 입력

### 3.6 RLS
- `raw` 폐쇄 유지. `core/analytics` authenticated 읽기.
- `app`: 모든 역할 읽기 (단 `item_setting.unit_price` 는 item_manager/scm_lead/admin 만 — 컬럼 보안은 뷰로 분리). 쓰기: admin 전부, item_manager 는 item_setting/inventory/inbound/attach_rate/eol_eos, scm_lead 는 approval 결정, 그 외 역할은 notification.read_at 만.
- 승인 결정·설정 반영은 **RPC(security definer 함수)** 로만: `fn_request_approval`, `fn_decide_approval`(승인 시 payload 를 대상 테이블에 적용 + audit), `fn_apply_upload`.

## 4. 업로드 파이프라인

1. 클라이언트에서 xlsx/csv 파싱(SheetJS) → 첫 50행 미리보기 + 컬럼 매핑 UI(대상 테이블별 템플릿, 자동 매핑)
2. 검증(클라이언트+서버): 필수 컬럼, 타입, `item_code` 가 dim_item 에 존재, 날짜 형식, 중복 키
3. 서버 액션 → `fn_apply_upload(target, rows jsonb, mode upsert|replace_period)` → 트랜잭션, 오류 행은 건너뛰고 `upload_log.errors` 에 기록
4. 반영 후 물리화 뷰 refresh, 결과 요약 카드(성공/오류 → 클릭 시 오류 행 목록, R-UI-01)
5. 대상: inventory_snapshot, inbound, item_setting, attach_rate, supplier, eol_eos, holiday, fact_shipment 추가월(raw 는 원칙상 수정 금지이므로 `app.shipment_extra` 에 넣고 v_item_monthly 가 UNION)

## 5. 웹 앱

- Next.js 15 App Router, TypeScript strict, Tailwind + shadcn/ui, TanStack Query(stale 5분, prefetch on hover), TanStack Table + Virtual, ECharts(echarts-for-react), SheetJS, zod.
- 라우트: `/login`, `/dashboard`, `/items`, `/items/[code]`, `/admin/settings`, `/admin/suppliers`, `/admin/item-settings`, `/admin/holidays`, `/admin/eol`, `/upload`, `/approvals`, `/notifications`
- 공통 컴포넌트:
  - `DrillCard` : 값 + 라벨 + `href`(필터 쿼리 포함). 클릭 필수 (R-UI-01)
  - `TimeSeriesChart` : ECharts 래퍼. props: series[{name, role(actual|forecast|sales_ol|scm_ol|order), data}], forecastFrom(ym), band. 색상 고정 (R-UI-03)
  - `DataGrid` : TanStack Table 래퍼 (정렬·필터·컬럼 숨김·CSV·가상 스크롤) (R-UI-05)
  - `TreeGrid` : 월 열 트리 그리드 — SP1 에서는 품목 상세의 "월별 출고" 로만 사용, SP3 에서 전개 행 추가 (R-UI-04)
- 대시보드(SP1 버전): 카드 6개 — 품목 수(카테고리별), 더미 데이터 비율, 승인 대기, 최근 업로드, 재고 스냅샷 기준일, 미설정 목표 DoS 품목 수. 전부 드릴다운.
- 성능: 첫 로드는 서버 컴포넌트 + `HydrationBoundary` 로 데이터 동봉, 이후 클라이언트 캐시. 목록 API 는 페이지 200행 + 서버 필터.

## 6. 엔진 뼈대

- `scm_engine.db.Base` : `read_df(sql)`, `write_df(df, table, mode)`, `exec(sql)`. 구현 `SQLiteDB(path)`, `PostgresDB(dsn)`.
- `scm_engine.loaders` : `load_monthly(item_type, hoc=True) -> DataFrame[item, ym, qty]` (0 채움·음수 클리핑 옵션), `load_mc_plan_actual()`, `load_masters()`.
- `scm_engine.verify` : 테이블별 행수 대조(sqlite vs postgres), XCN 다중 HOC 리포트, dim_item/bridge_xcn HOC 불일치 리포트 → `docs/reports/verify-YYYYMMDD.md`.
- CLI: `engine verify [--target sqlite|postgres]`, `engine regen-seed`, `engine refresh-views`.

## 7. 오류 처리
- 업로드: 행 단위 오류 격리, 전체 실패는 트랜잭션 롤백. 오류 파일 다운로드(CSV).
- RPC: 권한 없음 → 42501 → UI 토스트. 승인 대상 상태 불일치 → 명시적 에러 코드.
- 엔진: DB 연결 실패 시 즉시 종료 코드 2, 검증 불일치는 리포트 + 종료 코드 1.

## 8. 테스트
- SQL: `supabase/scripts/verify.sql` (행수, RLS 로 anon 0행, 트리거 audit 동작)
- engine: pytest — 어댑터 계약 테스트(sqlite 실 DB), 로더 0채움/클리핑, XCN 귀속 규칙(R-XCN-08) 케이스
- web: vitest — DrillCard href 생성, 업로드 검증기(zod), TimeSeriesChart 옵션 빌더(색상·forecastFrom 음영). Playwright — 로그인 → 품목 목록 → 상세 → 업로드(재고 샘플 CSV) → 관리자 설정 승인 요청 → 팀장 승인 smoke.
- 성능 확인: Playwright 로 메뉴 전환 시 LCP < 1s 측정(로컬).

## 9. 환경
- `web/.env.local`: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- `engine/.env`: SUPABASE_DB_URL(postgres dsn), SQLITE_PATH=../data/raw/scm.db
- `.env.example` 두 곳에 제공. `.gitignore` 에 .env* 포함. git 저장소 초기화(현재 미초기화).

## 10. 완료 기준
1. `supabase db push` + seed 로 Supabase 에 raw 10테이블·core·analytics·app 생성, `engine verify --target postgres` 통과
2. 로그인 후 역할별 메뉴, 대시보드 카드 6개 전부 드릴다운 동작
3. 재고 스냅샷 CSV 업로드 → 품목 상세 현재고 반영 → upload_log 확인
4. 관리자에서 목표 DoS 변경 → 승인 요청 → 팀장 계정 승인 → audit_log 기록
5. 메뉴 전환 체감 1초 이내 (Playwright 측정 기록)
6. 테스트 전부 통과, docs 갱신(05-data-catalog 에 app 테이블 등록)
