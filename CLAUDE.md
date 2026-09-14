# SCMpro — 복합기 수요예측 · 월간 발주량 결정 시스템

복합기/프린터/대형인쇄기를 해외 공급처 5곳에서 수입하는 회사의 SCM팀을 위해,
과거 출고 데이터로 수요를 예측하고 DoS·Flex rule·MOQ 를 적용해 **월간 최종 발주량과 발주 시점을 제안**하는 시스템.
상세는 `docs/` 를 본다. 이 파일은 인덱스다.

## 문서 지도
| 문서 | 언제 보나 |
|---|---|
| `docs/00-glossary.md` | 용어(OL, DoS, HOC, CAP, Flex …)가 나올 때 |
| `docs/01-business-process.md` | 월간 발주 사이클·카테고리별 산출 방식을 알아야 할 때 |
| `docs/02-domain-rules/*.md` | **구현 규칙. 코드·SQL·테스트는 규칙 ID(`R-XX-nn`)를 주석으로 참조** |
| `docs/03-decisions.md` | 문서에 없던 것을 사용자와 확정한 결정 로그 (append-only) |
| `docs/04-open-questions.md` | 아직 답 없는 질문. 새 의문은 **먼저 여기에 추가** |
| `docs/05-data-catalog.md` | 파일 → DB 테이블 → 뷰 매핑, 정제 규칙 |
| `docs/06-data-profile.md` | 데이터 검증 결과 (희소도, OL 정확도 기준선, 마스터 매핑 갭) |
| `docs/07-architecture.md` | 시스템 아키텍처 한 장 (구성 요소·데이터 계층·권한·주요 흐름·배치·디렉터리) |
| `docs/08-user-guide.md` | 사용자 가이드 — 역할별 시나리오(한 달 흐름, 메뉴별 할 일, FAQ). 화면·기능 변경 시 함께 갱신 |
| `docs/09-integration-plan.md` | ERP/MES 연동 계획 (인터페이스 목록·단계·매핑) |
| `docs/10-operations.md` | 운영·유지보수 방안 (실행 위치, 정기 작업, 모니터링, 변경·백업 절차) |
| `docs/meetings/` | 회의록 요약 |
| `docs/specs/` | 서브프로젝트별 설계 문서 (SP1~SP5) |
| `docs/plans/` | 서브프로젝트별 구현 계획 |

## 절대 규칙
1. `stage1.md`, `회의록.docx`, `데이터 설명.docx` 는 **원본. 수정 금지.** 해석은 `docs/` 에만 쓴다.
2. 사용자와 대화 중 확정된 사항은 `docs/03-decisions.md` 에 `D-nnn` 으로 기록한 뒤 진행한다. 뒤집히면 새 번호로 쓰고 `supersedes D-nnn` 표기. 기존 항목은 지우지 않는다.
3. 규칙이 바뀌면 `02-domain-rules` 의 해당 규칙을 고치고, 그 규칙을 참조하는 코드를 grep 해서 같이 고친다.
4. 답이 나온 질문은 `04-open-questions.md` 에서 지우고 `03-decisions.md` 로 옮긴다.
5. 새 데이터 파일이 들어오면 `05-data-catalog.md` 에 먼저 등록한다.
6. 하드코딩 금지 대상: 리드타임, OL 제출 선행 개월, 목표 DoS, MOQ, Flex 범위, 출항일 → 전부 관리자 설정값.
7. 화면 작업 시 `docs/02-domain-rules/ui.md` R-UI-07~09·R-UI-13 준수: 카드는 KpiTile/DrillCard/ChartCard 만 사용(동일 높이, `.scm-card` 표면 — 테두리·액센트 띠 금지), 차트는 `MiniCharts` + `lib/design/palette.ts` 토큰(순환 색·이중축 금지), 표는 숫자 우측·여백 통일, 한글 단어 잘림 금지(전역 keep-all). 화면 구조 = KPI 스트립 → 차트(한 줄 해석) → 근거 표, 전부 드릴다운. 반응형(창 축소)에서 확인 후 완료.
8. 엔진 런(backtest/run)이 도는 동안 `migrate.sh` 를 실행하지 않는다 — 물리화 뷰 재생성으로 런이 실패한다. 런·물리화 뷰 refresh·e2e 를 동시에 돌리지 않는다(2026-09-14 디스크 장애, D-045). 런 결과는 `run_retention` 개만 보관된다.
9. Supabase PostgREST 는 statement_timeout 8s. 파라미터 있는 집계 RPC 는 `plan_cache_mode = force_custom_plan` 을 붙이고 호출당 8초 내로 분할한다 (D-027).
10. 마스터·설정 데이터(재고, 입고예정, 단가, MOQ, 공급처, 장착률 …)는 **파일 업로드 + 관리자 화면 입력** 둘 다 지원. 실데이터 없는 것은 더미 시드하되 `is_dummy` 로 구분 (D-007).

## 문서 갱신 규칙 (구현 중 계속 유지)
- 규칙 ID 형식: `R-FC-nn`(forecast) `R-OQ-nn`(order-quantity) `R-INV-nn`(inventory) `R-AL-nn`(allocation) `R-BOM-nn`(bom-option) `R-XCN-nn`(parts-xcn) `R-SCH-nn`(schedule) `R-UI-nn`(ui) `R-AI-nn`(ai-agent). 번호는 재사용하지 않는다. 폐기는 `~~취소선~~ (D-nnn 로 폐기)`.
- 결정 ID `D-nnn`, 질문 ID `Q-nnn` 도 재사용 금지.
- 각 규칙 파일 상단의 `최종 갱신` 날짜를 수정 시 갱신한다.

## 데이터 원칙 (SQL 파일에서 계승)
- `raw` 스키마는 원본 그대로, 수정 금지. 앱/화면은 `analytics` 뷰만 읽는다.
- 부품 출고는 반드시 `core.v_shipment_by_hoc`(XCN 합산) 기준. `raw.fact_shipment` 직접 조회 금지.
- `fact_shipment` 는 0인 달을 저장하지 않는다(희소). 평균 계산 시 `core.v_ym_calendar` 와 LEFT JOIN.

## 실행 (SP1 기준)
```bash
# DB (Supabase) — engine/.env 의 SUPABASE_DB_URL 사용
supabase/scripts/migrate.sh                 # migrations 순서 적용 (재실행 안전)
uv --directory engine run engine export-raw # scm.db → data/export/*.csv
supabase/scripts/load-raw.sh                # raw 적재 (+ bridge_scc_config 시드)
uv --directory engine run engine seed-app && supabase/scripts/seed-app.sh   # 더미 시드 (D-007) + 물리화 뷰 refresh
uv --directory engine run engine verify --target postgres                  # 행수 대조·XCN 리포트 → docs/reports/
uv --directory engine run engine gen-types  # web/lib/types/database.ts 생성 (스키마 변경 시)
# 예측 (SP2)
uv --directory engine run engine forecast backtest --eval-fy 2025   # FY 롤링 백테스트 (~3분)
uv --directory engine run engine forecast run --horizon 6           # 프로덕션 예측
uv --directory engine run engine forecast tune                      # gpt-5-nano 오차 분석 → 제안 (승인은 /approvals)
uv --directory engine run engine forecast pending                   # 웹에서 요청한 런 처리
uv --directory engine run engine tick                               # pg_cron 대안: 배정 만료·알림·제출 알림·이메일 발송 + 월 1회 자동 런(auto_run_* 설정, D-041) + AI 감시(agent_mode 설정, D-042)
uv --directory engine run engine agent --mode dryrun --no-llm   # AI 감시 1회 수동 실행 (규칙 판단만)
uv --directory engine run engine notify                             # 이메일 큐 발송 (SMTP 미설정 시 skipped)
# 이 Mac 에 launchd 잡 com.scmpro.tick 이 10분마다 `engine tick` 실행 (~/Library/LaunchAgents/com.scmpro.tick.plist, 로그 /tmp/scmpro/tick.log)
# Web
cd web && npm run dev            # http://localhost:3000  (계정: scripts/seed-users.mts — admin insightdany@naver.com, scm_lead upflash@naver.com, sales insightcha0624@gmail.com, biz_enable pro-worker@daum.net, marketing alltest@nate.com, service imagineworld@kakao.com · 초기 비밀번호 1q2w3e)
npm test · npm run lint · npx tsc --noEmit
E2E_BASE_URL=http://localhost:3001 npm run test:e2e   # 이미 떠 있는 dev 서버에 붙여 실행 (Next 16 은 같은 폴더에 dev 서버 2개 불가). 서버가 없으면 E2E_BASE_URL 없이 실행하면 3000 에 자동 기동
# Engine
cd engine && uv run pytest
```
- Supabase 대시보드: Data API → Exposed schemas 에 `app, analytics, core` 필요.
- 상태: **SP1~SP6 + 확장 A~D 완료** (2026-09-14, docs/reports/final-verification.md): 디자인 언어, OL 시계열·자동 런·발주 피드백 루프, 자율 모드 AI 감시(기본 off), 운영 문서(09/10)·보존 정책·알림 스위치. 남은 것은 실데이터 수령(장착률·EOL·재고·MOQ·단가·공급처·물류 로그 Q-020)과 운영 이관(배포·ERP 연동). Supabase 는 Pro/Micro 8GB (2026-09-14 디스크 장애 후 이전, D-045). 서브프로젝트 목록: docs/01-business-process.md §7.
- LLM: OpenAI `gpt-5-nano` (D-017, R-AI). `OPENAI_API_KEY` 는 engine/.env, web/.env.local 에.

## E2E 반복 실행 전 정리 (DB 상태를 바꾸는 테스트)
`tests/e2e/global-setup.ts` 가 매 실행 전 E2E 주문·배정 취소 + 더미 입고(556K59129 seed) 재개방을 자동 수행한다(engine/.env DB URL + psql 필요, D-036). 배지 숫자 때문에 스펙은 직렬(`--workers=1`)로 돌리는 것이 안전. 전체 초기화가 필요하면 아래 SQL:
```sql
delete from app.order_plan where status='draft'; delete from app.allocation; delete from app.sales_order;
update app.inbound set status='ordered', actual_date=null where item_code='556K59129' and is_dummy; delete from app.demand_submission;
delete from app.agent_event; update app.approval set status='rejected', comment='cleanup', decided_at=now() where status='pending' and kind='agent_order';
update app.approval set status='rejected', comment='cleanup', decided_at=now() where status='pending' and kind in ('bulkdeal','priority_alloc');
```
