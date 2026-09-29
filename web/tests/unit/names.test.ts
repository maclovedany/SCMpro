import { it, expect } from "vitest";
import { aliasMap, realName, anonNamesOf } from "@/lib/names";
import { withRealNames } from "@/lib/ai/tools";
// 합성 값 (D-075)
const m = aliasMap([
  { kind: "family", anon: "MDL901 Mono(A237)", anon_key: "MDL901 MONO(A237)", real_name: "Alpha Mono(A100)" },
  { kind: "family", anon: "MDL901 MONO(A237)", anon_key: "MDL901 MONO(A237)", real_name: "ALPHA MONO(A100)" },
  { kind: "codename", anon: "MDL901", anon_key: "MDL901", real_name: "ALPHA" },
]);
it("restores display names: exact spelling first, then case-insensitive, else unchanged", () => {
  expect(realName(m, "family", "MDL901 Mono(A237)")).toBe("Alpha Mono(A100)");
  expect(realName(m, "family", "MDL901 MONO(A237)")).toBe("ALPHA MONO(A100)");
  expect(realName(m, "family", " mdl901 mono(a237) ")).toBe("Alpha Mono(A100)");
  expect(realName(m, "codename", "MDL901")).toBe("ALPHA");
  expect(realName(m, "family", "MDL901")).toBe("MDL901");        // 종류가 다르면 바꾸지 않는다
  expect(realName(m, "family", "47 SERIES")).toBe("47 SERIES"); expect(realName(m, "family", null)).toBeNull();
});
it("AI tool results show real family names and keep item codes", () => {
  expect(withRealNames([{ key_code: "MDL901", family: "MDL901 Mono(A237)", setting: { family: "47 SERIES", moq: 1 } }, null], m))
    .toEqual([{ key_code: "MDL901", family: "Alpha Mono(A100)", setting: { family: "47 SERIES", moq: 1 } }, null]);
});
it("finds stored names from a display name (for filters)", () => {
  expect(anonNamesOf(m, "family", "alpha mono(a100)").sort()).toEqual(["MDL901 MONO(A237)", "MDL901 Mono(A237)"]);   // 실제 이름 → 저장된 이름들 (대소문자 무시)
  expect(anonNamesOf(m, "family", "MDL901 Mono(A237)")).toEqual(["MDL901 Mono(A237)"]);                              // 저장된 이름을 그대로 받아도 된다
  expect(anonNamesOf(m, "family", "47 SERIES")).toEqual(["47 SERIES"]);                                               // 쌍이 없는 이름(익명화 때 바뀌지 않은 값)
  expect(anonNamesOf(m, "codename", "alpha")).toEqual(["MDL901"]);
});
