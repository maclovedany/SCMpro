/** 화면 · 용어 도움말 (R-AI-09, D-081): 사용자 가이드·용어집에서 질문과 가까운 항목을 찾고, 메뉴의 위치와 볼 수 있는 역할을 알려 준다 */
import { HELP, type HelpEntry } from "./helpData";
import { MENU_GROUPS, ROLE_LABEL, type Role } from "@/lib/auth/roles";
const squash = (s: string) => s.toLowerCase().replace(/[\s·.,()\[\]{}"'`~!?:;\/\\|<>=+_-]+/g, "");
/** 질문을 낱말로 — 2글자 이상, 조사가 붙은 말은 끝 한 글자를 뗀 꼴도 함께 */
export function helpTerms(q: string): string[] {
  const out = new Set<string>();
  for (const w of q.toLowerCase().split(/[\s·.,()\[\]{}"'`~!?:;\/\\|<>=+]+/).filter(Boolean)) {
    const t = squash(w); if (t.length >= 2) out.add(t); if (t.length >= 3 && /[가-힣]$/.test(t)) out.add(t.slice(0, -1));
  }
  const whole = squash(q); if (whole.length >= 2 && whole.length <= 12) out.add(whole);
  return [...out];
}
export function searchHelp(q: string, limit = 4, entries: HelpEntry[] = HELP): { title: string; kind: string; text: string }[] {
  const terms = helpTerms(q); if (!terms.length) return [];
  const scored = entries.map(e => { const t = squash(e.title), b = squash(e.text); let s = 0;
    for (const k of terms) { if (t.includes(k)) s += 5 * k.length; const n = b.split(k).length - 1; if (n) s += Math.min(3, n) * k.length; }
    return { e, s: e.kind === "term" && terms.some(k => squash(e.title).startsWith(k)) ? s + 20 : s }; }).filter(x => x.s > 0).sort((a, b) => b.s - a.s || a.e.id - b.e.id);
  return scored.slice(0, limit).map(({ e }) => ({ title: e.title, kind: e.kind === "term" ? "용어" : "사용자 가이드", text: e.text.length > 1400 ? e.text.slice(0, 1400) + " …" : e.text }));
}
/** 메뉴 찾기: 이름이 질문에 들어 있는 메뉴. 이 역할에 보이는지도 함께 */
export function searchMenus(q: string, role: Role): { menu: string; group: string; path: string; visible_to_you: boolean; visible_to: string[] }[] {
  const terms = helpTerms(q);
  return MENU_GROUPS.flatMap(g => g.items.map(i => ({ g, i }))).filter(({ i }) => { const n = squash(i.label); return terms.some(k => n.includes(k) || (k.length >= 3 && k.includes(n))); })
    .map(({ g, i }) => ({ menu: i.label, group: g.label, path: i.href, visible_to_you: i.roles.includes(role), visible_to: i.roles.map(r => ROLE_LABEL[r]) }));
}
/** 이 역할에 보이는 메뉴 전체 (어디서 무엇을 하는지 안내할 때) */
export const menusFor = (role: Role) => MENU_GROUPS.flatMap(g => g.items.filter(i => i.roles.includes(role)).map(i => ({ menu: i.label, group: g.label, path: i.href })));
