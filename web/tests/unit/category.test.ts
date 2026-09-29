import { it, expect } from "vitest";
import { catLabel, catCode, CATEGORY_TABS, MC, MC_BIZ } from "@/lib/design/category";
import { CATEGORY_COLOR } from "@/lib/design/palette";
// 회사 요청 표기 (D-077): OPTION · SPAREPARTS · CONSUMABLE · MC. 저장된 값(PART · SUPPLY …)과 주소의 값은 그대로
it("shows the company's category names and keeps stored codes", () => {
  expect(["OPTION", "PART", "SUPPLY", "MACHINE", "MC", "SW"].map(catLabel)).toEqual(["OPTION", "SPAREPARTS", "CONSUMABLE", "MC", "MC", "SW"]);
  expect(catLabel(null)).toBe("-"); expect(catLabel("기타")).toBe("기타");
  expect(["SPAREPARTS", "CONSUMABLE", "OPTION", "MC", "PART", "기타"].map(catCode)).toEqual(["PART", "SUPPLY", "OPTION", "MACHINE", "PART", "기타"]);
  expect(CATEGORY_COLOR[catCode("CONSUMABLE")]).toBe(CATEGORY_COLOR.SUPPLY);
});
it("category tabs include MC with its three groups", () => {
  expect(CATEGORY_TABS).toEqual(["PART", "SUPPLY", "OPTION", "SW", MC]); expect(MC).toBe("MC"); expect(MC_BIZ).toEqual(["DT", "GC", "PRT"]);
});
import { mcByBiz, type McItem } from "@/lib/queries/mcItems";
it("aggregates MC items by DT / GC / PRT", () => {
  const it_ = (p: Partial<McItem>): McItem => ({ family: "AL1", biz: "DT", item_code: "TL900001", model_base: "MDL901", codename: "ALPHA", predecessor: null, successor: null, has_alias: true, last_ym: "2026-06", act_12m: 0, act_avg_6m: 0, last_sales_ol: null, last_scm_ol: null, last_act: null, last_act_ym: null, sort_no: 0, ...p });
  expect(mcByBiz([it_({ act_12m: 10 }), it_({ family: "BT2", act_12m: 0 }), it_({ family: "GMS", biz: "PRT", act_12m: 5 })]))
    .toEqual([{ biz: "DT", n: 2, act_12m: 10, active: 1 }, { biz: "GC", n: 0, act_12m: 0, active: 0 }, { biz: "PRT", n: 1, act_12m: 5, active: 1 }]);
  expect(mcByBiz([it_({ biz: null })]).map(x => x.biz)).toEqual(["DT", "GC", "PRT", "미분류"]);
});
