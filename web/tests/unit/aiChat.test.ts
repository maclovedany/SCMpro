import { it, expect } from "vitest";
import { parseTopic, TOPICS, SYSTEM_PROMPT, runChat, classifyTopic, summarize, limitsFor, DEFAULT_AI_MODEL } from "@/lib/ai/chat";
import { TOOLS, toolSpecs } from "@/lib/ai/tools";
it("parses topic robustly", () => { expect(parseTopic(" 재고 ")).toBe("재고"); expect(parseTopic("주제: 발주입니다")).toBe("발주"); expect(parseTopic("unknown")).toBe("기타"); expect(TOPICS.length).toBe(7); });
it("tool specs are valid function schemas", () => { const s = toolSpecs(); expect(s.length).toBe(TOOLS.length); for (const t of s) { expect(t.type).toBe("function"); expect(t.function.parameters).toHaveProperty("type", "object"); } expect(SYSTEM_PROMPT).toContain("도구"); });
// 추론 모델(gpt-5 계열)은 추론 토큰도 max_completion_tokens 에 포함된다 — 한도를 추론이 다 쓰면 본문이 빈 채 finish_reason=length 로 끝난다 (D-072)
type Req = { model: string; max_completion_tokens?: number; reasoning_effort?: string };
const fakeClient = (responses: { content: string | null; finish_reason: string }[]) => {
  const calls: Req[] = []; let i = 0;
  const client = { chat: { completions: { create: async (req: Req) => { calls.push(req); const r = responses[Math.min(i++, responses.length - 1)]; return { usage: { prompt_tokens: 10, completion_tokens: 20 }, choices: [{ finish_reason: r.finish_reason, message: { role: "assistant", content: r.content } }] }; } } } };
  return { client: client as never, calls };
};
it("chat call limits reasoning effort and leaves room for the answer", async () => {
  const { client, calls } = fakeClient([{ content: "답변", finish_reason: "stop" }]);
  const r = await runChat(client, "gpt-5-nano", {} as never, [], null, "/dashboard", "기준예측 정확도 설명해줘");
  expect(r.answer).toBe("답변"); expect(r.error).toBeUndefined();
  expect(calls[0].reasoning_effort).toBe("low"); expect(calls[0].max_completion_tokens).toBeGreaterThanOrEqual(8000);
});
it("empty answer is reported as an error, not saved as a blank reply", async () => {
  const { client } = fakeClient([{ content: "", finish_reason: "length" }]);
  const r = await runChat(client, "gpt-5-nano", {} as never, [], null, null, "질문");
  expect(r.error).toBe("empty_answer:length"); expect(r.answer.length).toBeGreaterThan(10);
});
it("topic classification and summary do not spend the budget on reasoning", async () => {
  const a = fakeClient([{ content: "예측", finish_reason: "stop" }]);
  expect(await classifyTopic(a.client, "gpt-5-nano", "WAPE 가 뭐야")).toBe("예측"); expect(a.calls[0].reasoning_effort).toBe("minimal");
  const b = fakeClient([{ content: "요약", finish_reason: "stop" }]);
  expect(await summarize(b.client, "gpt-5-nano", null, [{ role: "user", content: "질문" }])).toBe("요약"); expect(b.calls[0].reasoning_effort).toBe("minimal");
});
// gpt-5.1 이후 모델(gpt-5.6-luna 등)은 Chat Completions 에서 도구와 추론을 함께 쓸 수 없고 minimal 도 없다 → none (D-073)
it("newer models are called without reasoning, first-generation gpt-5 keeps low/minimal", async () => {
  expect(limitsFor("gpt-5.6-luna")).toEqual({ chat: "none", aux: "none" });
  for (const m of ["gpt-5-nano", "gpt-5-mini", "gpt-5"]) expect(limitsFor(m)).toEqual({ chat: "low", aux: "minimal" });
  const a = fakeClient([{ content: "답변", finish_reason: "stop" }]);
  await runChat(a.client, "gpt-5.6-luna", {} as never, [], null, null, "질문"); expect(a.calls[0].reasoning_effort).toBe("none"); expect(a.calls[0].max_completion_tokens).toBeGreaterThanOrEqual(8000);
  const b = fakeClient([{ content: "재고", finish_reason: "stop" }]);
  expect(await classifyTopic(b.client, "gpt-5.6-luna", "재고 몇 개야")).toBe("재고"); expect(b.calls[0].reasoning_effort).toBe("none");
  expect(DEFAULT_AI_MODEL).toBe("gpt-5.6-luna");
});
