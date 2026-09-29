/** 답변 표시 형식 (R-AI-08, D-074). 굵은 글씨 표시(**)를 걷어 낸다 — 한글 조사가 바로 붙으면(**31.4%**는) 마크다운 규칙상 굵게 처리되지 않고 별표가 그대로 보인다.
 *  코드(``` 블록, `인라인`) 안의 ** 는 건드리지 않는다. */
export function plainEmphasis(md: string): string {
  return md.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((part, i) => i % 2 === 1 ? part : part.replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, "$1")).join("");
}
