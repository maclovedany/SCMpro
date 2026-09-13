# 규칙: AI Agent (R-AI)

최종 갱신: 2026-09-13 · 출처: D-017, D-025 · 구현: web/lib/ai/{tools,chat}.ts, app/api/ai/chat, components/ai/*, migrations/20260913005000_ai.sql, 화면 /admin/ai-stats

| ID | 규칙 |
|---|---|
| R-AI-01 | LLM = OpenAI Chat Completions, 모델은 설정값 `ai_model` (기본 `gpt-5-nano`). API 키는 서버 환경변수 `OPENAI_API_KEY` 만, 클라이언트 노출 금지. |
| R-AI-02 | 모든 화면 상단(Topbar)에 **AI Agent** 버튼. 클릭 시 **화면 우측 사이드 패널**로 열리는 ChatGPT 형 채팅(대화 목록 + 메시지 스트림 + 입력). 패널 너비는 **좌측 경계를 마우스 드래그**해 자유롭게 조절(최소 320px ~ 최대 화면의 70%), 너비·열림 상태는 사용자별로 기억(localStorage). 본문 화면은 패널 너비만큼 줄어들며 계속 사용 가능. 현재 화면 컨텍스트(경로·품목코드 등)를 첫 메시지에 첨부. |
| R-AI-03 | 대화는 사용자별로 `app.ai_conversation`(id, user, title, created/updated) · `app.ai_message`(conversation, role, content, tool_calls, tokens, created) 에 저장. 사용자는 자기 대화만, 관리자는 전체 조회. |
| R-AI-04 | 맥락 유지: 요청에 같은 대화의 최근 20턴 + 그 이전은 요약(summary 컬럼, 갱신 시 재요약)을 포함. |
| R-AI-05 | 에이전트는 시스템 데이터를 **도구(function calling)** 로만 조회 (품목 조회, 예측/발주 근거, 재고, 승인 상태). RLS 는 호출자 권한 그대로 적용 — 사용자가 못 보는 데이터는 에이전트도 못 본다. |
| R-AI-06 | 관리자 통계: 질문 수(일/주/사용자별), 주제 분류(LLM 이 메시지에 태그 부여: 예측/재고/발주/배정/기타), 상위 질문 목록, 답변 실패율. 카드는 드릴다운(R-UI-01). |
| R-AI-07 | 답변에 근거 데이터(품목·월·수치)를 함께 표시하고, 시스템에 없는 사실은 추정하지 않는다(모르면 모른다고 답변). |
