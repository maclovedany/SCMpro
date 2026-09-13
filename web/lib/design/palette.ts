/** 디자인 토큰 (D-032, R-UI-13). dataviz 검증 통과 팔레트(reference palette) — 순서 고정, 순환 금지.
 *  시리즈 색은 마크에만, 텍스트는 텍스트 토큰. 상태색은 시리즈로 재사용 금지. */
export const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#4a3aa7", "#e87ba4", "#008300", "#e34948"] as const;
export const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#9085e9", "#d55181", "#008300", "#e66767"] as const;
export const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" } as const;
export const SEQ_BLUE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"] as const;
/** 화면 묶음 액센트 (섹션 헤더·아이콘 타일). 시리즈 팔레트에서 슬롯 고정 배정 */
export const ACCENT = {
  stock: { hex: "#2a78d6", soft: "#e8f1fb", name: "blue" },     // 재고 건전성
  risk: { hex: "#eb6834", soft: "#fdeee7", name: "orange" },    // 품절 리스크
  cycle: { hex: "#4a3aa7", soft: "#ecebf7", name: "violet" },   // 발주 사이클
  forecast: { hex: "#1baf7a", soft: "#e6f6ef", name: "aqua" }, // 예측 신뢰도
  ops: { hex: "#eda100", soft: "#fdf5e1", name: "yellow" },    // 운영
  data: { hex: "#6b7280", soft: "#f1f2f4", name: "gray" },     // 데이터 준비
} as const;
export type AccentKey = keyof typeof ACCENT;
/** 카테고리(PART/SUPPLY/OPTION) 고정 슬롯 — 화면 어디서나 같은 색 */
export const CATEGORY_COLOR: Record<string, string> = { PART: SERIES_LIGHT[0], SUPPLY: SERIES_LIGHT[2], OPTION: SERIES_LIGHT[1], SW: "#9ca3af" };
export const ABC_COLOR: Record<string, string> = { A: SEQ_BLUE[5], B: SEQ_BLUE[3], C: SEQ_BLUE[1] };
