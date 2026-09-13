# SP3 발주량 산출 설계

작성: 2026-09-13 · 상태: **구현 완료** (D-022, docs/reports/final-verification.md) · 근거: R-OQ-*, R-INV-*, R-UI-04, D-002/003/007/013
선행: SP1, SP2 · 후속: SP5(발주일 캘린더가 plan_ym→발주일을 결정)

## 1. 목표
최신 프로덕션 예측 + 현재고 + 입고예정 + 확정 추가수요를 입력으로, 품목별 **필요월도 발주량**을 DoS·Flex·MOQ 규칙으로 산출해 발주 계획(초안)을 만들고, 품목담당자 확정 → SCM팀장 승인 → Supplier 제출 OL 로 기록한다. 재고전개(WBS 그리드)에서 월별 숫자를 보고 오버라이드할 수 있다.

## 2. 계산 (단일 구현: `web/lib/order/calc.ts`, 단위 테스트) — R-OQ 산출 순서
입력(품목당): forecast[ym] (최신 프로덕션 챔피언, 없으면 6M 평균), on_hand(정상 최신), inbound[ym](received 제외, planned_date 기준), avg_6m, target_dos_days, moq, unit_price, lead_months(공급처 lead_time_days/30 올림, 없으면 설정 default_lead_time_days), flex_base[ym](직전 승인 계획의 final_qty = 제출 OL), extras[ym](수주확정+수급회의승인+Bulkdeal승인), settings(flex_ranges, ol_lead_months, dos_avg_months, projection_future_months).
1. 전개: m = data_last_ym+1 … plan_ym+lead+H. `start[m] = end[m−1]` (첫 달 start = on_hand), `end[m] = start[m] + inbound[m] + order_arrival[m] − forecast[m] − extras[m]`, 음수 허용(품절 표시).
2. 필요월도 need_ym = plan_ym + lead_months. 목표재고 = target_dos_days/30 × avg_6m (R-OQ-01/04).
3. required = max(0, 목표재고 + forecast[need] + extras[need] − start[need]) (R-OQ-04, 추가수요 R-OQ-20).
4. Flex (R-OQ-10~13): base = flex_base[need]. offset = 1 (첫 월). pct = flex_ranges[offset]. 범위 [base×(1−pct), base×(1+pct)]. chosen = clamp(required) — ①품절 최소(범위 상한까지) ②DoS 충족 최소 ③재고금액 최소 = required 그대로 클램프. base 없으면 chosen = required. 범위 밖이면 `flex_hit` 표시.
5. MOQ (R-OQ-30/31): final = ceil(chosen/moq)×moq, moq null→1.
6. after: end_after = start[need] + final − forecast[need] − extras[need]; dos_after = end_after/avg_6m×30. `stockout_risk = end_before < 0`.
7. 차단: target_dos_days null → line.blocked=true (R-OQ-03). 금액 = final × unit_price.
오버라이드: override_qty(+사유 필수) 는 MOQ 올림 후 값을 대체, 근거 rationale 에 보존 (R-OQ-41).

## 3. DB (migration 20260913002000_order.sql)
- `app.extra_demand`(id, kind confirmed_order|meeting_approval|bulkdeal, item_code, need_ym, qty, order_no(수주확정 필수), customer, model_base, reason, status pending|approved|rejected, approval_id, created_by/at) — R-OQ-20~25. bulkdeal 은 approval kind=bulkdeal, 승인 시 approved.
- `app.order_plan`(id, plan_ym, status draft|confirmed|approved|rejected, note, summary jsonb, created_by/at, confirmed_by/at, approved_by/at, approval_id)
- `app.order_plan_line`(id, plan_id, key_code, category, supplier_id, need_ym, lead_months, forecast_need, extras_need, on_hand, inbound_until_need, start_need, target_stock, avg_6m, target_dos_days, required_qty, flex_base, flex_pct, flex_min, flex_max, flex_hit, chosen_qty, moq, final_qty, override_qty, override_reason, end_after, dos_after, stockout_risk, blocked, unit_price, amount, rationale jsonb, projection jsonb) — projection = 월별 {ym, forecast, inbound, extras, start, end}.
- `app.ol_submission`(id, plan_id, item_code, target_ym, qty, submitted_at) — 승인 시 기록 → 다음 계획의 flex_base.
- `app.item_setting.supplier_id` 추가. settings: `default_lead_time_days=30`.
- RPC: `fn_order_inputs(p_plan_ym)` → jsonb 배열(품목별 입력 묶음), `fn_save_order_plan(p_plan_ym, p_lines jsonb)` → plan(draft) 생성/교체, `fn_confirm_order_plan(p_plan_id)` (품목담당자, blocked 라인 있으면 거부, 승인 요청 생성 kind=order_plan), `fn_decide_approval` 분기 order_plan(승인→approved+ol_submission) / bulkdeal, `fn_override_line(p_line_id, qty, reason)`, `fn_add_extra_demand(...)`, 대시보드 카드 추가.
- 뷰: `analytics.v_order_plan_summary`(plan 별 금액·라인 수·품절위험·차단 수), `analytics.v_stockout_risk`(최신 draft/approved 기준).

## 4. 웹
- `/orders`: 계획 목록(카드: 이번 달 계획 상태, 품절 위험, 차단 품목, 총 발주금액, 전월 대비) + "계획 생성/재생성(plan_ym)".
- `/orders/[id]`: 상단 요약 카드(드릴다운) · **재고전개 TreeGrid**(카테고리→품목, 행: 예측·입고예정·추가수요·기초·기말·제안발주·확정발주, 열: 과거 3 + 미래 H, 편집 = 확정발주 셀) · 라인 표(DataGrid: 필터 품절위험/차단/Flex 초과) · 액션: 확정(품목담당자) → 승인 요청, 승인/반려는 /approvals.
- `/orders/[id]/report`: 사장 보고 — 총 발주금액, 전월 계획 대비, 제출 OL 대비 차이, 카테고리별 표, CSV.
- `/extra-demand`: 등록(종류별 필수 필드) + 목록 + Bulkdeal 승인 요청.
- 품목 상세 재고전개 그리드에 계획 행 추가.

## 5. 테스트
- vitest `calc.test.ts`: R-OQ 예제(120→MOQ50→150), Flex 클램프(상한/하한/base 없음), DoS 목표, 차단, 음수 재고, 오버라이드.
- Playwright: 계획 생성 → 그리드 표시 → 오버라이드 → 확정 → 팀장 승인 → ol_submission 존재 → 보고 페이지.
## 6. 완료 기준
1. `/orders` 에서 2026-09 계획 생성 → 9,672 품목 라인, 요약 카드 4개 드릴다운 2. 그리드 셀 편집·사유 → 라인 반영 3. 확정→승인→ol_submission 4. 다음 계획 생성 시 Flex 범위 적용 확인 5. 보고 페이지·CSV 6. 테스트 전부 통과.
