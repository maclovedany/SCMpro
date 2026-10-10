from __future__ import annotations
import os
from dataclasses import dataclass
from pathlib import Path
from dotenv import dotenv_values

ENGINE_DIR = Path(__file__).resolve().parent.parent

@dataclass(frozen=True)
class Settings:
    sqlite_path: Path
    db_url: str | None

    @classmethod
    def load(cls, env_file: Path | None = None) -> "Settings":
        env_file = env_file or ENGINE_DIR / ".env"
        # .env 파일 → 환경 변수 순으로 덮어쓴다. Railway 는 Variables 를 환경 변수로만 넣고 이미지에 .env 가 없다 (D-049, D-085)
        vals = {**(dotenv_values(env_file) if env_file.exists() else {}), **os.environ}
        raw_sqlite = vals.get("SQLITE_PATH") or "../data/raw/scm.db"
        sqlite_path = (env_file.parent / raw_sqlite).resolve()
        return cls(sqlite_path=sqlite_path, db_url=vals.get("SUPABASE_DB_URL") or None)
