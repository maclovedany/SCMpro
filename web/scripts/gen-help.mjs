// 도움말 자료 생성 (R-AI-09, D-081): docs 의 사용자 가이드·용어집 → web/lib/ai/helpData.ts
// 배포본(Vercel, Root = web)에는 docs 폴더가 없으므로 빌드 전에 만들어 저장소에 넣는다. 실행: npm run gen:help
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const clean = s => s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g, "(이메일)").replace(/`/g, "").replace(/\*\*/g, "").replace(/[ \t]+/g, " ").trim();
export function build(guide, glossary) {
  const out = [];
  // 사용자 가이드: 제목(##, ###) 단위
  let cur = null, parent = "";
  for (const line of guide.split("\n")) {
    const h = /^(#{2,3}) (.+)$/.exec(line);
    if (h) { if (cur) out.push(cur); if (h[1] === "##") parent = clean(h[2]); cur = { kind: "guide", title: h[1] === "##" ? clean(h[2]) : `${parent} › ${clean(h[2])}`, text: "" }; continue; }
    if (cur && line.trim()) cur.text += (cur.text ? "\n" : "") + clean(line);
  }
  if (cur) out.push(cur);
  // 용어집: 표의 행 단위
  for (const line of glossary.split("\n")) {
    const m = /^\| \*\*(.+?)\*\* \| (.+?) \|(.*)\|\s*$/.exec(line);      // 비고 칸이 비어 있는 행도 읽는다
    if (m) out.push({ kind: "term", title: clean(m[1]), text: clean(m[2]) + (clean(m[3]) ? ` (${clean(m[3])})` : "") });
  }
  return out.filter(e => e.text).map((e, i) => ({ id: i + 1, ...e }));
}
export function render(entries) {
  return "/** 도움말 자료 — 자동 생성(npm run gen:help). 직접 고치지 말고 docs/08-user-guide.md · docs/00-glossary.md 를 고친 뒤 다시 만든다 (D-081) */\n"
    + "export type HelpEntry = { id: number; kind: \"guide\" | \"term\"; title: string; text: string };\n"
    + "export const HELP: HelpEntry[] = " + JSON.stringify(entries, null, 1) + ";\n";
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const e = build(fs.readFileSync(path.join(ROOT, "docs/08-user-guide.md"), "utf8"), fs.readFileSync(path.join(ROOT, "docs/00-glossary.md"), "utf8"));
  fs.writeFileSync(path.join(ROOT, "web/lib/ai/helpData.ts"), render(e));
  console.log(`helpData.ts: ${e.length}개 (가이드 ${e.filter(x => x.kind === "guide").length} · 용어 ${e.filter(x => x.kind === "term").length})`);
}
