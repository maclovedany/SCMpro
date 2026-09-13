"use client";
import { createContext, startTransition, useCallback, useContext, useEffect, useState } from "react";
type Ctx = { open: boolean; setOpen: (v: boolean) => void; width: number; setWidth: (w: number) => void; conversationId: string | null; setConversationId: (id: string | null) => void };
const AiCtx = createContext<Ctx | null>(null);
const MIN = 320; const key = "scm.aiPanel";
/** R-AI-02: 우측 패널 상태 — 열림·너비·현재 대화를 localStorage 에 사용자별로 기억 */
export function AiPanelProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpenState] = useState(false); const [width, setWidthState] = useState(420); const [conversationId, setConvState] = useState<string | null>(null);
  // SSR 과 첫 클라이언트 렌더를 맞추기 위해 마운트 후 1회만 localStorage 를 읽는다 (setState 는 startTransition 안에서)
  useEffect(() => { if (hydrated) return; let s: { open?: boolean; width?: number; conversationId?: string } = {}; try { s = JSON.parse(localStorage.getItem(key) ?? "{}"); } catch {}
    startTransition(() => { if (typeof s.open === "boolean") setOpenState(s.open); if (typeof s.width === "number") setWidthState(s.width); if (typeof s.conversationId === "string") setConvState(s.conversationId); setHydrated(true); }); }, [hydrated]);
  const persist = useCallback((patch: Record<string, unknown>) => { try { const s = JSON.parse(localStorage.getItem(key) ?? "{}"); localStorage.setItem(key, JSON.stringify({ ...s, ...patch })); } catch {} }, []);
  const setOpen = useCallback((v: boolean) => { setOpenState(v); persist({ open: v }); }, [persist]);
  const setWidth = useCallback((w: number) => { const max = Math.floor(window.innerWidth * 0.7); const c = Math.min(max, Math.max(MIN, w)); setWidthState(c); persist({ width: c }); }, [persist]);
  const setConversationId = useCallback((id: string | null) => { setConvState(id); persist({ conversationId: id }); }, [persist]);
  return <AiCtx.Provider value={{ open, setOpen, width, setWidth, conversationId, setConversationId }}>{children}</AiCtx.Provider>;
}
export const useAiPanel = () => { const c = useContext(AiCtx); if (!c) throw new Error("AiPanelProvider missing"); return c; };
