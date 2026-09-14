import json
from types import SimpleNamespace
from scm_engine.forecast import ai_tuning

RESP = {"diagnosis": [{"area": "OPTION", "finding": "과대", "evidence": "bias 0.15"}],
        "proposals": [{"method_key": "hw", "param_patch": {"period": 12}, "enabled": None, "scope": "all", "rationale": "x", "expected_effect": "y"}],
        "data_issues": []}

class FakeClient:
    def __init__(self):
        self.calls = []
        create = lambda **kw: (self.calls.append(kw), SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(RESP)))]))[1]
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))

def test_call_llm_uses_schema_and_parses():
    fc = FakeClient()
    out = ai_tuning.call_llm({"run": {}}, model="gpt-5-nano", client=fc)
    assert out["proposals"][0]["method_key"] == "hw"
    kw = fc.calls[0]
    assert kw["model"] == "gpt-5-nano" and kw["response_format"]["type"] == "json_schema"
    assert "SCM" in kw["messages"][0]["content"]


def test_order_feedback_none_when_no_scored_plans():
    """D-044: 채점할 실적이 없으면 order_feedback 은 None (프롬프트에 빈 섹션을 넣지 않음)"""
    from scm_engine.forecast import ai_tuning
    import pandas as pd
    class DB:
        def read_df(self, sql, params=()):
            if "fn_recent_scorecards" in sql: return pd.DataFrame([{"s": {"plans": []}}])
            return pd.DataFrame([{"p": {"items": []}}])
    assert ai_tuning.order_feedback(DB()) is None
    class DB2(DB):
        def read_df(self, sql, params=()):
            if "fn_recent_scorecards" in sql: return pd.DataFrame([{"s": {"plans": [{"plan_ym": "2026-09", "scored": 10}]}}])
            return pd.DataFrame([{"p": {"items": [{"key_code": "X", "n": 3}]}}])
    fb = ai_tuning.order_feedback(DB2()); assert fb["override_patterns"]["items"][0]["key_code"] == "X"
    assert "dos_adjustments" in ai_tuning.SCHEMA["schema"]["required"]
