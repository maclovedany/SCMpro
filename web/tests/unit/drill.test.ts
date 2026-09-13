import { it, expect } from "vitest";
import { drillHref } from "@/lib/drill";
it("builds sorted query and skips undefined", () => {
  expect(drillHref("/items", { category: "PART", dummy: true, q: undefined })).toBe("/items?category=PART&dummy=true");
  expect(drillHref("/items", {})).toBe("/items");
});
