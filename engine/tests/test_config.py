from pathlib import Path
from scm_engine.config import Settings

def test_settings_load_from_env(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("SUPABASE_DB_URL=postgresql://u:p@h/db\nSQLITE_PATH=./x.db\n")
    s = Settings.load(env)
    assert s.db_url == "postgresql://u:p@h/db"
    assert s.sqlite_path == (tmp_path / "x.db").resolve()

def test_settings_missing_db_url_is_none(tmp_path):
    env = tmp_path / ".env"
    env.write_text("SQLITE_PATH=./x.db\n")
    assert Settings.load(env).db_url is None
