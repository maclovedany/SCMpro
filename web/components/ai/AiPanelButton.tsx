"use client";
import { Sparkles } from "lucide-react";
import { useAiPanel } from "./AiPanelProvider";
import { Button } from "@/components/ui/button";
export function AiPanelButton() {
  const { open, setOpen } = useAiPanel();
  return <Button size="sm" variant={open ? "default" : "outline"} onClick={() => setOpen(!open)} aria-pressed={open} data-testid="ai-agent-btn"><Sparkles className="mr-1 h-4 w-4" />AI Agent</Button>;
}
