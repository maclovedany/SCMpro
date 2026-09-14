"""자동 런 스케줄 (D-041): due 판정·평가 FY 선택·실행 흐름 (DB 없음, FakeDB)."""
from datetime import datetime
import pandas as pd
from scm_engine.forecast import auto_run
from scm_engine.forecast.auto_run import due, eval_fy_for, KST

def test_eval_fy_is_last_complete_fy():
    assert eval_fy_for("2026-07") == 2025      # FY26 진행 중 → FY25 평가
    assert eval_fy_for("2026-03") == 2025      # FY25 마지막 달까지 있음 → FY25
    assert eval_fy_for("2026-04") == 2025
    assert eval_fy_for("2027-03") == 2026

def test_due_rules():
    s = {"auto_run_enabled": True, "auto_run_day": 5, "auto_run_hour": 2}
    assert due(s, datetime(2026, 9, 5, 2, 0, tzinfo=KST), None) == (True, "due")
    assert due(s, datetime(2026, 9, 5, 1, 59, tzinfo=KST), None)[0] is False
    assert due(s, datetime(2026, 9, 20, 9, 0, tzinfo=KST), "2026-09") == (False, "already_ran")
    assert due(s, datetime(2026, 10, 1, 0, 0, tzinfo=KST), "2026-09")[0] is False   # 다음 달 5일 전
    assert due({"auto_run_enabled": False}, datetime(2026, 9, 9, tzinfo=KST), None) == (False, "disabled")
    assert due({"auto_run_enabled": True, "auto_run_day": 31, "auto_run_hour": 0}, datetime(2026, 2, 28, 1, tzinfo=KST), None)[0] is True   # 31일 → 28일로 클램프

class FakeDB:
    def __init__(self, settings):
        self.settings = settings; self.execs = []
    def read_df(self, sql, params=()):
        if "system_settings" in sql: return pd.DataFrame([{"key": k, "value": v} for k, v in self.settings.items()])
        if "auto_run_log" in sql: return pd.DataFrame(columns=["month"])
        if "advisory_lock" in sql: return pd.DataFrame([{"ok": True}])
        if "advisory_unlock" in sql: return pd.DataFrame([{"ok": True}])
        if "max(ym)" in sql: return pd.DataFrame([{"ym": "2026-07"}])
        if "select summary" in sql: return pd.DataFrame([{"summary": {"eval_fy": 2025, "item_wape": 0.32, "model_wape": 0.31, "regressed": False, "vs_prev": {"item_wape_delta": -0.004}}}])
        raise AssertionError(sql)
    def execute(self, sql, params=()): self.execs.append((sql, params))

class FakeRunner:
    calls = []
    @staticmethod
    def backtest(db, eval_fy, **kw): FakeRunner.calls.append(("bt", eval_fy, kw.get("extra_params"))); return "BT-ID"
    @staticmethod
    def production(db, horizon, **kw): FakeRunner.calls.append(("pr", horizon, kw.get("extra_params"))); return "PR-ID"

def test_maybe_run_executes_and_notifies():
    FakeRunner.calls.clear()
    db = FakeDB({"auto_run_enabled": True, "auto_run_day": 1, "auto_run_hour": 0, "auto_run_backtest": True, "auto_run_tune": True, "fiscal_year_start_month": 4})
    out = auto_run.maybe_run(db, now=datetime(2026, 9, 14, 9, 0, tzinfo=KST), runner=FakeRunner, tuner=lambda db, rid: "TUNE-ID")
    assert out["ran"] and out["backtest"] == "BT-ID" and out["production"] == "PR-ID" and out["tune"] == "TUNE-ID"
    assert FakeRunner.calls[0] == ("bt", 2025, {"auto_month": "2026-09"})
    sqls = [e[0] for e in db.execs]
    assert any("insert into app.auto_run_log" in q for q in sqls) and any("finished_at = now(), backtest_run_id" in q for q in sqls)
    roles = [e[1][0] for e in db.execs if "notify_role" in e[0]]
    assert roles == ["scm_lead", "item_manager", "admin"]
    assert "품목 WAPE 32.0%" in [e[1][3] for e in db.execs if "notify_role" in e[0]][0]

def test_maybe_run_skips_when_disabled():
    db = FakeDB({"auto_run_enabled": False})
    assert auto_run.maybe_run(db, now=datetime(2026, 9, 14, tzinfo=KST), runner=FakeRunner) == {"ran": False, "reason": "disabled"}
    assert db.execs == []
