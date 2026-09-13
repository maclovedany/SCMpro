/** Supabase 일시 오류 재시도: PGRST303(JWT issued at future — 토큰 발급 직후 서버 시계 차이) 등 */
export async function withRetry<T extends { error: { code?: string; message?: string } | null }>(fn: () => PromiseLike<T>, tries = 3): Promise<T> {
  let last: T | undefined;
  for (let i = 0; i < tries; i++) {
    last = await fn();
    const c = last.error?.code ?? ""; const m = last.error?.message ?? "";
    if (!last.error || !(c === "PGRST303" || m.includes("issued at future") || m.includes("fetch failed"))) return last;
    await new Promise(r => setTimeout(r, 700 * (i + 1)));
  }
  return last!;
}
