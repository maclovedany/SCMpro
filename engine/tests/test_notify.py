import pandas as pd
from scm_engine import notify

class FakeDB:
    def __init__(self, rows): self.rows = rows; self.execs = []
    def read_df(self, sql, params=()): return pd.DataFrame(self.rows)
    def execute(self, sql, params=()): self.execs.append((sql, params))

def test_skipped_without_smtp(monkeypatch):
    monkeypatch.delenv("SMTP_HOST", raising=False)
    db = FakeDB([{"id": 1, "title": "t", "body": "b", "email": "a@b"}, {"id": 2, "title": "t2", "body": None, "email": "c@d"}])
    r = notify.send_pending(db)
    assert r == {"sent": 0, "skipped": 2, "failed": 0}
    assert "skipped:no_smtp" in db.execs[0][1]

def test_empty():
    assert notify.send_pending(FakeDB([])) == {"sent": 0, "skipped": 0, "failed": 0}
