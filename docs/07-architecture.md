# 시스템 아키텍처

최종 갱신: 2026-09-14 · 근거: D-011(A안), D-013~D-049 · 상세 설계는 `docs/specs/*`, 규칙은 `docs/02-domain-rules/*`
이 문서는 "어떤 구성 요소가 어떻게 연결되어 있는가"를 한 장에 담는다. 규칙·결정의 근거는 여기 반복하지 않고 ID 로 가리킨다.

## 1. 한 장 요약

```mermaid
flowchart LR
  subgraph Users[사용자]
    U1[SCM 품목담당자 / SCM팀장]
    U2[영업 · 마케팅 · 서비스 · 사업강화]
    U3[관리자]
  end
  subgraph Web["Web — Next.js 16 (App Router) · Vercel"]
    P[화면 28 라우트<br/>서버 컴포넌트 + 클라이언트 위젯]
    SA[서버 액션 / API<br/>(권한 검사 → RPC 호출)]
    AI[/api/ai/chat<br/>gpt-5-nano + 도구 9종/]
    PX[proxy.ts<br/>세션 갱신·미로그인 리다이렉트]
  end
  subgraph SB["Supabase (PostgreSQL 17)"]
    AUTH[Auth<br/>이메일/비밀번호]
    RAW[(raw<br/>원본 10 테이블<br/>앱 접근 차단)]
    CORE[(core<br/>정제 뷰 8)]
    AN[(analytics<br/>뷰 23 + 물리화 뷰 2)]
    APP[(app<br/>업무 33 테이블 · 함수 59)]
    CRON[pg_cron<br/>scm-tick */10분<br/>scm-refresh 매분]
  end
  subgraph Eng["Engine — Python (uv) · Railway Cron */10분"]
    CLI[engine CLI]
    FC[forecast: 분류·기법 13·백테스트·프로덕션]
    TUNE[ai_tuning: 오차 분석 → 제안·DoS 보정]
    AUTO[auto_run: 월 1회 자동 런]
    AGENT[agent: 감지→판단→알림·발주 제안]
    TICK[tick / notify: 배정 만료·알림·이메일]
  end
  OAI[(OpenAI API<br/>gpt-5-nano)]
  SMTP[(SMTP<br/>선택)]
  FILES[[xlsx/csv 업로드]]

  U1 & U2 & U3 --> P
  P --> SA --> APP
  P -->|supabase-js 읽기, RLS| AN & APP
  PX --> AUTH
  AI --> OAI
  AI -->|사용자 세션으로 도구 조회| AN & APP
  FILES --> SA
  RAW --> CORE --> AN
  APP --> AN
  CRON -->|fn_tick| APP
  CLI --> FC & TUNE & AUTO & AGENT & TICK
  FC -->|읽기: analytics · 쓰기: app.forecast_*| SB
  TUNE --> OAI
  TICK --> SMTP
```

## 2. 구성 요소

| 구성 요소 | 기술 | 역할 | 위치 |
|---|---|---|---|
| Web | Next.js 16 App Router, TypeScript, Tailwind v4 + shadcn(base-ui), TanStack Query/Table/Virtual, ECharts, react-markdown | 화면·워크플로(확정/승인/배정/업로드), 발주량 산출 계산(`lib/order/calc.ts`), AI Agent 오케스트레이션 | `web/` → **Vercel** (D-048) |
| Supabase | PostgreSQL 17, Auth, RLS, pg_cron | 단일 데이터 저장소 + **업무 로직의 트랜잭션 부분**(배정 상태머신, 승인 적용, 업로드 반영)은 security-definer RPC | `supabase/migrations/` |
| Engine | Python 3.12, pandas, statsmodels, statsforecast, prophet, lightgbm, openai, psycopg | 무거운 배치: 예측 백테스트·프로덕션, 자동 런, AI 오차 분석, AI 감시, 주기 작업·이메일, 데이터 적재/검증/타입 생성 | `engine/` → **Railway Cron** (D-049) |
| OpenAI | gpt-5-nano (설정 `ai_model`) | AI Agent 답변·주제 분류·요약, 예측 조정안 | 외부 |
| SMTP | 네이버 SMTP (환경변수, D-029) | 이메일 채널 발송. 설정 `notify_email_enabled` 로 on/off, 미설정 시 `skipped:no_smtp` (D-046) | 외부 |

**책임 분리 원칙 (D-011, D-022)**
- 즉시 반응이 필요한 계산(발주량 DoS/Flex/MOQ, 재고전개 what-if)은 **TS 단일 구현** — 서버 액션과 화면이 같은 함수를 쓴다.
- 여러 사용자가 동시에 건드리는 상태 변경(주문·배정·승인·업로드)은 **DB RPC** — 트랜잭션·advisory lock·RLS 가 한 곳에서 보장.
- 분 단위 이상 걸리는 계산(예측)은 **Python 배치** — 결과를 버전(run)으로 저장하고 화면은 읽기만.

## 3. 데이터 계층 (Supabase 스키마)

```
raw        원본 그대로(CSV 적재). 앱 역할은 USAGE 없음(fail-closed). 수정 금지.
  └─ core      정제 규칙 1회 적용: XCN 합산(v_shipment_by_hoc), 다중 HOC 귀속, 옵션↔기종 연결(v_option_model_link), 기종 마스터 정리
       └─ analytics  화면·엔진이 읽는 뷰. 물리화: v_item_monthly(품목×월 0채움), mv_item_stats. 일반 뷰: v_item_master(설정·재고 실시간 조인), v_mc_compare, v_forecast_*, v_order_plan_summary, v_inbound_gap, v_ai_*
app        업무 데이터 33 테이블: 설정/마스터(system_settings, supplier, item_setting, inventory_snapshot, inbound, attach_rate, eol_eos, holiday, mc_plan_extra),
           공통 메커니즘(profiles, approval, notification, audit_log, upload_log), 예측(forecast_method/policy/run/result/accuracy, item_class, tuning_proposal, auto_run_log),
           발주(extra_demand, order_plan(_line), ol_submission), 배정(sales_order, allocation), 일정(demand_submission), AI(ai_conversation, ai_message, agent_event)
```
- 모든 app 마스터 테이블: `source(upload/manual/seed/parsed)`, `is_dummy`, `updated_by/at` (D-007). 감사 트리거 `trg_audit` → `audit_log`.
- 물리화 뷰 갱신: 출고 데이터가 바뀔 때만(`fn_refresh_matviews`). 설정·재고는 실시간 뷰로 조인해 승인·업로드가 즉시 반영 (D-014).

## 4. 권한·보안

| 층 | 방식 |
|---|---|
| 인증 | Supabase Auth 이메일/비밀번호. `proxy.ts` 가 매 요청 세션 갱신, 미로그인 → `/login`. `app.profiles.role`(7종) 을 가입 트리거로 생성 |
| 화면 접근 | `lib/auth/roles.ts` 의 역할별 메뉴 + 각 page 의 역할 검사(redirect) |
| 데이터 | RLS: `raw` 폐쇄, `core/analytics` 로그인 사용자 읽기, `app` 은 테이블별 정책(본인 대화·본인 승인·관리 역할만 단가 등). 쓰기는 대부분 RPC(security definer) 로만 |
| 서버 전용 | `service_role`(admin 클라이언트)은 서버 액션에서 대량 저장(발주 라인 청크)과 물리화 뷰 refresh 에만. 호출자는 `p_user` 로 전달해 함수 안에서 역할 검사 (D-022) |
| AI | 도구는 **사용자 세션** 클라이언트로 실행 → 사용자가 못 보는 데이터는 AI 도 못 봄 (R-AI-05). API 키는 서버 env 만 |
| 비밀값 | `web/.env.local`, `engine/.env` (git 제외). `.env.example` 은 빈 값 |

## 5. 주요 흐름

### 5.1 월간 발주 사이클 (업무절차 ①~⑩ ↔ 시스템)
```
① 수요자료 제출  /schedule (demand_submission) ─ 마감 후 미제출 부서 10분 알림(fn_tick)
② 실적·재고     업로드(/upload) 또는 입고 처리(/allocation → inventory_snapshot)
⑤ 수급회의      /extra-demand (수주확정·수급회의 승인·Bulkdeal→팀장 승인)
⑥ 소요량 산출   engine forecast run → /orders 계획 생성: fn_order_inputs → calc.ts(R-OQ) → fn_save/append/finalize
   담당자 검토   /orders/[id] 재고전개 그리드·오버라이드(사유) → 확정 → approval(order_plan)
   팀장 승인     /approvals → fn_decide_approval → ol_submission(제출 OL, 다음 Flex 기준)
⑦⑧ 보고         /orders/[id]/report (CSV·인쇄)
⑩ 입고 확인     /allocation 입고 완료 → v_inbound_gap(계획 vs 실제)
```

### 5.2 예측 (SP2)
```
engine forecast backtest --eval-fy N
  v_item_monthly + fact_mc_plan_actual → classify(SBC·ABC-XYZ) → 정책(셀별 후보) → 기법 13종 fit/predict(joblib 병렬, LightGBM 전역 1회)
  → 챔피언 선택(WAPE 최소, 기준선 우선) → forecast_result/accuracy/item_class 저장 → summary(vs_prev, regressed)
engine forecast run          최신 챔피언으로 미래 H개월 예측(밴드) → 화면·발주 계획 입력
engine forecast tune         런 요약 → gpt-5-nano → tuning_proposal → /approvals 승인 → forecast_method.params 반영(챔피언 off 가드)
```

### 5.3 주문·배정 (SP4) — 전부 RPC 안 트랜잭션, 품목 advisory lock
```
fn_create_sales_order → temp 배정(30일) | partial | waiting
fn_confirm_sales_order → temp→firm    fn_cancel_sales_order → 해제·주문 취소·알림
fn_receive_inbound → 재고 반영 → auto 품목: fn_auto_allocate(우선순위→요청순) / manual 품목: 담당자 알림
fn_manual_allocate → 큐 선두: firm | 건너뜀: hold + approval(priority_alloc) → 승인 시 firm
fn_allocation_tick(10분) → 만료 해제·예고(10/5/3/2/1일)·승인 반복 알림
```

### 5.4 AI Agent (SP6)
```
Topbar 버튼 → 우측 리사이즈 패널 → POST /api/ai/chat {conversation_id, message, page_context}
  → 최근 20턴 + summary → OpenAI(tools) ⇄ 도구 실행(사용자 세션) 최대 5라운드 → 답변·도구 이력 저장 → 주제 분류 → 30개 초과 시 요약
관리자: /admin/ai-stats (fn_ai_stats)
```

## 6. 주기 작업·배치

| 작업 | 실행 주체 | 주기 |
|---|---|---|
| `app.fn_tick()` (배정 만료·예고·승인 반복 알림·미제출 알림 — 반복 알림은 `notify_reminders_enabled`, D-046) | pg_cron `scm-tick` | 10분 |
| `engine tick` = fn_tick + **자동 런**(월 1회, `auto_run_*`, D-041) + **AI 감시**(`agent_mode`, D-042) + **웹 요청 런·AI 분석 요청 처리**(`process_pending`, D-052) + 이메일 발송(`notify_email_enabled`) + 런 결과 정리(`fn_prune_runs`, D-045) | **Railway Cron 서비스**(`engine/Dockerfile`+`railway.json`, D-049). 개발 Mac 의 launchd `com.scmpro.tick` 은 중복이라 중지 — 둘 중 하나만 | 10분 |
| 예측 백테스트·프로덕션 | 자동 런(설정 켜면 매월 지정일) 또는 `engine forecast backtest/run`·웹 요청 후 `engine forecast pending` | 월 1회 + 수동 |
| 물리화 뷰 refresh | 출고 업로드 시 `fn_request_refresh` 플래그 → pg_cron `scm-refresh`(매분) 가 `fn_refresh_matviews` 실행 (8초 제한 회피, D-030) | 1분 |

## 7. 환경·배포

- **운영(2026-09-14 배포됨)**: Web = Vercel(Root `web`, 리전 icn1, `maxDuration=60`) · Engine = Railway Cron(Root `engine`, `*/10 * * * *`) · DB = Supabase **Pro / Micro / 디스크 8GB**. 절차는 `10-operations.md`.
- 로컬: `web` dev 서버(3000/3001), `engine` uv, Supabase 클라우드 프로젝트 직결(psql/psycopg/supabase-js).
- 마이그레이션: `supabase/scripts/migrate.sh` 가 파일명 순 psql 적용(재실행 안전). **grants 는 파일명과 무관하게 스크립트가 마지막에 따로 실행**하지만, 새 마이그레이션은 자기 객체에 직접 `grant` 를 쓴다(파일명이 grants 보다 뒤인 경우 대비). **엔진 런 중 실행 금지**(물리화 뷰 재생성).
- 타입: `engine gen-types` → `web/lib/types/database.ts` (supabase CLI 는 Docker 필요해 자체 생성기).
- Supabase PostgREST 는 요청당 `statement_timeout` 8s — 파라미터 집계 RPC 는 `plan_cache_mode=force_custom_plan`, 대량 저장은 청크 (D-027).
- 남은 운영 과제: 사내 도메인·계정 정책, ERP/MES 연동, 백업 주기 확정, 디스크 사용률 모니터링(D-045) → 상세는 `10-operations.md`, ERP/MES 연동은 `09-integration-plan.md`.

## 8. 디렉터리 지도

```
web/app/(app)/*            라우트(서버 컴포넌트) + *Panel/*Form(클라이언트) + actions.ts(서버 액션)
web/lib/queries/*          화면별 읽기 쿼리(supabase-js)     web/lib/order/calc.ts  발주량 계산(R-OQ)
web/lib/ai/{tools,chat}.ts AI 도구·대화 루프                 web/lib/settings/registry.ts 설정 스펙(R-UI-10)
web/lib/auth/roles.ts      역할·사이드바 6그룹 정의(MENU_GROUPS, R-UI-11) — 새 화면은 여기 배속
web/components/{cards,charts,tables,ai,upload,layout}  공통 위젯(KpiTile·DrillCard·ChartCard·MiniCharts(묶음/스택/가로 막대·도넛·라인·히트맵)·TimeSeriesChart·DataGrid·TreeGrid·AiPanel)
web/lib/design/palette.ts  디자인 토큰(시리즈·상태·액센트·카테고리·ABC 색, R-UI-13) · web/components/charts/theme.ts ECharts 마크 스펙 · globals.css `.scm-card` 카드 표면(D-037)
web/lib/queries/{dashboard,forecast,orders,allocation,schedule}.ts  화면 개요 RPC 호출 + 차트 데이터 순수 함수(*Charts, vitest 대상)
web/tests/e2e/global-setup.ts  e2e 실행 전 픽스처 리셋(E2E 주문·더미 입고·AI 감시 이벤트, D-036/042)
web/vercel.json · engine/{Dockerfile,railway.json}  배포 설정 (D-048, D-049)
engine/scm_engine/forecast/{classify,metrics,backtest,runner,store,ai_tuning}.py + methods/*  예측
engine/scm_engine/{export_raw,verify,seed_app,gen_types,notify,cli}.py                      적재·검증·시드·타입·알림
engine/scm_engine/agent.py  자율 모드 감시 파이프라인(D-042) · forecast/auto_run.py 월 1회 자동 런(D-041) — 둘 다 `engine tick` 에서 실행
supabase/migrations/0001~0007 기반 · 0010 예측 · 0020 발주 · 0030 배정 · 0040 일정 · 0050 AI · 0060 대시보드 RPC · 0070/0071/0072 예측·발주·배정 화면 개요 RPC · 0080 OL 시계열(D-040) · 0081 자동 런(D-041) · 0082 AI 감시(D-042) · 0083 발주 피드백(D-044) · 0084 보존 정책(D-045) · 0085 알림 스위치(D-046) · 0086 AI 분석 요청 RPC(D-052) · 9999 권한
docs/                      00 용어 · 01 업무절차 · 02 규칙(R-*) · 03 결정(D-*) · 04 미확인 · 05 데이터 카탈로그 · 06 데이터 검증 · 07 아키텍처 · 08 사용자 가이드 · 09 ERP 연동 계획 · 10 운영 · 11 전체 요약 · specs · plans · reports
```
