/** AI Agent 대화 루프 (R-AI-01/03/04/05/07). OpenAI Chat Completions + function calling, 최대 5라운드. */
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { toolSpecs, runTool } from "./tools";
type SB = SupabaseClient<Database>;
export const TOPICS = ["예측", "재고", "발주", "배정", "일정", "설정", "기타"] as const;
export const SYSTEM_PROMPT = `당신은 복합기 회사 SCM팀의 수요예측·발주 시스템(SCMpro) 안에 있는 AI 어시스턴트입니다.
규칙: (1) 시스템 데이터는 반드시 도구로 조회해 답하고, 조회한 수치(품목·월·값)를 근거로 함께 제시합니다. (2) 도구로 확인되지 않는 사실은 추정하지 말고 "시스템에서 확인되지 않습니다"라고 말합니다. (3) 한국어, 간결하게, 표가 유용하면 마크다운 표.
도메인: 회계연도 4월 시작(FY25=2025-04~2026-03). DoS = 월말재고 ÷ 6개월 평균사용량 × 30. 발주량 = 목표재고 + 필요월 예측 + 추가수요 − 필요월 기초재고 → Flex(제출 OL ±20/30%) → MOQ 올림. 가용재고 = 현재고 − 임시배정 − 확정배정 − 승인대기. 임시배정은 30일 후 자동 만료. 부품은 HOC(최종 발주 코드) 기준.
현재 사용자의 권한 범위 안의 데이터만 보입니다.`;
export type ChatResult = { answer: string; toolTrace: { name: string; args: Record<string, unknown> }[]; tokensIn: number; tokensOut: number; error?: string };
export async function runChat(client: OpenAI, model: string, sb: SB, history: { role: "user" | "assistant"; content: string }[], summary: string | null, pageContext: string | null, userMsg: string): Promise<ChatResult> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "system", content: SYSTEM_PROMPT + (summary ? `\n\n[이전 대화 요약]\n${summary}` : "") + (pageContext ? `\n\n[사용자가 보고 있는 화면] ${pageContext}` : "") }, ...history, { role: "user", content: userMsg }];
  const trace: ChatResult["toolTrace"] = []; let tin = 0, tout = 0;
  for (let round = 0; round < 6; round++) {
    const res = await client.chat.completions.create({ model, messages, tools: toolSpecs(), tool_choice: round < 5 ? "auto" : "none", max_completion_tokens: 4000 });
    tin += res.usage?.prompt_tokens ?? 0; tout += res.usage?.completion_tokens ?? 0;
    const msg = res.choices[0].message;
    if (msg.tool_calls?.length) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        let args: Record<string, unknown> = {}; try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
        trace.push({ name: tc.function.name, args });
        const out = await runTool(sb, tc.function.name, args);
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out ?? null).slice(0, 20000) });
      }
      continue;
    }
    return { answer: msg.content ?? "", toolTrace: trace, tokensIn: tin, tokensOut: tout };
  }
  return { answer: "도구 호출 한도를 초과했습니다. 질문을 나눠서 다시 물어봐 주세요.", toolTrace: trace, tokensIn: tin, tokensOut: tout, error: "tool_loop_limit" };
}
export async function classifyTopic(client: OpenAI, model: string, question: string): Promise<string> {
  try {
    const r = await client.chat.completions.create({ model, messages: [{ role: "system", content: `질문의 주제를 다음 중 하나로만 답하세요: ${TOPICS.join(", ")}. 단어 하나만.` }, { role: "user", content: question.slice(0, 500) }], max_completion_tokens: 20 });
    const t = (r.choices[0].message.content ?? "").trim(); return (TOPICS as readonly string[]).find(x => t.includes(x)) ?? "기타";
  } catch { return "기타"; }
}
export async function summarize(client: OpenAI, model: string, prev: string | null, msgs: { role: string; content: string | null }[]): Promise<string> {
  const r = await client.chat.completions.create({ model, messages: [{ role: "system", content: "다음 대화를 이후 맥락 유지를 위해 8줄 이내 한국어로 요약하세요. 품목 코드·수치·사용자 결정은 유지." }, { role: "user", content: (prev ? `[기존 요약]\n${prev}\n\n` : "") + msgs.map(m => `${m.role}: ${m.content ?? ""}`).join("\n").slice(0, 12000) }], max_completion_tokens: 600 });
  return r.choices[0].message.content ?? prev ?? "";
}
export function parseTopic(text: string): string { const t = text.trim(); return (TOPICS as readonly string[]).find(x => t.includes(x)) ?? "기타"; }
