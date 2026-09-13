# SP2 예측 엔진 설계

작성: 2026-09-13 · 상태: 구현 중 (사용자 위임으로 승인 게이트 생략, D-013) · 근거: D-002, D-008, D-015~019, R-FC-*, 06-data-profile
선행: SP1 · 후속: SP3 발주량 산출(예측 결과 소비), SP6 AI Agent(예측 근거 도구)

## 1. 목표
품목(HOC)·기종 단위 월별 기준예측을 생성하고, **FY 롤링 백테스트**로 기법을 평가·선택(챔피언)하며, Sales OL·SCM OL 과 나란히 정확도를 비교한다. 관리자가 기법을 on/off 하고, AI(gpt-5-nano)가 라운드별 오차를 분석해 조정안을 제안한다(승인 후 적용).

하지 않는 것: 발주량 계산(SP3), 옵션 장착률 전개(장착률 미수령 — 옵션은 독립 시계열로만 예측, R-BOM-05 임시), 이메일.

## 2. 데이터 흐름
```
analytics.v_item_monthly (품목×월, 0채움, SW 제외)  ─┐
raw.fact_mc_plan_actual (기종×월 Sales/SCM OL, ACT) ─┤→ engine forecast ──► app.forecast_run / forecast_result / forecast_accuracy / item_class
app.forecast_method (enabled, params) · forecast_policy ┘                        │
                                                          gpt-5-nano ◄── engine tune ──► app.forecast_tuning_proposal → 승인(app.approval kind=forecast_tuning) → forecast_method.params 갱신
web /forecast* 화면 ◄── analytics.v_forecast_* 뷰
```

## 3. 분류 (engine/classify.py)
- **수요 패턴** (SBC): 최근 24개월 ADI·CV² → smooth / erratic / intermittent / lumpy / dead (R-FC-30).
- **ABC-XYZ** (R-FC-35): ABC = 최근 12개월 `qty × unit_price`(단가 없으면 qty) 기여도 누적 80/95/100. XYZ = 월 수요 CV ≤0.5 X / ≤1.0 Y / >1.0 Z. 결과 `app.item_class`.
- **정책** `app.forecast_policy(cell, methods text[], min_history int)`: 기본값
  - AX/AY/BX/BY: 전체 기법 · AZ/BZ: 간헐 기법 + lightgbm + 평균 · CX/CY: 이동평균·SES·Holt·전년동월 · CZ: 6M평균·Croston·SBA
  - 무거운 기법(arima·prophet)은 A/B 등급에만. lightgbm 은 전역 모델 1회 학습으로 전 품목 적용.

## 4. 기법 레지스트리 `app.forecast_method` (D-018)
| key | 이름 | family | 적용 패턴 | 기본 params |
|---|---|---|---|---|
| ma3 / ma6 / ma12 | 이동평균 | simple | all | window |
| ses | 단순지수평활 | ets | smooth,erratic | alpha auto |
| holt | Holt 추세 | ets | smooth | damped true |
| hw | Holt-Winters 가법 12 | ets | smooth,erratic (≥24M) | seasonal add |
| snaive | 전년동월×추세 | simple | all (≥24M) | trend_window 6 |
| croston | Croston | intermittent | intermittent,lumpy | alpha 0.1 |
| sba | SBA | intermittent | intermittent,lumpy | alpha 0.1 |
| arima | AutoARIMA (statsforecast) | stat | smooth,erratic, A/B | season 12 |
| prophet | Prophet | stat | smooth,erratic, A | yearly |
| lgbm | LightGBM 전역 | ml | all | lags 1-12, rolling, month, cat |
| ol_bias | OL 편향 보정 (기종 전용) | mc | MC | scm_ol × (1 − 과거 FY bias) |
| baseline6 | 6M 평균 (기준선, 항상 on) | simple | all | — |
`enabled` 관리자 토글, `params` jsonb 편집, 변경 audit.

## 5. 백테스트·챔피언 (engine/backtest.py, R-FC-40~41)
- 라운드: eval_fy 에 대해 학습 = 데이터 시작 ~ eval_fy−1 FY 말(3월), 예측 = eval_fy 12개월(4월~3월, 실적 있는 달까지). 초기 실행: eval_fy=2025 (학습 2023-04~2025-03), 추가로 eval_fy=2026(부분, 2026-04~07).
- 품목별: 정책 셀의 enabled 기법 각각 fit → 12개월 예측 → WAPE·Bias·MAPE. 챔피언 = WAPE 최소, 단 baseline6 보다 나쁘면 baseline6 (R-FC-31). 동률은 단순 기법 우선.
- 기종(MC): model_base 단위 ACT 시계열로 동일 절차 + `ol_bias`. 결과에 sales_ol/scm_ol 도 함께 저장해 3종 비교(R-FC-10~11).
- 집계: `forecast_accuracy` 에 level = item / category / abcxyz / pattern / model / biz / total, method 별 Bias·WAPE·MAPE·n.
- 프로덕션 런: 학습 = 전체 이력, horizon = `projection_future_months`(6) — 챔피언 기법(최신 백테스트)으로 예측 + 80% 구간(잔차 분위).

## 6. AI 정교화 (engine/ai_tuning.py, R-FC-42)
- 입력: 백테스트 런 요약(레벨별 정확도 표, 최악 50 품목·기종의 패턴, 기법별 승률, 계절성 실패 사례) → gpt-5-nano (OpenAI Responses API, JSON schema 강제).
- 출력 스키마: `{diagnosis:[{area, finding, evidence}], proposals:[{method_key, param_patch, scope(cell|category|all), rationale, expected_effect}], data_issues:[...]}` → `app.forecast_tuning_proposal(run_id, model, prompt, response, status pending)`.
- 승인: `app.approval kind=forecast_tuning` → `fn_decide_approval` 분기 추가: 승인 시 `param_patch` 를 `forecast_method.params` 에 병합(scope 는 policy 로), audit. 다음 런에 반영.

## 7. DB (migration 20260913001000_forecast.sql)
- `app.forecast_method`, `app.forecast_policy`, `app.forecast_run(id, run_type backtest|production, eval_fy, train_from, train_to, horizon, status requested|running|done|failed, params_snapshot, summary, started_at, finished_at, created_by, error)`, `app.forecast_result(run_id, key_code, level item|model, category, ym, method, value, lower, upper, is_champion)`, `app.forecast_accuracy(run_id, level, key, method, bias, wape, mape, n, extra)`, `app.item_class(key_code, category, pattern, abc, xyz, cv, adi, cv2, value_12m, share, run_id, computed_at)`, `app.forecast_tuning_proposal`.
- 뷰: `analytics.v_forecast_latest`(최신 done production 런 챔피언 예측 + 밴드), `analytics.v_item_forecast_series`(품목: 실적 + 최신 예측), `analytics.v_mc_compare`(기종×월: sales_ol, scm_ol, system(챔피언), act, fy), `analytics.v_accuracy_summary`(최신 백테스트 런 레벨별), `analytics.v_abc_xyz_matrix`.
- RPC: `fn_request_forecast_run(run_type, eval_fy, horizon)` → requested 행 (엔진이 `engine forecast pending` 으로 처리), `fn_dashboard_summary` 에 예측 카드 추가.
- 인덱스: forecast_result(run_id, key_code, ym), (run_id, is_champion).

## 8. 엔진 구조
```
engine/scm_engine/forecast/
  __init__.py  methods/{simple,ets,intermittent,stat,ml,mc}.py  registry.py  classify.py
  backtest.py  runner.py  metrics.py  ai_tuning.py  store.py(bulk write)
CLI: engine forecast classify | backtest --eval-fy 2025 | run --horizon 6 | pending | tune --run-id X
```
- 의존성: numpy, pandas, statsmodels(ETS/HW), statsforecast(AutoARIMA·Croston·SBA), prophet, lightgbm, openai, joblib(병렬).
- 성능 목표: 백테스트 1라운드 전체(≈9.7k 품목) 15분 이내 (arima/prophet 은 A/B 만, joblib 8 workers).
- 메트릭 정의(metrics.py): WAPE = Σ|f−a|/Σa, Bias = Σ(f−a)/Σa, MAPE = mean(|f−a|/a, a>0). a 합이 0이면 null.

## 9. 웹
- `/forecast` 예측 대시보드: 카드(최신 프로덕션 런, 백테스트 WAPE 기준예측 vs Sales OL vs SCM OL, ABC-XYZ 분포, 챔피언 기법 분포, 대기 중 AI 제안) 전부 드릴다운. ABC-XYZ 9셀 매트릭스(클릭→품목 목록 필터). 정확도 비교 ECharts(라인+막대).
- `/forecast/mc` 기종 비교: 기종 선택 → Sales OL/SCM OL/기준예측/ACT 4시리즈 차트(FY 구분선), FY별 Bias/WAPE 표 (R-FC-10).
- `/forecast/runs`, `/forecast/runs/[id]`: 런 목록·상세(레벨별 정확도, 기법별 승률, 최악 품목), "AI 분석 요청" 버튼(엔진이 tune 실행), 제안 목록 → 승인 요청.
- `/admin/forecast-methods`: 기법 on/off·params 편집, 정책 매트릭스 편집 (D-018).
- `/items/[code]`: 예측 시리즈(밴드)·챔피언·패턴·ABC-XYZ 카드, 재고전개 그리드에 "기준예측" 행.
- `/items` 목록에 pattern/abc/xyz/champion 컬럼·필터.

## 10. 테스트
- engine: metrics 단위, 각 기법 합성 시계열(정상·계절·간헐)에서 형태·비음수, classify 경계값, backtest 소규모(품목 20개) end-to-end(sqlite→DataFrame), ai_tuning 은 OpenAI 호출 mock.
- web: vitest(정확도 표 빌더, 매트릭스 빌더), Playwright(/forecast 카드 드릴다운, /forecast/mc 차트, 기법 토글).
- 실데이터 검증: eval_fy=2025 백테스트 실행 → 기준예측 총 WAPE 가 SCM OL(56.9%) 보다 낮은지 기록(목표 <50%, 미달 시 원인 기록).

## 11. 완료 기준
1. `engine forecast backtest --eval-fy 2025` 완료(15분 내), forecast_accuracy 에 총·카테고리·기종 레벨 존재, 리포트 `docs/reports/sp2-backtest-fy25.md`
2. `engine forecast run` 으로 2026-08~2027-01 예측 생성, `/items/[code]` 에 예측·밴드 표시
3. `/forecast/mc` 에서 기종별 4시리즈 + FY 정확도 표
4. 관리자 기법 토글 후 재실행 시 해당 기법 제외 확인
5. `engine forecast tune` 이 gpt-5-nano 제안을 저장하고 승인 시 params 반영
6. 테스트 전부 통과, docs 갱신
