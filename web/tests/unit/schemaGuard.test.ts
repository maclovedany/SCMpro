import { it, expect } from "vitest";
import { fetchItemDetail } from "@/lib/queries/items";
import { fetchEol } from "@/lib/queries/admin";

// CLAUDE.md 데이터 원칙: 앱/화면은 analytics 뷰만 읽는다 (raw·core 직접 조회 금지, D-056).
// supabase-js 체인을 흉내 내는 Proxy — schema() 호출만 기록하고 나머지는 체인을 잇는다.
function recorder() {
  const schemas: string[] = [];
  const chain: any = new Proxy({}, {
    get: (_, k) => {
      if (k === "then" || k === "data" || k === "error" || k === "count") return undefined;
      return (...a: unknown[]) => { if (k === "schema") schemas.push(String(a[0])); return chain; };
    },
  });
  return { sb: chain, schemas };
}

it("fetchItemDetail 은 raw·core 를 직접 읽지 않는다", async () => {
  const { sb, schemas } = recorder();
  await fetchItemDetail(sb, "556K59129");
  expect(schemas.length).toBeGreaterThan(0);
  expect(schemas.filter(s => s === "raw" || s === "core")).toEqual([]);
});

it("fetchEol 은 raw·core 를 직접 읽지 않는다", async () => {
  const { sb, schemas } = recorder();
  await fetchEol(sb);
  expect(schemas.length).toBeGreaterThan(0);
  expect(schemas.filter(s => s === "raw" || s === "core")).toEqual([]);
});
