# SP5 일정·알림 설계

작성: 2026-09-13 · 상태: **구현 완료** (D-024) · 근거: R-SCH-01~30, R-AL-17/30, Q-019 · 선행: SP1/3/4

## 1. 목표
공급처별 출항일 규칙으로 **월 발주일·입고예정일** 을 산출(주말·공휴일 → 이전 영업일), 부서별 수요자료 제출 마감(말일−1)과 미제출 10분 반복 알림, 계획 vs 실제 입고일 차이 통계, 주기 작업(pg_cron)과 이메일 채널.

## 2. 규칙 구현
- `supplier.sailing_rule` jsonb: `{"weekday": 3, "weeks": [1,3]}` (수요일, 매월 1·3주차 출항). 발주일 = 출항일 − prep_days, 입고예정일 = 출항일 + ship_lead_days(7). 주말·공휴일이면 이전 영업일 (R-SCH-01~05).
- `app.fn_business_day(d)`: 주말/`app.holiday` 면 하루씩 앞으로. `app.fn_order_calendar(from, months)` → 공급처별 {sailing_date, order_date, eta} 목록.
- 제출: `app.demand_submission(dept, ym, submitted_by, submitted_at, note)`. 마감 = 전월 말일 −1 (R-SCH-20). `fn_submission_status(ym)`: 부서(marketing/sales/service/biz_enable)별 제출 여부. `fn_submission_reminder_tick()`: 마감 경과 & 미제출 부서 사용자에게 10분마다 알림 (R-SCH-21).
- `app.fn_tick()` = allocation tick + submission tick + 이메일 큐잉. **pg_cron** `*/10 * * * *` (Supabase 확장). 실패 시 대안: `engine tick`.
- 이메일 (R-SCH-30): 시스템 알림 생성 시 트리거로 channel=email 행 복제(수신자 이메일). 발송은 `engine notify --send` (SMTP 환경변수 SMTP_HOST/PORT/USER/PASS/FROM 있으면 발송, 없으면 result='skipped:no_smtp'). Q-019.
- 입고 차이: `analytics.v_inbound_gap` (received 만): diff_days = actual − planned, 공급처·품목·월별 집계 뷰 (R-SCH-10/11).

## 3. 웹
- `/schedule`: 카드(다음 발주일, 이번 달 발주 건수, 미제출 부서 수, 평균 입고 차이) 드릴다운 · 공급처별 향후 3개월 발주 캘린더 표 · 부서 제출 현황(제출 버튼: 해당 부서 사용자/관리자) · 입고 차이 차트(월별 평균, 공급처별) + 표.
- `/admin/suppliers` 에 sailing_rule 편집(요일·주차).

## 4. 완료 기준
1. fn_order_calendar 가 공휴일·주말 보정 (단위 테스트 SQL) 2. 제출 마감 후 미제출 부서 알림 생성(tick) 3. pg_cron 잡 등록 확인 4. 입고 차이 뷰·차트 5. 이메일 큐 생성 + engine notify 동작(skipped) 6. E2E 통과
