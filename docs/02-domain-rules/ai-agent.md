# 규칙: AI Agent (R-AI)

최종 갱신: 2026-09-14 · 출처: D-017, D-025, D-042(자율 모드) · 구현: web/lib/ai/{tools,chat}.ts, app/api/ai/chat, components/ai/*, migrations/20260913005000_ai.sql, 화면 /admin/ai-stats · 자율 모드: engine/scm_engine/agent.py, migrations/20260914008200_agent.sql, 화면 /agent

| ID | 규칙 |
|---|---|
| R-AI-01 | LLM = OpenAI Chat Completions, 모델은 설정값 `ai_model` (기본 `gpt-5-nano`). API 키는 서버 환경변수 `OPENAI_API_KEY` 만, 클라이언트 노출 금지. |
| R-AI-02 | 모든 화면 상단(Topbar)에 **AI Agent** 버튼. 클릭 시 **화면 우측 사이드 패널**로 열리는 ChatGPT 형 채팅(대화 목록 + 메시지 스트림 + 입력). 패널 너비는 **좌측 경계를 마우스 드래그**해 자유롭게 조절(최소 320px ~ 최대 화면의 70%), 너비·열림 상태는 사용자별로 기억(localStorage). 본문 화면은 패널 너비만큼 줄어들며 계속 사용 가능. 현재 화면 컨텍스트(경로·품목코드 등)를 첫 메시지에 첨부. |
| R-AI-03 | 대화는 사용자별로 `app.ai_conversation`(id, user, title, created/updated) · `app.ai_message`(conversation, role, content, tool_calls, tokens, created) 에 저장. 사용자는 자기 대화만, 관리자는 전체 조회. |
| R-AI-04 | 맥락 유지: 요청에 같은 대화의 최근 20턴 + 그 이전은 요약(summary 컬럼, 갱신 시 재요약)을 포함. |
| R-AI-05 | 에이전트는 시스템 데이터를 **도구(function calling)** 로만 조회 (품목 조회, 예측/발주 근거, 재고, 승인 상태). RLS 는 호출자 권한 그대로 적용 — 사용자가 못 보는 데이터는 에이전트도 못 본다. |
| R-AI-06 | 관리자 통계: 질문 수(일/주/사용자별), 주제 분류(LLM 이 메시지에 태그 부여: 예측/재고/발주/배정/기타), 상위 질문 목록, 답변 실패율. 카드는 드릴다운(R-UI-01). |
| R-AI-07 | 답변에 근거 데이터(품목·월·수치)를 함께 표시하고, 시스템에 없는 사실은 추정하지 않는다(모르면 모른다고 답변). |
| R-AI-10 | **자율 모드 (D-042)**: 관리자 설정 `agent_mode` = off / dryrun / notify / propose. off 면 대화형만. 켜면 10분 주기 작업(tick)에서 감지 → 판단 → 행동 → 기록 루프를 사람 개입 없이 돈다. 발주 **반영**은 어떤 모드에서도 팀장 승인 뒤에만 (`agent_order` 승인 → 추가수요 `meeting_approval` 로 반영). |
| R-AI-11 | 감지는 결정론적 SQL `fn_agent_signals`: ① 품절 위험(최신 계획 라인 stockout_risk/기말<0) ② 재고 부족(DoS < 목표×`agent_dos_ratio`%, 입고예정 부족) ③ 입고 지연(계획일 경과 미입고) ④ 발주일 임박(다음 발주일 D-`agent_lead_days` 이내인데 계획 미승인) ⑤ 수요 급증(최근 월 출고 > 6개월 평균×(1+`agent_surge_pct`%)). 임계값은 전부 설정값. |
| R-AI-12 | 판단은 LLM 구조화 출력(심각도 1~3, 조치 ignore/notify/propose, 수량, 필요월, 한 줄 사유). **수량은 시스템이 만든 후보(부족량→MOQ 배수, ×1.2) 중 선택만** — 후보 밖 값은 첫 후보로 치환. LLM 실패·키 없음이면 규칙 판단(신호·ABC·지연일 기준) 으로 폴백하고 `judgment.by` 에 기록. |
| R-AI-13 | 행동: notify 이상이면 tick 당 1건의 **다이제스트 알림**(품목담당자, 즉시 조치 포함 시 팀장도) — 같은 이벤트는 `agent_cooldown_hours` 안에 재알림 금지, tick 당 `agent_max_per_tick` 건 상한. propose 면 stockout/low_dos 에 한해 승인함에 `agent_order` 요청(요청자 = 관리자 계정, 사유에 AI 근거). |
| R-AI-14 | 기록·피드백: `app.agent_event` 에 신호별 1행(key), 상태 open→notified→proposed→accepted/dismissed, 신호가 사라지면 resolved(재발 시 open). 사용자는 "유용/불필요" 피드백을 남기고, `fn_agent_stats` 가 채택률·유용률을 집계해 AI 감시 화면 KPI 로 보여준다 — 임계값 조정 근거. |
| R-AI-15 | 실데이터 초기 도입 순서: dryrun 으로 오탐률 확인 → notify → propose. 어떤 모드에서도 LLM 은 시스템 데이터를 조회·계산하지 않는다(감지·후보 계산은 SQL·엔진). |
