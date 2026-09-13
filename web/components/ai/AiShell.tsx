"use client";
import { AiPanel } from "./AiPanel";
import { useAiPanel } from "./AiPanelProvider";
/** 패널이 열리면 본문을 패널 너비만큼 줄인다 (R-AI-02) */
export function AiShell({ children }: { children: React.ReactNode }) {
  const { open, width } = useAiPanel();
  return <><div style={{ paddingRight: open ? width : 0 }} className="transition-[padding] duration-150">{children}</div><AiPanel /></>;
}
