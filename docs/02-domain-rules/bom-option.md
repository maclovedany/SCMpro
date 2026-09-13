# 규칙: BOM · 필수옵션 · 장착률 · Common품 (R-BOM)

최종 갱신: 2026-09-13 · 출처: 회의록, 데이터 설명.docx, 01-schema.sql

## 구조

```
CAP 코드 (주문·수요가 들어오는 단위, 판매 구성)
 ├─ Neutral 본체 (실제 수입 코드)
 │    └─ SCC 교체 구성품 (bridge_scc_config)
 ├─ 필수 옵션 (bridge_cap_option.role = MUST_OPTION)
 └─ SCC/Label (bridge_cap_option.role = SCC/LABEL)
선택 옵션 → 장착률로 산출 (bridge_option_model)
```

| ID | 규칙 |
|---|---|
| R-BOM-01 | 수요·주문은 **CAP 코드** 로 들어오지만 실제 출고·발주는 Neutral + SCC + 필수옵션 등 하위 품목이다. 기계 수요는 반드시 하위 품목으로 **전개(explode)** 한다. |
| R-BOM-02 | 필수 옵션은 기계와 1:1. 기계 N대 발주 = 필수옵션 각 N × qty. |
| R-BOM-03 | 같은 옵션이 A기종에서는 필수, B기종에서는 선택일 수 있다. 옵션 코드 기준으로 합산할 때 두 경로를 모두 더한다. |
| R-BOM-04 | 선택 옵션 소요 = Σ(기종별 판매대수 × 기종별 장착률). 장착률은 기종마다 다르다. |
| R-BOM-05 | 장착률 이력은 현재 미수령 (Q-001). 수령 시 업로드로 DB 마스터에 반영 (D-004). 그 전까지는 옵션 출고 ÷ 기종 판매대수로 역산한 값을 임시치로 쓰고 "역산" 표시. |
| R-BOM-06 | Common 옵션(복수 기종 공용)은 기종별로 나눠 세면 이중계상. `core.v_option_commonality` 로 판정 후 **옵션 코드 기준 1회** 합산. |
| R-BOM-07 | Common 소모품: 구기종 EOL → 신기종 전환 시 소모품이 같으면 총량 유지, 다르면 각각 급감/급증. 기종별 수명주기(R-FC-07)와 함께 본다. |
| R-BOM-08 | BOM 활성(`bridge_bom.active` O/X/△)과 start/end date 는 GC-BOM 만 채워짐. DT BOM 은 전부 활성으로 간주. |
| R-BOM-09 | 기종 조인은 `model_key` 가 아니라 **`model_base`** 로. `dim_model` 중 model_base 가 빈 8행은 Option MAP 헤더이므로 `core.v_model` 만 사용. |
| R-BOM-10 | 옵션 출고 트렌드 파일은 이미 수출·폐각 제외 상태 (시트명 `출고 Trend(수출,폐각 제외)`). 다시 제외하지 않는다. |
| R-BOM-11 | SW 라이선스 옵션(family LIKE 'LICENSE%' 또는 '1DAY CODE')은 예측·발주 대상에서 제외, 카테고리 `SW`. 옵션↔기종 연결은 bridge_option_model 우선, 없으면 dim_item.family 의 MDLnnn 토큰 파싱 (D-009). 구현: `core.v_option_model_link` (link_source bridge/parsed/none, Common 옵션은 기종 수만큼 행). |
