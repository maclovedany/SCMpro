# SP1 기반 — 검증 리포트

검증일: 2026-09-13 · 브랜치: sp1-foundation · spec: docs/specs/2026-09-13-sp1-foundation-design.md §10

## 완료 기준 대조

| # | 기준 | 결과 | 증거 |
|---|---|---|---|
| 1 | Supabase 에 raw 10테이블·core·analytics·app 생성, `engine verify --target postgres` 통과 | ✅ | 아래 "engine verify" — 10/10 OK, exit 0 |
| 2 | 로그인 후 역할별 메뉴, 대시보드 카드 6개 전부 드릴다운 | ✅ | `tests/e2e/dashboard.spec.ts` — 카드 6개 href 검증, 영업 역할 메뉴 3개 |
| 3 | 재고 CSV 업로드 → 품목 상세 반영 → upload_log | ✅ | `tests/e2e/upload.spec.ts` — 정상 2/오류 1(클라이언트), 서버 오류 1(UNKNOWN_ITEM), 상세 현재고 120·기준일 2026-09-10, 이력 표시 |
| 4 | 목표 DoS 변경 → 승인 요청 → 팀장 승인 → audit_log | ✅ | `tests/e2e/approval-flow.spec.ts` — 요청·알림·승인·반영·요청자 알림. audit_log 행 존재 (아래) |
| 5 | 메뉴 전환 체감 1초 이내 | ✅ | `tests/e2e/perf.spec.ts` (프로덕션 빌드): /items 66ms · /notifications 62ms · /upload 58ms · /approvals 41ms · /admin/item-settings 50ms · /dashboard 49ms |
| 6 | 테스트 전부 통과, docs 갱신 | ✅ | 아래 + 05-data-catalog §3 app 스키마 등록, D-014/D-015 |

## 테스트 결과

- engine (pytest): 15 passed in 1.82s
- web unit (vitest):       Tests  20 passed (20)
- web e2e (Playwright, `next build && next start`):   7 passed (12.8s)
- lint: 0 errors (1 warning: React Compiler 가 TanStack Table 훅 메모이제이션 건너뜀 — 동작 영향 없음)
- tsc --noEmit: 0 errors

## engine verify --target postgres
```
              table  src_n  dst_n   ok
           dim_item  93881  93881 True
          dim_model    156    156 True
      fact_shipment 103795 103795 True
fact_mc_plan_actual   2765   2765 True
         bridge_bom   7170   7170 True
      bridge_mc_cap    106    106 True
  bridge_cap_option    646    646 True
bridge_option_model    972    972 True
         bridge_xcn  20760  20760 True
  bridge_scc_config     88     88 True
리포트: /Users/danymac/Projects/SCMpro/docs/reports/verify-20260913.md
```

## DB 상태
```
app tables|14
rls on|14
audit triggers|9
anon raw usage|f
authenticated raw usage|f
audit_log rows|60437
approvals|7
notifications|14
upload_log|6
```
- raw 스키마: anon/authenticated USAGE 없음 (fail-closed) — 위 두 줄 false 확인
- app 14 테이블 전부 RLS on, 감사 트리거 9개

## 구현 중 spec 에서 달라진 점 (전부 docs 반영)
- D-014: `v_item_master` 를 물리화 뷰 → `mv_item_stats`(물리화) + `v_item_master`(실시간 뷰) 로 분리. 승인/업로드 즉시 반영을 위해.
- D-015: 회계연도 4월 시작 (`fiscal_year_start_month`), R-FC-08, web/engine 헬퍼.
- `bridge_scc_config` 는 scm.db 에 없어 legacy SQL 에서 추출한 시드로 적재.
- Supabase 타입 생성은 CLI 가 Docker 를 요구해 `engine gen-types`(information_schema 기반) 로 대체.
- Next.js 16: `middleware.ts` 대신 `proxy.ts`, async `cookies()/params/searchParams`.
- shadcn v4(base-ui): `asChild` 대신 `render` prop. TanStack Table 은 v8 로 고정.
- SW 라이선스 옵션(출고량 40%)은 `category='SW'` 로 분리해 예측 대상에서 제외 (D-009).

## 스크린샷
- `web/test-results/dashboard.png`, `item-detail.png`, `item-settings.png`, `upload-log.png` (git 제외, 로컬 확인용)
