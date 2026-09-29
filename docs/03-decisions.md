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

## D-024 (2026-09-13) SP5 구현 결과 — pg_cron 10분 tick, 출항 규칙 jsonb, 이메일은 큐잉 후 engine 발송
- 결정: (1) 공급처 출항 규칙 `sailing_rule={"weekday":1~7,"weeks":[1..5]}` (관리자 화면 편집), 발주일 = 출항일 − prep_days, 입고예정 = 출항일 + ship_lead_days, 둘 다 `fn_business_day` 로 이전 영업일 보정. (2) 수요자료 제출 `demand_submission`, 마감 = 대상월 −1개월 말일 −1, 미제출 부서 10분 반복 알림. (3) `app.fn_tick()` 을 pg_cron `scm-tick` */10 분 등록(확장 사용 가능 확인). 대안 `engine tick`. (4) 이메일: system 알림 insert 트리거로 email 행 복제 → `engine notify` 가 SMTP 설정 시 발송, 없으면 `skipped:no_smtp` (Q-019 유지). (5) 입고 차이는 `analytics.v_inbound_gap(_summary)` 차이값 하나로
- 검증: 영업일 보정(개천절·추석 연휴), 캘린더 3개월, 제출/알림 E2E, pg_cron 잡 등록, engine tick 실행
- 출처: 구현 검증

## D-025 (2026-09-13) SP6 구현 결과 — AI Agent 는 function calling + 사용자 세션 RLS, 비스트리밍 JSON
- 결정: (1) `/api/ai/chat` 가 OpenAI Chat Completions(`ai_model`=gpt-5-nano) 를 도구 9종(품목·예측·가용재고·발주계획·정확도·승인함·일정·영업주문·검색)과 함께 최대 5라운드 호출. 도구는 사용자 세션 supabase 클라이언트로 실행 → RLS 그대로 (R-AI-05). (2) 응답은 비스트리밍 JSON(안정성 우선; 스트리밍은 후속). (3) 대화 저장 ai_conversation/ai_message(user·assistant·tool 행), 최근 20턴 + 30개 초과 시 LLM 요약(summary). (4) 주제 분류는 별도 짧은 호출(7개 주제). (5) 패널 상태(열림·너비·현재 대화)는 localStorage. (6) 마크다운 렌더(react-markdown+gfm)
- 검증: E2E — 리사이즈(+150px 유지), 질문→`get_item` 도구→근거 수치 답변(현재고·DoS·Holt), 후속 질문 맥락, 관리자 통계 카드·목록
- 출처: 구현 검증

## D-026 (2026-09-13) Bulkdeal 주문번호는 선택, 수주확정과의 이중 계상은 경고로 처리
- 배경: 사용자 질문 "Bulkdeal 은 주문번호가 없는가". stage1 §5 는 수주확정만 주문번호 필수, Bulkdeal 은 고객·기종·수량·사유만 요구
- 결정: Bulkdeal 주문번호 선택 입력. 수주확정 등록 시 같은 품목·필요월의 승인 Bulkdeal 존재 시 경고(등록은 허용). 회사 규칙이 다르면 필수로 전환(한 줄)
- 출처: 사용자 질문 + 문서 해석
- 영향: R-OQ-26, /extra-demand 폼·목록, fn_add_extra_demand 반환값

## D-027 (2026-09-13) 파라미터 SQL 함수는 plan_cache_mode=force_custom_plan
- 배경: `/orders` 계획 생성에서 "canceling statement due to statement timeout"(PostgREST 8s). `fn_order_inputs` 가 순수 SQL 176ms 인데 함수 호출은 5.3초 — 파라미터(p_category) 로 인한 generic plan
- 결정: 큰 집계를 하는 파라미터 함수(fn_order_inputs, fn_plan_cat_projection, fn_ai_stats)에 `set plan_cache_mode = force_custom_plan`. 결과 0.7초. 입력 조회는 카테고리별 3회, 라인 저장 청크 500 으로 8초 여유 확보
- 규칙: 앞으로 파라미터가 있는 집계 RPC 를 만들면 같은 설정을 붙이고 `\timing` 으로 8초 내 확인

## D-028 (2026-09-13) 최종 검증 이후 UX·운영 개선 묶음
- 배경: 사용자 검수 피드백 (2026-09-13 저녁)
- 결정·적용:
  1. **시스템 설정 비개발자 UI** — JSON 노출 제거, 키별 컨트롤·단위·범위·현재값 문장 (`web/lib/settings/registry.ts`, R-UI-10)
  2. **사이드바 6그룹**(현황·계획·운영·결재·데이터·관리) + 역할별 항목 필터 + 승인/미읽음 배지 + 접기 기억 (`lib/auth/roles.ts` MENU_GROUPS, R-UI-11). 배지는 `fn_sidebar_badges` 1회 왕복
  3. **품목 상세 "예측 검증" 섹션** — 최신 백테스트(FY25)의 이 품목 예측 vs 실적: 챔피언·WAPE·Bias·12개월 합계, 기법 선택·비교, 월별 차이 표 (`BacktestSection.tsx`, R-FC-41)
  4. **카드 동일 높이·표 여백·한글 keep-all** 전역 (R-UI-07~09), 추가수요 표 열 분리
  5. **실사용 계정 6개**로 교체(초기 비밀번호 1q2w3e), 이 Mac 에 launchd `com.scmpro.tick` 10분 주기 등록(이메일 발송은 SMTP 설정 대기, Q-019)
  6. 성능: `v_order_plan_summary` 를 summary jsonb 기반으로(라인 재집계 제거), `/orders` 전환 803→187ms(dev)
- 출처: 사용자 피드백
- 영향: 08-user-guide, 07-architecture §2/§6, 05-data-catalog RPC 목록

## D-029 (2026-09-13) 이메일 채널 확정 — 네이버 SMTP(insightdany), launchd 10분 발송
- 결정: `engine/.env` SMTP_HOST=smtp.naver.com:587(STARTTLS), 발신 insightdany@naver.com(애플리케이션 비밀번호). 발송 주체는 이 Mac 의 launchd `com.scmpro.tick`(10분). 운영 이관 시 동일 env 를 서버 크론으로 옮기면 됨
- 검증: 테스트 알림 발송 `{'sent': 1}` → 수신 확인 (사용자). Q-019 종결
- 출처: 사용자 확인

## D-030 (2026-09-13) 과거 연도 출고 실적 추가 — 회사 파일(넓은 형식) 그대로 업로드, 학습 구간 자동 확장
- 배경: 사용자 질문 "22년·21년 데이터를 올리면 학습하나". 엔진은 v_item_monthly 전 기간을 학습하므로 데이터만 들어오면 됨. 단 업로드가 긴 형식만 받았음
- 결정: (1) 업로드 대상 "출고 실적 추가"가 월이 열로 늘어선 넓은 형식(07-2026, 2022-07, 202207, 2022년 7월 …)을 자동 감지해 품목×월 행으로 변환(`web/lib/upload/wide.ts`), 품목코드 열·품목 유형 선택. (2) `v_item_monthly` 가 shipment_extra 의 부품 옛 코드를 HOC 로 귀속, 옵션 SW 분리. (3) 대량 반영 후 물리화 뷰 갱신은 8초 제한을 넘기므로 플래그(`fn_request_refresh`) → pg_cron `scm-refresh`(매분)가 DB 안에서 갱신. (4) 엔진은 품목별 이력 앞쪽 0 구간을 잘라 학습(`trim_leading_zeros`)
- 검증: 2022-01~06 넓은 형식 CSV 업로드 → 1분 내 v_item_monthly 반영(옛 코드 합산 확인), PART 이력 시작 2022-01. 이후 백테스트 재실행으로 vs_prev 비교 가능
- 사용자 절차: 데이터 업로드 → "출고 실적 추가" → 회사 파일 그대로 → 품목 유형 선택 → 검증 → 반영 → 예측 화면에서 백테스트·프로덕션 요청

## D-031 (2026-09-13) 대시보드를 SCM 업무 지표로 재구성
- 배경: 기존 카드가 시스템 준비 상태(품목 수·더미 비율·업로드·스냅샷) 위주 — 담당자가 매일 행동할 숫자가 아님
- 결정: `fn_dashboard_v2` 한 번 호출로 5묶음 15카드 + 관리자용 데이터 준비 3카드. ① 재고 건전성(월말 예상 재고금액 vs 목표, 카테고리별 평균 DoS, 과잉 재고 품목·금액) ② 품절 리스크(품절 위험·A등급, 품절+주문 대기, 입고 지연 PO) ③ 발주 사이클(계획 상태 + 다음 발주일 D-n, 총 금액 vs 전월·제출 OL, 수요자료 제출) ④ 예측 신뢰도(기준예측 WAPE vs SCM/Sales OL, 예측 최신성, AI 제안 대기) ⑤ 운영(승인 대기·최장 대기, 임시배정 만료 임박, 배정 대기). 역할별 섹션 순서(팀장: 재고→사이클→예측…, 담당자: 리스크→사이클→운영…, 영업: 운영→리스크→사이클). 비관리자에게는 더미가 남아 있을 때만 한 줄 경고
- 색 기준: 빨강 = A등급 품절 위험, 품절+주문 대기, 승인 24시간 초과, 마감 경과 미제출, 목표 DoS 미설정 / 노랑 = 나머지 주의
- 출처: 사용자 요청 + SCM 관점 설계. 규칙 R-UI-12

## D-032 (2026-09-14) 대시보드 비주얼 재설계 — 디자인 토큰 + KPI 스트립 + 묶음별 차트
- 배경: 사용자 요청 "컬러풀하고 차트가 함께 있는 대시보드" (참고 이미지: SCOR KPI·ABC 분석 화면 스타일)
- 결정: (1) 디자인 언어를 먼저 정의(R-UI-13) — dataviz 스킬로 팔레트 검증(light/dark 모두 통과), ECharts 마크 스펙 통일. (2) 상단 KPI 스트립 5개(월말 재고금액·품절 위험·발주 금액·WAPE·승인/미제출) — 아이콘 타일, 전월/직전 라운드 대비, 목표 진행바. (3) 5묶음 각각 카드 3개(세로, compact) + 차트 1개: 카테고리별 재고 금액 묶음 막대 / 품절 위험 카테고리×ABC 스택 / 월별 발주 금액 추이 / WAPE 비교 가로 막대 / 배정 구성 도넛. 차트 카드에 한 줄 해석 자동 생성. (4) `fn_dashboard_v2` 에 charts 집계 5종 추가(호출 0.5초)
- 다음: 같은 언어로 예측(ABC-XYZ 히트맵·등급별 재고·12개월 추이) → 발주 계획 → 배정·일정 순 (③~⑤)
- 출처: 사용자 요청. 스크린샷 /tmp/scmpro/dash-v3.png 로 확인

## D-033 (2026-09-14) 카드 표면 스타일 통일 — 액센트 띠 제거, 그림자·글로우·그라데이션
- 배경: 왼쪽에만 색 띠를 두는 DrillCard 스타일이 "AI 스러운" 인상이라는 사용자 피드백.
- 결정: KpiTile·DrillCard·ChartCard 모두 `.scm-card` (globals.css) 한 클래스로 표면 통일. CSS 변수 `--acc/--acc-soft` 를 카드가 인라인으로 주입(액센트·톤별).
  - 평상시: `linear-gradient(135deg, soft 0%, #fff 55%)` 배경 + 이중 drop shadow(1px/4px).
  - 호버: 액센트색 outer glow(`0 0 0 3px acc@18%` + `0 8px 28px acc@28%`), 테두리 액센트 45%, translateY(-1px).
  - warn/danger: `data-tone` 속성으로 노랑/빨강 액센트 치환(별도 배경색 클래스 제거).
- 규칙 반영: R-UI-13 카드 표면 항목.

## D-034 (2026-09-14) 예측 화면 비주얼 재설계 — ABC-XYZ 히트맵 · 등급별 재고 · 12개월 추이
- 배경: 대시보드(D-032)와 같은 디자인 언어로 예측 화면을 재구성(사용자 순서 ③). 참고 스크린샷의 ABC-XYZ 히트맵·등급별 재고 금액/DoS·카테고리 추이·등급별 지침 패널을 SCM 관점으로 옮김.
- 결정:
  - RPC `app.fn_forecast_overview()` 하나로 매트릭스(품목 수·금액 비중·재고 금액·평균 DoS), 등급별(품목 수·재고 금액·평균/목표 DoS·과잉·재고 0), 최근 12개월 카테고리 출고, 챔피언 분포를 반환(약 0.9s, security definer — 단가 마스킹 무관한 집계만).
  - 화면: KPI 4 → 정확도 3차트(기법별·카테고리별·패턴별 WAPE, 가로 막대 하나의 축 — 기존 이중축 `AccuracyChart` 제거) → 히트맵 + 관리 지침 9셀(링크) → 등급별 카드 3 + 재고 금액·DoS 차트 → 추이 라인(카테고리 고정색) + 챔피언 분포.
  - SCM OL·Sales OL 정확도는 `forecast_accuracy` 행이 아니라 런 summary(`scm_ol_wape` 등)에 있으므로 화면에서 보강 표시.
  - `analytics.v_item_master` 에 `is_excess`(DoS ≥ 목표 2배) 컬럼 append; 품목 목록 필터 `stock=zero`(스냅샷 없음 포함) · `excess=true` 추가 → 카드 드릴다운이 정확히 그 품목에 도달.
  - 추이 해석은 "최근 3개월 평균 vs 직전 9개월 평균"(마지막 달이 부분 집계일 때 왜곡 방지).
- 성능: `v_item_monthly(ym)` 인덱스 추가, 추이 범위의 하한을 `char(7)` 로 캐스팅해 인덱스 조건화(텍스트 비교 시 전체 스캔 → 900ms, 수정 후 ~200ms). R-UI-02 유지.
- 규칙 반영: R-UI-13(화면 공통 구조·Heatmap), R-FC-35(셀별 운영 지침).

## D-035 (2026-09-14) 발주 계획 화면 비주얼 재설계 — 계획 구성 차트 4종 + 이력
- 배경: 사용자 순서 ④. 대시보드·예측과 같은 구조(KPI 스트립 → 차트 → 근거 표)로 발주 계획 목록·상세를 재구성.
- 결정:
  - RPC `app.fn_plan_overview(plan_id)` 하나로 카테고리별(라인·수량·금액·품절·차단·Flex·제출 OL 금액·필요량 금액), 공급처별 금액, 필요월×카테고리 금액, 금액 상위 10 품목, 품절 위험 카테고리×ABC 를 반환(force_custom_plan).
  - 목록: KPI 5(최신 계획·총 금액(전월 승인 대비 Δ)·품절 위험·확정 차단·Flex 도달 진행바) → 최신 계획 구성 4차트 → 계획 이력(발주월별 대표 계획 = 승인 우선, 막대) + 표(카드 표면).
  - 상세: KPI 5(라인·총 금액·품절 위험 진행바·확정 차단·오버라이드) → 4차트(카테고리 도넛·필요월 스택·상위 10 품목·품절 위험) → 기존 재고전개 그리드·라인 표. 차트 클릭은 라인 필터(`category`·`q`·`risk`)로 드릴다운.
  - 금액 차트는 억/만 축약(`money`) — Donut·StackedBars 에 `money` 옵션 추가, HBars 축 라벨 겹침 방지(splitNumber 4, hideOverlap).
  - e2e perf 의 사이드바 링크 매칭을 배지 숫자 허용 정규식으로 변경(알림·승인함 배지가 접근성 이름에 포함되어 exact 매칭이 실패하던 문제).
- 규칙 반영: R-UI-13 화면 공통 구조에 발주 계획 포함.

## D-036 (2026-09-14) 배정·일정·영업 주문 화면 비주얼 재설계 + e2e 픽스처 리셋
- 배경: 사용자 순서 ⑤. 남은 운영 화면 3개를 같은 구조(KPI 스트립 → 차트 → 작업 패널)로 재구성.
- 결정:
  - RPC `app.fn_allocation_overview()`: 배정 구성(temp/firm/hold/waiting), 대기 부족 상위 10 품목, 임시배정 만료 예정(30일, R-AL-02), 입고 예정 월×공급처, 90일 주문 상태, 30일 요청 추이.
  - 재고 배정: KPI 4(KpiTile, 패널 내부 카드 제거) + 차트 4(배정 구성 도넛·부족 상위 막대→영업 주문 품목 필터·만료 예정 막대·입고 예정 스택) + 기존 큐/입고/승인 패널.
  - 일정·제출: KPI 4(다음 발주일 D-day, 발주 회차, 미제출 진행바, 입고 차이 평균) + 차트 4(공급처별 회차 스택, 부서별 제출 현황 패널, 입고 차이 공급처×월 막대(패널의 이중축 없는 인라인 차트를 공통 컴포넌트로 이전), 지연/정시/조기 도넛 — 상태색 사용) — 계산은 `scheduleCharts` 순수 함수.
  - 영업 주문: 패널 카드를 KpiTile 로, 하단에 주문 상태 도넛·30일 요청 추이(목록 200건 클라이언트 집계).
  - 차트 공통: 범례 줄 수에 따라 grid.top 자동(`gridFor`), 도넛 링 30%/범례 62% 배치로 겹침 제거.
  - e2e: `tests/e2e/global-setup.ts` 가 실행 전 E2E 주문·배정을 취소하고 배정 시나리오용 더미 입고(556K59129 seed)를 '입고 대기'로 되돌림(engine/.env 의 DB URL + psql 필요, 없으면 건너뜀). 이전에는 실행이 누적될수록 입고 픽스처가 소진돼 "우선 배정" 분기가 비활성화되어 실패. 재입고마다 더미 재고 +30 씩 누적되는 점은 허용(더미).
- 규칙 반영: R-UI-13 화면 공통 구조에 3화면 추가.

## D-037 (2026-09-14) 카드 테두리 제거 + 우측 하단 그림자 (supersedes D-033 의 테두리 부분)
- 배경: 액센트색 테두리가 "촌스럽다"는 사용자 피드백. 테두리 없이 그림자 방향으로 입체감을 주기로.
- 결정: `.scm-card` `border: 0`. 그림자는 우측 하단 오프셋(`2px 3px 6px` + `6px 10px 22px`, 남색 5~8%). 호버 glow 는 유지하되 테두리 색 전환 제거. warn/danger 는 soft 배경을 조금 진하게(#fff3d1 / #fbdede) 해 테두리 없이도 구분. 그라데이션 오버레이 유지.
- 규칙 반영: R-UI-13 카드 표면 항목. 대시보드 안내문의 "노란 테두리/빨간 테두리" 표현은 배경색 기준으로 수정.

## D-038 (2026-09-14) KPI 타일 아이콘을 우측 상단 소형 배치
- 배경: 왼쪽 큰 아이콘 타일이 숫자 공간을 잡아먹고 무겁다는 사용자 피드백.
- 결정: KpiTile 아이콘을 우측 상단 28px 소형 타일(액센트 soft 배경, 16px 아이콘)로 이동, 본문은 전폭 사용(우측 여백 pr-12). 카드 높이·드릴다운·톤 규칙은 그대로.

## D-039 (2026-09-14) 사이드바 선택·호버 색상
- 결정: 선택된 메뉴는 밝고 옅은 노랑(#fff1cc) 배경 + 진갈색(#8a5a00) 글자, 호버 시 형광 연두(#7CFF3B) 1px 테두리 + 연한 연두 배경. 선택 메뉴 위에 호버해도 테두리가 나타나 식별 가능. 상태색(주의 노랑·조치 빨강)과 혼동되지 않도록 테두리는 초록 계열.
- 규칙 반영: R-UI-11.

## D-040 (2026-09-14) OL 시계열 연결 — 시스템 제출 OL 이 품목 SCM OL, 기종 OL 은 업로드로 이어감
- 배경: 26년부터 SCM OL 은 회사 파일이 아니라 이 시스템이 제출한다. 그대로 두면 27년 예측 시 OL 편향보정·OL 정확도 비교가 끊긴다(사용자 확인 2026-09-14).
- 결정:
  - 기종: `app.mc_plan_extra`(업로드 대상 `mc_plan_actual`) + `core.v_mc_plan_actual`(raw 변형 합산 ∪ 추가분, 추가분 우선). 엔진 `load_inputs` 와 `analytics.v_mc_compare` 는 이 뷰만 읽는다. raw 는 수정하지 않는다.
  - 품목: `analytics.v_item_ol`(최신 `ol_submission`) = SCM OL 시계열. `v_item_ol_accuracy(_summary)` 로 실적 있는 달만 채점. 백테스트는 평가월 제출 OL 을 `scm_ol` 로 채점해 `forecast_accuracy`(item·total) 와 런 summary(`item_scm_ol_wape/bias/n`)에 기록; `ol_bias` 기법 스펙을 item/both 레벨로 바꾸면 품목에도 후보로 참여(기본은 model 유지 — 품목 OL 이력이 6개월 이상 쌓인 뒤 관리자가 켠다).
  - 화면: 품목 상세 "제출 OL vs 실적" 섹션 + 차트 시리즈, 예측 KPI 에 제출 OL WAPE(실적 쌓이면), 업로드 대상 추가. 실제 발주량은 수요 모델 입력으로 쓰지 않는다(자기 순환 편향) — OL 시계열·재고 전개·규칙 보정에만 쓴다.
  - e2e: 기종 OL 업로드 → 기종 비교 반영 검증, global-setup 이 `E2E%` 기종 추가분 정리.
- 규칙 반영: R-FC-13 신설, R-FC-20 의 기준값 출처 명확화.

## D-041 (2026-09-14) 예측 자동 런 — 월 1회 백테스트·프로덕션·AI 분석을 tick 이 실행
- 배경: 실적이 쌓여도 런을 사람이 켜야 학습되던 것을 자동화(사용자 "계속 학습" 요구, 신규 작업 2번).
- 결정: 설정 5개(`auto_run_enabled` 기본 끔, `auto_run_day` 5일, `auto_run_hour` 2시 KST, `auto_run_backtest` 켬, `auto_run_tune` 켬) 를 시스템 설정 화면(비개발자 UI)에서 관리. 엔진 `forecast/auto_run.py` 가 tick 마다 `due()` 판정 → `app.auto_run_log` 에 월 단위 기록 → `runner.backtest/production(extra_params={'auto_month'})` → `ai_tuning.tune` → `notify_role` 3역할. 실패 시 로그·알림 후 예외 재전파(다음 tick 재시도 없음 — 같은 달 재실행은 관리자가 로그 행 삭제).
- 평가 FY 규칙: `eval_fy_for(last_actual)` = 진행 중 FY 면 전년도. 실데이터 운영 시 실적 마감 후 실행되도록 실행일을 잡는다.
- 규칙 반영: R-FC-43 신설. CLAUDE.md 실행 명령의 tick 설명 갱신.

## D-042 (2026-09-14) 자율 모드 — AI 감시 파이프라인 (감지 → 판단 → 알림·발주 제안 → 승인 게이트)
- 배경: 현재 AI Agent 는 대화형(질문해야 답함). 사용자 확인: 계획 생성·감지·판단·제안·알림까지 자동, 발주 제안 **승인은 사람**. 모드 스위치로 구현(off/dryrun/notify/propose).
- 결정:
  - 감지 `app.fn_agent_signals(dos_ratio, lead_days, surge_pct)` 5종(R-AI-11), 이벤트 `app.agent_event`(key 유일, 쿨다운·피드백·approval 연결), 승인 트리거 `trg_agent_order_decided`(approved → `extra_demand` kind=meeting_approval status=approved, reason "AI 감시 제안 승인"), 통계 `fn_agent_stats`, 피드백 `fn_agent_feedback`.
  - 엔진 `agent.py`: tick 마다 실행(설정 off 면 즉시 반환). LLM(gpt-5-nano, 구조화 출력) 판단 + 규칙 폴백, 수량 후보 가드레일(R-AI-12), 다이제스트 알림(R-AI-13), 제안은 관리자 계정 명의로 승인함에 등록. CLI `engine agent --mode --no-llm` 으로 수동/드라이런 실행.
  - 화면 `/agent`(AI 감시, 현황 그룹, SCM 역할): KPI(모드·조치 필요·제안 대기·유용함 비율) + 이벤트 표(심각도·신호·대상·판단 사유·근거·상태·피드백). 결재함에 "AI 감시 발주 제안" 항목, 알림은 `/agent` 로 이동. 설정 6개는 시스템 설정 화면.
  - 커리큘럼 [06]·[09] 대응. 배송 지연(신규 작업 5번)은 `inbound_delay` 신호로 이 파이프라인에 포함.
- 규칙 반영: R-AI-10~15 신설.

## D-043 (2026-09-14) 운영 이관 문서 + 물류 구간 분석 보류 + 확률적 ROP 미채택
- `docs/09-integration-plan.md`(ERP/MES 연동 인터페이스 I-1~I-9, 단계·매핑·확정 필요 사항), `docs/10-operations.md`(실행 위치·정기 작업 달력·모니터링·변경 절차·백업·인수인계) 신설.
- 물류 구간별 인터벌 분석(커리큘럼 [04])은 데이터가 없어 Q-020 으로 등록, 수령 후 업로드 템플릿·EDA 화면 추가.
- 확률적 ROP·안전재고(커리큘럼 [07])는 **채택하지 않음** — 회사 규칙이 DoS·Flex·MOQ 이고 현업 설명 가능성이 우선. 불확실성은 예측 구간·재고 전개·AI 감시(D-042)·DoS 파라미터 보정(D-044 예정)으로 다룬다.

## D-044 (2026-09-14) 발주 피드백 루프 — 사후 채점 + 오버라이드 패턴 → 목표 DoS 조정 제안
- 배경: 실제 발주량은 기록만 되고 학습에 쓰이지 않았다(사용자 질의 2026-09-14). 수요 모델에는 넣지 않고(순환 편향) **발주 규칙 보정과 사람 판단 채점**에 쓴다.
- 결정: `fn_plan_scorecard(plan)`(라인별 결과·개선/악화·카테고리·최악 15), `fn_recent_scorecards(months)`, `fn_override_patterns(months)`; AI 튜닝 프롬프트에 `order_feedback` 섹션 + 응답 스키마 `dos_adjustments`; `fn_request_tuning_approval` payload 와 `fn_apply_tuning` 에 DoS 조정 적용(5~180일 가드, 품목/셀). 화면: 승인된 계획 상세 "지난 계획 채점", 런 상세 제안에 "목표 DoS 조정 제안", 결재 설명.
- 현재 데이터로는 필요월(2026-10~) 실적이 없어 채점 결과가 비어 있음 — 실적이 쌓이면 자동으로 채워진다.
- 규칙 반영: R-OQ-42/43 신설.

## D-045 (2026-09-14) 디스크 가득 참 장애 → 보존 정책·부하 제한
- 장애: 09:22 백테스트 중 Postgres 크래시 루프(`pg_wal: No space left on device`). Free/nano 디스크 2GB 에 DB 1.2GB + WAL 576MB. 원인은 런 결과 무제한 누적(`forecast_result` 591MB, 12런), 라인 단위 감사 로그(`audit_log` 264MB), 같은 발주월의 계획 중복(212MB). Pro 조직 이전 + Micro 로 디스크 8GB 확장 후 복구(13:41). 정리 후 287MB.
- 결정: 설정 `run_retention`(기본 3, 종류별 최근 N런만 결과 보관), `audit_retention_days`(90), `engine_n_jobs`(3). `fn_prune_runs` 를 런 종료 시·tick 에서 호출. 대량 테이블(`order_plan_line`, `forecast_result`, `forecast_accuracy`)은 감사 트리거 제외(계획·런 단위 이력으로 충분). AI 제안 프롬프트 원문은 20KB 까지만 보관. CLI 기본 병렬도 6→3. 런·물리화 뷰 refresh·e2e 동시 실행 금지(10-operations).
- 이번 정리에서 삭제한 것: 완료 런 결과(최신 백테스트·프로덕션 1개씩만 유지), 2026-09 중복 계획 9개(최신 승인 1개 유지, 제출 OL 은 최신 계획분 유지), 3일 이전 감사 로그.

## D-046 (2026-09-14) 알림 on/off 를 시스템 설정으로
- 배경: 10분 반복 알림·이메일을 관리자가 화면에서 끄고 켤 수 있어야 한다(사용자 요청).
- 결정: 설정 3개 — `notify_enabled`(전체, before-insert 트리거 `trg_notify_gate`), `notify_email_enabled`(이메일 복제 트리거 + `notify.send_pending` 이 대기분 skipped:disabled 처리), `notify_reminders_enabled`(`fn_allocation_tick` 예고·독촉 루프와 `fn_tick` 의 제출 독촉 가드). 기본 전부 켬. 시스템 설정 화면 최상단 그룹.
- 규칙 반영: schedule.md 신규 규칙(R-SCH 마지막 번호), 가이드 6-2.

## D-047 (2026-09-14) 차트 반응형 — 도넛 범례 겹침·잘림 수정
- 배경: 발주 계획 화면을 1300px 정도로 줄이면 4열 차트 카드가 ~245px 가 되어 도넛이 잘리고 범례가 링 위에 겹침(사용자 보고).
- 결정: `Donut` 이 ResizeObserver 로 폭을 측정해 좁으면 범례 하단·링 중앙, 넓으면 링 좌측(폭 29%)·범례 우측(62%), 반지름은 픽셀로 계산. 4열 차트 그리드는 Tailwind 임의 브레이크포인트가 컴파일되지 않아 전역 CSS `.charts-4`(min-width 1400px) 로 통일(발주 목록·상세·재고 배정·일정). 1100/1300/1500px 스크린샷 검증.
- 규칙 반영: R-UI-13 차트 반응형 항목.

## D-048 (2026-09-14) Vercel 배포 준비
- 웹은 Vercel Pro 에 배포 가능: `maxDuration = 60` 을 발주 계획 페이지(계획 생성 서버 액션 ~20s)·업로드 페이지(대량 반영)·AI 채팅 라우트에 선언, `web/vercel.json` 으로 서울 리전 고정(메뉴 전환 1초 규칙). 엔진(tick·자동 런·AI 감시·이메일·런 처리)은 Vercel 에서 돌 수 없어 별도 서버(현재 개발 Mac launchd, 운영은 Linux systemd timer) 가 계속 필요하다 — 10-operations §1.

## D-049 (2026-09-14) 엔진 실행 서버 = Railway Cron
- `engine/Dockerfile`(python 3.12-slim + uv, libgomp1) + `engine/railway.json`(cron `*/10 * * * *`, 재시작 없음). tick 1회 = 컨테이너 1회 실행. 환경변수는 engine/.env 항목 그대로 Railway Variables. 절차는 10-operations §1-1. Mac launchd 와 동시 실행 금지(중복 알림).

## D-050 (2026-09-14) 재고전개 행을 산식 순서로 — 예측 판매 행 명시
- 배경: 그리드가 예측/입고/추가/기초/기말/확정 발주 순이라 "기초 − 기말 = 판매" 를 사용자가 암산해야 했다(사용자 요청).
- 결정: 품목 행 값 = 기말, 자식 행 = 기초 → ＋입고예정 → −예측 판매 → −추가수요 → ＋확정 발주(편집) → ＝기말. 차감 행은 음수로 표시. 카테고리 합계 행도 같은 순서(기초 합 없음). `buildTreeRows` 단위 테스트로 세로 합 = 기말 검증.
- 규칙 반영: R-UI-04.

## D-051 (2026-09-14) 런 상세의 summary JSON 노출 제거
- 배경: 예측 런 상세 화면이 `forecast_run.summary` 를 JSON 그대로 보여 주고 있었다(개발 중 잔재, R-UI-10 위반; 사용자 지적).
- 결정: 백테스트 런 = KPI 6(품목 WAPE·Bias·직전 대비, 기종 WAPE, SCM/Sales OL WAPE, 회귀 여부, 제출 OL 채점, 실행 정보) + 챔피언 기법 분포 차트 + 기존 정확도 표 4개 + AI 제안. 프로덕션 런 = KPI 4(품목·기종 수, 지평선, 실행). "자동" 배지·오류 문구 표시. summary 원본은 DB 에만.
- 규칙 반영: R-UI-10 적용 범위에 런 상세 포함(문구 추가 없음 — 기존 규칙으로 충분).

## D-052 (2026-09-14) AI 제안을 사람 말로 + 웹에서 분석 요청 + tick 이 웹 요청 런을 처리
- 배경: 런 상세의 AI 제안이 기법 키(`ma12`)·파라미터 JSON(`{"window":12}`)·근거 문장 속 변수명(`scm_ol_bias: 0.36…`) 을 그대로 보여 주고, 생성 방법이 "터미널 명령" 이었다(사용자 지적). 또 웹의 "백테스트 요청" 은 `engine forecast pending` 을 사람이 돌려야만 처리돼 Railway 운영에서 영영 처리되지 않는 상태였다.
- 결정:
  - 표시: `web/lib/forecast/tuningText.ts` — 기법 라벨, 파라미터 라벨·단위("평균 기간 9개월 → 12개월", 현재값은 `forecast_method.params`), 켬/끔, 근거 문장의 키 이름→라벨·0~1 소수→퍼센트 치환(`humanize`). 상태 라벨(분석 대기/검토 대기/승인 요청됨/적용됨/반려/실패). 프롬프트에도 "비개발자 독자, 변수명 금지, 퍼센트" 지시 추가.
  - 요청: 런 상세 "AI 오차 분석 요청" 버튼 → `forecast_tuning_proposal(status='queued')` → `runner.process_pending` 이 `ai_tuning.tune(proposal_id=…)` 로 채움(실패 시 status failed + 사유).
  - **tick 이 `process_pending` 을 호출** — 웹의 백테스트/프로덕션 요청과 분석 요청을 10분 내 처리. 병렬도는 `engine_n_jobs`.
  - 프로덕션 런 상세는 빈 정확도 표 대신 안내 문장. 총계 표의 item/model → 품목/기종.
- 규칙 반영: R-UI-10 준수, R-FC-42 표시 방식.

## D-053 (2026-09-14) 예측 기법 설정 화면 — JSON 제거, 기법별 컨트롤·설명
- 배경: `/admin/forecast-methods` 가 `params (JSON)` 입력란을 그대로 노출(R-UI-10 위반, 사용자 지적).
- 결정: `methodRegistry.ts` — 13개 기법의 파라미터 스펙(int/number/bool/select, 라벨·단위·범위·도움말)과 비전문가용 설명(무엇을 하나·언제 쓰나), 계열/레벨/패턴 우리말. 화면은 기법 카드(켬/끔·설명·메타 배지·"현재 설정" 요약·컨트롤·저장), 정책 표는 기법 이름과 칸 설명(A 등급·안정). 서버 액션이 같은 레지스트리로 검증·인코딩하고 스펙 밖 키는 보존. `tuningText` 의 파라미터 라벨도 이 레지스트리를 단일 소스로 사용.
- 규칙 반영: R-UI-10 확장.

## D-054 (2026-09-14) 필터·페이지 링크의 스크롤 유지
- 배경: 발주 계획 상세의 필터(전체/품절 위험/차단/Flex 도달)·이전/다음을 누르면 페이지 맨 위로 이동해 다시 내려와야 했다(사용자 지적). Next `Link` 기본 동작.
- 결정: 같은 화면의 검색 파라미터만 바꾸는 링크 전부 `scroll={false}` — 발주 계획 상세, 품목 목록(카테고리·페이지), 승인함 상태 탭, AI 감시 탭, AI 통계 기간, 업로드 탭. 규칙 R-UI-14 신설.

## D-055 (2026-09-15) 표·템플릿 내보내기에 Excel(xlsx) 추가 + SheetJS 를 CDN 배포판으로 교체
- 배경: 다운로드가 CSV 뿐이었다(사용자 요청). 또 `xlsx@0.18.5`(npm) 는 CVE-2023-30533(프로토타입 오염, `sheet_to_json` 읽기 경로) 이 남아 있는 마지막 npm 배포판인데, 업로드 파싱(`lib/upload/parse.ts`)이 정확히 그 경로를 쓰고 있었다 — 내보내기와 무관하게 이미 노출 상태였다(사용자 지적).
- 결정:
  - **의존성**: `xlsx` 를 SheetJS 공식 CDN tarball 로 교체 — `package.json` 의 `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`. SheetJS 는 0.19.3 이후를 npm 에 올리지 않으므로 CDN 이 유일한 정식 경로. `import * as XLSX from "xlsx"` 는 그대로라 기존 코드 수정 없음. `npm audit` 취약점 0건 확인.
  - **UI**: 화면마다 있던 CSV 버튼을 `components/export/ExportMenu.tsx` 드롭다운 하나로 통일(`[⭳ 내보내기 ▾] → CSV / Excel (.xlsx)`). 툴바 버튼 개수를 늘리지 않는다.
  - **생성**: `lib/export/sheet.ts` 단일 소스(`exportRows`). 숫자는 숫자 셀(엑셀 합계 가능), CSV 는 BOM + RFC 4180 따옴표(기존 `JSON.stringify` 방식은 `"` 를 `\"` 로 잘못 escape 했다), xlsx 는 헤더 행 고정 + 열 너비 자동(한글 2칸 계산), 시트명은 엑셀 제약(31자·`[]:*?/\` 금지)으로 정제.
  - **적용 4곳**: `DataGrid`(품목·발주 계획 상세 등 전체 — 정렬·검색·컬럼 숨김이 반영된 화면 그대로 내보냄), 발주 리포트, 업로드 템플릿, 검증 오류. `DataGrid` 의 `csvName` prop 은 `exportName` 으로 개명.
- 사내 이관 시 주의: CDN tarball 은 설치 시 `cdn.sheetjs.com` 접속이 필요하다. 폐쇄망으로 옮기면 사내 npm 레지스트리(Verdaccio/Nexus)에 미러링한다 — `xlsx` 만의 문제가 아니라 전 의존성에 필요한 인프라이므로 이관 과제로 둔다(Q-021).
- 규칙 반영: R-UI-05 개정.

## D-056 (2026-09-16) 화면의 core 직접 조회 3곳을 analytics pass-through 뷰로 이전
- 배경: CLAUDE.md 데이터 원칙("앱/화면은 analytics 뷰만 읽는다")과 달리 `web/lib/queries/items.ts`(`core.v_part_linkage`, `core.v_option_model_link`)·`admin.ts`(`core.v_model`) 가 core 를 직접 읽고 있었다. DB 권한(`grant select … core to authenticated`)이 막지 않아 동작은 했지만 원칙 위반이고, Exposed schemas 에서 core 를 빼는 순간 해당 화면(품목 상세 연결 기종, 관리자 EOL 기종 목록)이 오류 없이 빈 목록이 되는 구조였다(쿼리가 `?? []` 로 오류를 삼킴).
- 결정: `analytics.v_model`, `analytics.v_option_model_link` pass-through 뷰 신설(migration `20260916009000_analytics_passthrough.sql`). 정제 로직은 여전히 core 한 곳에만 둔다. `v_part_linkage` 는 기존 `analytics.v_part_linkage` 로 교체. `tests/unit/schemaGuard.test.ts` 가 두 조회 함수의 `schema()` 호출을 기록해 raw·core 가 없음을 강제한다.
- 규칙 반영: 새 규칙 ID 없음(CLAUDE.md 데이터 원칙 그대로). 05-data-catalog 의 마이그레이션 표·analytics 뷰 목록 갱신.

## D-057 (2026-09-16) pg_cron `scm-tick` 해제 — fn_tick 실행 주체는 Railway Cron 하나
- 배경: D-049 로 엔진을 Railway Cron 에 올리면서 `engine tick` 이 `app.fn_tick()` 을 10분마다 호출하게 됐는데, 004000_schedule.sql 이 등록한 pg_cron `scm-tick`(같은 주기, 같은 함수)이 그대로 살아 있었다. 9/14~16 사이 pg_cron 쪽만 349회 실행 — 10분마다 두 번. D-049 는 Mac launchd 중복만 언급했다. 실제 중복 알림은 없었다(`fn_allocation_tick`·`fn_submission_reminder_tick` 의 `not exists` 가드) — 다만 정각 동시 발화 시 가드 경합 창과 두 배 부하가 남는다.
- 결정: migration `20260916009100_unschedule_scm_tick.sql` 이 `scm-tick` 을 해제한다(멱등, pg_cron 없으면 no-op). `schedule.sql` 이 재실행마다 재등록하므로 이 파일이 항상 뒤에 와서 다시 해제한다. `scm-refresh`(물리화 뷰 매분 갱신)는 Railway tick 이 대신하지 않으므로 **유지**. fn_tick 의 유일한 정기 호출자는 Railway `engine tick`.
- 규칙 반영: 07-architecture §6 배치 표, 10-operations §1 갱신. 새 규칙 ID 없음.

## D-058 (2026-09-17) 부서 추가 요청 6건 — 고객사별 배정현황·강제배정·긴급발주 진행·담당 품목 재고·전 부서 재고·품명 병기
- 배경: 현업 추가 요청. 영업(OL 제출 시 고객사별 필요 기기 수 대비 최종 배정·부족 확인 화면), 서비스(품목코드 옆 품명, 긴급발주 처리 진행을 대시보드에), NP마케팅(용지·카드리더기 재고를 대시보드에), 전 부서(재고현황을 대시보드에서 바로), 사업강화(사업부 제출 총량 안에서 입고 물량 일부를 고객사별로 강제배정).
- 결정(스키마): `app.customer`, `app.demand_line`(부서×고객사×품목×월), `app.item_group`/`item_group_item`(제품군→담당 부서), `app.inbound_event`(PO 진행 단계), `sales_order.customer_code`·`is_dummy`, `allocation.forced`, `extra_demand.need_date`·`requested_dept`·`inbound_id`·`is_dummy`, enum `extra_kind.urgent`·`approval_kind.urgent_order`·`inbound_stage`. 설정 `force_alloc_max_pct`(기본 30). 뷰 `analytics.v_item_name`·`v_customer_allocation`·`v_urgent_progress`·`v_group_stock`·`v_force_alloc_pool`. RPC `fn_save_demand_lines`·`fn_force_allocate`·`fn_request_urgent`·`fn_link_urgent_inbound`·`fn_add_inbound_event`·`fn_dashboard_ext`, `fn_create_sales_order`(고객코드 인자 추가)·`fn_decide_approval`(urgent_order 분기)·`fn_apply_upload`(대상 4종 추가).
- 결정(동작): 강제배정은 임시배정으로 만들고 팀장 승인은 생략하되 고객사 한도·품목 한도(설정값)와 즉시 알림·불변 이력으로 통제한다(R-AL-53/54). 긴급발주는 전 부서 요청 → 팀장 승인 → 추가수요 가산 → PO 연결 후 단계 추적(R-OQ-44, R-SCH-33). 대시보드는 기존 `fn_dashboard_v2` 를 건드리지 않고 `fn_dashboard_ext` 를 추가한다(R-UI-16). 재고 "바로바로" 는 스키마 변경 없이 스냅샷 적재 주기를 올리는 것으로 대응하고 ERP 일별 인터페이스(09-integration-plan I-2)는 이관 과제로 둔다.
- 데이터: 실데이터가 없어 고객사 10곳·기기 12종 재고·수요 라인·더미 주문/배정·품목 그룹 2개·긴급발주 6건(단계별)을 `is_dummy` 로 시드(D-007). 원천은 Q-022~024.
- 규칙 반영: R-AL-51~54, R-SCH-32·33, R-OQ-44, R-INV-09, R-UI-15·16 신설, R-UI-12 개정.

## D-072 (2026-09-29) AI Agent 채팅 — 빈 답변·저장 누락 수정, 대화 삭제 추가
- 증상: 운영 화면에서 "기준예측 정확도 설명해줘" 같은 질문에 답이 비어 나오거나 아무 반응이 없다. 저장된 답변 34건 중 6건이 빈 값, 주제 분류는 35건 전부 "기타".
- 원인 ① 추론 토큰: gpt-5 계열은 추론 토큰이 `max_completion_tokens` 에 포함된다. 기본 추론 강도에서 한도 4,000 을 추론이 다 쓰면 본문 없이 `finish_reason=length` 로 끝나는데, 이를 확인하지 않고 빈 답변을 저장했다(재현 3회 중 1회, 운영 1회). 주제 분류는 한도 20 이라 항상 비어 "기타"가 됐다.
- 원인 ② 남의 대화 id: 패널이 현재 대화 id 를 브라우저(localStorage)에 계정 구분 없이 기억한다. 계정을 바꿔 로그인한 관리자는 남의 대화가 조회는 되지만(R-AI-03) 쓰기는 막혀 있어, 질문·답변 저장이 조용히 실패하고 화면에 아무것도 나타나지 않았다.
- 결정: (1) 대화 호출은 `reasoning_effort=low` · 한도 8,000, 주제 분류·요약은 `minimal`. `minimal` 은 도구를 호출하지 않아(R-AI-05 위반) 대화에는 쓰지 않는다. (2) 본문이 비면 오류(`empty_answer:<사유>`)로 기록하고 안내 문구를 보여 준다. (3) 서버는 본인 소유 대화만 이어 쓰고, 아니면 새 대화를 만든다. 질문 저장 실패는 오류로 돌려준다. (4) 패널의 대화 목록은 본인 대화만 — 관리자의 전체 조회는 관리자 통계 화면. (5) 사용자는 대화 목록에서 자기 대화를 삭제할 수 있다. 메시지까지 함께 지워지므로(cascade) **삭제한 대화는 관리자 통계·질문 로그에서도 빠진다.**
- 검증: 같은 질문 3회 모두 답변(14~17초, 수정 전 26~30초), 주제 분류 정상("예측"·"발주"). 단위 5건, E2E 2건 통과. E2E 는 전역 픽스처 리셋 없이 AI 스펙만 실행(운영 DB 의 AI 감시 이벤트·승인 대기 보호).
- 규칙 반영: R-AI-01 · R-AI-02 · R-AI-03 개정.

## D-073 (2026-09-29) AI 모델 교체 — gpt-5-nano → gpt-5.6-luna (D-017 의 모델 부분 supersedes)
- 배경: 사용자 요청. 계정에서 `gpt-5.6-luna` 사용 가능 확인(모델 목록 조회).
- 확인한 호출 조건(Chat Completions): ① 도구(function calling)와 추론을 함께 쓸 수 없다 — `reasoning_effort` 를 생략해도 400, `none` 이어야 한다. ② `minimal` 은 없다(none · low · medium · high · xhigh). ③ 구조화 출력(json_schema)은 그대로 동작 — 엔진의 AI 감시 판단·오차 분석 호출은 바꿀 것이 없다. 반대로 1세대 gpt-5(gpt-5 · mini · nano)는 `none` 이 없다.
- 결정: (1) 설정 `ai_model` 의 운영 값과 기본값(웹·엔진·시드·`fn_request_tuning`)을 `gpt-5.6-luna` 로. 관리자 설정 화면의 선택지에 추가하고 기존 3종도 남긴다. (2) 추론 강도는 모델별로 고정: gpt-5.1 이후 = none, 1세대 gpt-5 = 대화 low · 분류·요약 minimal(D-072 유지). Responses API 전환은 하지 않는다(R-AI-01 의 Chat Completions 유지). (3) 패널 상단의 모델 표기는 설정값을 읽어 보여 준다.
- 적용 순서: 웹·엔진 배포 → 운영 DB 의 `ai_model` 값 변경 → `fn_request_tuning` 만 재적용(전체 migrate 없음). 순서를 바꾸면 구버전 웹이 새 모델을 추론 low 로 호출해 채팅이 400 으로 실패한다.
- 검증: 같은 질문("기준예측 정확도 설명") 2회 모두 도구 호출 후 답변, 6~7초(gpt-5-nano 14~17초).
- 규칙 반영: R-AI-01 개정, R-FC-42 문구.

## D-074 (2026-09-29) AI Agent 답변에서 굵은 글씨 표시(**) 제거
- 증상: 답변에 `기준예측 정확도 **31.4%**는` 처럼 별표가 그대로 보인다.
- 원인: 마크다운(CommonMark) 규칙상 닫는 `**` 앞이 문장부호(`%`, `)`)이고 뒤에 글자가 바로 붙으면 강조로 인정되지 않는다. 한국어는 조사가 붙어 이 경우가 흔하다.
- 결정: (1) 시스템 프롬프트에 강조 표시 금지를 넣는다. (2) 모델이 그래도 넣은 `**` 는 답변 저장 전에 걷어 내고, 이미 저장된 과거 답변은 화면 표시 때 걷어 낸다. 코드(``` 블록, 인라인) 안은 건드리지 않는다. 굵게 표시하는 쪽으로 고치지 않은 이유: 사용자 요청이 강조 자체를 없애는 것.
- 검증: 단위 7건 통과. 같은 질문의 새 답변과 저장돼 있던 과거 답변 모두 별표 없음.
- 규칙 반영: R-AI-08 신설.

## D-075 (2026-09-29) 제품군·기종 이름은 실제 이름으로 표시 — 이름 쌍만 DB 에 올린다 (D-059 의 "치환표는 DB 에 올리지 않는다" 중 이름 부분 supersedes)
- 배경: 회사 담당자 확인 — 실무에서 가장 중요한 화면은 원본 파일 `MC OL vs ACT` 의 FY 시트 배치(IOT · 구분 · Product, 월별 Sales OL · SCM OL · 실적 · 실적/Sales OL)이고, **Product(제품군 이름)는 실제 값으로** 보여야 한다. **IOT(기기 코드)는 지금처럼 익명**이어야 한다. 계획 메뉴에 제품군·기종 기준으로 보는 화면이 없어 실무에 쓰기 어렵다. 실제 제품군 이름을 클라우드 DB 에 올리는 것은 사용자가 승인(규칙 변경).
- 확인한 사실: 익명화는 코드네임 치환만이 아니라 이름 안의 숫자도 바꿨다 → 코드네임 토큰 치환만으로는 복원되지 않고(81행 중 35행 불일치) **전체 이름 쌍**이 필요하다. 치환표의 제품군 이름 쌍은 DB 의 제품군 602종·기종 OL Product 108종과 전부 일치, 기종 묶음(MDLnnn) 32종도 전부 일치.
- 결정: (1) 치환표에서 **이름 쌍만** `app.name_alias` 에 올린다 — 제품군 전체 이름(kind=family)과 기종 코드네임(kind=codename). **품목코드 복원 쌍과 IOT 는 올리지 않는다** — 코드는 익명 체계 그대로(D-059 유지). (2) 적재는 로컬 명령 `engine load-names --key <치환표>` — 치환표 파일은 계속 저장소 밖. (3) 저장된 값(raw·core)은 바꾸지 않고 **표시할 때만** 실제 이름으로 바꾼다: DB 는 `app.fn_real_name`, 웹은 `lib/names.ts`. 주소·조인·엔진이 쓰는 키는 익명 이름 그대로. (4) 계획 메뉴에 **기종 OL · 실적** 화면(`/mc-plan`, 전 역할) 추가. (5) 저장소·테스트·문서에는 실제 이름을 쓰지 않는다(합성 값).
- 같은 익명 이름에 표기가 여럿이면(대소문자 차이 등 15건) 기종 OL 파일에 나온 표기를 쓴다 — 화면이 원본 파일과 같게.
- 원본 파일과 다른 점: 실적/Sales OL 은 Sales OL 이 0 이면 값을 내지 않는다(원본은 0 으로 표시). 행 순서는 구분 → IOT 순(원본의 행 순서는 저장돼 있지 않다).
- 적용 결과: 이름 1,060쌍(제품군 794 · 기종 266). 원본 4개 시트(FY23~FY26)의 Product 307행 이름 전부 일치, FY26 수치 230칸 전부 일치. 새 마이그레이션 한 파일만 적용(전체 migrate 없음).
- 남은 것: 품명(description) 안의 코드네임 표기는 그대로다(품목 601개) — 이름 안 숫자가 바뀌어 있어 토큰만 되돌리면 실제와 다른 이름이 된다. 품목·발주 계획의 제품군 기준 필터·묶어 보기는 다음 단계.
- 규칙 반영: R-FC-15 · R-UI-17 신설, R-INV-10 개정.

## D-076 (2026-09-29) 제품군 · 기종 기준으로 보기 — 소계, 필터, 묶어 보기, 연결 품목
- 배경: D-075 의 남은 것. 계획 메뉴가 품목코드 중심이라 제품군(Family)·기종 단위로 재고와 발주를 볼 수 없었다.
- 결정:
  1. **기종 OL · 실적의 소계**: 원본 파일과 같은 두 묶음 — `DT/GC 소계`(구분 DT · GC), `PRINTER 소계`(PRT) — 와 합계를 표 맨 위에 둔다. 표에 보이는 행(검색·필터 적용)만 더한다. 원본처럼 묶음 끝에 끼워 넣지 않은 이유: 정렬·검색을 하면 묶음이 섞인다.
  2. **품목 ↔ 기종 연결** `analytics.v_item_model`: ① 제품군 이름에 들어 있는 기종 표기 ② BOM ③ 옵션-기종 연결. 한 품목이 여러 기종에 연결될 수 있다(연결 8,694 · 671 · 2,358품목).
  3. **필터**: 품목 목록과 발주 계획 상세에 제품군(이름 입력, 자동완성)·기종 필터. 주소에는 제품군은 고른 이름, 기종은 시스템 코드(MDLnnn)를 남긴다. 서버가 이름을 저장된 이름으로 바꿔 조회한다.
  4. **묶어 보기**: 품목 › 제품군 · 기종별 보기(`/items/families`) — 품목 수·현재고·입고예정·평균 출고·DoS·재고 0·목표 미달. 발주 계획 상세에 제품군별 / 기종별 요약(라인·발주 수량·금액·품절 위험·Flex 도달). 행을 누르면 그 범위의 품목·라인으로 좁혀진다.
  5. **연결 품목으로 이동**: 기종 OL · 실적의 Product 옆 아이콘, 기종 예측 비교의 "연결 품목" → 품목 목록(기종 필터).
- 8초 제한(D-027): 발주 계획의 기종별 요약은 뷰로 두면 API 에서 시간 초과(8.4초) → 함수 `app.fn_plan_model_summary` + `force_custom_plan` 으로 0.7초. 나머지 조회는 0.1~1.1초.
- 기종별 숫자의 뜻: 연결 품목 기준이라 기종 사이에 중복이 있다 — 기종별 합은 전체 품목 수·라인 수와 같지 않다. 화면에 적어 둔다.
- 검증 중 사고와 복구: 로컬 검증에서 쓰기를 하는 E2E(`orders.spec`)를 함께 실행해 운영 DB 에 발주 계획(2026-09)이 새로 생성·승인됐다(16:42~16:43, 금액 377.6억 → 357.8억). 그 실행이 만든 행만 삭제해 복구(제출 OL 4,303 · 계획 1 · 라인 9,572 · 추가수요 2 · 승인 2 · 알림 4). 최신 계획은 다시 2026-09-22 승인분. 감사 로그는 남겼다. E2E 는 운영 DB 에 쓰므로 읽기 전용 스펙만 확인 없이 실행한다.
- 규칙 반영: R-UI-18 신설, R-FC-15 · R-UI-17 개정.

## D-077 (2026-09-29) 회사 정리본 반영 — MC 분류 추가, 카테고리 표기 변경, MC 제품군은 보안용 약자, 전임 · 후속기 (D-075 의 "MC Product 는 실제 이름" 부분 supersedes)
- 배경: 회사가 `MC OL vs ACT` 정리본을 보냈다 — Family 이름 정리, Family 별 Item Code 추가, `전임 후속기` 시트(전임기 → 후속기 + **보안용 Family 약자**) 추가. 회사 요청: ① 분류에 **MC** 추가(관리자가 주로 보는 자료), MC 는 **DT · GC · PRT** 로 다시 나뉘므로 검색·집계에 구분자가 있어야 한다. ② 카테고리 표기 변경 — OPTION → OPTION, PART → **SPAREPARTS**, SUPPLY → **CONSUMABLE**, 신규 **MC**. ③ Family 실제 이름은 문제가 될 수 있어 약자로 바꿨다.
- 사용자 확정: MC 의 Family 는 **보안용 약자만** 표시(실제 이름은 DB 에서 지운다). 부품·소모품·옵션의 제품군 이름은 회사 약자가 없으므로 **실제 이름 유지**(D-075 그대로), 회사 약자가 오면 교체.
- 결정:
  1. **적재**: 로컬 명령 `engine load-mc --src <회사 정리본> --key <치환표>` 가 제품군 이름은 회사 약자로, Item Code 는 치환표의 익명 코드로 바꿔 `app.mc_family`(약자·구분·익명 Item Code·기종 묶음·전임기·행 순서)와 `app.mc_plan_item`(약자 × 월 Sales OL·SCM OL·실적)에 넣는다. 실제 이름·실코드는 DB·저장소에 남기지 않는다. raw 는 바꾸지 않는다.
  2. **화면 자료**: `analytics.v_mc_ol_act` 는 정리본이 있으면 그것을, 없으면 raw 를 읽는다. `load-names` 는 적재 뒤 MC Product 의 실제 이름을 `app.name_alias` 에서 지운다(부품·소모품·옵션 제품군으로도 쓰이는 이름은 남긴다).
  3. **카테고리 표기**: 저장된 값(PART · SUPPLY · OPTION · SW · MACHINE)과 주소는 그대로 두고 **보여 줄 때만** 바꾼다(`lib/design/category.ts`). 화면·차트·내보내기·AI Agent 답변에 적용. 기기 재고의 MACHINE 도 MC 로 표기.
  4. **MC 분류**: 품목 화면의 카테고리 탭에 MC 추가 — MC 목록(Item Code · 구분 · Family · 전임기 · 후속기 · 최근 실적), MC 구분(DT · GC · PRT) 필터, 구분별 집계 카드·차트. 기종 OL · 실적의 소계는 합계 / DT/GC 소계(DT · GC 내역) / PRINTER 소계.
  5. **전임 · 후속기**: Family 옆에 전임기·후속기를 표시하고, 「전임 · 후속 묶기」로 한 줄에 더해 본다(기종이 바뀐 해에도 이어서 비교). 묶어도 합계는 같다.
- 적용 결과: Family 86개(DT 26 · GC 19 · PRT 41), 2,709행(FY23 ~ 2026-06), 전임 · 후속 12건. 회사 약자가 없는 Family 3개는 익명 이름으로 표시, 치환표에 없는 Item Code 6개는 코드 없이 적재 — 회사에 확인 요청 대상. FY26 합계는 기존과 같다(Sales OL 4,510 · SCM OL 6,104 · 실적 4,170). 연결된 칸의 수치는 전부 일치.
- 기존 자료와의 차이: 정리본은 일부 행을 빼거나 고쳤다 — 실적 합계 FY23 24,576 → 24,557, FY24 23,095 → 23,084, FY25 18,198 → 18,197. **기종 단위 예측의 입력(`core.v_mc_plan_actual`)은 기존 raw 그대로**라 기종 예측 비교 화면과는 이만큼 차이가 난다. 예측 입력까지 정리본으로 바꿀지는 다음 예측 실행 전에 정한다(Q-035).
- 남은 것: 기종 묶음 이름(코드네임)은 실제 이름으로 남아 있다 — 부품·소모품·옵션 제품군 이름에 같은 코드네임이 들어 있어 함께 다뤄야 한다(회사 약자 수령 시).
- 규칙 반영: R-FC-16 · R-UI-19 신설, R-FC-15 · R-UI-17 개정.

## D-078 (2026-09-29) 회사 약자가 없는 MC Family 는 회사 파일의 이름 그대로 표시 (D-077 의 "약자가 없으면 익명 이름" 부분 supersedes)
- 배경: 회사 정리본의 Family 중 3개는 `전임 후속기` 시트에 없어 약자가 없다. D-077 에서는 익명 이름(MDL…)으로 표시했다.
- 사용자 확정: 익명으로 하지 말고 **원래 이름대로** 표시한다.
- 결정: `engine load-mc` 는 Family 에 회사 약자가 있으면 약자를, 없으면 회사 파일의 이름을 그대로 `family_key` 로 쓴다(`has_alias = false`). 약자가 있는 Family 의 실제 이름과 실코드는 여전히 DB 에 넣지 않는다. 저장소·테스트·문서에는 어떤 이름도 쓰지 않는다.
- 적용 결과: Family 86개 중 3개가 회사 파일의 이름으로 표시, 익명 표기(MDLnnn)로 나오는 Family 는 0개. 수치와 구분·전임 후속 관계는 그대로.
- 회사 약자가 오면 다시 적재해 약자로 바꾼다(Q-035).
- 규칙 반영: R-FC-16 개정.

## D-079 (2026-09-29) 기종 OL · 실적을 계획 메뉴 맨 위로, 기종 예측 비교에 선택한 Family 표시
- 배경(사용자): 기종 OL · 실적에서 Family 를 눌러 기종 예측 비교로 가면 어떤 Family 였는지 보이지 않아 이전 화면으로 되돌아가야 했다. 기종 예측 비교의 차트는 기종 묶음 단위(속한 Family 의 합)라 Family 이름이 없었다.
- 결정: (1) 사이드바 계획 그룹 순서 = 기종 OL · 실적 → 품목 → 예측 → 발주 계획 → 추가 수요. (2) 기종 OL · 실적의 Family 링크는 주소에 `family` 를 함께 넘긴다. 기종 예측 비교는 맨 위에 **선택한 Family**(이름 · MC 구분 · Item Code · 전임기 · 후속기 · 최근 12개월 실적)와 **그 기종에 속한 Family 목록**을 보여 주고, 차트 제목에도 선택한 Family 를 적는다. 목록의 다른 Family 를 누르면 선택이 바뀐다. (3) 차트와 정확도가 기종 전체 기준임을 화면에 적는다 — Family 별 월 수치는 기종 OL · 실적에서 본다.
- 규칙 반영: R-FC-15 개정.
