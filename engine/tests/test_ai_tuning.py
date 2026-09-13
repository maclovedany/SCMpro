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
