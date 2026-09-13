import { it, expect } from "vitest";
import { parseItemFilters, applyItemFilters } from "@/lib/queries/items";
it("parses drill params", () => {
  expect(parseItemFilters({ category: "PART", dummy: "true", target_dos: "missing", page: "2" }))
    .toEqual({ category: "PART", dummy: true, target_dos: "missing", page: 2, q: undefined, sort: undefined });
});
it("applies filters to builder", () => {
  const calls: string[] = [];
  const b: any = new Proxy({}, { get: (_, k) => (...a: any[]) => { calls.push(`${String(k)}(${a.map(x => String(x)).join(",")})`); return b; } });
  applyItemFilters(b, { category: "SUPPLY", dummy: true, target_dos: "missing", q: "toner" });
  expect(calls).toEqual(["eq(category,SUPPLY)", "eq(setting_is_dummy,true)", "is(target_dos_days,null)", "or(key_code.ilike.%toner%,description.ilike.%toner%)"]);
});
