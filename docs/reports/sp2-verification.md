# SP2 예측 엔진 — 검증 리포트

검증일: 2026-09-13 · 브랜치: sp2-forecast · spec: docs/specs/2026-09-13-sp2-forecast-design.md §11 · 백테스트 상세: sp2-backtest-fy25.md

## 완료 기준 대조

| # | 기준 | 결과 | 증거 |
|---|---|---|---|
| 1 | `engine forecast backtest --eval-fy 2025` 15분 내 완료, 레벨별 정확도 저장, 리포트 | ✅ | 157초(라운드 1) / 129초(라운드 2). forecast_accuracy 에 total·category·biz·abcxyz·pattern·item·model. docs/reports/sp2-backtest-fy25.md |
| 2 | `engine forecast run` 6개월 예측 생성, 품목 상세에 예측·밴드 표시 | ✅ | 프로덕션 런 3811d570-f511-4398-818a-8fe822322fcf · 2026-07 → ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"]. 챔피언 예측 58,032행. `tests/e2e/forecast.spec.ts` 품목 556K59129 예측(Holt)·80% 밴드·분류 카드 |
| 3 | `/forecast/mc` 기종별 4시리즈 + FY 정확도 표 | ✅ | e2e: MDL213 차트(실적·Sales OL·SCM OL·기준예측), FY23~FY26 표 |
| 4 | 관리자 기법 토글 후 재실행 시 제외 | ✅ | hw off → 소규모 백테스트에서 hw 결과 0행 (SQL 확인). e2e 토글 on/off 왕복 + audit_log |
| 5 | `engine forecast tune` 이 gpt-5-nano 제안 저장, 승인 시 params 반영 | ✅ | 제안 2건(라운드 1·2). 라운드 1 제안 승인 → croston/sba α 0.2, lgbm 600/0.04, prophet off 반영 확인. 반려 경로 e2e |
| 6 | 테스트 전부 통과, docs 갱신 | ✅ | engine pytest 31 · web vitest 23 · Playwright 9 · lint 0 errors · tsc 0 |

## 핵심 수치 (FY25 백테스트, 라운드 2 = 현재 설정)
- 기종 시스템 기준예측 WAPE **31.9%** (Bias +1.9%) vs Sales OL 46.4% / **SCM OL 48.2% (Bias +36.4%)** → 목표(<50%) 달성, SCM OL 대비 16%p 개선
- 품목 WAPE **32.3%** (Bias +0.2%) vs 기준선 6M 평균 37.8% — 단, 챔피언 in-sample 선택으로 상한 추정 (D-020)

## 구현 중 spec 에서 달라진 점 (docs 반영)
- D-020: 챔피언 선택 낙관 편향 명시, EOL 미반영 한계, 기종 변형(model_key) 합산
- D-021: AI 조정 가드레일 — 챔피언 기법 off 거부(fn_apply_tuning), 프롬프트 규칙, 라운드 간 회귀 감지(summary.vs_prev/regressed). 계기: ol_bias off 승인으로 기종 WAPE 48.9% 급등 사고
- `item_class` 테이블을 000400 migration 으로 이동(v_item_master 조인), grants 를 999900 으로 이동(항상 마지막)
- 프로덕션 기종 예측은 미래 OL 이 없으면 ol_bias 제외하고 백테스트 챔피언 사용
- migrate.sh 실행 중 엔진 런이 돌면 물리화 뷰 drop 으로 실패 — 운영 규칙: 런 중 migrate 금지 (CLAUDE.md 에 명시)

## 알려진 한계 / 다음
- EOL 진행 기종(MDL156 등)은 EOL 마스터(Q-008) 전까지 6M 평균으로 예측 → R-FC-07 후속
- 옵션은 독립 시계열 예측(장착률 미수령, Q-001)
- AI 1차 조정은 개선 효과 없음(±0.5%p). 데이터 누적(FY26) 후 정직한 롤링 평가에서 재판단
- 웹 "런 요청"은 `engine forecast pending` 을 수동/크론 실행해야 처리됨 (SP5 스케줄러 후보)
