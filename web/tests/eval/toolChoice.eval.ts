/** 도구 선택 평가: 역할별로 실제로 물을 만한 질문에 실제 모델이 기대한 도구를 고르는지 (첫 호출만 본다 — 도구는 실행하지 않는다) */
import { it, expect, describe } from "vitest";
import OpenAI from "openai";
import { toolSpecs, toolsForRole } from "@/lib/ai/tools";
import { systemPrompt } from "@/lib/ai/chat";
import { DEFAULT_AI_MODEL, limitsFor } from "@/lib/ai/model";
import type { Role } from "@/lib/auth/roles";
import { ENV } from "./env";
type Case = { q: string; page?: string; any: string[] };
const COMMON: Case[] = [
  { q: "강제 배정 화면의 품목한도잔여가 뭐야?", page: "/allocation/force", any: ["get_help"] },
  { q: "오늘 내가 처리할 게 뭐야?", page: "/dashboard", any: ["get_my_tasks"] },
  { q: "긴급발주는 어디서 요청해?", page: "/dashboard", any: ["get_help"] },
];
const CASES: Record<Role, Case[]> = {
  item_manager: [...COMMON,
    { q: "A등급 중 품절 위험 품목 보여줘", page: "/dashboard", any: ["list_stock_risks"] },
    { q: "목표 DoS 에 못 미치는 품목은 뭐가 있어?", page: "/items", any: ["list_stock_risks"] },
    { q: "556K59129 는 언제 재고가 마이너스 돼?", page: "/orders", any: ["get_item_projection"] },
    { q: "지연된 PO 몇 건이야? 공급처별로 알려줘", page: "/dashboard", any: ["list_inbound"] },
    { q: "더미 설정이 남은 품목이 몇 개야? 마지막 업로드는 언제였어?", page: "/upload", any: ["get_data_readiness"] },
    { q: "최근 예측은 언제 돌았고 AI 가 제안한 조정안은 뭐야?", page: "/forecast", any: ["get_forecast_runs"] }],
  scm_lead: [...COMMON,
    { q: "승인 대기 건 뭐 있어? 발주 계획이면 오버라이드한 품목도 알려줘", page: "/approvals", any: ["get_approvals"] },
    { q: "이번 발주 계획이 지난 계획이랑 뭐가 달라졌어?", page: "/orders", any: ["compare_order_plans"] },
    { q: "지금 심각한 AI 감시 경보는 몇 건이야?", page: "/agent", any: ["list_agent_events"] },
    { q: "Flex 범위 설정값이 지금 얼마야?", page: "/orders", any: ["get_settings"] },
    { q: "이 발주 계획 승인해줘", page: "/approvals", any: ["get_help", "get_approvals"] }],
  sales: [...COMMON,
    { q: "부족 수량이 큰 고객사는 어디야?", page: "/sales-orders/customers", any: ["get_customer_allocation"] },
    { q: "임시배정이 곧 만료되는 내 주문 있어?", page: "/sales-orders", any: ["list_sales_orders", "get_my_tasks"] },
    { q: "다음 달 수요자료 제출 마감 언제야? 우리 부서는 냈어?", page: "/schedule", any: ["get_submission_status"] },
    { q: "SO-E2E-001 주문은 언제 배정돼?", page: "/sales-orders", any: ["list_sales_orders"] },
    { q: "시스템 설정에서 Flex 범위를 30% 로 바꿔줘", page: "/dashboard", any: ["get_help"] }],
  biz_enable: [...COMMON,
    { q: "지금 강제 배정 얼마까지 가능해?", page: "/allocation/force", any: ["get_force_alloc"] },
    { q: "진행 중인 Bulkdeal 뭐 있어?", page: "/extra-demand", any: ["list_extra_demand"] },
    { q: "우선 배정 승인 대기 중인 건 있어?", page: "/allocation/priority", any: ["get_force_alloc", "get_my_tasks"] }],
  marketing: [...COMMON,
    { q: "용지 재고 얼마나 남았어?", page: "/dashboard", any: ["get_group_stock"] },
    { q: "내 담당 품목 중에 가용재고가 0 인 것은?", page: "/dashboard", any: ["get_group_stock"] },
    { q: "우리 부서 수요자료 제출했어?", page: "/schedule", any: ["get_submission_status", "get_my_tasks"] }],
  service: [...COMMON,
    { q: "내가 요청한 긴급발주 어디까지 왔어?", page: "/extra-demand", any: ["list_urgent_orders"] },
    { q: "지연된 긴급발주 있어?", page: "/dashboard", any: ["list_urgent_orders"] },
    { q: "기종 패밀리 중에 실적이 제일 높은 건 뭐야?", page: "/mc-plan", any: ["get_mc_totals", "search_mc_families"] },
    { q: "556K59129 재고랑 입고 예정 알려줘", page: "/items", any: ["get_item", "get_available_stock", "list_inbound"] }],
  admin: [...COMMON,
    { q: "이번 주 AI 질문은 몇 건이고 답변 실패는 몇 건이야?", page: "/admin/ai-stats", any: ["get_ai_usage"] },
    { q: "예측 자동 실행 켜져 있어?", page: "/admin/settings", any: ["get_settings"] },
    { q: "AI 감시 모드가 지금 뭐야?", page: "/agent", any: ["get_settings"] }],
};
const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
const model = process.env.AI_MODEL ?? DEFAULT_AI_MODEL;
describe.each(Object.keys(CASES) as Role[])("도구 선택 — %s", role => {
  it("질문마다 기대한 도구를 고른다", async () => {
    const ctx = { role, userId: "u", dept: null, name: "평가" }; const miss: string[] = []; const log: string[] = [];
    await Promise.all(CASES[role].map(async c => {
      const r = await client.chat.completions.create({ model, reasoning_effort: limitsFor(model).chat, max_completion_tokens: 2000, tools: toolSpecs(role), tool_choice: "auto",
        messages: [{ role: "system", content: systemPrompt(ctx) + (c.page ? `\n\n[사용자가 보고 있는 화면] ${c.page}` : "") }, { role: "user", content: c.q }] });
      const called = (r.choices[0].message.tool_calls ?? []).map(t => (t.type === "function" ? t.function.name : "?"));
      const ok = called.some(n => c.any.includes(n)) && called.every(n => toolsForRole(role).some(t => t.name === n));
      log.push(`${ok ? "OK  " : "MISS"} ${c.q} → ${called.join(", ") || "(도구 없이 답변)"}${ok ? "" : `  (기대: ${c.any.join(" | ")})`}`);
      if (!ok) miss.push(`${c.q} → ${called.join(", ") || "(없음)"}`);
    }));
    console.log(`[${role}] 도구 ${toolSpecs(role).length}개 · 질문 ${CASES[role].length}개 · 적중 ${CASES[role].length - miss.length}\n  ` + log.join("\n  "));
    expect(miss).toEqual([]);
  });
});
