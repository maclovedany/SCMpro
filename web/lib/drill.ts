/** 드릴다운 href 빌더 (R-UI-01). 정의된 값만, 키 정렬 → URL 안정 */
export function drillHref(base: string, filters: Record<string, string | number | boolean | undefined>): string {
  const q = Object.keys(filters).sort().filter(k => filters[k] !== undefined && filters[k] !== "")
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(filters[k]))}`).join("&");
  return q ? `${base}?${q}` : base;
}
