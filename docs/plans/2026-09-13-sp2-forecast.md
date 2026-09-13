# SP2 예측 엔진 구현 계획

> 상태: **완료** 2026-09-13 (docs/reports/sp2-verification.md). 실행자 = 동일 세션(inline). spec: docs/specs/2026-09-13-sp2-forecast-design.md

**Goal:** FY 롤링 백테스트로 기법을 평가·선택하는 예측 엔진 + 관리자 기법 토글 + OL 3종 비교 화면 + AI 오차 분석 제안.

## Global Constraints
- 부품은 HOC, SW 제외 (`analytics.v_item_monthly`). 회계연도 4월 시작 (R-FC-08). 기준선 6M 평균을 못 이기면 기준선 (R-FC-31).
- enabled 기법만 후보 (R-FC-34). 무거운 기법은 A/B 등급만 (spec §3).
- 모든 카드 드릴다운, 시리즈 색상 고정 (R-UI). 규칙 ID 를 코드 주석에.

## Tasks
| # | Task | 산출물 | 검증 |
|---|---|---|---|
| 1 | DB migration `20260913001000_forecast.sql` | 테이블 7, 뷰 5, RPC, 기법·정책 시드, fn_decide_approval 분기(forecast_tuning), dashboard 카드 | migrate.sh, verify.sql 확장 |
| 2 | engine: metrics + classify | `metrics.py`, `classify.py` (SBC, ABC-XYZ) | pytest 경계값 |
| 3 | engine: 기법 (simple/ets/intermittent/stat/ml/mc) + registry | `methods/*.py` 공통 시그니처 `fit_predict(y, h, params) -> Forecast(point, lower, upper)` | pytest 합성 시계열 |
| 4 | engine: backtest + runner + store | FY 롤링, 챔피언, 정확도 집계, bulk write, CLI | 20품목 소규모 e2e(pytest), 실데이터 eval_fy 2025 실행 |
| 5 | engine: ai_tuning | OpenAI gpt-5-nano JSON 제안, 저장, CLI tune | mock 테스트 + 실제 1회 호출 |
| 6 | web: 예측 대시보드 `/forecast`, ABC-XYZ 매트릭스, 정확도 비교 | queries/forecast.ts, 페이지 | vitest 빌더, Playwright |
| 7 | web: `/forecast/mc`, `/forecast/runs[/id]`, 제안 승인 요청 | 페이지 + actions | Playwright |
| 8 | web: `/admin/forecast-methods` 토글·params·정책 | 페이지 + actions | Playwright 토글 |
| 9 | web: `/items/[code]` 예측 시리즈·카드·그리드 행, `/items` 컬럼 | 수정 | Playwright |
| 10 | 검증 리포트 `docs/reports/sp2-verification.md`, 문서 갱신, main 병합 | | 완료 기준 6 |
