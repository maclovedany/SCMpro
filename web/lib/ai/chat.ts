/** AI Agent 대화 루프 (R-AI-01/03/04/05/07). OpenAI Chat Completions + function calling, 최대 5라운드. */
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { toolSpecs, runTool, hiddenFor, type ToolCtx } from "./tools";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { limitsFor } from "./model";
import { plainEmphasis } from "./format";
export { limitsFor, DEFAULT_AI_MODEL } from "./model";
type SB = SupabaseClient<Database>;
export const TOPICS = ["예측", "재고", "발주", "배정", "일정", "설정", "기타"] as const;
export const SYSTEM_PROMPT = `당신은 복합기 회사 SCM팀의 수요예측·발주 시스템(SCMpro) 안에 있는 AI 어시스턴트입니다.
규칙: (1) 시스템 데이터는 반드시 도구로 조회해 답하고, 조회한 수치(품목·월·값)를 근거로 함께 제시합니다. (2) 도구로 확인되지 않는 사실은 추정하지 말고 "시스템에서 확인되지 않습니다"라고 말합니다. (3) 한국어, 간결하게, 표가 유용하면 마크다운 표. (4) 굵은 글씨(**)·기울임(*) 같은 강조 표시는 쓰지 않습니다. 구분이 필요하면 소제목·목록·표를 씁니다.
도메인: 회계연도 4월 시작(FY25=2025-04~2026-03). DoS = 월말재고 ÷ 6개월 평균사용량 × 30. 발주량 = 목표재고 + 필요월 예측 + 추가수요 − 필요월 기초재고 → Flex(제출 OL ±20/30%) → MOQ 올림. 가용재고 = 현재고 − 임시배정 − 확정배정 − 승인대기. 임시배정은 30일 후 자동 만료. 부품은 HOC(최종 발주 코드) 기준. 카테고리 표기: SPAREPARTS(부품) · CONSUMABLE(소모품) · OPTION(옵션) · MC(기종, 그 안에서 DT · GC · PRT 로 구분).
기종(MC): 자료 단위는 Family(회사가 정한 약자, 예: 화면의 Family 열) × 월의 Sales OL · SCM OL · 실적이고 Item Code 는 익명 코드입니다. Family · 패밀리 · 기종 · MC 에 대한 질문이나 화면이 /mc-plan · /forecast/mc · /items?category=MC 일 때는 search_mc_families · get_mc_family · get_mc_totals 를 씁니다. search_items 는 품목(SPAREPARTS · CONSUMABLE · OPTION)용이라 Family 약자는 나오지 않습니다. 전임기 → 후속기는 같은 계열의 이전 · 다음 기종입니다.
현재 사용자의 권한 범위 안의 데이터만 보입니다.
조회만 합니다: 승인 · 반려 · 배정 · 발주 확정 · 주문 등록 · 설정 변경처럼 데이터를 바꾸는 일은 하지 않습니다. 그런 요청을 받으면 get_help 로 어느 화면에서 어떻게 하는지 찾아 경로(예: /approvals)와 함께 안내하고, 필요한 근거 수치는 조회해서 보여 줍니다.
용어 뜻 · 화면 사용법 · "어디서 해?" 질문은 get_help 를 씁니다. 도구 결과에 where 가 있으면 답변 끝에 그 화면을 알려 줍니다.`;
/** 역할을 넣은 시스템 프롬프트 — 도구도 이 역할에 맞는 것만 넘긴다 (D-081) */
export const systemPrompt = (ctx?: ToolCtx) => SYSTEM_PROMPT + (ctx ? `\n\n[질문한 사용자] 역할: ${ROLE_LABEL[ctx.role]}${ctx.name ? ` · 이름: ${ctx.name}` : ""}. "내", "우리 부서"는 이 사용자를 뜻합니다.${hiddenFor(ctx.role).length ? ` 이 역할이 볼 수 없는 자료: ${hiddenFor(ctx.role).join(", ")}. 이 자료를 물으면 다른 지표로 대신 답하지 말고, 이 역할에서는 볼 수 없으니 SCM팀(품목담당자 · 팀장)이나 관리자에게 문의하라고 답합니다.` : ""}` : "");
/** 추론 토큰은 max_completion_tokens 에 포함된다. 기본 추론 강도로는 한도를 추론이 다 써서 본문이 비는 일이 생긴다 (D-072).
 *  추론 강도는 모델별로 고정(limitsFor, D-073)하고 본문 몫을 남긴다. */
const CHAT_MAX_TOKENS = 8000;
const EMPTY_ANSWER = "답변을 만들지 못했습니다. 질문을 더 짧게 나눠서 다시 물어봐 주세요.";
export type ChatResult = { answer: string; toolTrace: { name: string; args: Record<string, unknown> }[]; tokensIn: number; tokensOut: number; error?: string };
export async function runChat(client: OpenAI, model: string, sb: SB, history: { role: "user" | "assistant"; content: string }[], summary: string | null, pageContext: string | null, userMsg: string, ctx?: ToolCtx): Promise<ChatResult> {
  const who: ToolCtx = ctx ?? { role: "admin", userId: "", dept: null, name: null };   // ctx 없이 부르는 것은 테스트뿐
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt(ctx) + (summary ? `\n\n[이전 대화 요약]\n${summary}` : "") + (pageContext ? `\n\n[사용자가 보고 있는 화면] ${pageContext}` : "") }, ...history, { role: "user", content: userMsg }];
  const trace: ChatResult["toolTrace"] = []; let tin = 0, tout = 0;
  for (let round = 0; round < 6; round++) {
    const res = await client.chat.completions.create({ model, messages, tools: toolSpecs(who.role), tool_choice: round < 5 ? "auto" : "none", reasoning_effort: limitsFor(model).chat, max_completion_tokens: CHAT_MAX_TOKENS });
    tin += res.usage?.prompt_tokens ?? 0; tout += res.usage?.completion_tokens ?? 0;
    const msg = res.choices[0].message;
    if (msg.tool_calls?.length) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        let args: Record<string, unknown> = {}; try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
        trace.push({ name: tc.function.name, args });
        const out = await runTool(sb, tc.function.name, args, who);
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out ?? null).slice(0, 20000) });
      }
      continue;
    }
    const answer = plainEmphasis(msg.content ?? "").trim();
    if (!answer) return { answer: EMPTY_ANSWER, toolTrace: trace, tokensIn: tin, tokensOut: tout, error: `empty_answer:${res.choices[0].finish_reason}` };
    return { answer, toolTrace: trace, tokensIn: tin, tokensOut: tout };
  }
  return { answer: "도구 호출 한도를 초과했습니다. 질문을 나눠서 다시 물어봐 주세요.", toolTrace: trace, tokensIn: tin, tokensOut: tout, error: "tool_loop_limit" };
}
export async function classifyTopic(client: OpenAI, model: string, question: string): Promise<string> {
  try {
    const r = await client.chat.completions.create({ model, messages: [{ role: "system", content: `질문의 주제를 다음 중 하나로만 답하세요: ${TOPICS.join(", ")}. 단어 하나만.` }, { role: "user", content: question.slice(0, 500) }], reasoning_effort: limitsFor(model).aux, max_completion_tokens: 50 });
    const t = (r.choices[0].message.content ?? "").trim(); return (TOPICS as readonly string[]).find(x => t.includes(x)) ?? "기타";
  } catch { return "기타"; }
}
export async function summarize(client: OpenAI, model: string, prev: string | null, msgs: { role: string; content: string | null }[]): Promise<string> {
  const r = await client.chat.completions.create({ model, messages: [{ role: "system", content: "다음 대화를 이후 맥락 유지를 위해 8줄 이내 한국어로 요약하세요. 품목 코드·수치·사용자 결정은 유지." }, { role: "user", content: (prev ? `[기존 요약]\n${prev}\n\n` : "") + msgs.map(m => `${m.role}: ${m.content ?? ""}`).join("\n").slice(0, 12000) }], reasoning_effort: limitsFor(model).aux, max_completion_tokens: 800 });
  return r.choices[0].message.content ?? prev ?? "";
}
export function parseTopic(text: string): string { const t = text.trim(); return (TOPICS as readonly string[]).find(x => t.includes(x)) ?? "기타"; }
