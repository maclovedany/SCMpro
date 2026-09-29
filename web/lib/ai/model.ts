/** AI 모델 기본값과 모델별 호출 조건 (R-AI-01, D-073). 모델은 설정값 `ai_model` — 여기 값은 설정이 없을 때만 쓴다. */
export const DEFAULT_AI_MODEL = "gpt-5.6-luna";
export type Effort = "none" | "minimal" | "low";
/** 추론 강도: chat = 도구를 쓰는 대화, aux = 주제 분류·요약.
 *  1세대 gpt-5(gpt-5 · mini · nano)는 none 이 없어 low/minimal. 그 뒤 모델은 Chat Completions 에서 도구와 추론을 함께 쓸 수 없고 minimal 도 없어 none. */
export function limitsFor(model: string): { chat: Effort; aux: Effort } {
  return /^gpt-5(-|$)/.test(model) ? { chat: "low", aux: "minimal" } : { chat: "none", aux: "none" };
}
