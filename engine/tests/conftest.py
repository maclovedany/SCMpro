import pytest
from pathlib import Path

@pytest.fixture(scope="session")
def scm_db_path() -> Path:
    p = Path(__file__).resolve().parents[2] / "data" / "raw" / "scm.db"
    if not p.exists():
        pytest.skip("data/raw/scm.db 없음")
    return p
