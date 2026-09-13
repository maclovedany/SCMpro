# 규칙: 부품 XCN · HOC (R-XCN)

최종 갱신: 2026-09-13 · 출처: 회의록, 데이터 설명.docx, 04-core-views.sql

| ID | 규칙 |
|---|---|
| R-XCN-01 | 설계변경(XCN)으로 같은 부품의 코드가 A→B→C 로 바뀐다. **출고 트렌드는 연계 코드 전체 합산**으로 본다. `raw.fact_shipment` 직접 조회 금지, `core.v_shipment_by_hoc` 사용. |
| R-XCN-02 | **발주는 HOC(최종) 코드로만.** |
| R-XCN-03 | 재고도 연계 코드 합산 (R-INV-05). |
| R-XCN-04 | `dim_item.hoc_code` 가 비어 있으면 자기 자신이 HOC (`core.v_item` 이 보정). |
| R-XCN-05 | XCN 은 PART 에만 적용. SUPPLY·OPTION 은 자기 코드가 곧 대표코드. |
| R-XCN-06 | 소모품에도 HOC 가 드물게 존재 (회의록). `부품_XCN.xlsx` 외 소모품 파일에서 HOC 열이 있으면 같은 방식으로 합산. |
| R-XCN-08 | 구코드가 여러 HOC 에 연결되면 최근 24개월 출고 최다 HOC 하나로 귀속. 동률은 코드 정렬 최댓값. 귀속 목록 리포트 (D-010). |
| R-XCN-07 | `부품_Part_Tool_3년사용량.csv` 의 `HOC` 열과 `bridge_xcn.hoc_item` 이 불일치하면 bridge_xcn 우선 (회의록: "업데이트가 안 됐을 수도"). 불일치 목록을 리포트로 남긴다. |
