# SP2 백테스트 리포트 — 평가 FY25 (라운드 1)

실행: 2026-09-13 · run_id `8b962cc2-8d37-49c9-8570-4c2040f568cf` · 학습 2023-04 ~ 2025-03 → 예측 2025-04 ~ 2026-03 (12개월) · 품목 9,672 (SW 제외) · 기종 30 · 157초
규칙: R-FC-30/31/40/41 (D-016). 회계연도 4월 시작 (R-FC-08).

## 요약

| 레벨 | 시스템 기준예측(챔피언) WAPE | Bias | 비교 |
|---|---|---|---|
| 기종 (MC) | **31.4%** | −2.3% | Sales OL 46.4% (Bias +5.4%) · **SCM OL 48.2% (Bias +36.4%)** |
| 품목 (HOC) | **31.8%** | −0.7% | 기준선 6M 평균 37.8% (Bias +17.0%) |

- 기종 레벨에서 시스템 기준예측이 SCM OL 보다 **16.8%p** 정확 (목표 < 50% 달성). SCM OL 은 일관된 +36% 과대(06-data-profile 과 일치).
- 챔피언 분포(품목): baseline6 69.7% · SBA 11.2% · MA3 8.7% · MA12 2.9% · 전년동월 2.1% · LightGBM 1.8% · Croston 0.9% · HW 0.8% · SES 0.6% · ARIMA 0.6% · Holt 0.5% · Prophet 0.3%
  → 품목 대다수가 소량·간헐 수요라 단순 평균이 최선. 정교 기법은 A 등급 안정 품목에서만 이김.
- 기종 챔피언: ol_bias(SCM OL 편향 보정)가 다수 — OL 정보 자체는 유용하나 편향 보정이 필수 (D-002 근거).

## 레벨별 정확도 (챔피언 및 기법별)
```
level|key|method|wape|bias|n
abcxyz|AX|champion|0.195|0.027|2076
abcxyz|AY|champion|0.469|0.049|1668
abcxyz|AZ|champion|0.401|-0.062|444
abcxyz|BX|champion|0.238|0.037|1116
abcxyz|BY|champion|0.471|0.003|5100
abcxyz|BZ|champion|0.622|-0.177|5280
abcxyz|CX|champion|0.301|0.059|816
abcxyz|CY|champion|0.493|-0.041|3204
abcxyz|CZ|champion|0.848|-0.368|96360
biz|DT|champion|0.310|-0.021|224
biz|GC|champion|0.491|0.020|91
biz|PRT|champion|0.976|-0.976|12
category|OPTION|champion|0.640|0.034|36888
category|PART|champion|0.447|-0.101|71568
category|SUPPLY|champion|0.240|0.007|7608
pattern|dead|champion|1.000|-1.000|34764
pattern|erratic|champion|0.644|0.000|3420
pattern|intermittent|champion|0.736|-0.335|63420
pattern|lumpy|champion|0.488|-0.101|4476
pattern|smooth|champion|0.249|0.030|9984
total|item|champion|0.318|-0.007|116064
total|item|lgbm|0.405|-0.008|15684
total|item|ma12|0.428|0.083|19704
total|item|ses|0.441|0.196|12084
total|item|arima|0.446|0.226|8760
total|item|baseline6|0.453|0.153|116064
total|item|ma3|0.461|0.152|102552
total|item|holt|0.488|0.321|9984
total|item|snaive|0.489|0.147|19704
total|item|hw|0.543|0.393|8760
total|item|prophet|0.645|0.554|3732
total|item|sba|2.387|0.448|87948
total|item|croston|2.460|0.524|87948
total|model|champion|0.314|-0.023|327
total|model|ol_bias|0.323|0.011|327
total|model|holt|0.615|0.261|96
total|model|ma3|0.619|0.300|327
total|model|baseline6|0.655|0.410|327
total|model|ma12|0.905|0.593|291
total|model|snaive|0.914|0.359|237
total|model|prophet|0.930|0.457|156
total|model|arima|0.943|0.648|213
total|model|ses|0.990|0.711|225
total|model|hw|1.236|0.574|213
```

## 주의 — 챔피언 선택의 낙관 편향
라운드 1 은 평가 FY25 구간에서 기법을 고르고 같은 구간으로 평가했으므로(in-sample selection) 품목 레벨 31.8% 는 **상한(낙관)** 추정입니다. 이력이 2023-04 부터라 FY24 로 선택·FY25 로 평가하는 완전 롤링은 학습 12개월뿐이라 불가. 프로덕션 예측은 "최신 백테스트 챔피언"을 미래에 적용하므로 정직(out-of-sample)합니다. FY26 실적이 쌓이면 FY25 챔피언 → FY26 평가로 정직한 수치를 얻습니다 (R-FC-40 롤링).

## AI 정교화 (라운드 1 → 2)
gpt-5-nano 진단 요지: SCM OL 과대편향, Prophet 비효율(A 등급 품목에서도 열세), 간헐수요 α 상향, LightGBM 트리 수 증가, MA3 창 확대.
승인 적용: Prophet off · Croston/SBA α 0.1→0.2 · LightGBM n_estimators 300→600, lr 0.05→0.04 · MA3 window 3→5. (존재하지 않는 키 `scm_ol` 제안은 무시)
라운드 2 결과는 아래 "라운드 2" 절 참조.
