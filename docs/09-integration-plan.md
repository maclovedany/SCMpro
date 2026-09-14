# ERP/MES 연동 계획 (현업 적용 설계)

최종 갱신: 2026-09-14 · 출처: 커리큘럼 [10] 현업 적용 설계, D-043 · 상태: **계획안** — 회사 ERP/MES 담당과 확정 필요

## 1. 원칙
- 이 시스템은 **의사결정 계층**(예측·발주 제안·배정 판단)이고, ERP 는 **거래 원장**(발주서·입고·재고·매출)이다. 원장은 ERP 에 남기고, 이 시스템은 ERP 에서 사실을 받아 계산하고 결과(제출 OL·발주 계획·배정)를 ERP 로 돌려준다.
- 연동은 전부 **파일/API 어댑터**를 통해 `app.*` 테이블에 쓰며, `raw` 는 건드리지 않는다(원본 불변 원칙). 모든 유입 데이터는 `source`(upload/api) 와 `is_dummy=false` 로 구분한다.
- 1단계는 **파일 교환(현재 업로드 화면)**, 2단계는 **API(REST/CSV SFTP)**, 3단계는 **이벤트(웹훅)**. 각 단계는 같은 RPC(`fn_apply_upload`) 를 재사용하므로 화면 로직이 바뀌지 않는다.

## 2. 인터페이스 목록

| # | 방향 | 데이터 | ERP/MES 소스 | 이 시스템 대상 | 주기 | 담당 |
|---|---|---|---|---|---|---|
| I-1 | ERP → SCM | 출고 실적 (품목·월·수량) | 출고/매출 원장 | `app.shipment_extra` → `analytics.v_item_monthly` | 월 1회 (실적 마감 익일) | SCM팀 |
| I-2 | ERP → SCM | 재고 스냅샷 (정상/검사/불량/서비스/파트너/운송중) | 재고 원장 | `app.inventory_snapshot` | 일 1회 | SCM팀 |
| I-3 | ERP → SCM | 입고예정·입고 실적 (PO·품목·수량·계획일·실입고일) | 구매/입고 | `app.inbound` | 일 1회 + 입고 시 | 구매 |
| I-4 | ERP → SCM | 품목 마스터 (단가·MOQ·공급처·포장단위) | 품목 마스터 | `app.item_setting` (승인 없이 반영, 이력 audit) | 변경 시 | 구매 |
| I-5 | ERP → SCM | 기종 OL·판매 실적 (FY 시트) | 영업 계획/판매 | `app.mc_plan_extra` | 월 1회 | 영업기획 |
| I-6 | SCM → ERP | 승인된 발주 계획 (품목·수량·필요월·공급처) → 구매요청/PO 초안 | 구매 | `app.order_plan_line` (status=approved) 내보내기 | 월 1회 (승인 직후) | SCM팀 |
| I-7 | SCM → Supplier | 제출 OL (품목·대상월·수량) | FX-LIVE 등 공급처 포털 | `app.ol_submission` 내보내기 | 월 1회 | SCM팀 |
| I-8 | SCM → ERP | 확정배정 (주문·품목·수량) → 출고 지시 예약 | 영업 주문/출고 | `app.allocation` (kind=firm) | 실시간(이벤트) | 영업 |
| I-9 | MES/WMS → SCM | 창고 입고 완료 이벤트 | WMS | `fn_receive_inbound` 호출 | 실시간 | 물류 |

## 3. 단계별 계획
1. **파일 교환 (지금 가능)**: I-1~I-5 는 이미 업로드 화면·템플릿이 있다. ERP 에서 같은 열 이름으로 내보내기 저장 → 담당자가 월/일 단위로 업로드. I-6/I-7 은 발주 보고서 CSV 로 내보내기.
2. **API**: Supabase PostgREST 를 그대로 API 로 쓴다(서비스 키는 서버 간 통신에만). 어댑터(Python `engine` 에 `erp` 명령 추가)가 ERP 뷰/CSV(SFTP) 를 읽어 `fn_apply_upload` 를 청크로 호출. 스케줄은 `engine tick` 에 포함.
3. **이벤트**: WMS 입고 완료·영업 주문 확정을 웹훅으로 받아 `fn_receive_inbound`·`fn_confirm_sales_order` 호출. 재시도·멱등키(PO 번호·주문번호) 필수.

## 4. 매핑·검증 규칙
- 품목 코드는 ERP 코드 그대로(`raw.dim_item` 와 동일 체계인지 Q-013). 미등록 코드는 업로드가 `UNKNOWN_ITEM` 으로 거부하므로, 신규 품목은 먼저 품목 마스터(I-4) 를 넣는다.
- 부품은 XCN 대표코드(HOC) 로 합산되므로 ERP 의 후속 코드가 들어와도 `core.v_part_linkage` 로 귀속된다(R-XCN-01).
- 각 인터페이스는 행수·합계 대조 리포트를 남긴다(`app.upload_log` + `engine verify` 확장).

## 5. 확정 필요 사항
- ERP 제품·버전, 내보내기 가능 형식(뷰/CSV/API), 실적 마감 시점, 코드 체계(익명화 여부), 공급처 포털 제출 형식, 보안(망 분리·키 보관).
