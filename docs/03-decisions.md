# 결정 로그

append-only. 뒤집을 때는 새 번호로 쓰고 `supersedes D-nnn` 표기. 형식:

```
## D-nnn (YYYY-MM-DD) 한 줄 제목
- 배경:
- 결정:
- 출처: (사용자 답변 / 회의 / 데이터 검증)
- 영향: 관련 규칙 ID, 파일
```

---

## D-001 (2026-09-13) "조달 대상 해외법인 5곳" = 공급처(Supplier) 5곳
- 배경: stage1.md 의 표현이 판매법인인지 공급처인지 불명확했음
- 결정: 공급처 5곳. 출항일·출항 준비기간·리드타임은 이 5개 Supplier 단위로 관리
- 출처: 사용자 답변
- 영향: R-SCH-02, 01-business-process.md §1

## D-002 (2026-09-13) Sales OL · SCM OL · 시스템 기준예측 3종 병행 표시
- 배경: 시스템 기준예측이 정확하면 장기적으로 OL 을 대체할 목표
- 결정: 당분간 3종 + ACT 를 항상 나란히 표시하고 정확도를 누적 비교. 대체 시점은 사용자 판단
- 출처: 사용자 답변
- 영향: R-FC-10 ~ R-FC-12

## D-003 (2026-09-13) Supplier OL 제출 선행 개월 = 1개월, 관리자 설정값
- 배경: Flex rule 의 기준월 계산에 필요. 문서에 미명시
- 결정: 기본값 1개월. 하드코딩 금지, 관리자 모드에서 수정 가능
- 출처: 사용자 답변
- 영향: R-OQ-11, R-FC-20

## D-004 (2026-09-13) 장착률은 파일 업로드로 DB 반영
- 배경: 장착률 이력 데이터 미수령. 회사 측이 정리해 추후 제공 예정
- 결정: 업로드 → DB 마스터 반영 경로를 만든다. 수령 전에는 역산 임시치 사용
- 출처: 사용자 답변
- 영향: R-BOM-05, Q-001

## D-005 (2026-09 회의) MIF(설치 기반 대수)는 이번 범위 제외
- 배경: 매달 바뀌고 복잡도가 높음
- 결정: 예측 입력에 MIF 를 쓰지 않는다. 향후 확장 후보
- 출처: 회의록 (참석자 3)
- 영향: R-FC 미정 항목

## D-006 (2026-09-13) 문서 구조 채택
- 결정: `docs/` 아래 glossary / process / domain-rules(주제별, 규칙 ID) / decisions / open-questions / data-catalog / meetings. CLAUDE.md 는 인덱스만. 원본 3개 문서는 수정 금지
- 출처: 사용자 승인
- 영향: CLAUDE.md

## D-007 (2026-09-13) 마스터·설정 데이터는 파일 업로드 + 관리자 화면 입력 이중 경로, 실데이터 전까지 더미값
- 배경: 현재고·입고예정(Q-005), MOQ(Q-003), 품목 단가(Q-004), 공급처 마스터(Q-002)가 현재 파일에 없음
- 결정: 위 데이터 전부 (1) 파일 업로드로 일괄 반영, (2) 관리자 화면에서 개별 입력·수정 — 두 경로 모두 지원. 실데이터 수령 전까지는 **임의(더미) 값을 시드**해서 산출 로직이 동작하게 한다. 더미값은 `is_dummy`/출처 컬럼으로 표시해 실데이터와 구분
- 출처: 사용자 답변
- 영향: R-OQ-33, R-INV-08, R-SCH-06, 05-data-catalog §1 "아직 없는 데이터". Q-002~005 종결

## D-008 (2026-09-13) 예측 기법 후보 — 수요 패턴별 배정
- 배경: 데이터 검증(06-data-profile §1) 결과 SUPPLY·PART A급은 smooth, PART 다수·OPTION 은 intermittent
- 결정: 품목별로 아래 후보를 백테스트해 최적 기법을 자동 선택(챔피언), 선택 근거를 저장한다
  - smooth/erratic: 이동평균(3/6/12M), 단순지수평활(SES), Holt, Holt-Winters(가법, 12개월 계절 — 24개월 이상 데이터일 때만), 전년동월×추세
  - intermittent/lumpy: Croston, SBA(Syntetos-Boylan 보정), 6개월 평균
  - 기계(MC): 위 + Sales OL·SCM OL 을 입력으로 쓰는 보정(OL × 과거 bias 역보정)
  - 옵션: 독립 시계열이 아니라 `기종 예측 × 장착률` 을 기본, 트렌드 기법은 보조
- 평가: 최근 6개월 홀드아웃 WAPE + Bias. 기준선 = 6개월 단순평균
- 출처: 데이터 검증
- 영향: R-FC-06, 향후 forecast 모듈

## D-009 (2026-09-13) OPTION 정제 — SW 라이선스 제외, family 로 기종 연결
- 배경: OPTION 출고의 40% 가 `LICENSE` family(SW 옵션). 업무절차상 SW 옵션은 예측 대상 아님. 또 bridge_option_model 매핑은 물량 6.8% 뿐이나 dim_item.family('MDL156 4 LOW')로 기종 파싱 가능
- 결정: (1) family LIKE 'LICENSE%' 또는 description LIKE '%1DAY CODE%' 는 예측·발주 대상에서 제외하고 별도 카테고리 `SW` 로 표시. (2) 옵션↔기종 연결은 bridge_option_model 우선, 없으면 family 앞 토큰(MDLnnn) 파싱. 파싱 결과는 `source='parsed'` 표시
- 출처: 데이터 검증
- 영향: R-BOM-11 (신설), core 뷰

## D-010 (2026-09-13) XCN 구코드가 여러 HOC 에 연결된 454건 처리
- 결정: 해당 구코드의 출고는 **출고 이력이 가장 많은(최근 24개월 합) HOC** 하나에만 합산. 동률이면 코드 문자열 정렬 최댓값. 결정 목록을 리포트로 남겨 회사 확인 요청
- 출처: 데이터 검증
- 영향: R-XCN-08 (신설), core.v_part_linkage 수정 필요

## D-011 (2026-09-13) 아키텍처 A안 + 5개 서브프로젝트 분해 채택
- 결정: Next.js(App Router) + Supabase(DB/Auth/스케줄) + Python 배치 예측 엔진(`engine/`). 발주량 산출(DoS/Flex/MOQ)은 SQL 뷰 + TS 로 즉시 재계산. 예측만 Python 이 버전 저장
- 서브프로젝트: SP1 기반 → SP2 예측 엔진 → SP3 발주량 산출 → SP4 주문·배정 → SP5 일정·알림 (SP4 는 SP2/3 과 병렬 가능)
- 환경: Supabase 프로젝트 있음(비어 있음). 로컬은 scm.db(SQLite). 이 폴더에서 신규 시작
- 출처: 사용자 승인

## D-012 (2026-09-13) UX 공통 요구 — 드릴다운 · 즉시 전환 · 인터랙티브 차트 · WBS형 재고전개
- 결정:
  1. 대시보드 요약 카드는 전부 클릭 가능 → 해당 숫자를 구성하는 행 목록으로 이동(필터 유지). 숫자만 있는 카드 금지
  2. 메뉴 전환 체감 1초 이내. 클라이언트 라우팅 + 데이터 프리페치/캐시, 무거운 집계는 물리화 뷰(엔진 실행 후 갱신)
  3. 차트는 인터랙티브(툴팁, 범례 토글, 기간 줌, 예측 구간 음영·신뢰구간, 다중 패널, 라인+막대 혼합, 도넛). 라이브러리는 Apache ECharts
  4. 품목별 재고전개는 WBS/트리 그리드: 행 = 실제출고·예측·OL·현재고·입고예정·예상 월말재고·DoS·발주계획, 열 = 월. 트리(카테고리→기종→품목) 접기/펼치기, 셀 편집(오버라이드) 가능
- 출처: 사용자 요구 (참고 스크린샷: Streamline, Deepflow 등)
- 영향: R-UI-01~04 신설 (02-domain-rules/ui.md)

## D-013 (2026-09-13) SP1 설계 승인 · 구현 중 설계 판단 위임 · GitHub 연결
- 결정: SP1 spec(docs/specs/2026-09-13-sp1-foundation-design.md) 승인. 구현 중 SCM 수요예측 관점에서 수정이 필요하면 Claude 가 판단해 수정하되, 변경은 반드시 docs(규칙/결정/spec)에 반영한다
- 환경: git 초기화, origin = https://github.com/maclovedany/SCMpro.git. Supabase 접속 확인(PG 17.6, 빈 DB). 비밀값은 `web/.env.local`, `engine/.env` (git 제외)
- 출처: 사용자 승인

## D-014 (2026-09-13) 품목 마스터는 "출고 통계 물리화 + 설정/재고 실시간 뷰" 로 분리
- 배경: SP1 spec 은 v_item_master 전체를 물리화 뷰로 잡았으나, 승인·업로드 결과가 refresh 전까지 화면에 반영되지 않는 결함 발견 (E2E)
- 결정: `analytics.mv_item_stats`(출고 통계만 물리화) + `analytics.v_item_master`(일반 뷰, 설정·재고·입고 조인). 목록 200행 조회 약 230ms 로 R-UI-02 충족. refresh 는 출고 데이터 변경(업로드 shipment_extra, 엔진 실행) 시에만
- 출처: 구현 중 검증
- 영향: spec §3.3, 05-data-catalog

## D-015 (2026-09-13) 회계연도 = 4월 1일 시작 — 모든 연 단위 시계열 집계는 FY 기준
- 배경: 사용자 지시. MC_OL_vs_ACT 파일도 FY23/FY24/FY25 시트로 이미 FY 구조
- 결정: `app.system_settings.fiscal_year_start_month = 4`. 1년 = 4/1 ~ 익년 3/31 (FY25 = 2025-04~2026-03). 연간 집계·전년동월·FY별 정확도·화면 연도 필터 전부 FY 기준. 헬퍼: web `fyOf(ym)`, `fyLabel(ym)`, `fyRange(fy)`; engine `fiscal.py`
- 출처: 사용자 지시
- 영향: R-FC-08 (신설), SP2 예측 엔진(계절성 주기·백테스트 구간), 대시보드 연도 필터

## D-016 (2026-09-13) 백테스트 프로토콜 — FY 롤링 학습·평가 + AI 오차 분석으로 정교화
- 배경: 사용자 지시. 현재 데이터는 FY23~FY25(+FY26 일부)
- 결정: 초기 검증은 **FY23+FY24 학습 → FY25 예측 vs FY25 실적** 비교. 매년 FY 가 추가되면 학습 구간을 확장해 다음 FY 를 예측·평가(롤링). 각 라운드의 오차 패턴(기종/품목군/월별 Bias·WAPE, 계절성 실패, EOL 전환 오차 등)을 **AI(gpt-5-nano)가 분석**해 기법·파라미터·전처리 조정을 제안하고, 제안은 승인 후 다음 라운드에 적용. 분석 결과·적용 이력 저장
- 출처: 사용자 지시
- 영향: R-FC-40~42 (신설), SP2 spec

## D-017 (2026-09-13) AI Agent — OpenAI gpt-5-nano, 전 화면 상단 버튼, 사용자별 대화 저장·맥락 유지, 관리자 질문 통계
- 결정: (1) LLM 은 OpenAI Chat API, 모델 `gpt-5-nano` (설정값 `ai_model`). (2) 모든 화면 최상단 "AI Agent" 버튼 → 화면 우측 사이드 패널로 열리는 ChatGPT 형 채팅. 패널 너비는 마우스 드래그로 조절, 사용자별 기억. (3) 사용자별 대화(conversation)·메시지 저장, 이전 맥락을 요청에 포함(최근 N 턴 + 요약). (4) 관리자: 질문 로그 조회, 주제 분류·빈도 통계. (5) 에이전트는 시스템 데이터(예측·재고·발주 근거)를 도구로 조회해 답변
- 출처: 사용자 지시
- 영향: R-AI-01~06 (신설, 02-domain-rules/ai-agent.md), 서브프로젝트 SP6 추가, 환경변수 OPENAI_API_KEY

## D-018 (2026-09-13) 예측 기법 on/off 관리자 설정
- 결정: 기법 레지스트리 `app.forecast_method`(key, 이름, 적용 패턴, enabled, params jsonb). 관리자 화면에서 on/off·파라미터 편집. 챔피언 선택(R-FC-30)은 enabled 기법 중에서만. 변경 이력 audit
- 출처: 사용자 지시
- 영향: R-FC-34 (신설), SP2 spec

## D-019 (2026-09-13) 예측 기법 후보 확장 + ABC-XYZ 교차분석
- 결정: D-008 후보에 **ARIMA(auto), Prophet, LightGBM(전역 회귀: lag·계절·카테고리 피처)** 추가. 품목을 **ABC(출고 금액/수량 기여도) × XYZ(변동계수)** 9개 셀로 분류해 셀별 기본 기법·백테스트 정책·목표 DoS 권고를 다르게 적용 (예: AX = 정교 기법 전부, CZ = 6M 평균·Croston 만). ABC-XYZ 분류 결과는 화면 카드·매트릭스(드릴다운)로 표시
- 출처: 사용자 지시
- 영향: R-FC-30 후보 목록, R-FC-35 (ABC-XYZ, 신설), SP2 spec, engine 의존성(statsmodels·pmdarima 대체로 statsforecast, prophet, lightgbm)

## D-020 (2026-09-13) SP2 구현 결과 반영 — 챔피언 선택 낙관 편향 명시, EOL 미반영 한계, MC 변형 합산
- 결정: (1) 백테스트 라운드의 챔피언 선택은 평가 구간 in-sample 이므로 품목 WAPE 는 상한 추정으로 표기(R-FC-41 주석). 프로덕션은 최신 백테스트 챔피언 사용(out-of-sample). FY 가 쌓이면 롤링 선택으로 전환. (2) EOL 진행 기종(예: MDL156 FY26 실적 0)은 EOL 마스터(Q-008) 수령 전까지 예측이 수렴하지 않음 — R-FC-07 은 SP2 후속. (3) `fact_mc_plan_actual` 의 기종 변형(model_key) 은 기종·월 합산. (4) 무거운 기법(ARIMA/Prophet)은 A/B 등급 한정으로 전체 백테스트 157초
- 출처: 구현 검증 (docs/reports/sp2-backtest-fy25.md)
- 영향: R-FC-41, 06-data-profile §2 보완, Q-008 우선순위 상향

## D-021 (2026-09-13) AI 조정안 가드레일 — 챔피언 기법 off 금지, 라운드 간 회귀 감지
- 배경: 라운드 1 AI 제안에 `ol_bias` off 가 포함돼 승인·적용되자 기종 WAPE 31.4% → 48.9% 로 악화 (ol_bias 가 기종 챔피언이었음)
- 결정: (1) `fn_apply_tuning` 은 최신 백테스트에서 챔피언인 기법의 off 제안을 무시. (2) 프롬프트에 동일 규칙 명시. (3) 백테스트 summary 에 직전 라운드 대비 WAPE delta 와 `regressed` 플래그 기록 → 화면·리포트에 표시. (4) 회귀 시 담당자가 params 를 되돌린다(관리자 화면)
- 출처: 구현 검증
- 영향: R-FC-42, engine/ai_tuning.py, migrations/001000

## D-022 (2026-09-13) SP3 구현 결과 — 계산은 TS 단일 구현, 대량 저장은 service role + 청크
- 결정: (1) 발주량 산출 로직은 `web/lib/order/calc.ts` 하나(서버 액션·what-if 공용, 단위 테스트 7). SQL 에 중복 구현하지 않음. (2) Supabase `authenticated` 역할 statement_timeout 8s → 9,672 라인 저장은 서버 액션이 service role 로 `fn_save_order_plan(p_user)` + `fn_append_plan_lines` 1,000행 청크 + `fn_finalize_order_plan`. 역할 검사는 함수 안에서 p_user 로. (3) service_role 스키마 권한을 grants 에 추가. (4) 라인 표는 서버 필터·500행 페이지, 트리 상위 합계는 `fn_plan_cat_projection` SQL 집계
- 검증: 2026-09 계획 9,672 라인 생성 ~15초, 품절위험 3,979(더미 재고 기준), 승인 → 제출 OL 4,294건, 재생성 시 Flex 클램프 2,306 라인
- 출처: 구현 검증
- 영향: R-OQ 규칙에 구현 위치 주석, spec SP3 §3

## D-023 (2026-09-13) SP4 구현 결과 — 배정 상태머신은 전부 SQL RPC, 주기 처리는 fn_allocation_tick
- 결정: 주문·배정 트랜잭션은 `pg_advisory_xact_lock(hashtext(item))` 로 품목 단위 직렬화 (R-AL-05). 만료·예고·10분 반복 알림은 `app.fn_allocation_tick()` 하나로, 화면 버튼 + SP5 pg_cron 10분 주기. 알림 중복은 notification(kind, payload.order_id, days_before/approval_id) 로 방지
- 검증: E2E 전체 흐름 + SQL 로 만료(자동 해제 알림)·3일 전 예고 확인. 자동배정은 입고 RPC 직접 호출로 확인(auto_allocated_orders=1)
- 출처: 구현 검증
- 영향: R-AL 규칙에 구현 위치, spec SP4
