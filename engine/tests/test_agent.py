"""자율 모드 파이프라인 (D-042): 후보 수량·규칙 판단·실행 흐름 (FakeDB, LLM 없음)."""
import json
from datetime import datetime, timezone
import pandas as pd
from scm_engine import agent

def test_candidates_round_to_moq_and_next_month():
    s = {"signal": "stockout", "evidence": {"shortage": 28, "moq": 10, "need_ym": "2026-11"}}
    q, y = agent.candidates(s, "2026-09")
    assert q == [30.0, 40.0] and y == ["2026-11", "2026-10"]
    assert agent.candidates({"signal": "low_dos", "evidence": {"shortage": 0}}, "2026-12") == ([], [])
    assert agent.candidates({"signal": "x", "evidence": {"shortage": 5, "moq": 1}}, "2026-12")[1] == ["2027-01"]

def test_rule_judge_severity_and_action():
    assert agent.rule_judge({"signal": "stockout", "evidence": {"abc": "A", "shortage": 5, "need_ym": "2026-10"}}, "propose")["severity"] == 3
    r = agent.rule_judge({"signal": "low_dos", "evidence": {"abc": "C", "shortage": 5, "dos_days": 3, "target_dos_days": 30}}, "notify")
    assert r["severity"] == 1 and r["action"] == "notify"
    assert agent.rule_judge({"signal": "inbound_delay", "evidence": {"days_late": 10}}, "notify")["severity"] == 2
    assert agent.rule_judge({"signal": "demand_surge", "evidence": {"ratio": 2.1, "ym": "2026-07", "actual": 100}}, "notify")["action"] == "notify"

class FakeDB:
    def __init__(self, mode, signals, open_events=None):
        self.settings = {"agent_mode": mode, "agent_dos_ratio": 50, "agent_lead_days": 7, "agent_surge_pct": 50, "agent_cooldown_hours": 24, "agent_max_per_tick": 30}
        self.signals = signals; self.execs = []; self.events = open_events or []
    def read_df(self, sql, params=()):
        if "system_settings" in sql: return pd.DataFrame([{"key": k, "value": v} for k, v in self.settings.items()])
        if "fn_agent_signals" in sql: return pd.DataFrame([{"s": self.signals}])
        if "select id, key from app.agent_event" in sql: return pd.DataFrame(self.events, columns=["id", "key"])
        if "notified_count from app.agent_event" in sql:
            return pd.DataFrame([{"id": f"id-{i}", "key": f"{s['signal']}:{s.get('item_code') or s.get('supplier')}", "signal": s["signal"], "item_code": s.get("item_code"), "category": s.get("category"), "supplier": s.get("supplier"), "evidence": s["evidence"], "notified_count": 0} for i, s in enumerate(self.signals)])
        if "from app.profiles where role = 'admin'" in sql: return pd.DataFrame([{"user_id": "admin-uid"}])
        if "select id from app.agent_event where key" in sql: return pd.DataFrame([{"id": "ev-1"}])
        if "insert into app.approval" in sql: self.execs.append((sql, params)); return pd.DataFrame([{"id": "appr-1"}])
        raise AssertionError(sql)
    def execute(self, sql, params=()): self.execs.append((sql, params))

SIG = [{"signal": "stockout", "item_code": "A1", "category": "PART", "evidence": {"abc": "A", "shortage": 12, "moq": 5, "need_ym": "2026-10", "amount": 1e6}},
       {"signal": "inbound_delay", "item_code": "B2", "category": "SUPPLY", "evidence": {"days_late": 3, "po_no": "PO1", "supplier": "일본 공장", "qty": 10}}]

def test_off_mode_does_nothing():
    db = FakeDB("off", SIG)
    assert agent.run(db) == {"mode": "off", "signals": 0} and db.execs == []

def test_dryrun_records_judgment_but_no_notification():
    db = FakeDB("dryrun", SIG, open_events=[("old-1", "low_dos:Z9")])
    out = agent.run(db, now=datetime(2026, 9, 14, tzinfo=timezone.utc), use_llm=False)
    assert out["judged"] == 2 and out["resolved"] == 1 and out["notified"] == 0 and out["proposed"] == 0
    assert not any("notify_role" in q for q, _ in db.execs)
    assert any("judgment = " in q for q, _ in db.execs)

def test_propose_mode_notifies_and_creates_approval_with_candidate_qty():
    db = FakeDB("propose", SIG)
    out = agent.run(db, now=datetime(2026, 9, 14, tzinfo=timezone.utc), use_llm=False)
    assert out["notified"] == 2 and out["proposed"] == 1
    roles = [p[0] for q, p in db.execs if "notify_role" in q and p[1] == "agent_digest"]
    assert roles == ["item_manager", "scm_lead"]                       # 심각 3 → 팀장에게도
    appr = [p for q, p in db.execs if "insert into app.approval" in q][0]
    payload = json.loads(appr[1]); assert payload["item_code"] == "A1" and payload["qty"] == 15.0 and payload["need_ym"] == "2026-10"   # 12 → MOQ 5 배수 15
    assert any("status = 'proposed'" in q for q, _ in db.execs)
