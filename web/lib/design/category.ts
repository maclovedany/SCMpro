/** 카테고리 표기 (R-UI-19, D-077). 회사 표기: OPTION · SPAREPARTS · CONSUMABLE · MC.
 *  DB·주소·조회 조건은 저장된 값(PART · SUPPLY · OPTION · SW · MACHINE)을 그대로 쓰고, **보여 줄 때만** 바꾼다. */
export const CATEGORY_LABEL: Record<string, string> = { PART: "SPAREPARTS", SUPPLY: "CONSUMABLE", OPTION: "OPTION", SW: "SW", MACHINE: "MC", MC: "MC" };
const CODE_OF: Record<string, string> = { SPAREPARTS: "PART", CONSUMABLE: "SUPPLY", MC: "MACHINE" };
/** 저장된 값 → 화면 표기 */
export const catLabel = (code: string | null | undefined): string => (code == null || code === "" ? "-" : CATEGORY_LABEL[code] ?? code);
/** 화면 표기 → 저장된 값 (차트에서 누른 이름을 조회 조건으로 바꿀 때) */
export const catCode = (label: string): string => CODE_OF[label] ?? label;
/** MC(기종)는 품목 마스터(출고 품목)와 다른 자료라 주소에서는 category=MC 로 구분한다. MC 안의 구분 = DT · GC · PRT */
export const MC = "MC";
export const MC_BIZ = ["DT", "GC", "PRT"] as const;
/** 품목 화면의 카테고리 탭 순서 */
export const CATEGORY_TABS = ["PART", "SUPPLY", "OPTION", "SW", MC] as const;
