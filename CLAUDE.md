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
7. 마스터·설정 데이터(재고, 입고예정, 단가, MOQ, 공급처, 장착률 …)는 **파일 업로드 + 관리자 화면 입력** 둘 다 지원. 실데이터 없는 것은 더미 시드하되 `is_dummy` 로 구분 (D-007).

## 문서 갱신 규칙 (구현 중 계속 유지)
- 규칙 ID 형식: `R-FC-nn`(forecast) `R-OQ-nn`(order-quantity) `R-INV-nn`(inventory) `R-AL-nn`(allocation) `R-BOM-nn`(bom-option) `R-XCN-nn`(parts-xcn) `R-SCH-nn`(schedule) `R-UI-nn`(ui). 번호는 재사용하지 않는다. 폐기는 `~~취소선~~ (D-nnn 로 폐기)`.
- 결정 ID `D-nnn`, 질문 ID `Q-nnn` 도 재사용 금지.
- 각 규칙 파일 상단의 `최종 갱신` 날짜를 수정 시 갱신한다.

## 데이터 원칙 (SQL 파일에서 계승)
- `raw` 스키마는 원본 그대로, 수정 금지. 앱/화면은 `analytics` 뷰만 읽는다.
- 부품 출고는 반드시 `core.v_shipment_by_hoc`(XCN 합산) 기준. `raw.fact_shipment` 직접 조회 금지.
- `fact_shipment` 는 0인 달을 저장하지 않는다(희소). 평균 계산 시 `core.v_ym_calendar` 와 LEFT JOIN.
