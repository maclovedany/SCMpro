from pathlib import Path
from scm_engine.config import Settings

def test_settings_load_from_env(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("SUPABASE_DB_URL=postgresql://u:p@h/db\nSQLITE_PATH=./x.db\n")
    s = Settings.load(env)
    assert s.db_url == "postgresql://u:p@h/db"
    assert s.sqlite_path == (tmp_path / "x.db").resolve()

def test_settings_missing_db_url_is_none(tmp_path, monkeypatch):
    monkeypatch.delenv("SUPABASE_DB_URL", raising=False)
    env = tmp_path / ".env"
    env.write_text("SQLITE_PATH=./x.db\n")
    assert Settings.load(env).db_url is None

def test_settings_db_url_from_environment_when_file_lacks_it(tmp_path, monkeypatch):
    # Railway Variables 는 환경 변수로 들어오고 이미지에는 .env 가 없다 (D-049)
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://env:p@h/db")
    assert Settings.load(tmp_path / ".env").db_url == "postgresql://env:p@h/db"

def test_settings_environment_overrides_file(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("SUPABASE_DB_URL=postgresql://file:p@h/db\n")
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://env:p@h/db")
    assert Settings.load(env).db_url == "postgresql://env:p@h/db"
