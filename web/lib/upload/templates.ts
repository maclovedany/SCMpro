/** 업로드 대상 정의 (D-007). 키 = fn_apply_upload 의 p_target, 컬럼 key = RPC 가 읽는 jsonb 키 */
export type ColType = "text" | "int" | "number" | "date" | "ym" | "enum";
export type ColDef = { key: string; label: string; required: boolean; type: ColType; enum?: string[] };
export type TargetDef = { label: string; description: string; mode: "upsert" | "replace"; columns: ColDef[] };
export type TargetKey = "inventory_snapshot" | "inbound" | "item_setting" | "attach_rate" | "supplier" | "eol_eos" | "holiday" | "shipment_extra" | "mc_plan_actual" | "customer" | "item_group" | "demand_line" | "inbound_event";
export const UPLOAD_TARGETS: Record<TargetKey, TargetDef> = {
  inventory_snapshot: { label: "재고 스냅샷", description: "기준일 기준 재고. 같은 기준일은 교체 (R-INV-01)", mode: "replace", columns: [
    { key: "item_code", label: "품목코드", required: true, type: "text" },
    { key: "snap_date", label: "기준일", required: true, type: "date" },
    { key: "qty", label: "수량", required: true, type: "number" },
    { key: "stock_class", label: "재고구분", required: false, type: "enum", enum: ["normal", "inspection", "defect", "service_center", "partner", "in_transit"] } ] },
  inbound: { label: "입고예정", description: "발주·선적·입고 상태 (R-INV-02, R-SCH-10)", mode: "upsert", columns: [
    { key: "item_code", label: "품목코드", required: true, type: "text" },
    { key: "supplier_code", label: "공급처코드", required: false, type: "text" },
    { key: "po_no", label: "PO번호", required: false, type: "text" },
    { key: "qty", label: "수량", required: true, type: "number" },
    { key: "planned_date", label: "계획입고일", required: true, type: "date" },
    { key: "actual_date", label: "실제입고일", required: false, type: "date" },
    { key: "status", label: "상태", required: false, type: "enum", enum: ["ordered", "shipped", "received"] } ] },
  item_setting: { label: "품목 설정", description: "목표 DoS·MOQ·단가·배정방식 (승인 없이 즉시 반영)", mode: "upsert", columns: [
    { key: "item_code", label: "품목코드", required: true, type: "text" },
    { key: "target_dos_days", label: "목표DoS", required: false, type: "int" },
    { key: "moq", label: "MOQ", required: false, type: "int" },
    { key: "unit_price", label: "단가", required: false, type: "number" },
    { key: "allocation_mode", label: "배정방식", required: false, type: "enum", enum: ["auto", "manual"] } ] },
  attach_rate: { label: "장착률", description: "기종×옵션 장착률 (R-BOM-04, D-004)", mode: "upsert", columns: [
    { key: "model_base", label: "기종", required: true, type: "text" },
    { key: "option_item_code", label: "옵션코드", required: true, type: "text" },
    { key: "rate", label: "장착률", required: true, type: "number" },
    { key: "effective_ym", label: "적용월", required: true, type: "ym" } ] },
  supplier: { label: "공급처", description: "출항 준비일·리드타임 (R-SCH-06)", mode: "upsert", columns: [
    { key: "code", label: "코드", required: true, type: "text" },
    { key: "name", label: "이름", required: true, type: "text" },
    { key: "country", label: "국가", required: false, type: "text" },
    { key: "prep_days", label: "출항준비일", required: false, type: "int" },
    { key: "lead_time_days", label: "리드타임일", required: false, type: "int" } ] },
  eol_eos: { label: "EOL/EOS", description: "기종 수명주기 (R-FC-07)", mode: "upsert", columns: [
    { key: "model_base", label: "기종", required: true, type: "text" },
    { key: "launch_date", label: "출시일", required: false, type: "date" },
    { key: "eol_date", label: "EOL일", required: false, type: "date" },
    { key: "eos_date", label: "EOS일", required: false, type: "date" } ] },
  holiday: { label: "공휴일", description: "영업일 보정 (R-SCH-04)", mode: "upsert", columns: [
    { key: "date", label: "날짜", required: true, type: "date" },
    { key: "name", label: "이름", required: true, type: "text" },
    { key: "country", label: "국가", required: false, type: "text" } ] },
  shipment_extra: { label: "출고 실적 추가 (과거 연도·최신 월)", description: "학습에 쓸 출고 실적 추가. 긴 형식(품목·월·수량) 또는 회사 파일 그대로(월이 열로 늘어선 넓은 형식)도 자동 인식. 반영 후 예측 재실행", mode: "upsert", columns: [
    { key: "item_code", label: "품목코드", required: true, type: "text" },
    { key: "ym", label: "월", required: true, type: "ym" },
    { key: "qty", label: "수량", required: true, type: "number" },
    { key: "item_type", label: "품목유형", required: true, type: "enum", enum: ["PART", "SUPPLY", "OPTION"] } ] },
  mc_plan_actual: { label: "기종 OL·실적 추가 (FY26~)", description: "기종별 월 Sales OL / SCM OL / 실적(ACT). 회사 MC_OL_vs_ACT 파일의 새 회계연도 시트를 긴 형식으로. 같은 기종·월은 갱신, 빈 칸은 유지 (D-040)", mode: "upsert", columns: [
    { key: "model_base", label: "기종", required: true, type: "text" },
    { key: "ym", label: "월", required: true, type: "ym" },
    { key: "sales_ol", label: "Sales OL", required: false, type: "number" },
    { key: "scm_ol", label: "SCM OL", required: false, type: "number" },
    { key: "act", label: "실적", required: false, type: "number" } ] },
  customer: { label: "고객사", description: "고객 마스터 — 영업 주문·수요자료가 가리키는 고객코드 (R-AL-51, D-058)", mode: "upsert", columns: [
    { key: "code", label: "고객코드", required: true, type: "text" },
    { key: "name", label: "이름", required: true, type: "text" },
    { key: "segment", label: "세그먼트", required: false, type: "text" },
    { key: "is_strategic", label: "전략고객", required: false, type: "enum", enum: ["true", "false"] } ] },
  item_group: { label: "품목 그룹", description: "품목 → 제품군 → 담당 부서. 담당 부서 대시보드에 그룹 재고 표시 (R-INV-09, D-058)", mode: "upsert", columns: [
    { key: "group_code", label: "그룹코드", required: true, type: "text" },
    { key: "group_name", label: "그룹이름", required: false, type: "text" },
    { key: "owner_dept", label: "담당부서", required: false, type: "enum", enum: ["marketing", "service", "sales", "biz_enable"] },
    { key: "item_code", label: "품목코드", required: true, type: "text" } ] },
  demand_line: { label: "수요자료 상세 (고객사별 필요 수량)", description: "부서 × 고객사 × 품목 × 필요월 × 수량 — 고객사 배정현황의 \"필요\" (R-SCH-32, D-058)", mode: "upsert", columns: [
    { key: "ym", label: "필요월", required: true, type: "ym" },
    { key: "dept", label: "부서", required: true, type: "enum", enum: ["sales", "marketing", "service", "biz_enable"] },
    { key: "customer_code", label: "고객코드", required: true, type: "text" },
    { key: "item_code", label: "품목코드", required: true, type: "text" },
    { key: "qty", label: "수량", required: true, type: "number" },
    { key: "note", label: "메모", required: false, type: "text" } ] },
  inbound_event: { label: "PO 진행 이벤트", description: "PO 별 접수·출하·출항·입항·통관 일자 — 긴급발주 진행 단계 (R-SCH-33, D-058)", mode: "upsert", columns: [
    { key: "po_no", label: "PO번호", required: true, type: "text" },
    { key: "stage", label: "단계", required: true, type: "enum", enum: ["po_accepted", "shipped", "departed", "arrived", "customs"] },
    { key: "event_date", label: "일자", required: true, type: "date" },
    { key: "note", label: "메모", required: false, type: "text" } ] },
};
export const TARGET_KEYS = Object.keys(UPLOAD_TARGETS) as TargetKey[];
/** 빈 템플릿의 헤더 행 (CSV·xlsx 공통, D-055) */
export function templateHeaders(target: TargetKey): string[] {
  return UPLOAD_TARGETS[target].columns.map(c => c.label);
}
