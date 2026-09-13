import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { runChat, classifyTopic, summarize } from "@/lib/ai/chat";
export const maxDuration = 120;
export async function POST(req: Request) {
  const p = await getProfile(); if (!p) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY 가 설정되지 않았습니다 (R-AI-01)" }, { status: 503 });
  const body = await req.json().catch(() => ({})) as { conversation_id?: string; message?: string; page_context?: string };
  const text = (body.message ?? "").trim(); if (!text) return NextResponse.json({ error: "메시지가 비어 있습니다" }, { status: 400 });
  const sb = await createServerSupabase();
  const { data: ms } = await sb.schema("app").from("system_settings").select("value").eq("key", "ai_model").maybeSingle();
  const model = (typeof ms?.value === "string" ? ms.value : null) ?? "gpt-5-nano";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // 대화
  let convId = body.conversation_id ?? null; let summary: string | null = null;
  if (convId) { const { data } = await sb.schema("app").from("ai_conversation").select("id,summary").eq("id", convId).maybeSingle(); if (!data) convId = null; else summary = data.summary; }
  if (!convId) { const { data, error } = await sb.schema("app").from("ai_conversation").insert({ user_id: p.user_id, title: text.slice(0, 60), page_context: body.page_context ?? null }).select("id").single(); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); convId = data.id; }
  const { data: hist } = await sb.schema("app").from("ai_message").select("id,role,content").eq("conversation_id", convId).in("role", ["user", "assistant"]).order("id", { ascending: false }).limit(20);
  const history = (hist ?? []).reverse().map(m => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }));
  await sb.schema("app").from("ai_message").insert({ conversation_id: convId, role: "user", content: text });
  const t0 = Date.now();
  let result; try { result = await runChat(client, model, sb, history, summary, body.page_context ?? null, text); }
  catch (e) { const err = e instanceof Error ? e.message : String(e); await sb.schema("app").from("ai_message").insert({ conversation_id: convId, role: "assistant", content: null, error: err.slice(0, 500), latency_ms: Date.now() - t0 }); return NextResponse.json({ conversation_id: convId, error: `AI 호출 실패: ${err}` }, { status: 502 }); }
  const topic = await classifyTopic(client, model, text);
  await sb.schema("app").from("ai_message").update({ topic }).eq("conversation_id", convId).eq("role", "user").eq("content", text).order("id", { ascending: false }).limit(1);
  for (const t of result.toolTrace) await sb.schema("app").from("ai_message").insert({ conversation_id: convId, role: "tool", tool_name: t.name, tool_args: t.args as never, content: null });
  await sb.schema("app").from("ai_message").insert({ conversation_id: convId, role: "assistant", content: result.answer, tokens_in: result.tokensIn, tokens_out: result.tokensOut, latency_ms: Date.now() - t0, error: result.error ?? null, topic });
  await sb.schema("app").from("ai_conversation").update({ updated_at: new Date().toISOString() }).eq("id", convId);
  // 요약 (R-AI-04): 사용자/어시스턴트 메시지 30개 초과 시 오래된 것 요약
  const { count } = await sb.schema("app").from("ai_message").select("id", { count: "exact", head: true }).eq("conversation_id", convId).in("role", ["user", "assistant"]);
  if ((count ?? 0) > 30) { const { data: old } = await sb.schema("app").from("ai_message").select("role,content").eq("conversation_id", convId).in("role", ["user", "assistant"]).order("id").limit((count ?? 0) - 20); const s = await summarize(client, model, summary, old ?? []); await sb.schema("app").from("ai_conversation").update({ summary: s }).eq("id", convId); }
  return NextResponse.json({ conversation_id: convId, answer: result.answer, topic, tool_trace: result.toolTrace, latency_ms: Date.now() - t0 });
}
