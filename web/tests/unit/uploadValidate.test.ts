
import { describe as d2, it as it2, expect as ex2 } from "vitest";
import { autoMap as am2, normalizeRows as nr2 } from "@/lib/upload/validate";
d2("월(ym) 컬럼 — 파서가 Date 로 읽어 YYYY-MM-DD 가 된 경우도 허용 (D-040)", () => {
  it2("YYYY-MM-DD → YYYY-MM", () => {
    const m = am2(["기종", "월", "Sales OL", "SCM OL", "실적"], "mc_plan_actual");
    const r = nr2([{ "기종": "MDL1", "월": "2026-07-01", "Sales OL": "50", "SCM OL": "45", "실적": "" }, { "기종": "MDL1", "월": "2026/8", "Sales OL": "1", "SCM OL": "1", "실적": "1" }], m, "mc_plan_actual");
    ex2(r.errors).toEqual([]); ex2(r.rows[0]).toEqual({ model_base: "MDL1", ym: "2026-07", sales_ol: 50, scm_ol: 45 }); ex2(r.rows[1].ym).toBe("2026-08");
  });
});
