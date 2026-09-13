# SP4 주문·배정 설계

작성: 2026-09-13 · 상태: **구현 완료** (D-023) · 근거: R-AL-01~50, R-INV-03, R-SCH-30 · 선행: SP1

## 1. 목표
영업 주문(검토 요청)에 대한 임시배정(30일) → 수주 확정 시 확정배정, 만료·반려·취소 시 해제. 신규 입고 시 품목별 자동/수동 배정, 사업강화부 우선순위, 수동 우선 배정의 팀장 승인(10분 반복 알림), 만료 알림(10/5/3/2/1일 전) — 전부 stage1 §2 규칙대로. 주문 상태 변경과 배정은 한 트랜잭션(품목 advisory lock).

## 2. 상태
`sales_order.status`: review_requested(임시배정 완료) · partial(부분 임시배정, 부족 대기) · waiting(전체 배정 대기) · confirmed(수주 확정=확정배정) · rejected · cancelled · expired
`allocation.kind`: temp(임시, expires_at) · firm(확정, 만료 없음) · hold(승인대기 확보수량, 만료 없음)
가용재고 = 현재고(normal 최신) − temp(active) − firm − hold (R-INV-03, R-AL-16)

## 3. DB (migration 20260913003000_allocation.sql)
- `app.sales_order`(id, order_no serial-like, item_code, qty, customer, sales_rep uuid, status, alloc_mode partial|wait, priority int default 100, requested_at, expires_at, confirmed_at, decided_at, cancel_reason, prev_order_id, note)
- `app.allocation`(id, order_id, item_code, qty, kind, created_at, expires_at, released_at, release_reason, approval_id)
- `app.inbound_receipt`: inbound.status=received 처리 시 inventory_snapshot(normal, 오늘) 갱신 (R-INV-02)
- RPC: `fn_available_stock(item)`, `fn_create_sales_order(item, qty, customer, mode, prev_order_id)`, `fn_confirm_sales_order(id)`, `fn_cancel_sales_order(id, reason)`, `fn_receive_inbound(inbound_id, actual_date)` → 자동배정(auto 품목, 우선순위→검토요청 순→id 순) + 알림, `fn_manual_allocate(order_id, qty, reason)` → 큐 선두면 확정배정, 아니면 사유 필수 + hold + approval(priority_alloc), `fn_set_priority(order_id, priority, reason)`(사업강화부), `fn_release_firm(alloc_id, reason)` → 주문 취소·알림, `fn_allocation_tick()` → 만료 처리·만료 예고·승인 10분 반복 알림. `fn_decide_approval` priority_alloc 분기.
- 알림 이력: notification(kind, payload.order_id, payload.days_before) 로 중복 발송 방지.
- 뷰: `app.v_sales_order`(배정 합계·부족·품목 설명), `app.v_available_stock` 재정의, `app.v_allocation_queue`(품목별 대기 주문·가용).

## 4. 웹
- `/sales-orders` (전 역할, 영업 주 사용): 가용재고 조회 + 주문 등록(부분/대기 선택) + 내 주문 목록(상태·만료일·배정/부족) + 수주 확정 · 취소.
- `/allocation` (SCM): 대기/부분 주문 큐(품목별 가용), 수동 배정 다이얼로그(사유), 입고 처리(ordered/shipped → 창고 입고 완료), 승인 대기 우선배정, "만료·알림 처리 실행"(tick).
- `/allocation/priority` (사업강화부·SCM): 임시배정 주문 우선순위 편집(사유).
- 카드 전부 드릴다운. 승인함에 priority_alloc 설명.

## 5. 완료 기준
1. 영업 주문 등록 → 임시배정·가용재고 감소 → 확정 → 확정배정 2. 가용 부족 → 부분/대기 선택 저장 3. 입고 처리 → 자동배정(FIFO/우선순위) + 알림 4. 수동 우선배정 → 팀장 승인 → 확정배정 / 반려 → 해제 5. tick: 만료 처리·예고 알림·10분 반복 알림 6. 확정배정 해제 → 주문 취소·알림 7. 테스트 통과
