import { it, expect } from "vitest";
import { parseTopic, TOPICS, SYSTEM_PROMPT } from "@/lib/ai/chat";
import { TOOLS, toolSpecs } from "@/lib/ai/tools";
it("parses topic robustly", () => { expect(parseTopic(" 재고 ")).toBe("재고"); expect(parseTopic("주제: 발주입니다")).toBe("발주"); expect(parseTopic("unknown")).toBe("기타"); expect(TOPICS.length).toBe(7); });
it("tool specs are valid function schemas", () => { const s = toolSpecs(); expect(s.length).toBe(TOOLS.length); for (const t of s) { expect(t.type).toBe("function"); expect(t.function.parameters).toHaveProperty("type", "object"); } expect(SYSTEM_PROMPT).toContain("도구"); });
