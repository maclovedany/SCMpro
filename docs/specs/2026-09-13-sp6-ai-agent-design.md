# SP6 AI Agent 설계

작성: 2026-09-13 · 상태: **구현 완료** (D-025) · 근거: D-017, R-AI-01~07 · 선행: SP1~5 (도구가 예측·재고·발주·승인 데이터를 조회)

## 1. 목표
모든 화면 상단 "AI Agent" 버튼 → 우측 리사이즈 패널의 ChatGPT 형 채팅. gpt-5-nano 가 **도구 호출**로 시스템 데이터(품목·예측·가용재고·발주계획·승인함·정확도)를 조회해 근거와 함께 답한다. 사용자별 대화·메시지 저장, 맥락(최근 20턴 + 요약) 유지, 관리자 질문 통계.

## 2. DB (migration 20260913005000_ai.sql)
- `app.ai_conversation`(id, user_id, title, summary, page_context, created_at, updated_at) · `app.ai_message`(id, conversation_id, role user|assistant|tool, content, tool_name, tool_args jsonb, topic, tokens_in, tokens_out, latency_ms, error, created_at)
- RLS: 본인 대화만, admin 전체. `analytics.v_ai_stats_daily`(일·주제별 질문 수), `v_ai_stats_user`, `fn_ai_stats(days)` (카드용 jsonb).
- 주제 태그: 예측 / 재고 / 발주 / 배정 / 일정 / 설정 / 기타 (LLM 분류, R-AI-06).

## 3. API `POST /api/ai/chat` (서버, 사용자 세션)
입력 {conversation_id?, message, page_context}. 흐름: 대화 로드(요약 + 최근 20 메시지) → OpenAI chat.completions(model=settings.ai_model, tools) → tool_calls 실행(사용자 supabase 클라이언트 = RLS 그대로, R-AI-05) 최대 5라운드 → 답변 저장 → 주제 분류(같은 모델, 짧은 호출) → 30메시지 초과 시 오래된 것 요약(summary 갱신). 응답 {conversation_id, answer, topic, tool_trace}.
도구: `search_items(q)`, `get_item(code)`(마스터·설정·재고·DoS·분류), `get_item_forecast(code)`(최신 예측·챔피언), `get_available_stock(code)`, `get_order_plan(plan_ym?)`(최신 계획 요약·해당 품목 라인), `get_forecast_accuracy()`(최신 백테스트 총계), `list_pending_approvals()`, `get_schedule()`(다음 발주일·제출 현황).
시스템 프롬프트: 역할·규칙 ID·"모르면 모른다"(R-AI-07)·근거 수치 포함·한국어.

## 4. UI
- `AiPanelProvider`(전역 상태: open, width, conversationId) + Topbar 버튼 + `AiPanel`(우측 고정, 좌측 경계 드래그 리사이즈 320px~70vw, localStorage 기억, 본문은 `padding-right` 로 축소, R-AI-02). 대화 목록(새 대화·이전 대화), 메시지 스트림, 입력(Enter 전송), 도구 사용 표시, 오류 표시.
- `/admin/ai-stats`: 카드(총 질문, 오늘, 활성 사용자, 상위 주제) 드릴다운 → 메시지 목록(주제·사용자·기간 필터, 질문/답변 미리보기).

## 5. 완료 기준
1. 패널 열기/닫기/리사이즈/새로고침 후 유지 2. 질문 → 도구 호출(품목 재고) → 근거 포함 답변 저장 3. 같은 대화 후속 질문이 맥락 유지 4. 관리자 통계 카드·목록 5. 테스트 통과
