"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { X, Plus, Send, Wrench } from "lucide-react";
import { useAiPanel } from "./AiPanelProvider";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
type Msg = { id: number | string; role: string; content: string | null; tool_name?: string | null; created_at?: string | null; pending?: boolean; error?: string | null };
type Conv = { id: string; title: string | null; updated_at: string | null };
/** R-AI-02: 우측 사이드 패널 — 좌측 경계 드래그 리사이즈, 대화 목록, 메시지, 입력 */
export function AiPanel() {
  const { open, setOpen, width, setWidth, conversationId, setConversationId } = useAiPanel();
  const pathname = usePathname();
  const [convs, setConvs] = useState<Conv[]>([]); const [msgs, setMsgs] = useState<Msg[]>([]); const [input, setInput] = useState(""); const [busy, setBusy] = useState(false); const [showList, setShowList] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null); const dragging = useRef(false);
  const sb = createClient();
  const loadConvs = useCallback(async () => { const { data } = await sb.schema("app").from("ai_conversation").select("id,title,updated_at").order("updated_at", { ascending: false }).limit(30); setConvs((data ?? []) as Conv[]); }, [sb]);
  const loadMsgs = useCallback(async (id: string | null) => { if (!id) { setMsgs([]); return; } const { data } = await sb.schema("app").from("ai_message").select("id,role,content,tool_name,created_at,error").eq("conversation_id", id).order("id"); setMsgs((data ?? []) as Msg[]); }, [sb]);
  useEffect(() => { if (open) { loadConvs(); loadMsgs(conversationId); } }, [open, conversationId, loadConvs, loadMsgs]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) setWidth(window.innerWidth - e.clientX); };
    const up = () => { dragging.current = false; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [setWidth]);
  const send = async () => {
    const text = input.trim(); if (!text || busy) return;
    setInput(""); setBusy(true);
    setMsgs(m => [...m, { id: `u-${Date.now()}`, role: "user", content: text }, { id: "pending", role: "assistant", content: null, pending: true }]);
    try {
      const r = await fetch("/api/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversation_id: conversationId, message: text, page_context: pathname }) });
      const d = await r.json();
      if (!r.ok) { setMsgs(m => m.filter(x => x.id !== "pending").concat({ id: `e-${Date.now()}`, role: "assistant", content: null, error: d.error ?? "오류" })); }
      else { if (d.conversation_id !== conversationId) setConversationId(d.conversation_id); await loadMsgs(d.conversation_id); loadConvs(); }
    } catch (e) { setMsgs(m => m.filter(x => x.id !== "pending").concat({ id: `e-${Date.now()}`, role: "assistant", content: null, error: String(e) })); }
    finally { setBusy(false); }
  };
  if (!open) return null;
  return (
    <aside className="fixed right-0 top-0 z-40 flex h-screen flex-col border-l bg-background shadow-xl" style={{ width }} data-testid="ai-panel" aria-label="AI Agent 패널">
      <div className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40" data-testid="ai-resize-handle" onMouseDown={() => { dragging.current = true; document.body.style.userSelect = "none"; }} title="드래그하여 너비 조절" />
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="text-sm font-semibold">AI Agent <span className="font-normal text-muted-foreground">gpt-5-nano</span></span>
        <Button size="sm" variant="ghost" onClick={() => setShowList(!showList)} aria-label="대화 목록">{showList ? "채팅" : `대화 (${convs.length})`}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setConversationId(null); setMsgs([]); setShowList(false); }} aria-label="새 대화"><Plus className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpen(false)} aria-label="닫기"><X className="h-4 w-4" /></Button>
      </div>
      {showList ? (
        <ul className="flex-1 overflow-auto p-2 text-sm">{convs.map(c => <li key={c.id}><button type="button" className={cn("w-full rounded px-2 py-1.5 text-left hover:bg-muted", c.id === conversationId && "bg-muted font-medium")} onClick={() => { setConversationId(c.id); setShowList(false); }}>{c.title ?? "(제목 없음)"}<div className="text-xs text-muted-foreground">{fmtDateTime(c.updated_at)}</div></button></li>)}{convs.length === 0 && <li className="p-3 text-muted-foreground">대화 없음</li>}</ul>
      ) : (
        <div className="flex-1 space-y-3 overflow-auto p-3 text-sm" data-testid="ai-messages">
          {msgs.length === 0 && <div className="rounded-md bg-muted/40 p-3 text-muted-foreground">예: &ldquo;556K59129 재고랑 예측 알려줘&rdquo;, &ldquo;이번 달 발주 계획 품절 위험은?&rdquo;, &ldquo;내 승인 대기 뭐 있어?&rdquo;<br />답변은 시스템 데이터를 도구로 조회한 근거와 함께 제공됩니다 (R-AI-05/07).</div>}
          {msgs.map(m => m.role === "tool" ? <div key={m.id} className="flex items-center gap-1 text-xs text-muted-foreground"><Wrench className="h-3 w-3" />도구 {m.tool_name}</div>
            : <div key={m.id} className={cn("rounded-lg px-3 py-2", m.role === "user" && "whitespace-pre-wrap", m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-muted", m.error && "border border-red-300 bg-red-50 text-red-700")} data-role={m.role}>
                {m.pending ? <span className="animate-pulse">생각 중…</span> : m.error ? `오류: ${m.error}` : m.role === "assistant" ? <div className="ai-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content ?? ""}</ReactMarkdown></div> : m.content}
              </div>)}
          <div ref={bottomRef} />
        </div>)}
      <div className="border-t p-2">
        <div className="flex gap-2"><textarea name="ai-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} placeholder="질문을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)" className="flex-1 resize-none rounded-md border bg-background px-2 py-1 text-sm" disabled={busy} />
          <Button size="sm" onClick={send} disabled={busy || !input.trim()} aria-label="전송"><Send className="h-4 w-4" /></Button></div>
        <div className="mt-1 text-[10px] text-muted-foreground">현재 화면: {pathname} · 대화는 저장되며 관리자가 통계를 봅니다 (R-AI-03/06)</div>
      </div>
    </aside>
  );
}
