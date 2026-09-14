"""자율 모드 — AI 감시 파이프라인 (D-042, R-AI-10~15).
tick 마다: 감지(app.fn_agent_signals, SQL) → 이벤트 upsert/해소 → 쿨다운 지난 후보 선택 → 판단(LLM 구조화 출력, 실패 시 규칙) → 행동(모드별: 기록 / 알림 다이제스트 / 발주 제안 승인 요청) → 기록.
LLM 은 수량을 계산하지 않고 후보(shortage → MOQ 반올림, ×1.2) 중 고르기만 한다. 발주 반영은 항상 팀장 승인 뒤(트리거 → extra_demand)."""
from __future__ import annotations
import json, logging, math, os
from datetime import datetime, timedelta, timezone

log = logging.getLogger(__name__)
SIGNAL_LABEL = {"stockout": "품절 위험", "low_dos": "재고 부족(DoS)", "inbound_delay": "입고 지연", "lead_imminent": "발주일 임박", "demand_surge": "수요 급증"}
SCHEMA = {"name": "agent_judgment", "schema": {"type": "object", "additionalProperties": False, "properties": {"decisions": {"type": "array", "items": {"type": "object", "additionalProperties": False,
    "properties": {"key": {"type": "string"}, "severity": {"type": "integer"}, "action": {"type": "string", "enum": ["ignore", "notify", "propose"]},
                   "qty": {"type": ["number", "null"]}, "need_ym": {"type": ["string", "null"]}, "reason": {"type": "string"}},
    "required": ["key", "severity", "action", "qty", "need_ym", "reason"]}}}, "required": ["decisions"]}}
SYSTEM = """당신은 복합기 부품·소모품·옵션 SCM 의 자율 감시 에이전트입니다. 시스템이 감지한 신호(재고 부족·품절 위험·입고 지연·발주일 임박·수요 급증)를 보고
각 신호의 심각도(1 낮음, 2 보통, 3 즉시 조치)와 조치(ignore / notify / propose)를 정하고 한 줄 사유를 한국어로 씁니다.
규칙: propose 는 stockout·low_dos 신호에만, 그리고 qty 는 반드시 제공된 qty_candidates 중 하나여야 합니다(새 숫자 금지). need_ym 도 제공된 후보만.
A 등급·금액 큰 품목·부족량 큰 순으로 심각도를 높이고, 입고예정으로 곧 해소되면 낮춥니다. 근거 없는 추정은 하지 마세요."""

def _key(s: dict) -> str:
    return f"{s['signal']}:{s.get('item_code') or s.get('supplier') or '-'}"

def candidates(s: dict, now_ym: str) -> tuple[list[float], list[str]]:
    """발주 제안 수량 후보: 부족량을 MOQ 배수로 올림, ×1.2. 필요월 후보: 계획 필요월 또는 다음 달"""
    ev = s.get("evidence") or {}
    short = float(ev.get("shortage") or 0); moq = max(1, int(ev.get("moq") or 1))
    if short <= 0: return [], []
    q1 = math.ceil(short / moq) * moq; q2 = math.ceil(short * 1.2 / moq) * moq
    y, m = int(now_ym[:4]), int(now_ym[5:7]); nxt = f"{y + (m // 12)}-{(m % 12) + 1:02d}"
    return sorted({float(q1), float(q2)}), [x for x in [ev.get("need_ym"), nxt] if x]

def rule_judge(s: dict, mode: str) -> dict:
    """LLM 없이 쓰는 규칙 판단 (폴백·드라이런·테스트)"""
    ev = s.get("evidence") or {}; sig = s["signal"]; abc = ev.get("abc")
    if sig == "stockout": sev = 3 if abc == "A" else 2
    elif sig == "low_dos": sev = 2 if abc == "A" else 1
    elif sig == "inbound_delay": sev = 2 if float(ev.get("days_late") or 0) > 7 else 1
    elif sig == "lead_imminent": sev = 2
    else: sev = 1
    act = "propose" if (sev >= 2 and sig in ("stockout", "low_dos") and (ev.get("shortage") or 0) > 0) else "notify"
    reason = {"stockout": f"필요월 {ev.get('need_ym')} 기초재고 부족 {ev.get('shortage')}개 (ABC {abc or '-'})",
              "low_dos": f"DoS {ev.get('dos_days')}일 < 목표 {ev.get('target_dos_days')}일, 입고예정 {ev.get('inbound_qty')}",
              "inbound_delay": f"{ev.get('supplier')} {ev.get('po_no')} 입고 {ev.get('days_late')}일 지연 ({ev.get('qty')}개)",
              "lead_imminent": f"{ev.get('supplier')} 발주일 {ev.get('order_date')} (D-{ev.get('days_left')}), 계획 {ev.get('plan_status') or '없음'}",
              "demand_surge": f"{ev.get('ym')} 출고 {ev.get('actual')} = 6개월 평균의 {ev.get('ratio')}배"}[sig]
    return {"severity": sev, "action": act, "reason": reason}

def llm_judge(items: list[dict], model: str, client=None) -> dict[str, dict]:
    from openai import OpenAI
    client = client or OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    resp = client.chat.completions.create(model=model, messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": "신호 목록(JSON):\n" + json.dumps(items, ensure_ascii=False, default=str)[:60000]}],
                                          response_format={"type": "json_schema", "json_schema": {"name": SCHEMA["name"], "schema": SCHEMA["schema"], "strict": False}})
    out = json.loads(resp.choices[0].message.content)
    return {d["key"]: d for d in out.get("decisions", [])}

def run(db, now: datetime | None = None, *, mode_override: str | None = None, use_llm: bool = True, client=None) -> dict:
    from .forecast import store
    settings = store.load_settings(db)
    mode = mode_override or settings.get("agent_mode", "off")
    if mode == "off":
        return {"mode": "off", "signals": 0}
    now = now or datetime.now(tz=timezone.utc)
    now_ym = now.strftime("%Y-%m")
    sig = db.read_df("select app.fn_agent_signals(%s, %s, %s) as s", (float(settings.get("agent_dos_ratio", 50)), int(settings.get("agent_lead_days", 7)), float(settings.get("agent_surge_pct", 50)))).iloc[0, 0] or []
    keys = set()
    for s in sig:
        k = _key(s); keys.add(k)
        db.execute("""insert into app.agent_event(key, signal, item_code, category, supplier, evidence) values (%s, %s, %s, %s, %s, %s::jsonb)
                      on conflict (key) do update set last_seen = now(), evidence = excluded.evidence,
                        status = case when app.agent_event.status = 'resolved' then 'open' else app.agent_event.status end,
                        resolved_at = case when app.agent_event.status = 'resolved' then null else app.agent_event.resolved_at end""",
                   (k, s["signal"], s.get("item_code"), s.get("category"), s.get("supplier"), json.dumps(s.get("evidence") or {}, default=str)))
    # 해소: 이번에 안 잡힌 열린 이벤트
    open_rows = db.read_df("select id, key from app.agent_event where status in ('open','notified')")
    resolved = 0
    for r in open_rows.itertuples():
        if r.key not in keys:
            db.execute("update app.agent_event set status = 'resolved', resolved_at = now() where id = %s", (r.id,)); resolved += 1
    # 후보: 쿨다운 지난 열린 이벤트
    cd = int(settings.get("agent_cooldown_hours", 24)); mx = int(settings.get("agent_max_per_tick", 30))
    cand = db.read_df("""select id, key, signal, item_code, category, supplier, evidence, notified_count from app.agent_event
                         where status in ('open','notified') and (last_notified_at is null or last_notified_at < now() - (%s || ' hours')::interval)
                         order by first_seen limit %s""", (cd, mx))
    if cand.empty:
        return {"mode": mode, "signals": len(sig), "resolved": resolved, "judged": 0, "notified": 0, "proposed": 0}
    items = []
    for r in cand.itertuples():
        s = {"signal": r.signal, "item_code": r.item_code, "supplier": r.supplier, "category": r.category, "evidence": r.evidence if isinstance(r.evidence, dict) else json.loads(r.evidence or "{}")}
        qc, yc = candidates(s, now_ym)
        items.append({"key": r.key, **s, "qty_candidates": qc, "need_ym_candidates": yc})
    decisions: dict[str, dict] = {}
    if use_llm and os.environ.get("OPENAI_API_KEY"):
        try:
            model = settings.get("ai_model") if isinstance(settings.get("ai_model"), str) else "gpt-5-nano"
            decisions = llm_judge(items, model, client)
        except Exception as e:
            log.warning("agent llm failed, rule fallback: %s", e)
    judged, notified, proposed = [], [], []
    for it in items:
        d = decisions.get(it["key"]) or rule_judge(it, mode)
        sev = int(min(3, max(1, d.get("severity") or 1))); act = d.get("action") or "notify"
        qty = d.get("qty"); need = d.get("need_ym")
        if act == "propose":
            if it["signal"] not in ("stockout", "low_dos") or not it["qty_candidates"]: act = "notify"
            else:
                qty = float(qty) if qty in it["qty_candidates"] else it["qty_candidates"][0]     # 가드레일: 후보 밖 수량 금지
                need = need if need in it["need_ym_candidates"] else it["need_ym_candidates"][0]
        j = {"severity": sev, "action": act, "qty": qty, "need_ym": need, "reason": d.get("reason") or "", "by": "llm" if it["key"] in decisions else "rule", "at": now.isoformat()}
        db.execute("update app.agent_event set severity = %s, judgment = %s::jsonb where key = %s", (sev, json.dumps(j, ensure_ascii=False), it["key"]))
        judged.append({**it, **j})
        if act == "ignore" or mode == "dryrun": continue
        notified.append({**it, **j})
        if mode == "propose" and act == "propose":
            proposed.append({**it, **j})
    if notified:
        _notify_digest(db, notified)
    for p in proposed:
        _propose(db, p)
    return {"mode": mode, "signals": len(sig), "resolved": resolved, "judged": len(judged), "notified": len(notified), "proposed": len(proposed)}

def _line(e: dict) -> str:
    who = e.get("item_code") or e.get("supplier") or "-"
    return f"[{'!' * int(e['severity'])}] {SIGNAL_LABEL.get(e['signal'], e['signal'])} · {who} — {e['reason']}"

def _notify_digest(db, events: list[dict]):
    events = sorted(events, key=lambda e: -int(e["severity"]))
    sev3 = sum(1 for e in events if int(e["severity"]) >= 3)
    title = f"[AI 감시] 조치 필요 {len(events)}건" + (f" — 즉시 조치 {sev3}건" if sev3 else "")
    body = "\n".join(_line(e) for e in events[:8]) + (f"\n… 외 {len(events) - 8}건" if len(events) > 8 else "") + "\nAI 감시 화면에서 근거·피드백"
    payload = json.dumps({"event_keys": [e["key"] for e in events], "severe": sev3})
    for role in (["item_manager", "scm_lead"] if sev3 else ["item_manager"]):
        db.execute("select app.notify_role(%s::app.role, %s, %s, %s, %s::jsonb)", (role, "agent_digest", title, body, payload))
    keys = tuple(e["key"] for e in events)
    db.execute("update app.agent_event set status = case when status = 'open' then 'notified' else status end, last_notified_at = now(), notified_count = notified_count + 1 where key = any(%s)", (list(keys),))

def _propose(db, e: dict):
    admin = db.read_df("select user_id from app.profiles where role = 'admin' order by created_at limit 1")
    if admin.empty: return
    ev_id = db.read_df("select id from app.agent_event where key = %s", (e["key"],)).iloc[0, 0]
    payload = json.dumps({"item_code": e["item_code"], "need_ym": e["need_ym"], "qty": e["qty"], "signal": e["signal"], "reason": e["reason"], "evidence": e["evidence"], "severity": e["severity"]}, ensure_ascii=False, default=str)
    reason = f"AI 감시 제안 ({SIGNAL_LABEL.get(e['signal'], e['signal'])}): {e['item_code']} {e['qty']:g}개 / {e['need_ym']} — {e['reason']}"
    aid = db.read_df("insert into app.approval(kind, target_table, target_pk, payload, requested_by, reason) values ('agent_order', 'app.agent_event', %s, %s::jsonb, %s, %s) returning id",
                     (str(ev_id), payload, str(admin.iloc[0, 0]), reason)).iloc[0, 0]
    db.execute("update app.agent_event set status = 'proposed', approval_id = %s where id = %s", (str(aid), str(ev_id)))
    db.execute("select app.notify_role('scm_lead'::app.role, 'approval_requested', %s, %s, %s::jsonb)", ("[승인 요청] AI 감시 발주 제안", reason, json.dumps({"approval_id": str(aid)})))
