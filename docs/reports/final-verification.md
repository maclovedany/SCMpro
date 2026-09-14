# 최종 검증 리포트 — SP1~SP6

검증일: 2026-09-13 · 브랜치: main (sp1~sp6 병합) · 환경: Supabase(PG 17) + Next.js 16 프로덕션 빌드 + Python 엔진

## 테스트 결과 (최종 실행)
| 스위트 | 결과 |
|---|---|
| engine pytest | 33 passed (기법·분류·백테스트·AI tuning mock·notify·fiscal) |
| web vitest | 32 passed (발주 계산 R-OQ 7건, 예측 빌더, 업로드 검증, 권한, AI) |
| Playwright E2E (프로덕션 서버, 13 spec) | 13 passed — 대시보드·품목·관리자·승인·업로드·예측·AI제안·발주계획·영업주문/배정·일정·AI Agent·성능 |
| 메뉴 전환 성능 (R-UI-02) | 10개 라우트 48~345ms, 본문(h1) 렌더 완료 기준 (< 1,000ms) |
| lint / tsc / next build | 0 errors (경고 2: React Compiler 메모 건너뜀), 27 라우트 빌드 성공 |

## 서브프로젝트별 완료 기준
| SP | 완료 기준 | 증거 |
|---|---|---|
| SP1 기반 | 6/6 | sp1-verification.md |
| SP2 예측 | 6/6 — 기종 WAPE 31.9% vs SCM OL 48.2%, AI 제안 승인 반영, 기법 토글 | sp2-verification.md, sp2-backtest-fy25.md |
| SP3 발주 | 6/6 — 9,672 라인 계획 생성(~15초), 오버라이드, 확정→승인→제출 OL 4,294건, 재생성 시 Flex 클램프 2,306 라인, 보고/CSV | orders.spec, D-022 |
| SP4 배정 | 7/7 — 임시→확정→해제, 부분/대기, 입고 자동·수동 배정, 우선배정 승인/hold, 우선순위, 만료·예고·10분 반복 알림(tick) | allocation.spec + SQL 검증, D-023 |
| SP5 일정 | 6/6 — 영업일 보정(개천절·추석), 캘린더, 제출·미제출 알림, pg_cron `scm-tick`, 입고 차이 뷰, 이메일 큐+engine notify | schedule.spec, D-024 |
| SP6 AI | 5/5 — 우측 리사이즈 패널(유지), gpt-5-nano 도구 호출 답변(근거 수치), 후속 맥락, 관리자 통계 | ai-agent.spec, D-025 |

## DB 현황
```
app tables|30
app functions|43
analytics views/mv|22
forecast runs done|4
order plans|6
cron job|scm-tick */10 * * * *
audit_log|164889
ai messages|26
```

## 알려진 한계 · 다음 단계 (실데이터·운영)
1. **실데이터 수령 대기**: 장착률(Q-001)·EOL/EOS(Q-008)·재고 스냅샷·입고예정·MOQ·단가·공급처 출항 규칙 — 전부 업로드 화면/관리자 화면으로 반영 가능(D-007). 현재 값은 더미(`is_dummy`).
2. 옵션은 장착률 수령 전까지 독립 시계열 예측(R-BOM-05 임시). EOL 기종은 수렴 미적용(R-FC-07 후속).
3. 품목 백테스트 WAPE 는 in-sample 챔피언 선택으로 상한 추정(D-020) — FY26 실적 누적 후 정직한 롤링 평가.
4. 이메일 발송은 SMTP 설정 전까지 `skipped:no_smtp` (Q-019). pg_cron 이 10분마다 tick 실행 중.
5. 웹의 "런 요청"은 `engine forecast pending`(수동/크론) 이 처리. 엔진을 서버(cron)에 올리는 배포는 운영 단계.
6. AI Agent 응답은 비스트리밍(수 초~수십 초). 스트리밍은 후속.
7. E2E 는 실제 DB 상태를 바꾸므로 반복 실행 시 정리 SQL 필요(리포트 §테스트 데이터 정리 — CLAUDE.md 참조).

## 최종 검증 이후 변경 (2026-09-13 저녁, 사용자 검수 반영) — D-026~D-028
| 변경 | 검증 |
|---|---|
| 시스템 설정 비개발자 UI (R-UI-10) | vitest settings 8건, admin e2e |
| 사이드바 6그룹·배지·접기 (R-UI-11) | vitest roles 4건, dashboard/perf e2e, 관리자·영업 스크린샷 |
| 품목 상세 예측 검증 섹션 | items/forecast e2e, 556K59129 스크린샷(Holt WAPE 24.8%) |
| 카드 동일 높이·표 여백·한글 keep-all (R-UI-07~09), 추가수요 표 열 분리·NULL 정규화 | 3001 서버 CSS 확인, orders e2e |
| Bulkdeal 주문번호 선택 + 이중 계상 경고 (R-OQ-26) | orders e2e |
| 발주 계획 생성 타임아웃 근본 수정 (force_custom_plan, 카테고리 분할, 청크 500) | fn_order_inputs 5.3s→0.7s, orders e2e |
| Supabase 일시 오류 재시도 + 오류 경계 화면 | 수동 |
| 실사용 계정 6개(1q2w3e), launchd 10분 tick | seed 로그, tick 로그 |
E2E 는 `E2E_BASE_URL=http://localhost:3001` 로 기존 dev 서버에 붙여 실행 (Next 16 dev 서버 1개 제한). 전체 13 spec 통과 확인은 2026-09-13 21:40 기준.

## 디자인 언어 적용 (2026-09-14, 사용자 순서 ①~⑤) — D-032~D-039
| 변경 | 검증 |
|---|---|
| 디자인 토큰·차트 테마·MiniCharts(히트맵 포함), 카드 3종(KpiTile·DrillCard·ChartCard), `.scm-card` 표면(테두리 없음·우하단 그림자·호버 glow·그라데이션), KPI 아이콘 우측 상단, 사이드바 선택 노랑/호버 형광 테두리 | dataviz 팔레트 검증 스크립트 통과, 스크린샷(/tmp/scmpro/dash-v6*, sidebar.png), dashboard/perf e2e |
| 대시보드 KPI 스트립 + 묶음별 차트 (`fn_dashboard_v2.charts`) | dashboard e2e, vitest dashboard |
| 예측 화면: KPI·WAPE 3차트·ABC-XYZ 히트맵·관리 지침·등급별 재고·12개월 추이 (`fn_forecast_overview`, `v_item_master.is_excess`, 품목 필터 stock/excess) | vitest forecastOverview 6건, forecast/items e2e, RPC 900ms→200ms(ym 인덱스·char(7) 캐스팅), perf e2e < 1s |
| 발주 계획 목록·상세: KPI·구성 차트 4·이력 (`fn_plan_overview`) | vitest planCharts 5건, orders e2e(전체 워크플로), 스크린샷 |
| 재고 배정·일정·영업 주문: KPI·차트 (`fn_allocation_overview`, `scheduleCharts`) | vitest allocScheduleCharts 8건, allocation/schedule e2e |
| e2e 픽스처 리셋(global-setup), perf 스펙 배지 허용 | 전체 14 spec 직렬 통과 (2026-09-14 08:10, 2.8분) · vitest 60/60 · tsc/lint 0 error |

## 신규 작업 1~8 (2026-09-14 오후) — D-040~D-045
| # | 작업 | 검증 |
|---|---|---|
| 1 | OL 시계열 연결 (D-040): `core.v_mc_plan_actual`, `v_item_ol(_accuracy)`, 업로드 "기종 OL·실적 추가", 엔진 제출 OL 채점, 품목 상세 "제출 OL vs 실적" | 백테스트 2회(기종 WAPE 31.4%, 제출 OL 채점 0건 — 실적 미도래), 업로드 e2e(E2E-MDL → 기종 비교 FY26 42), items e2e, pytest scores_submitted_ol |
| 2 | 자동 런 (D-041): `auto_run.py`·tick, 설정 5개, `auto_run_log`, 런 "자동" 배지, 알림 | **실제 실행**: 설정 켜고 tick → 백테스트 67s(품목 33.0%/기종 31.4%, 회귀 없음) → 프로덕션 96s → AI 제안 1건 → 알림 4건·이메일 22통 → 로그 행 1. pytest 5건 |
| 3 | 자율 모드 AI 감시 (D-042): 감지 5종, LLM/규칙 판단, 다이제스트 알림, `agent_order` 승인 → 추가수요, `/agent` 화면, 설정 6개 | 실데이터 드라이런 251건 감지·30건 판단; agent e2e(제안 모드 → 화면·피드백 → 팀장 알림 → 승인 → 추가수요 반영 → accepted); pytest 5건 |
| 4 | 발주 피드백 루프 (D-044): 채점·오버라이드 패턴 RPC, AI 튜닝 `dos_adjustments`, 승인 시 목표 DoS 적용, 계획 상세 "지난 계획 채점" | RPC 적용·화면 렌더(현재 "채점 전" — 필요월 실적 미도래), vitest scorecardInsight, pytest order_feedback |
| 5 | 배송 지연 반영 | AI 감시 `inbound_delay` 신호(드라이런 1건 감지) |
| 7 | 운영 이관 문서 (D-043) | `09-integration-plan.md`, `10-operations.md` |
| 8 | 물류 구간 분석 | Q-020 등록(데이터 대기) |
| — | 디스크 장애 대응 (D-045): 런·계획·감사로그 정리 1.2GB→287MB, `fn_prune_runs`, 보존 설정 3개, 감사 트리거 축소, 병렬도 3 | Pro/Micro 8GB 이전 후 복구; 정리 후 3런 보관 상태 454MB |
| — | 전체 회귀 | pytest 46 · vitest 67 · lint 0 error · e2e 16 spec 직렬 통과 (아래 로그) |
스크린샷: /tmp/scmpro/{agent,runs,item-ol,scorecard,settings-agent}.png
