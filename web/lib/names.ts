/** 표시 이름 (D-075, R-UI-17): 시스템에 저장된 익명 제품군·기종 이름을 실제 이름으로 바꿔 보여 준다. 품목코드·IOT 는 바꾸지 않는다. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
export type AliasKind = "family" | "codename";
export type AliasRow = { kind: string; anon: string; anon_key: string; real_name: string };
export type AliasMap = { exact: Map<string, string>; loose: Map<string, string> };
const k = (kind: string, v: string) => `${kind}\u0000${v}`;
export function aliasMap(rows: AliasRow[]): AliasMap {
  const exact = new Map<string, string>(); const loose = new Map<string, string>();
  for (const r of rows) { exact.set(k(r.kind, r.anon), r.real_name); if (!loose.has(k(r.kind, r.anon_key))) loose.set(k(r.kind, r.anon_key), r.real_name); }
  return { exact, loose };
}
/** 같은 표기 → 대소문자 무시 → 없으면 받은 값 그대로 */
export function realName<T extends string | null | undefined>(m: AliasMap, kind: AliasKind, anon: T): T | string {
  if (anon == null) return anon;
  return m.exact.get(k(kind, anon)) ?? m.loose.get(k(kind, anon.trim().toUpperCase())) ?? anon;
}
/** 종류별로 나눠 읽는다 — 한 번에 1,000행 제한 (제품군 약 800쌍, 기종 약 270쌍) */
export async function fetchAliasMap(sb: SupabaseClient<Database>): Promise<AliasMap> {
  const read = async (kind: AliasKind) => (await sb.schema("app").from("name_alias").select("kind,anon,anon_key,real_name").eq("kind", kind).limit(1000)).data ?? [];
  const [f, c] = await Promise.all([read("family"), read("codename")]);
  return aliasMap([...f, ...c]);
}
