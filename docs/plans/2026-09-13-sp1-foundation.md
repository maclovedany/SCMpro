# SP1 기반(Foundation) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase 에 실데이터와 `app` 스키마를 세우고, 인증·이력·승인·알림·업로드 공통 메커니즘과 Next.js/Python 뼈대를 만들어 SP2~SP5 가 올라탈 토대를 완성한다.

**Architecture:** Supabase(PostgreSQL 17)에 `raw`(원본, 폐쇄) → `core`(정제 뷰) → `analytics`(물리화 뷰, 화면용) → `app`(업무 데이터) 계층. Next.js 15 App Router 가 supabase-js 로 `analytics/app` 만 읽고, 쓰기는 전부 security-definer RPC. Python `engine/` 은 SQLite(`scm.db`)와 Postgres 양쪽에 붙는 어댑터로 데이터 export·검증·시드 생성을 담당한다.

**Tech Stack:** PostgreSQL 17 (Supabase), psql, supabase CLI 2.117 (타입 생성용), Python 3.12 + uv + pandas + psycopg 3 + typer + pytest, Next.js 15 + TypeScript strict + Tailwind + shadcn/ui + @supabase/ssr + TanStack Query/Table/Virtual + ECharts + SheetJS + zod, vitest, Playwright.

**Spec:** `docs/specs/2026-09-13-sp1-foundation-design.md` (규칙은 `docs/02-domain-rules/*.md`, 결정은 `docs/03-decisions.md`)

## Global Constraints

- `raw` 스키마는 원본 그대로. 앱은 `analytics`/`app` 만 읽는다. 부품 출고는 `core.v_shipment_by_hoc` 기준 (R-XCN-01).
- 모든 마스터 테이블 공통 컬럼: `source text check (source in ('upload','manual','seed','parsed'))`, `is_dummy boolean default false`, `updated_by uuid`, `updated_at timestamptz default now()`.
- 하드코딩 금지: 리드타임·OL 선행개월·목표 DoS·MOQ·Flex 범위 → `app.system_settings` / `app.item_setting`.
- 모든 요약 카드는 `DrillCard` 로만 만들고 `href` 필수 (R-UI-01). 차트는 ECharts 래퍼 `TimeSeriesChart` 만 사용, 색상 고정: actual `#6b7280`, forecast `#2563eb`, sales_ol `#f97316`, scm_ol `#16a34a`, order `#7c3aed` (R-UI-03).
- 화면 문구는 한국어. 숫자 천 단위 구분 (R-UI-06).
- 비밀값은 `web/.env.local`, `engine/.env` 에만. `.env.example` 은 빈 값.
- 커밋 메시지 끝에 반드시:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011Mwf1svXejDGyRFZDccXeM
  ```
- 각 Task 완료 시 관련 docs 갱신 (규칙 변경 → `02-domain-rules`, 새 테이블 → `05-data-catalog.md`).

## 파일 구조 (최종)

```
SCMpro/
├── data/raw/                      원본 xlsx·csv·scm.db (Task 1 에서 이동)
├── data/export/                   engine export-raw 산출 CSV (git 제외)
├── supabase/
│   ├── migrations/
│   │   ├── 20260913000100_raw_schema.sql        raw 10 테이블 (기존 01)
│   │   ├── 20260913000200_core_views.sql        core 뷰 (기존 04 + R-XCN-08 + v_option_model_link)
│   │   ├── 20260913000300_analytics_views.sql   기존 05
│   │   ├── 20260913000400_app_schema.sql        enum + app 12 테이블
│   │   ├── 20260913000500_app_functions.sql     audit 트리거, current_role, approval/upload RPC, dashboard, refresh
│   │   ├── 20260913000600_app_views.sql         analytics 물리화 뷰 2개, app 뷰 3개
│   │   ├── 20260913000700_rls.sql               RLS 정책
│   │   └── 20260913000900_grants.sql            권한 (항상 마지막)
│   ├── seed/app_seed.sql                        engine seed-app 이 생성 (더미)
│   └── scripts/
│       ├── migrate.sh                           psql 로 migrations 순서 적용
│       ├── load-raw.sh                          data/export/*.csv → raw (\copy)
│       ├── seed-app.sh                          app_seed.sql 적용 + refresh
│       └── verify.sql                           행수·RLS·트리거 검증
├── engine/
│   ├── pyproject.toml
│   ├── scm_engine/
│   │   ├── __init__.py
│   │   ├── config.py            .env 로딩
│   │   ├── db/base.py           DB 프로토콜
│   │   ├── db/sqlite.py
│   │   ├── db/postgres.py
│   │   ├── loaders.py           월별 시계열·마스터 로더
│   │   ├── export_raw.py        sqlite → CSV
│   │   ├── seed_app.py          더미 시드 SQL 생성
│   │   ├── verify.py            행수 대조·XCN 리포트
│   │   └── cli.py               typer
│   └── tests/
└── web/
    ├── app/
    │   ├── layout.tsx, globals.css, providers.tsx
    │   ├── (auth)/login/page.tsx
    │   └── (app)/layout.tsx  + dashboard/, items/, items/[code]/, admin/*, upload/, approvals/, notifications/
    ├── components/
    │   ├── ui/                  shadcn
    │   ├── layout/Sidebar.tsx, Topbar.tsx
    │   ├── cards/DrillCard.tsx
    │   ├── charts/TimeSeriesChart.tsx, chartOption.ts
    │   ├── tables/DataGrid.tsx, TreeGrid.tsx
    │   └── upload/UploadWizard.tsx, ColumnMapper.tsx
    ├── lib/
    │   ├── supabase/client.ts, server.ts, middleware.ts, admin.ts
    │   ├── auth/roles.ts, getProfile.ts
    │   ├── queries/items.ts, dashboard.ts, admin.ts, approvals.ts, notifications.ts
    │   ├── upload/parse.ts, templates.ts, validate.ts, apply.ts
    │   ├── drill.ts             드릴다운 href 빌더
    │   ├── format.ts            숫자·날짜 포맷
    │   └── types/database.ts    supabase gen types
    ├── scripts/seed-users.ts
    ├── tests/unit/*.test.ts
    └── tests/e2e/*.spec.ts
```

---

### Task 1: 레포 재구성 + 엔진 프로젝트 초기화

**Files:**
- Move: 루트의 `*.xlsx`, `부품_Part_Tool_3년사용량.csv`, `scm.db` → `data/raw/`
- Move: `01-schema.sql` → `supabase/migrations/20260913000100_raw_schema.sql`, `04-core-views.sql` → `…000200_core_views.sql`, `05-analytics-views.sql` → `…000300_analytics_views.sql`, `06-grants-and-lockdown.sql` → `…000900_grants.sql`
- Move: `02-data-*.sql`, `03-verify.sql`, `07-deprecate-and-agent.sql` → `supabase/legacy/` (참고용, 적재는 CSV 로 대체)
- Create: `engine/pyproject.toml`, `engine/scm_engine/__init__.py`, `engine/scm_engine/config.py`, `engine/tests/conftest.py`
- Modify: `.gitignore` (`data/export/` 추가), `docs/05-data-catalog.md` (경로 갱신)

**Interfaces:**
- Produces: `scm_engine.config.Settings` — `sqlite_path: Path`, `db_url: str | None`; `settings = Settings.load()` 가 `engine/.env` 를 읽는다.

- [ ] **Step 1: 파일 이동**

```bash
cd /Users/danymac/Projects/SCMpro
mkdir -p data/raw data/export supabase/migrations supabase/seed supabase/scripts supabase/legacy
git mv GC-BOM_item_Manage_sheet.xlsx MC_OL_vs_ACT.xlsx TOTAL_BOM_LIST__CAP.xlsx 부품_XCN.xlsx 소모품_출고_트렌드.xlsx 옵션_출고_Trend.xlsx 부품_Part_Tool_3년사용량.csv scm.db data/raw/
git mv 01-schema.sql supabase/migrations/20260913000100_raw_schema.sql
git mv 04-core-views.sql supabase/migrations/20260913000200_core_views.sql
git mv 05-analytics-views.sql supabase/migrations/20260913000300_analytics_views.sql
git mv 06-grants-and-lockdown.sql supabase/migrations/20260913000900_grants.sql
git mv 02-data-*.sql 03-verify.sql 07-deprecate-and-agent.sql supabase/legacy/
echo "data/export/" >> .gitignore
```

- [ ] **Step 2: 엔진 pyproject 작성**

`engine/pyproject.toml`:
```toml
[project]
name = "scm-engine"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "pandas>=2.2",
  "psycopg[binary]>=3.2",
  "typer>=0.12",
  "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = ["pytest>=8", "pytest-cov"]

[project.scripts]
engine = "scm_engine.cli:app"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["scm_engine"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

- [ ] **Step 3: config 테스트 작성**

`engine/tests/test_config.py`:
```python
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
```

- [ ] **Step 4: 실패 확인**

```bash
cd engine && uv venv && uv pip install -e ".[dev]" && uv run pytest tests/test_config.py -v
```
Expected: FAIL `ModuleNotFoundError: scm_engine.config`

- [ ] **Step 5: config 구현**

`engine/scm_engine/__init__.py`: 빈 파일.
`engine/scm_engine/config.py`:
```python
from __future__ import annotations
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
        vals = dotenv_values(env_file) if env_file.exists() else {}
        raw_sqlite = vals.get("SQLITE_PATH") or "../data/raw/scm.db"
        sqlite_path = (env_file.parent / raw_sqlite).resolve()
        return cls(sqlite_path=sqlite_path, db_url=vals.get("SUPABASE_DB_URL") or None)
```
`engine/tests/conftest.py`:
```python
import pytest
from pathlib import Path

@pytest.fixture(scope="session")
def scm_db_path() -> Path:
    p = Path(__file__).resolve().parents[2] / "data" / "raw" / "scm.db"
    if not p.exists():
        pytest.skip("data/raw/scm.db 없음")
    return p
```

- [ ] **Step 6: 통과 확인**

Run: `uv run pytest -v` → 2 passed

- [ ] **Step 7: 문서·커밋**

`docs/05-data-catalog.md` §1 표의 파일 경로에 `data/raw/` 접두, §2 "SQL 파일 실행 순서" 표를 migrations 파일명으로 교체(02-data 는 "legacy, CSV 적재로 대체").
```bash
git add -A && git commit -m "chore: 레포 재구성 (data/raw, supabase/migrations) + engine 초기화"
```

---

### Task 2: 엔진 DB 어댑터 + 로더

**Files:**
- Create: `engine/scm_engine/db/__init__.py`, `db/base.py`, `db/sqlite.py`, `db/postgres.py`, `engine/scm_engine/loaders.py`
- Test: `engine/tests/test_db.py`, `engine/tests/test_loaders.py`

**Interfaces:**
- Produces:
  ```python
  class DB(Protocol):
      def read_df(self, sql: str, params: tuple = ()) -> pd.DataFrame
      def execute(self, sql: str, params: tuple = ()) -> None
      def table_count(self, table: str) -> int        # 'raw.dim_item' 또는 'dim_item'
  SQLiteDB(path: Path); PostgresDB(dsn: str)
  loaders.load_monthly(db, item_type: str, *, by_hoc=True, fill_zero=True, clip_negative=True) -> DataFrame[key_code, ym, qty]
  loaders.load_mc_plan_actual(db) -> DataFrame[model_base, biz, ym, sales_ol, scm_ol, act]
  ```
- SQLite 에는 스키마가 없으므로 어댑터가 `raw.`/`core.` 접두를 제거해 준다 (`strip_schema`).

- [ ] **Step 1: 어댑터 테스트**

`engine/tests/test_db.py`:
```python
import pandas as pd
from scm_engine.db.sqlite import SQLiteDB

def test_sqlite_read_df(scm_db_path):
    db = SQLiteDB(scm_db_path)
    df = db.read_df("select item_code, ym, qty from raw.fact_shipment limit 3")
    assert list(df.columns) == ["item_code", "ym", "qty"] and len(df) == 3

def test_sqlite_table_count_strips_schema(scm_db_path):
    db = SQLiteDB(scm_db_path)
    assert db.table_count("raw.dim_model") == db.table_count("dim_model") == 156

def test_sqlite_execute_creates_temp(scm_db_path):
    db = SQLiteDB(scm_db_path, readonly=False)
    db.execute("create temp table t(x int)")
    db.execute("insert into t values (1)")
    assert db.read_df("select * from t").iloc[0, 0] == 1
```

- [ ] **Step 2: 실패 확인** — `uv run pytest tests/test_db.py -v` → ModuleNotFoundError

- [ ] **Step 3: 어댑터 구현**

`engine/scm_engine/db/base.py`:
```python
from __future__ import annotations
import re
from typing import Protocol
import pandas as pd

SCHEMA_RE = re.compile(r"\b(raw|core|analytics|app)\.")

def strip_schema(sql: str) -> str:
    return SCHEMA_RE.sub("", sql)

class DB(Protocol):
    def read_df(self, sql: str, params: tuple = ()) -> pd.DataFrame: ...
    def execute(self, sql: str, params: tuple = ()) -> None: ...
    def table_count(self, table: str) -> int: ...
```
`engine/scm_engine/db/sqlite.py`:
```python
from __future__ import annotations
import sqlite3
from pathlib import Path
import pandas as pd
from .base import strip_schema

class SQLiteDB:
    def __init__(self, path: Path, readonly: bool = True):
        uri = f"file:{path}?mode={'ro' if readonly else 'rw'}"
        self.conn = sqlite3.connect(uri, uri=True)

    def read_df(self, sql: str, params: tuple = ()) -> pd.DataFrame:
        return pd.read_sql_query(strip_schema(sql), self.conn, params=params)

    def execute(self, sql: str, params: tuple = ()) -> None:
        self.conn.execute(strip_schema(sql), params); self.conn.commit()

    def table_count(self, table: str) -> int:
        t = table.split(".")[-1]
        return self.conn.execute(f'select count(*) from "{t}"').fetchone()[0]
```
`engine/scm_engine/db/postgres.py`:
```python
from __future__ import annotations
import psycopg
import pandas as pd

class PostgresDB:
    def __init__(self, dsn: str):
        self.conn = psycopg.connect(dsn, autocommit=True)

    def read_df(self, sql: str, params: tuple = ()) -> pd.DataFrame:
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            cols = [d.name for d in cur.description]
            return pd.DataFrame(cur.fetchall(), columns=cols)

    def execute(self, sql: str, params: tuple = ()) -> None:
        with self.conn.cursor() as cur:
            cur.execute(sql, params)

    def table_count(self, table: str) -> int:
        return int(self.read_df(f"select count(*) as n from {table}").iloc[0, 0])
```
`engine/scm_engine/db/__init__.py`:
```python
from .base import DB, strip_schema
from .sqlite import SQLiteDB
from .postgres import PostgresDB
__all__ = ["DB", "strip_schema", "SQLiteDB", "PostgresDB"]
```

- [ ] **Step 4: 통과 확인** — `uv run pytest tests/test_db.py -v` → 3 passed

- [ ] **Step 5: 로더 테스트**

`engine/tests/test_loaders.py`:
```python
from scm_engine.db.sqlite import SQLiteDB
from scm_engine import loaders

def test_load_monthly_supply_fills_zero_and_clips(scm_db_path):
    db = SQLiteDB(scm_db_path)
    df = loaders.load_monthly(db, "SUPPLY")
    months = sorted(df["ym"].unique())
    assert months[0] == "2023-04" and months[-1] == "2026-07"
    # 모든 품목이 모든 달을 가진다 (0 채움)
    per_item = df.groupby("key_code")["ym"].count()
    assert per_item.min() == per_item.max() == len(months)
    assert (df["qty"] >= 0).all()

def test_load_monthly_part_uses_hoc(scm_db_path):
    db = SQLiteDB(scm_db_path)
    raw_items = db.read_df("select count(distinct item_code) n from fact_shipment where item_type='PART'").iloc[0,0]
    df = loaders.load_monthly(db, "PART", by_hoc=True)
    assert df["key_code"].nunique() < raw_items   # 합산으로 줄어듦

def test_load_mc_plan_actual_fills_biz(scm_db_path):
    df = loaders.load_mc_plan_actual(SQLiteDB(scm_db_path))
    assert df["model_base"].notna().all()
    assert df["biz"].isna().mean() < 0.01
```

- [ ] **Step 6: 실패 확인** — ModuleNotFoundError `loaders`

- [ ] **Step 7: 로더 구현**

`engine/scm_engine/loaders.py`:
```python
from __future__ import annotations
import pandas as pd
from .db.base import DB

MONTHLY_SQL = {
    "PART_HOC": "select hoc_item as key_code, ym, qty from core.v_shipment_by_hoc",
    "PART": "select item_code as key_code, ym, qty from raw.fact_shipment where item_type='PART'",
    "SUPPLY": "select item_code as key_code, ym, qty from raw.fact_shipment where item_type='SUPPLY'",
    "OPTION": "select item_code as key_code, ym, qty from raw.fact_shipment where item_type='OPTION'",
}

def load_monthly(db: DB, item_type: str, *, by_hoc: bool = True,
                 fill_zero: bool = True, clip_negative: bool = True) -> pd.DataFrame:
    key = "PART_HOC" if (item_type == "PART" and by_hoc) else item_type
    df = db.read_df(MONTHLY_SQL[key])
    df = df.groupby(["key_code", "ym"], as_index=False)["qty"].sum()
    if clip_negative:
        df["qty"] = df["qty"].clip(lower=0)
    if fill_zero:
        months = pd.period_range(df["ym"].min(), df["ym"].max(), freq="M").strftime("%Y-%m")
        idx = pd.MultiIndex.from_product([df["key_code"].unique(), months], names=["key_code", "ym"])
        df = df.set_index(["key_code", "ym"]).reindex(idx, fill_value=0).reset_index()
    return df

def load_mc_plan_actual(db: DB) -> pd.DataFrame:
    df = db.read_df("""
        select p.model_base, coalesce(p.biz, m.biz) as biz, p.ym, p.sales_ol, p.scm_ol, p.act
        from raw.fact_mc_plan_actual p
        left join (select model_base, max(biz) as biz from raw.dim_model
                   where biz is not null group by model_base) m on m.model_base = p.model_base
        where p.model_base is not null""")
    return df
```

- [ ] **Step 8: 통과 확인** — `uv run pytest -v` → 전부 passed

- [ ] **Step 9: 커밋** — `git commit -m "feat(engine): DB 어댑터(sqlite/postgres) + 월별 시계열 로더"`

---

### Task 3: 엔진 export-raw · verify · CLI

**Files:**
- Create: `engine/scm_engine/export_raw.py`, `engine/scm_engine/verify.py`, `engine/scm_engine/cli.py`
- Test: `engine/tests/test_export_verify.py`

**Interfaces:**
- Produces: `export_raw.export_all(db: SQLiteDB, out_dir: Path) -> dict[str,int]` (테이블별 행수, CSV 는 헤더 포함, 컬럼 순서 = sqlite 테이블 순서), `verify.compare_counts(src: DB, dst: DB) -> DataFrame[table, src_n, dst_n, ok]`, `verify.xcn_multi_hoc_report(db) -> DataFrame[related_item, n_hoc, chosen_hoc]`, CLI `engine export-raw`, `engine verify --target postgres`.
- `RAW_TABLES` 순서(FK 없음이지만 통일): dim_item, dim_model, fact_shipment, fact_mc_plan_actual, bridge_bom, bridge_scc_config, bridge_mc_cap, bridge_cap_option, bridge_option_model, bridge_xcn

- [ ] **Step 1: 테스트**

`engine/tests/test_export_verify.py`:
```python
import csv
from scm_engine.db.sqlite import SQLiteDB
from scm_engine import export_raw, verify

def test_export_all_writes_csv_with_header(scm_db_path, tmp_path):
    db = SQLiteDB(scm_db_path)
    counts = export_raw.export_all(db, tmp_path)
    assert counts["dim_model"] == 156
    with open(tmp_path / "dim_model.csv", newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    assert rows[0] == ["model_key", "model_base", "biz", "iot_code", "sources"]
    assert len(rows) == 157

def test_compare_counts_self_is_ok(scm_db_path):
    db = SQLiteDB(scm_db_path)
    df = verify.compare_counts(db, db)
    assert df["ok"].all() and len(df) == 10

def test_xcn_multi_hoc_report_picks_one(scm_db_path):
    df = verify.xcn_multi_hoc_report(SQLiteDB(scm_db_path))
    assert len(df) == 454
    assert df["chosen_hoc"].notna().all()
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현**

`engine/scm_engine/export_raw.py`:
```python
from __future__ import annotations
import csv
from pathlib import Path
from .db.sqlite import SQLiteDB

RAW_TABLES = ["dim_item", "dim_model", "fact_shipment", "fact_mc_plan_actual", "bridge_bom",
              "bridge_scc_config", "bridge_mc_cap", "bridge_cap_option", "bridge_option_model", "bridge_xcn"]

def export_all(db: SQLiteDB, out_dir: Path) -> dict[str, int]:
    out_dir.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    for t in RAW_TABLES:
        cur = db.conn.execute(f'select * from "{t}"')
        cols = [d[0] for d in cur.description]
        n = 0
        with open(out_dir / f"{t}.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f); w.writerow(cols)
            for row in cur:
                w.writerow(["" if v is None else v for v in row]); n += 1
        counts[t] = n
    return counts
```
`engine/scm_engine/verify.py`:
```python
from __future__ import annotations
import pandas as pd
from .db.base import DB
from .export_raw import RAW_TABLES

def compare_counts(src: DB, dst: DB) -> pd.DataFrame:
    rows = []
    for t in RAW_TABLES:
        a, b = src.table_count(f"raw.{t}"), dst.table_count(f"raw.{t}")
        rows.append({"table": t, "src_n": a, "dst_n": b, "ok": a == b})
    return pd.DataFrame(rows)

# R-XCN-08: 최근 24개월 출고 최다 HOC, 동률은 코드 정렬 최댓값
XCN_MULTI_SQL = """
with multi as (
  select related_item from raw.bridge_xcn group by related_item having count(distinct hoc_item) > 1
), cand as (
  select x.related_item, x.hoc_item,
         coalesce((select sum(qty) from raw.fact_shipment f
                   where f.item_code = x.hoc_item and f.ym >= '2024-08'), 0) as vol
  from raw.bridge_xcn x join multi m on m.related_item = x.related_item
)
select related_item, count(*) as n_hoc,
       (select hoc_item from cand c2 where c2.related_item = cand.related_item
        order by vol desc, hoc_item desc limit 1) as chosen_hoc
from cand group by related_item"""

def xcn_multi_hoc_report(db: DB) -> pd.DataFrame:
    return db.read_df(XCN_MULTI_SQL)

def hoc_mismatch_report(db: DB) -> pd.DataFrame:
    return db.read_df("""select d.item_code, d.hoc_code as csv_hoc, x.hoc_item as xcn_hoc
        from raw.dim_item d join raw.bridge_xcn x on x.related_item = d.item_code
        where d.hoc_code is not null and d.hoc_code <> '' and d.hoc_code <> x.hoc_item""")
```
`engine/scm_engine/cli.py`:
```python
from __future__ import annotations
from pathlib import Path
import typer
from .config import Settings, ENGINE_DIR
from .db.sqlite import SQLiteDB
from .db.postgres import PostgresDB
from . import export_raw, verify

app = typer.Typer(help="SCM 엔진 CLI")

def _sqlite() -> SQLiteDB:
    return SQLiteDB(Settings.load().sqlite_path)

def _pg() -> PostgresDB:
    s = Settings.load()
    if not s.db_url:
        raise typer.BadParameter("engine/.env 의 SUPABASE_DB_URL 이 비어 있습니다")
    return PostgresDB(s.db_url)

@app.command("export-raw")
def export_raw_cmd(out: Path = ENGINE_DIR.parent / "data" / "export"):
    counts = export_raw.export_all(_sqlite(), out)
    for t, n in counts.items():
        typer.echo(f"{t:24} {n:>8}")

@app.command("verify")
def verify_cmd(target: str = "postgres", report_dir: Path = ENGINE_DIR.parent / "docs" / "reports"):
    src = _sqlite(); dst = _pg() if target == "postgres" else src
    counts = verify.compare_counts(src, dst)
    multi = verify.xcn_multi_hoc_report(src)
    mism = verify.hoc_mismatch_report(src)
    report_dir.mkdir(parents=True, exist_ok=True)
    from datetime import date
    p = report_dir / f"verify-{date.today():%Y%m%d}.md"
    p.write_text("# 검증 리포트\n\n## 행수 대조\n" + counts.to_markdown(index=False)
                 + f"\n\n## XCN 다중 HOC 귀속 (R-XCN-08) — {len(multi)}건\n" + multi.head(50).to_markdown(index=False)
                 + f"\n\n## CSV HOC vs XCN 불일치 (R-XCN-07) — {len(mism)}건\n" + mism.head(50).to_markdown(index=False))
    typer.echo(counts.to_string(index=False)); typer.echo(f"리포트: {p}")
    raise typer.Exit(code=0 if counts["ok"].all() else 1)

if __name__ == "__main__":
    app()
```
`pyproject.toml` dependencies 에 `"tabulate>=0.9"` 추가 (to_markdown 용).

- [ ] **Step 4: 통과 확인** — `uv pip install -e ".[dev]" && uv run pytest -v`; `uv run engine export-raw` 로 `data/export/*.csv` 10개 생성 확인

- [ ] **Step 5: 커밋** — `git commit -m "feat(engine): raw CSV export, 검증 리포트, CLI"`

---

### Task 4: Supabase — raw 적재 스크립트 + core 뷰 수정

**Files:**
- Modify: `supabase/migrations/20260913000100_raw_schema.sql` (상단 "5회차" 언급 주석 정리만, DDL 불변)
- Modify: `supabase/migrations/20260913000200_core_views.sql` — `v_part_linkage` 를 R-XCN-08 로 교체, `v_option_model_link` 추가
- Create: `supabase/scripts/migrate.sh`, `supabase/scripts/load-raw.sh`, `supabase/scripts/verify.sql`

**Interfaces:**
- Produces: `core.v_part_linkage(related_item, hoc_item)` — related_item 당 정확히 1행. `core.v_option_model_link(item_code, model_base, link_source('bridge'|'parsed'), is_sw boolean)`.
- 스크립트는 `engine/.env` 의 `SUPABASE_DB_URL` 을 읽는다.

- [ ] **Step 1: migrate.sh / load-raw.sh 작성**

`supabase/scripts/migrate.sh`:
```bash
#!/usr/bin/env bash
# migrations 를 파일명 순으로 psql 적용. 각 파일은 재실행 가능(drop if exists / create or replace)해야 한다.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
set -a; source "$ROOT/engine/.env"; set +a
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "==> $(basename "$f")"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "migrations 완료"
```
`supabase/scripts/load-raw.sh`:
```bash
#!/usr/bin/env bash
# data/export/*.csv → raw.* (\copy). 기존 행은 truncate 후 적재.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
set -a; source "$ROOT/engine/.env"; set +a
TABLES="dim_item dim_model fact_shipment fact_mc_plan_actual bridge_bom bridge_scc_config bridge_mc_cap bridge_cap_option bridge_option_model bridge_xcn"
for t in $TABLES; do
  echo "==> raw.$t"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q \
    -c "truncate raw.$t" \
    -c "\\copy raw.$t from '$ROOT/data/export/$t.csv' with (format csv, header true, null '')"
done
psql "$SUPABASE_DB_URL" -Atc "select 'dim_item', count(*) from raw.dim_item union all select 'fact_shipment', count(*) from raw.fact_shipment"
```
`chmod +x supabase/scripts/*.sh`

- [ ] **Step 2: core 뷰 수정** — `20260913000200_core_views.sql` 의 `create or replace view core.v_part_linkage …` 블록을 아래로 교체하고, 파일 끝(확인 블록 앞)에 `v_option_model_link` 추가:

```sql
-- v_part_linkage — XCN 연계 (구코드 → 대표코드). R-XCN-08: 구코드가 여러 HOC 에 걸리면
-- 최근 24개월 출고 최다 HOC 하나로 귀속, 동률은 코드 정렬 최댓값.
drop view if exists core.v_part_linkage cascade;
create view core.v_part_linkage as
with cand as (
  select x.related_item, x.hoc_item,
         coalesce((select sum(f.qty) from raw.fact_shipment f
                   where f.item_code = x.hoc_item
                     and f.ym >= to_char(now() - interval '24 months', 'YYYY-MM')), 0) as vol
  from raw.bridge_xcn x
), ranked as (
  select related_item, hoc_item,
         row_number() over (partition by related_item order by vol desc, hoc_item desc) as rn
  from cand
)
select related_item, hoc_item from ranked where rn = 1;
comment on view core.v_part_linkage is 'R-XCN-08 적용. related_item 당 1행';

-- v_option_model_link — 옵션 ↔ 기종 연결 (R-BOM-11). bridge 우선, 없으면 family 파싱. SW 라이선스 플래그.
create or replace view core.v_option_model_link as
with shipped as (
  select distinct item_code from raw.fact_shipment where item_type = 'OPTION'
), bridged as (
  select b.item_code, b.model_base, 'bridge'::text as link_source
  from raw.bridge_option_model b where b.model_base is not null and b.model_base <> ''
), parsed as (
  select d.item_code, substring(d.family from '^(MDL[0-9]+)') as model_base, 'parsed'::text as link_source
  from raw.dim_item d join shipped s on s.item_code = d.item_code
  where d.family ~ '^MDL[0-9]+' and not exists (select 1 from bridged b where b.item_code = d.item_code)
)
select l.item_code, l.model_base, l.link_source,
       (d.family ilike 'LICENSE%' or d.description ilike '%1DAY CODE%') as is_sw
from (select * from bridged union all select * from parsed) l
join raw.dim_item d on d.item_code = l.item_code;
```
`v_shipment_by_hoc` 는 기존대로 `v_part_linkage` 를 조인하므로 변경 없음(단, 위 drop cascade 로 지워지므로 파일 내 순서상 `v_shipment_by_hoc` 정의가 `v_part_linkage` **뒤**에 있는지 확인).

- [ ] **Step 3: verify.sql 작성**

`supabase/scripts/verify.sql`:
```sql
-- 행수 (scm.db 실측 기준)
with expected(t, n) as (values
  ('dim_item',93881),('dim_model',156),('fact_shipment',103795),('fact_mc_plan_actual',2765),
  ('bridge_bom',7170),('bridge_scc_config',88),('bridge_mc_cap',106),('bridge_cap_option',646),
  ('bridge_option_model',972),('bridge_xcn',20760)),
actual as (
  select 'dim_item' t, count(*) n from raw.dim_item union all select 'dim_model', count(*) from raw.dim_model
  union all select 'fact_shipment', count(*) from raw.fact_shipment union all select 'fact_mc_plan_actual', count(*) from raw.fact_mc_plan_actual
  union all select 'bridge_bom', count(*) from raw.bridge_bom union all select 'bridge_scc_config', count(*) from raw.bridge_scc_config
  union all select 'bridge_mc_cap', count(*) from raw.bridge_mc_cap union all select 'bridge_cap_option', count(*) from raw.bridge_cap_option
  union all select 'bridge_option_model', count(*) from raw.bridge_option_model union all select 'bridge_xcn', count(*) from raw.bridge_xcn)
select e.t, e.n expected, a.n actual, case when e.n = a.n then 'OK' else 'MISMATCH' end
from expected e join actual a using (t) order by 1;
-- v_part_linkage 는 related_item 당 1행
select 'v_part_linkage dup' as chk, count(*) from (select related_item from core.v_part_linkage group by 1 having count(*) > 1) x;
-- SW 옵션 비중 (D-009 검증: 약 40%)
select 'sw share' as chk, round(sum(case when l.is_sw then f.qty else 0 end) / sum(f.qty), 3)
from raw.fact_shipment f left join core.v_option_model_link l on l.item_code = f.item_code where f.item_type = 'OPTION' and f.qty > 0;
```

- [ ] **Step 4: 실행**

```bash
cd /Users/danymac/Projects/SCMpro
supabase/scripts/migrate.sh          # 000100, 000200, 000300, 000900 만 있는 상태 — 000900 grants 는 뷰 없으면 오류 없이 통과해야 함
uv --directory engine run engine export-raw
supabase/scripts/load-raw.sh
psql "$(grep SUPABASE_DB_URL engine/.env | cut -d= -f2-)" -f supabase/scripts/verify.sql
uv --directory engine run engine verify --target postgres
```
Expected: 10개 전부 OK, `v_part_linkage dup = 0`, `sw share ≈ 0.40`, engine verify exit 0.
주의: `000300_analytics_views.sql` 이 `core.v_part_linkage` 컬럼을 참조하면 컬럼명(related_item, hoc_item)이 동일하므로 그대로 동작. 오류 시 해당 뷰 정의를 확인해 수정.

- [ ] **Step 5: 문서·커밋**
`docs/02-domain-rules/parts-xcn.md` R-XCN-08 에 "구현: core.v_part_linkage" 추가, `bom-option.md` R-BOM-11 에 "구현: core.v_option_model_link" 추가.
`git commit -m "feat(db): raw 적재 스크립트, core 뷰 R-XCN-08/R-BOM-11 반영"`

---

### Task 5: Supabase — `app` 스키마 + 함수 + 뷰 + RLS + 권한

**Files:**
- Create: `supabase/migrations/20260913000400_app_schema.sql`, `…000500_app_functions.sql`, `…000600_app_views.sql`, `…000700_rls.sql`
- Modify: `supabase/migrations/20260913000900_grants.sql` (app·analytics 물리화 뷰 권한 추가)

**Interfaces (Produces):**
- enum `app.role`: `item_manager, scm_lead, sales, marketing, service, biz_enable, admin`
- `app.current_role() returns app.role` (auth.uid 기준, 없으면 null)
- RPC `app.fn_request_approval(p_kind text, p_target_table text, p_target_pk text, p_payload jsonb, p_reason text) returns uuid`
- RPC `app.fn_decide_approval(p_id uuid, p_decision text /*approved|rejected*/, p_comment text) returns void`
- RPC `app.fn_apply_upload(p_target text, p_rows jsonb, p_mode text /*upsert|replace*/, p_file_name text) returns jsonb {upload_id, ok_count, error_count, errors:[{row, message}]}`
- RPC `app.fn_dashboard_summary() returns jsonb` — 키: items_by_category{PART,SUPPLY,OPTION,SW}, dummy_ratio, pending_approvals, last_upload{file_name, uploaded_at, ok_count, error_count}, snapshot_date, missing_target_dos
- RPC `app.fn_refresh_matviews() returns void`
- 물리화 뷰 `analytics.v_item_master`, `analytics.v_item_monthly` (컬럼은 Step 3 참조)
- 뷰 `app.v_item_setting`(단가 마스킹), `app.v_available_stock`, `app.v_my_approvals`

- [ ] **Step 1: app_schema.sql**

```sql
-- 20260913000400_app_schema.sql — 업무 데이터 스키마 (재실행 가능)
create schema if not exists app;

do $$ begin
  create type app.role as enum ('item_manager','scm_lead','sales','marketing','service','biz_enable','admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.allocation_mode as enum ('auto','manual');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.setting_status as enum ('draft','pending','approved');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.stock_class as enum ('normal','inspection','defect','service_center','partner','in_transit');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.inbound_status as enum ('ordered','shipped','received');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.approval_kind as enum ('item_setting','target_dos','allocation_mode','order_plan','priority_alloc','bulkdeal');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.approval_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.notify_channel as enum ('system','email');
exception when duplicate_object then null; end $$;

create table if not exists app.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text, name text, role app.role not null default 'sales', dept text,
  created_at timestamptz default now()
);

create table if not exists app.system_settings (
  key text primary key, value jsonb not null, description text,
  updated_by uuid, updated_at timestamptz default now()
);

create table if not exists app.supplier (
  id serial primary key, code text unique not null, name text not null, country text,
  prep_days int not null default 7, lead_time_days int not null default 30, sailing_rule jsonb,
  source text not null default 'manual' check (source in ('upload','manual','seed','parsed')),
  is_dummy boolean not null default false, updated_by uuid, updated_at timestamptz default now()
);

create table if not exists app.item_setting (
  item_code text primary key,
  target_dos_days int, moq int not null default 1, pack_unit int, min_order_amount numeric,
  unit_price numeric, currency text default 'KRW',
  allocation_mode app.allocation_mode not null default 'auto',
  status app.setting_status not null default 'draft', approved_by uuid, approved_at timestamptz,
  source text not null default 'manual' check (source in ('upload','manual','seed','parsed')),
  is_dummy boolean not null default false, updated_by uuid, updated_at timestamptz default now()
);

create table if not exists app.inventory_snapshot (
  id bigserial primary key, item_code text not null, snap_date date not null,
  qty numeric not null, stock_class app.stock_class not null default 'normal',
  source text not null default 'manual' check (source in ('upload','manual','seed','parsed')),
  is_dummy boolean not null default false, updated_by uuid, updated_at timestamptz default now(),
  unique (item_code, snap_date, stock_class)
);
create index if not exists ix_inv_item_date on app.inventory_snapshot(item_code, snap_date desc);

create table if not exists app.inbound (
  id bigserial primary key, item_code text not null, supplier_id int references app.supplier(id),
  po_no text, qty numeric not null, planned_date date not null, actual_date date,
  status app.inbound_status not null default 'ordered',
  source text not null default 'manual' check (source in ('upload','manual','seed','parsed')),
  is_dummy boolean not null default false, updated_by uuid, updated_at timestamptz default now()
);
create index if not exists ix_inbound_item on app.inbound(item_code, planned_date);

create table if not exists app.attach_rate (
  id bigserial primary key, model_base text not null, option_item_code text not null,
  rate numeric(6,4) not null check (rate >= 0 and rate <= 1), effective_ym char(7) not null,
  source text not null default 'manual' check (source in ('upload','manual','seed','parsed')),
  is_dummy boolean not null default false, updated_by uuid, updated_at timestamptz default now(),
  unique (model_base, option_item_code, effective_ym)
);

create table if not exists app.eol_eos (
  model_base text primary key, launch_date date, eol_date date, eos_date date,
  source text not null default 'manual' check (source in ('upload','manual','seed','parsed')),
  is_dummy boolean not null default false, updated_by uuid, updated_at timestamptz default now()
);

create table if not exists app.holiday (
  date date primary key, name text not null, country text not null default 'KR'
);

create table if not exists app.shipment_extra (   -- raw 수정 금지 원칙: 추가월 출고는 여기로 (v_item_monthly 가 UNION)
  item_code text not null, ym char(7) not null, qty numeric not null, item_type text not null,
  source text not null default 'upload' check (source in ('upload','manual','seed','parsed')),
  updated_by uuid, updated_at timestamptz default now(), primary key (item_code, ym)
);

create table if not exists app.upload_log (
  id uuid primary key default gen_random_uuid(), file_name text, target text not null,
  row_count int not null default 0, ok_count int not null default 0, error_count int not null default 0,
  errors jsonb not null default '[]'::jsonb, status text not null default 'done',
  uploaded_by uuid, uploaded_at timestamptz default now()
);

create table if not exists app.audit_log (
  id bigserial primary key, table_name text not null, row_pk text, action text not null,
  before jsonb, after jsonb, actor uuid, at timestamptz default now()
);
create index if not exists ix_audit_table_pk on app.audit_log(table_name, row_pk, at desc);

create table if not exists app.approval (
  id uuid primary key default gen_random_uuid(),
  kind app.approval_kind not null, target_table text not null, target_pk text not null,
  payload jsonb not null default '{}'::jsonb,
  requested_by uuid not null, requested_at timestamptz default now(),
  approver uuid, status app.approval_status not null default 'pending',
  reason text not null, comment text, decided_at timestamptz
);
create index if not exists ix_approval_status on app.approval(status, requested_at desc);

create table if not exists app.notification (
  id bigserial primary key, recipient uuid not null, channel app.notify_channel not null default 'system',
  kind text not null, title text not null, body text, payload jsonb,
  created_at timestamptz default now(), sent_at timestamptz, read_at timestamptz, result text
);
create index if not exists ix_notification_recipient on app.notification(recipient, read_at, created_at desc);

-- system_settings 초기값 (spec §3.4)
insert into app.system_settings(key, value, description) values
 ('ol_lead_months', '1', 'Supplier OL 제출 선행 개월 (D-003)'),
 ('flex_ranges', '[{"offset":1,"pct":20},{"offset":2,"pct":30},{"offset":3,"pct":30}]', 'Flex rule (R-OQ-10). offset≥4 제한 없음'),
 ('dos_avg_months', '6', 'DoS 월평균 기간 (R-FC-03)'),
 ('ship_lead_days', '7', '선적 리드타임 (R-SCH-05)'),
 ('submit_deadline_rule', '"last_day-1"', '수요자료 제출 마감 (R-SCH-20)'),
 ('reminder_interval_min', '10', '반복 알림 간격 (R-SCH-21, R-AL-17)'),
 ('projection_past_months', '12', '재고전개 과거 열 수 (R-UI-04)'),
 ('projection_future_months', '6', '재고전개 미래 열 수 (R-UI-04)')
on conflict (key) do nothing;
```

- [ ] **Step 2: app_functions.sql**

```sql
-- 20260913000500_app_functions.sql
-- 현재 사용자 역할
create or replace function app.current_role() returns app.role
language sql stable security definer set search_path = app, public as
$$ select role from app.profiles where user_id = auth.uid() $$;

-- 가입 시 profiles 자동 생성
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  insert into app.profiles(user_id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          coalesce((new.raw_user_meta_data->>'role')::app.role, 'sales'))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- 범용 감사 트리거
create or replace function app.fn_audit() returns trigger
language plpgsql security definer set search_path = app, public as $$
declare pk text;
begin
  pk := coalesce(
    case when tg_op = 'DELETE' then (to_jsonb(old)->>'id') else (to_jsonb(new)->>'id') end,
    case when tg_op = 'DELETE' then (to_jsonb(old)->>'item_code') else (to_jsonb(new)->>'item_code') end,
    case when tg_op = 'DELETE' then (to_jsonb(old)->>'key') else (to_jsonb(new)->>'key') end,
    case when tg_op = 'DELETE' then (to_jsonb(old)->>'model_base') else (to_jsonb(new)->>'model_base') end);
  insert into app.audit_log(table_name, row_pk, action, before, after, actor)
  values (tg_table_name, pk, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end, auth.uid());
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['system_settings','supplier','item_setting','inventory_snapshot','inbound','attach_rate','eol_eos','holiday','approval'] loop
    execute format('drop trigger if exists trg_audit on app.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on app.%I for each row execute function app.fn_audit()', t);
  end loop; end $$;

-- 알림 helper
create or replace function app.notify_role(p_role app.role, p_kind text, p_title text, p_body text, p_payload jsonb)
returns void language sql security definer set search_path = app, public as $$
  insert into app.notification(recipient, kind, title, body, payload)
  select user_id, p_kind, p_title, p_body, p_payload from app.profiles where role = p_role $$;

create or replace function app.notify_user(p_user uuid, p_kind text, p_title text, p_body text, p_payload jsonb)
returns void language sql security definer set search_path = app, public as $$
  insert into app.notification(recipient, kind, title, body, payload) values (p_user, p_kind, p_title, p_body, p_payload) $$;

-- 승인 요청
create or replace function app.fn_request_approval(p_kind text, p_target_table text, p_target_pk text, p_payload jsonb, p_reason text)
returns uuid language plpgsql security definer set search_path = app, public as $$
declare v_id uuid; v_role app.role := app.current_role();
begin
  if v_role is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'REASON_REQUIRED'; end if;
  insert into app.approval(kind, target_table, target_pk, payload, requested_by, reason)
  values (p_kind::app.approval_kind, p_target_table, p_target_pk, p_payload, auth.uid(), p_reason) returning id into v_id;
  if p_kind = 'item_setting' then
    update app.item_setting set status = 'pending', updated_by = auth.uid(), updated_at = now() where item_code = p_target_pk;
  end if;
  perform app.notify_role('scm_lead', 'approval_requested', '승인 요청: ' || p_kind, p_target_pk || ' — ' || p_reason,
                          jsonb_build_object('approval_id', v_id, 'kind', p_kind, 'target_pk', p_target_pk));
  return v_id;
end $$;

-- 승인/반려 결정 (승인 시 payload 를 대상에 적용)
create or replace function app.fn_decide_approval(p_id uuid, p_decision text, p_comment text)
returns void language plpgsql security definer set search_path = app, public as $$
declare a app.approval; v_role app.role := app.current_role();
begin
  if v_role not in ('scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  select * into a from app.approval where id = p_id for update;
  if a.id is null then raise exception 'NOT_FOUND'; end if;
  if a.status <> 'pending' then raise exception 'ALREADY_DECIDED'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'BAD_DECISION'; end if;

  if p_decision = 'approved' and a.kind = 'item_setting' then
    insert into app.item_setting(item_code) values (a.target_pk) on conflict do nothing;
    update app.item_setting s set
      target_dos_days  = coalesce((a.payload->>'target_dos_days')::int, s.target_dos_days),
      moq              = coalesce((a.payload->>'moq')::int, s.moq),
      unit_price       = coalesce((a.payload->>'unit_price')::numeric, s.unit_price),
      allocation_mode  = coalesce((a.payload->>'allocation_mode')::app.allocation_mode, s.allocation_mode),
      status = 'approved', approved_by = auth.uid(), approved_at = now(),
      source = 'manual', is_dummy = false, updated_by = auth.uid(), updated_at = now()
    where s.item_code = a.target_pk;
  elsif p_decision = 'rejected' and a.kind = 'item_setting' then
    update app.item_setting set status = case when approved_at is null then 'draft' else 'approved' end where item_code = a.target_pk;
  end if;
  -- 다른 kind(order_plan, priority_alloc, bulkdeal …)의 적용 로직은 SP3/SP4 에서 이 함수에 분기 추가

  update app.approval set status = p_decision::app.approval_status, approver = auth.uid(), comment = p_comment, decided_at = now() where id = p_id;
  perform app.notify_user(a.requested_by, 'approval_decided',
    case when p_decision = 'approved' then '승인됨: ' else '반려됨: ' end || a.kind::text,
    a.target_pk || coalesce(' — ' || p_comment, ''), jsonb_build_object('approval_id', p_id, 'decision', p_decision));
end $$;

-- 업로드 반영. 대상별 컬럼 매핑은 클라이언트가 표준 키로 정규화해 보낸다.
create or replace function app.fn_apply_upload(p_target text, p_rows jsonb, p_mode text, p_file_name text)
returns jsonb language plpgsql security definer set search_path = app, public as $$
declare r jsonb; i int := 0; ok int := 0; errs jsonb := '[]'::jsonb; v_id uuid; v_role app.role := app.current_role();
begin
  if v_role not in ('item_manager','scm_lead','admin') then raise exception 'FORBIDDEN'; end if;
  if p_target not in ('inventory_snapshot','inbound','item_setting','attach_rate','supplier','eol_eos','holiday','shipment_extra') then
    raise exception 'BAD_TARGET %', p_target; end if;
  if p_mode = 'replace' and p_target = 'inventory_snapshot' then
    delete from app.inventory_snapshot where snap_date = (p_rows->0->>'snap_date')::date; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    begin
      if p_target in ('inventory_snapshot','inbound','item_setting','shipment_extra')
         and not exists (select 1 from raw.dim_item where item_code = r->>'item_code') then
        raise exception 'UNKNOWN_ITEM %', r->>'item_code'; end if;

      case p_target
      when 'inventory_snapshot' then
        insert into app.inventory_snapshot(item_code, snap_date, qty, stock_class, source, updated_by)
        values (r->>'item_code', (r->>'snap_date')::date, (r->>'qty')::numeric, coalesce((r->>'stock_class')::app.stock_class,'normal'), 'upload', auth.uid())
        on conflict (item_code, snap_date, stock_class) do update set qty = excluded.qty, source = 'upload', is_dummy = false, updated_by = auth.uid(), updated_at = now();
      when 'inbound' then
        insert into app.inbound(item_code, supplier_id, po_no, qty, planned_date, actual_date, status, source, updated_by)
        values (r->>'item_code', (select id from app.supplier where code = r->>'supplier_code'), r->>'po_no', (r->>'qty')::numeric,
                (r->>'planned_date')::date, (r->>'actual_date')::date, coalesce((r->>'status')::app.inbound_status,'ordered'), 'upload', auth.uid());
      when 'item_setting' then
        insert into app.item_setting(item_code, target_dos_days, moq, unit_price, allocation_mode, status, source, updated_by)
        values (r->>'item_code', (r->>'target_dos_days')::int, coalesce((r->>'moq')::int,1), (r->>'unit_price')::numeric,
                coalesce((r->>'allocation_mode')::app.allocation_mode,'auto'), 'approved', 'upload', auth.uid())
        on conflict (item_code) do update set
          target_dos_days = coalesce(excluded.target_dos_days, app.item_setting.target_dos_days),
          moq = excluded.moq, unit_price = coalesce(excluded.unit_price, app.item_setting.unit_price),
          allocation_mode = excluded.allocation_mode, source = 'upload', is_dummy = false, updated_by = auth.uid(), updated_at = now();
      when 'attach_rate' then
        insert into app.attach_rate(model_base, option_item_code, rate, effective_ym, source, updated_by)
        values (r->>'model_base', r->>'option_item_code', (r->>'rate')::numeric, r->>'effective_ym', 'upload', auth.uid())
        on conflict (model_base, option_item_code, effective_ym) do update set rate = excluded.rate, source = 'upload', is_dummy = false, updated_at = now();
      when 'supplier' then
        insert into app.supplier(code, name, country, prep_days, lead_time_days, source, updated_by)
        values (r->>'code', r->>'name', r->>'country', (r->>'prep_days')::int, (r->>'lead_time_days')::int, 'upload', auth.uid())
        on conflict (code) do update set name = excluded.name, country = excluded.country, prep_days = excluded.prep_days,
          lead_time_days = excluded.lead_time_days, source = 'upload', is_dummy = false, updated_at = now();
      when 'eol_eos' then
        insert into app.eol_eos(model_base, launch_date, eol_date, eos_date, source, updated_by)
        values (r->>'model_base', (r->>'launch_date')::date, (r->>'eol_date')::date, (r->>'eos_date')::date, 'upload', auth.uid())
        on conflict (model_base) do update set launch_date = excluded.launch_date, eol_date = excluded.eol_date, eos_date = excluded.eos_date, source='upload', is_dummy=false, updated_at = now();
      when 'holiday' then
        insert into app.holiday(date, name, country) values ((r->>'date')::date, r->>'name', coalesce(r->>'country','KR'))
        on conflict (date) do update set name = excluded.name;
      when 'shipment_extra' then
        insert into app.shipment_extra(item_code, ym, qty, item_type, updated_by)
        values (r->>'item_code', r->>'ym', (r->>'qty')::numeric, r->>'item_type', auth.uid())
        on conflict (item_code, ym) do update set qty = excluded.qty, updated_at = now();
      end case;
      ok := ok + 1;
    exception when others then
      errs := errs || jsonb_build_object('row', i, 'message', sqlerrm);
    end;
  end loop;

  insert into app.upload_log(file_name, target, row_count, ok_count, error_count, errors, uploaded_by)
  values (p_file_name, p_target, i, ok, i - ok, errs, auth.uid()) returning id into v_id;
  return jsonb_build_object('upload_id', v_id, 'ok_count', ok, 'error_count', i - ok, 'errors', errs);
end $$;

-- 대시보드 요약 (한 번의 왕복)
create or replace function app.fn_dashboard_summary() returns jsonb
language sql stable security definer set search_path = app, analytics, public as $$
  select jsonb_build_object(
    'items_by_category', (select jsonb_object_agg(category, n) from (select category, count(*) n from analytics.v_item_master group by 1) c),
    'dummy_ratio', (select round(avg(case when is_dummy then 1 else 0 end), 3) from app.item_setting),
    'pending_approvals', (select count(*) from app.approval where status = 'pending'),
    'last_upload', (select to_jsonb(u) from (select file_name, uploaded_at, ok_count, error_count from app.upload_log order by uploaded_at desc limit 1) u),
    'snapshot_date', (select max(snap_date) from app.inventory_snapshot where stock_class = 'normal'),
    'missing_target_dos', (select count(*) from analytics.v_item_master m where m.target_dos_days is null)
  ) $$;

create or replace function app.fn_refresh_matviews() returns void
language plpgsql security definer set search_path = app, analytics, public as $$
begin
  refresh materialized view analytics.v_item_monthly;
  refresh materialized view analytics.v_item_master;
end $$;

create or replace function app.fn_mark_read(p_ids bigint[]) returns void
language sql security definer set search_path = app, public as
$$ update app.notification set read_at = now() where id = any(p_ids) and recipient = auth.uid() and read_at is null $$;
```

- [ ] **Step 3: app_views.sql**

```sql
-- 20260913000600_app_views.sql
drop materialized view if exists analytics.v_item_master;
drop materialized view if exists analytics.v_item_monthly;

-- 월별 시계열 (HOC 기준, 0 채움, SW 옵션 제외, shipment_extra UNION). R-XCN-01, R-BOM-11, R-FC-33(클리핑은 엔진에서)
create materialized view analytics.v_item_monthly as
with base as (
  select hoc_item as key_code, 'PART'::text as category, ym, qty from core.v_shipment_by_hoc
  union all
  select f.item_code, case when f.item_type = 'OPTION' and coalesce(l.is_sw, false) then 'SW' else f.item_type end, f.ym, f.qty
  from raw.fact_shipment f left join core.v_option_model_link l on l.item_code = f.item_code
  where f.item_type in ('SUPPLY','OPTION')
  union all
  select item_code, item_type, ym, qty from app.shipment_extra
), agg as (
  select key_code, max(category) as category, ym, sum(qty) as qty from base group by key_code, ym
), keys as (select key_code, max(category) as category from agg group by key_code),
cal as (select distinct ym from agg)
select k.key_code, k.category, c.ym, coalesce(a.qty, 0) as qty
from keys k cross join cal c left join agg a on a.key_code = k.key_code and a.ym = c.ym;
create unique index on analytics.v_item_monthly(key_code, ym);
create index on analytics.v_item_monthly(category);

-- 품목 마스터 (목록 화면 소스)
create materialized view analytics.v_item_master as
with m as (
  select key_code, max(category) category,
         sum(case when ym >= to_char(now() - interval '6 months', 'YYYY-MM') then qty end) / 6.0 as avg_6m,
         sum(case when ym >= to_char(now() - interval '12 months', 'YYYY-MM') then qty end) as total_12m,
         max(case when qty > 0 then ym end) as last_ship_ym
  from analytics.v_item_monthly group by key_code
), inv as (
  select item_code, qty, snap_date from (
    select item_code, qty, snap_date, row_number() over (partition by item_code order by snap_date desc) rn
    from app.inventory_snapshot where stock_class = 'normal') x where rn = 1
), inb as (select item_code, sum(qty) qty from app.inbound where status <> 'received' group by 1)
select m.key_code, m.category, d.description, d.family, m.avg_6m, m.total_12m, m.last_ship_ym,
       s.target_dos_days, s.moq, s.allocation_mode, s.status as setting_status, coalesce(s.is_dummy, false) as setting_is_dummy,
       inv.qty as on_hand, inv.snap_date, coalesce(inb.qty, 0) as inbound_qty,
       case when m.avg_6m > 0 and inv.qty is not null then round(inv.qty / m.avg_6m * 30) end as dos_days
from m left join raw.dim_item d on d.item_code = m.key_code
left join app.item_setting s on s.item_code = m.key_code
left join inv on inv.item_code = m.key_code left join inb on inb.item_code = m.key_code;
create unique index on analytics.v_item_master(key_code);
create index on analytics.v_item_master(category);

-- 단가 마스킹 뷰 (품목담당자/팀장/관리자만 단가 조회)
create or replace view app.v_item_setting as
select item_code, target_dos_days, moq, pack_unit, min_order_amount,
       case when app.current_role() in ('item_manager','scm_lead','admin') then unit_price end as unit_price,
       currency, allocation_mode, status, approved_by, approved_at, source, is_dummy, updated_by, updated_at
from app.item_setting;

-- 가용재고 (SP4 전까지 배정 0)
create or replace view app.v_available_stock as
select key_code as item_code, on_hand, 0::numeric as temp_allocated, 0::numeric as firm_allocated,
       coalesce(on_hand, 0) as available from analytics.v_item_master;

create or replace view app.v_my_approvals as
select a.*, p.name as requester_name from app.approval a left join app.profiles p on p.user_id = a.requested_by
where a.requested_by = auth.uid() or app.current_role() in ('scm_lead','admin');
```

- [ ] **Step 4: rls.sql**

```sql
-- 20260913000700_rls.sql
alter table app.profiles enable row level security;
alter table app.system_settings enable row level security;
alter table app.supplier enable row level security;
alter table app.item_setting enable row level security;
alter table app.inventory_snapshot enable row level security;
alter table app.inbound enable row level security;
alter table app.attach_rate enable row level security;
alter table app.eol_eos enable row level security;
alter table app.holiday enable row level security;
alter table app.shipment_extra enable row level security;
alter table app.upload_log enable row level security;
alter table app.audit_log enable row level security;
alter table app.approval enable row level security;
alter table app.notification enable row level security;

-- 읽기: 로그인 사용자 전부 (단가는 뷰로 마스킹, item_setting 직접 select 는 관리 역할만)
do $$ declare t text; begin
  foreach t in array array['profiles','system_settings','supplier','inventory_snapshot','inbound','attach_rate','eol_eos','holiday','shipment_extra','upload_log'] loop
    execute format('drop policy if exists p_read on app.%I', t);
    execute format('create policy p_read on app.%I for select to authenticated using (true)', t);
  end loop; end $$;
drop policy if exists p_read on app.item_setting;
create policy p_read on app.item_setting for select to authenticated using (app.current_role() in ('item_manager','scm_lead','admin'));
drop policy if exists p_read on app.audit_log;
create policy p_read on app.audit_log for select to authenticated using (app.current_role() in ('item_manager','scm_lead','admin'));
drop policy if exists p_read on app.approval;
create policy p_read on app.approval for select to authenticated using (requested_by = auth.uid() or app.current_role() in ('scm_lead','admin'));
drop policy if exists p_read on app.notification;
create policy p_read on app.notification for select to authenticated using (recipient = auth.uid());

-- 쓰기: admin 전부, item_manager 는 마스터 테이블, 나머지는 RPC 로만
do $$ declare t text; begin
  foreach t in array array['system_settings','supplier','item_setting','inventory_snapshot','inbound','attach_rate','eol_eos','holiday'] loop
    execute format('drop policy if exists p_write on app.%I', t);
    execute format('create policy p_write on app.%I for all to authenticated using (app.current_role() in (%L,%L)) with check (app.current_role() in (%L,%L))',
                   t, 'admin', 'item_manager', 'admin', 'item_manager');
  end loop; end $$;
drop policy if exists p_write on app.system_settings;
create policy p_write on app.system_settings for all to authenticated using (app.current_role() = 'admin') with check (app.current_role() = 'admin');
drop policy if exists p_self on app.profiles;
create policy p_self on app.profiles for update to authenticated using (user_id = auth.uid() or app.current_role() = 'admin') with check (user_id = auth.uid() or app.current_role() = 'admin');
```

- [ ] **Step 5: grants.sql 끝에 추가**

```sql
-- app / analytics 물리화 뷰 권한 (SP1)
grant usage on schema app to authenticated;
grant select, insert, update, delete on all tables in schema app to authenticated;   -- RLS 가 실제 제어
grant usage, select on all sequences in schema app to authenticated;
grant select on all tables in schema analytics to authenticated;                     -- 물리화 뷰 포함
grant execute on all functions in schema app to authenticated;
revoke usage on schema app from anon;
alter default privileges in schema app grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema analytics grant select on tables to authenticated;
```

- [ ] **Step 6: 적용·검증**

```bash
supabase/scripts/migrate.sh
psql "$SUPABASE_DB_URL" -c "select app.fn_refresh_matviews()" -c "select count(*) from analytics.v_item_master" -c "select category, count(*) from analytics.v_item_master group by 1"
```
Expected: v_item_master ≈ 10,700행 (PART≈6,001 / SUPPLY 634 / OPTION≈3,070 / SW≈520). `verify.sql` 에 아래 추가 후 실행:
```sql
select 'audit trigger', count(*) from pg_trigger where tgname = 'trg_audit';   -- 9
select 'rls on', count(*) from pg_tables where schemaname = 'app' and rowsecurity;  -- 14
```

- [ ] **Step 7: 문서·커밋**
`docs/05-data-catalog.md` §3 "앞으로 추가될 테이블" → "app 스키마 (SP1 구현)" 로 바꾸고 12개 테이블·뷰·RPC 를 표로 등록.
`git commit -m "feat(db): app 스키마, 감사 트리거, 승인/업로드 RPC, 물리화 뷰, RLS"`

---

### Task 6: 더미 시드 생성 (engine seed-app) + 테스트 사용자

**Files:**
- Create: `engine/scm_engine/seed_app.py`, `supabase/scripts/seed-app.sh`, `web/scripts/seed-users.ts` (Task 7 이후 실행)
- Modify: `engine/scm_engine/cli.py` (`seed-app` 명령)
- Test: `engine/tests/test_seed_app.py`

**Interfaces:**
- Produces: `seed_app.build_seed_sql(db: DB, snap_date: str, seed: int = 42) -> str` — 결정적(난수 seed 고정) SQL 텍스트. 생성물 `supabase/seed/app_seed.sql`.
- 시드 내용 (spec §3.5): supplier 5, item_setting(v_item_monthly 의 key_code 전부, 카테고리별 MOQ: PART 1/SUPPLY 10/OPTION 5, target_dos 30, unit_price 카테고리별 균등난수 PART 5,000~200,000 / SUPPLY 20,000~300,000 / OPTION 100,000~3,000,000), inventory_snapshot(normal = round(avg_6m × U(0.5,2.0)), 10% 품목에 inspection 소량), inbound(총 12개월 출고 상위 300 품목 각 1건, planned 2026-09-15~2026-10-31, supplier 순환), holiday 2026 KR.

- [ ] **Step 1: 테스트**

`engine/tests/test_seed_app.py`:
```python
from scm_engine.db.sqlite import SQLiteDB
from scm_engine import seed_app

def test_seed_sql_is_deterministic_and_marks_dummy(scm_db_path):
    db = SQLiteDB(scm_db_path)
    a = seed_app.build_seed_sql(db, "2026-08-31")
    b = seed_app.build_seed_sql(db, "2026-08-31")
    assert a == b
    assert "insert into app.supplier" in a and a.count("SUP-") >= 5
    assert "is_dummy" in a and "'seed'" in a
    assert "2026-10-03" in a   # 개천절

def test_seed_moq_by_category(scm_db_path):
    sql = seed_app.build_seed_sql(SQLiteDB(scm_db_path), "2026-08-31")
    # SUPPLY 는 moq 10
    assert any("'SUPPLY'" in ln or ", 10," in ln for ln in sql.splitlines() if "item_setting" in ln or ln.startswith("("))
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현**

`engine/scm_engine/seed_app.py`:
```python
from __future__ import annotations
import random
import pandas as pd
from .db.base import DB
from .loaders import load_monthly

SUPPLIERS = [("SUP-VN","베트남 공장","VN",7,35),("SUP-CN","중국 공장","CN",7,30),
             ("SUP-JP","일본 공장","JP",10,25),("SUP-HK","홍콩 물류","HK",7,28),("SUP-KR","국내 공급","KR",3,10)]
MOQ = {"PART": 1, "SUPPLY": 10, "OPTION": 5}
PRICE = {"PART": (5_000, 200_000), "SUPPLY": (20_000, 300_000), "OPTION": (100_000, 3_000_000)}
HOLIDAYS_2026 = [("2026-01-01","신정"),("2026-02-16","설날 연휴"),("2026-02-17","설날"),("2026-02-18","설날 연휴"),
  ("2026-03-01","삼일절"),("2026-03-02","대체공휴일"),("2026-05-05","어린이날"),("2026-05-24","부처님오신날"),("2026-05-25","대체공휴일"),
  ("2026-06-06","현충일"),("2026-08-15","광복절"),("2026-08-17","대체공휴일"),("2026-09-24","추석 연휴"),("2026-09-25","추석"),("2026-09-26","추석 연휴"),
  ("2026-10-03","개천절"),("2026-10-05","대체공휴일"),("2026-10-09","한글날"),("2026-12-25","성탄절")]

def _q(s: str) -> str:
    return "'" + str(s).replace("'", "''") + "'"

def build_seed_sql(db: DB, snap_date: str, seed: int = 42) -> str:
    rnd = random.Random(seed)
    frames = []
    for t in ("PART", "SUPPLY", "OPTION"):
        df = load_monthly(db, t); df["category"] = t; frames.append(df)
    m = pd.concat(frames)
    last6 = sorted(m["ym"].unique())[-6:]; last12 = sorted(m["ym"].unique())[-12:]
    stats = m.groupby(["key_code", "category"]).agg(
        avg6=("qty", lambda s: s[m.loc[s.index, "ym"].isin(last6)].sum() / 6),
        tot12=("qty", lambda s: s[m.loc[s.index, "ym"].isin(last12)].sum())).reset_index()
    stats = stats.sort_values("key_code").reset_index(drop=True)

    out = ["-- 자동 생성: engine seed-app (D-007 더미). 실데이터 업로드 시 덮어써짐.", "begin;",
           "delete from app.inbound where is_dummy; delete from app.inventory_snapshot where is_dummy;",
           "delete from app.item_setting where is_dummy; delete from app.supplier where is_dummy;"]
    out.append("insert into app.supplier(code,name,country,prep_days,lead_time_days,source,is_dummy) values")
    out.append(",\n".join(f"({_q(c)},{_q(n)},{_q(k)},{p},{l},'seed',true)" for c,n,k,p,l in SUPPLIERS) + " on conflict (code) do nothing;")

    rows = []
    for r in stats.itertuples():
        lo, hi = PRICE[r.category]
        rows.append(f"({_q(r.key_code)},30,{MOQ[r.category]},{rnd.randint(lo, hi)},'approved','seed',true)")
    out.append("insert into app.item_setting(item_code,target_dos_days,moq,unit_price,status,source,is_dummy) values")
    out.append(",\n".join(rows) + " on conflict (item_code) do nothing;")

    rows = []
    for r in stats.itertuples():
        qty = round(r.avg6 * rnd.uniform(0.5, 2.0))
        rows.append(f"({_q(r.key_code)},{_q(snap_date)},{qty},'normal','seed',true)")
        if rnd.random() < 0.10 and r.avg6 > 0:
            rows.append(f"({_q(r.key_code)},{_q(snap_date)},{max(1, round(r.avg6 * 0.2))},'inspection','seed',true)")
    out.append("insert into app.inventory_snapshot(item_code,snap_date,qty,stock_class,source,is_dummy) values")
    out.append(",\n".join(rows) + " on conflict (item_code,snap_date,stock_class) do nothing;")

    top = stats.sort_values("tot12", ascending=False).head(300)
    rows = []
    for i, r in enumerate(top.itertuples()):
        sup = SUPPLIERS[i % 5][0]; day = 15 + (i % 46)
        planned = f"2026-09-{day:02d}" if day <= 30 else f"2026-10-{day-30:02d}"
        rows.append(f"({_q(r.key_code)},(select id from app.supplier where code={_q(sup)}),{_q('PO-D'+str(i+1).zfill(4))},{max(1, round(r.avg6))},{_q(planned)},'ordered','seed',true)")
    out.append("insert into app.inbound(item_code,supplier_id,po_no,qty,planned_date,status,source,is_dummy) values")
    out.append(",\n".join(rows) + ";")

    out.append("insert into app.holiday(date,name,country) values " + ",".join(f"({_q(d)},{_q(n)},'KR')" for d, n in HOLIDAYS_2026) + " on conflict (date) do nothing;")
    out.append("commit;")
    return "\n".join(out) + "\n"
```
`cli.py` 에 추가:
```python
@app.command("seed-app")
def seed_app_cmd(snap_date: str = "2026-08-31", out: Path = ENGINE_DIR.parent / "supabase" / "seed" / "app_seed.sql"):
    from . import seed_app
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(seed_app.build_seed_sql(_sqlite(), snap_date), encoding="utf-8")
    typer.echo(f"생성: {out}")
```
`supabase/scripts/seed-app.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
set -a; source "$ROOT/engine/.env"; set +a
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/seed/app_seed.sql"
psql "$SUPABASE_DB_URL" -Atc "select app.fn_refresh_matviews()" -Atc "select 'item_setting', count(*) from app.item_setting union all select 'inventory', count(*) from app.inventory_snapshot union all select 'inbound', count(*) from app.inbound"
```

- [ ] **Step 4: 통과·적용** — `uv run pytest -v`; `uv run engine seed-app`; `supabase/scripts/seed-app.sh` → item_setting ≈ 10,700, inventory ≈ 11,700, inbound 300

- [ ] **Step 5: 테스트 사용자 스크립트** (Task 7 에서 web 생성 후 실행)

`web/scripts/seed-users.ts`:
```ts
// 실행: cd web && npx tsx scripts/seed-users.ts   (SEED_USER_PASSWORD 환경변수 없으면 'Scm!2026test')
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const pw = process.env.SEED_USER_PASSWORD ?? "Scm!2026test";
const users = [
  { email: "admin@scm.test", name: "관리자", role: "admin" },
  { email: "lead@scm.test", name: "SCM팀장", role: "scm_lead" },
  { email: "manager@scm.test", name: "품목담당자", role: "item_manager" },
  { email: "sales@scm.test", name: "영업담당", role: "sales" },
  { email: "biz@scm.test", name: "사업강화", role: "biz_enable" },
];
for (const u of users) {
  const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: pw, email_confirm: true, user_metadata: { name: u.name, role: u.role } });
  if (error && !error.message.includes("already")) throw error;
  console.log(u.email, data?.user?.id ?? "(exists)");
}
```

- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 더미 시드 생성기(seed-app) + 테스트 사용자 스크립트"`

---

### Task 7: Next.js 스캐폴드 + Supabase Auth + 역할별 레이아웃

**Files:**
- Create (create-next-app 생성물 외): `web/lib/supabase/client.ts`, `server.ts`, `middleware.ts`, `admin.ts`, `web/middleware.ts`, `web/lib/auth/roles.ts`, `web/lib/auth/getProfile.ts`, `web/app/providers.tsx`, `web/app/(auth)/login/page.tsx`, `web/app/(auth)/login/actions.ts`, `web/app/(app)/layout.tsx`, `web/components/layout/Sidebar.tsx`, `web/components/layout/Topbar.tsx`, `web/lib/format.ts`, `web/lib/types/database.ts`, `web/vitest.config.ts`
- Test: `web/tests/unit/roles.test.ts`, `web/tests/unit/format.test.ts`

**Interfaces:**
- Produces: `createClient()` (browser), `createServerSupabase()` (server components/actions, cookies), `createAdminClient()` (service role, 서버 전용), `getProfile(): Promise<Profile|null>` (`{user_id,email,name,role,dept}`), `ROLE_LABEL: Record<Role,string>`, `menuForRole(role): MenuItem[]` (`{href,label,icon}`), `fmtInt(n)`, `fmtPct(x)`, `fmtYm(ym)`.
- 메뉴(역할): 공통 `/dashboard`, `/items`, `/notifications`; item_manager/scm_lead/admin 추가 `/upload`, `/approvals`; admin 추가 `/admin/settings`, `/admin/suppliers`, `/admin/item-settings`, `/admin/holidays`, `/admin/eol`; item_manager 도 `/admin/item-settings`.

- [ ] **Step 1: 스캐폴드**

```bash
cd /Users/danymac/Projects/SCMpro
npx --yes create-next-app@latest web --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
cd web
npm i @supabase/supabase-js @supabase/ssr @tanstack/react-query @tanstack/react-table @tanstack/react-virtual echarts echarts-for-react xlsx zod lucide-react dotenv
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test tsx
npx --yes shadcn@latest init -d
npx --yes shadcn@latest add button card input label table badge dialog select tabs toast dropdown-menu sheet separator skeleton
```
`package.json` scripts 에 추가: `"test": "vitest run"`, `"test:e2e": "playwright test"`, `"gen:types": "supabase gen types typescript --db-url \"$SUPABASE_DB_URL\" --schema app,analytics,core > lib/types/database.ts"`.
create-next-app 이 `.env.local` 을 건드리지 않는지 확인(이미 존재).

- [ ] **Step 2: 타입 생성**

```bash
cd web && SUPABASE_DB_URL="$(grep SUPABASE_DB_URL ../engine/.env | cut -d= -f2-)" npm run gen:types && head -5 lib/types/database.ts
```

- [ ] **Step 3: 단위 테스트 작성**

`web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", include: ["tests/unit/**/*.test.ts?(x)"], globals: true },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```
`web/tests/unit/roles.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { menuForRole } from "@/lib/auth/roles";
describe("menuForRole", () => {
  it("sales sees only common menus", () => {
    expect(menuForRole("sales").map(m => m.href)).toEqual(["/dashboard", "/items", "/notifications"]);
  });
  it("admin sees admin menus", () => {
    const hrefs = menuForRole("admin").map(m => m.href);
    expect(hrefs).toContain("/admin/settings");
    expect(hrefs).toContain("/upload");
    expect(hrefs).toContain("/approvals");
  });
  it("item_manager sees item-settings but not system settings", () => {
    const hrefs = menuForRole("item_manager").map(m => m.href);
    expect(hrefs).toContain("/admin/item-settings");
    expect(hrefs).not.toContain("/admin/settings");
  });
});
```
`web/tests/unit/format.test.ts`:
```ts
import { fmtInt, fmtPct, fmtYm } from "@/lib/format";
it("formats", () => {
  expect(fmtInt(1234567)).toBe("1,234,567");
  expect(fmtInt(null)).toBe("-");
  expect(fmtPct(0.4023)).toBe("40.2%");
  expect(fmtYm("2026-07")).toBe("26-07");
});
```

- [ ] **Step 4: 실패 확인** — `npm test` → 모듈 없음

- [ ] **Step 5: 구현**

`web/lib/auth/roles.ts`:
```ts
export type Role = "item_manager" | "scm_lead" | "sales" | "marketing" | "service" | "biz_enable" | "admin";
export const ROLE_LABEL: Record<Role, string> = {
  item_manager: "SCM 품목담당자", scm_lead: "SCM팀장", sales: "영업부", marketing: "마케팅부",
  service: "서비스부", biz_enable: "사업강화부", admin: "관리자",
};
export type MenuItem = { href: string; label: string; icon: string };
const COMMON: MenuItem[] = [
  { href: "/dashboard", label: "대시보드", icon: "LayoutDashboard" },
  { href: "/items", label: "품목", icon: "Package" },
  { href: "/notifications", label: "알림", icon: "Bell" },
];
const SCM: MenuItem[] = [
  { href: "/upload", label: "데이터 업로드", icon: "Upload" },
  { href: "/approvals", label: "승인함", icon: "CheckSquare" },
  { href: "/admin/item-settings", label: "품목 설정", icon: "SlidersHorizontal" },
];
const ADMIN: MenuItem[] = [
  { href: "/admin/settings", label: "시스템 설정", icon: "Settings" },
  { href: "/admin/suppliers", label: "공급처", icon: "Truck" },
  { href: "/admin/holidays", label: "공휴일", icon: "Calendar" },
  { href: "/admin/eol", label: "EOL/EOS", icon: "Clock" },
];
export function menuForRole(role: Role): MenuItem[] {
  if (role === "admin") return [...COMMON, ...SCM, ...ADMIN];
  if (role === "scm_lead" || role === "item_manager") return [...COMMON, ...SCM];
  return COMMON;
}
export const canWriteMaster = (r: Role) => r === "admin" || r === "item_manager";
export const canApprove = (r: Role) => r === "admin" || r === "scm_lead";
```
`web/lib/format.ts`:
```ts
export const fmtInt = (n: number | null | undefined) => n == null ? "-" : Math.round(n).toLocaleString("ko-KR");
export const fmtNum = (n: number | null | undefined, d = 1) => n == null ? "-" : n.toLocaleString("ko-KR", { maximumFractionDigits: d });
export const fmtPct = (x: number | null | undefined) => x == null ? "-" : `${(x * 100).toFixed(1)}%`;
export const fmtYm = (ym: string) => ym.slice(2);
export const fmtDate = (d: string | null | undefined) => d ? d.slice(0, 10) : "-";
```
`web/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";
export const createClient = () =>
  createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
```
`web/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";
export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} },
    },
  });
}
```
`web/lib/supabase/admin.ts`:
```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
export const createAdminClient = () =>
  createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
```
`web/lib/supabase/middleware.ts` + `web/middleware.ts` — @supabase/ssr 공식 패턴(세션 갱신, 비로그인 시 `/login` 리다이렉트, `/login` 은 예외). `matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]`.
`web/lib/auth/getProfile.ts`:
```ts
import { createServerSupabase } from "@/lib/supabase/server";
import type { Role } from "./roles";
export type Profile = { user_id: string; email: string | null; name: string | null; role: Role; dept: string | null };
export async function getProfile(): Promise<Profile | null> {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.schema("app").from("profiles").select("user_id,email,name,role,dept").eq("user_id", user.id).single();
  return data as Profile | null;
}
```
`web/app/(auth)/login/actions.ts`: 서버 액션 `login(formData)` → `sb.auth.signInWithPassword`, 실패 시 `{error:'이메일 또는 비밀번호가 올바르지 않습니다'}`, 성공 시 `redirect('/dashboard')`. `logout()` 도 여기.
`web/app/(auth)/login/page.tsx`: 이메일/비밀번호 폼 (shadcn Input/Button), 오류 메시지 표시.
`web/app/providers.tsx`: `QueryClientProvider` (defaultOptions: `staleTime: 5*60_000, gcTime: 30*60_000, refetchOnWindowFocus: false`).
`web/app/layout.tsx`: `<html lang="ko">`, Providers 래핑, Toaster.
`web/app/(app)/layout.tsx`: `getProfile()` 없으면 redirect('/login'); `<Sidebar menu={menuForRole(profile.role)} />` + `<Topbar profile />` + `<main>`.
`web/components/layout/Sidebar.tsx`: `next/link` 로 메뉴 렌더(`prefetch` 기본 true — hover 프리페치), 현재 경로 강조(`usePathname`), 아이콘은 `lucide-react` 동적 매핑.
`web/components/layout/Topbar.tsx`: 사용자명·역할 배지·로그아웃 버튼(서버 액션), 미읽음 알림 수 배지(`app.notification` count where read_at is null, TanStack Query).

- [ ] **Step 6: 통과 확인 + 수동 로그인**

`npm test` → passed. `npx tsx scripts/seed-users.ts` (Task 6 Step 5). `npm run dev` → `/login` 에서 admin@scm.test 로그인 → `/dashboard`(빈 페이지) 로 이동, 사이드바에 관리자 메뉴 12개 표시. sales@scm.test 는 3개.

- [ ] **Step 7: 커밋** — `git add -A && git commit -m "feat(web): Next.js 스캐폴드, Supabase Auth, 역할별 레이아웃"`

---

### Task 8: 공통 컴포넌트 — DrillCard · TimeSeriesChart · DataGrid · TreeGrid

**Files:**
- Create: `web/lib/drill.ts`, `web/components/cards/DrillCard.tsx`, `web/components/charts/chartOption.ts`, `web/components/charts/TimeSeriesChart.tsx`, `web/components/tables/DataGrid.tsx`, `web/components/tables/TreeGrid.tsx`
- Test: `web/tests/unit/drill.test.ts`, `web/tests/unit/chartOption.test.ts`, `web/tests/unit/treegrid.test.tsx`

**Interfaces:**
- `drillHref(base: string, filters: Record<string, string|number|boolean|undefined>): string` — 정의된 값만 쿼리로, 키 정렬.
- `<DrillCard label value hint? href icon? tone?='default'|'warn'|'danger' />` — 전체가 `<Link>`; `href` 필수(타입 강제).
- `SeriesRole = 'actual'|'forecast'|'sales_ol'|'scm_ol'|'order'|'other'`; `SERIES_COLOR: Record<SeriesRole,string>`
- `buildTimeSeriesOption({ months: string[], series: {name, role, data:(number|null)[], band?: {lower:number[], upper:number[]}}[], forecastFrom?: string, yName?: string, bars?: string[] /* name 이 막대인 시리즈 */ }): EChartsOption`
- `<TimeSeriesChart option height? onPointClick?(ym, seriesName) />`
- `<DataGrid columns rows rowKey pageSize? onRowClick? csvName? toolbar? />` — TanStack Table + Virtual, 정렬·컬럼 필터·컬럼 숨김·CSV 다운로드.
- `TreeRow = { id, label, level, parentId?, values: Record<string /*ym*/, number|null>, editable?, children?: TreeRow[] }`; `<TreeGrid months rows pastUntil onCellEdit?(rowId, ym, value) />` — 접기/펼치기, 과거/미래 열 배경 구분, editable 셀 인라인 편집.

- [ ] **Step 1: 테스트**

`web/tests/unit/drill.test.ts`:
```ts
import { drillHref } from "@/lib/drill";
it("builds sorted query and skips undefined", () => {
  expect(drillHref("/items", { category: "PART", dummy: true, q: undefined })).toBe("/items?category=PART&dummy=true");
  expect(drillHref("/items", {})).toBe("/items");
});
```
`web/tests/unit/chartOption.test.ts`:
```ts
import { buildTimeSeriesOption, SERIES_COLOR } from "@/components/charts/chartOption";
const months = ["2026-01","2026-02","2026-03","2026-04"];
it("assigns fixed colors and shades forecast area", () => {
  const opt: any = buildTimeSeriesOption({ months, forecastFrom: "2026-03",
    series: [{ name: "실제", role: "actual", data: [1,2,null,null] }, { name: "예측", role: "forecast", data: [null,null,3,4], band: { lower:[0,0,2,3], upper:[0,0,4,5] } }] });
  const actual = opt.series.find((s: any) => s.name === "실제");
  expect(actual.itemStyle.color).toBe(SERIES_COLOR.actual);
  expect(opt.xAxis.data).toEqual(["26-01","26-02","26-03","26-04"]);
  const fc = opt.series.find((s: any) => s.name === "예측");
  expect(fc.markArea.data[0][0].xAxis).toBe("26-03");
  expect(opt.series.some((s: any) => s.name === "예측 구간")).toBe(true);
  expect(opt.dataZoom.length).toBeGreaterThan(0);
});
it("renders bars for listed series", () => {
  const opt: any = buildTimeSeriesOption({ months, series: [{ name: "발주", role: "order", data: [1,1,1,1] }], bars: ["발주"] });
  expect(opt.series[0].type).toBe("bar");
});
```
`web/tests/unit/treegrid.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { TreeGrid } from "@/components/tables/TreeGrid";
const rows = [{ id: "p", label: "부품", level: 0, values: { "2026-01": 10, "2026-02": 20 },
  children: [{ id: "c", label: "556K59129", level: 1, values: { "2026-01": 4, "2026-02": 6 } }] }];
it("collapses and expands children", () => {
  render(<TreeGrid months={["2026-01","2026-02"]} rows={rows} pastUntil="2026-01" />);
  expect(screen.getByText("556K59129")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /부품/ }));
  expect(screen.queryByText("556K59129")).toBeNull();
});
```

- [ ] **Step 2: 실패 확인** — `npm test`

- [ ] **Step 3: 구현**

`web/lib/drill.ts`:
```ts
export function drillHref(base: string, filters: Record<string, string | number | boolean | undefined>): string {
  const q = Object.keys(filters).sort().filter(k => filters[k] !== undefined && filters[k] !== "")
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(filters[k]))}`).join("&");
  return q ? `${base}?${q}` : base;
}
```
`web/components/cards/DrillCard.tsx`:
```tsx
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";
type Props = { label: string; value: string; hint?: string; href: string; tone?: "default" | "warn" | "danger"; icon?: React.ReactNode };
export function DrillCard({ label, value, hint, href, tone = "default", icon }: Props) {
  const toneCls = tone === "danger" ? "border-red-300" : tone === "warn" ? "border-amber-300" : "";
  return (
    <Link href={href} prefetch className="block group" aria-label={`${label} 상세 보기`}>
      <Card className={`p-4 transition hover:shadow-md hover:border-primary ${toneCls}`}>
        <div className="flex items-center justify-between text-sm text-muted-foreground">{label}{icon}<ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100" /></div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </Card>
    </Link>
  );
}
```
`web/components/charts/chartOption.ts`:
```ts
import type { EChartsOption } from "echarts";
import { fmtYm } from "@/lib/format";
export type SeriesRole = "actual" | "forecast" | "sales_ol" | "scm_ol" | "order" | "other";
export const SERIES_COLOR: Record<SeriesRole, string> = { actual: "#6b7280", forecast: "#2563eb", sales_ol: "#f97316", scm_ol: "#16a34a", order: "#7c3aed", other: "#0ea5e9" };
export type TsSeries = { name: string; role: SeriesRole; data: (number | null)[]; band?: { lower: number[]; upper: number[] } };
export function buildTimeSeriesOption(p: { months: string[]; series: TsSeries[]; forecastFrom?: string; yName?: string; bars?: string[] }): EChartsOption {
  const x = p.months.map(fmtYm);
  const series: any[] = [];
  for (const s of p.series) {
    const isBar = p.bars?.includes(s.name);
    const base: any = { name: s.name, type: isBar ? "bar" : "line", data: s.data, itemStyle: { color: SERIES_COLOR[s.role] },
      lineStyle: { color: SERIES_COLOR[s.role], type: s.role === "forecast" ? "dashed" : "solid" }, smooth: false, connectNulls: false, showSymbol: true, symbolSize: 5 };
    if (s.role === "forecast" && p.forecastFrom) {
      base.markArea = { silent: true, itemStyle: { color: "rgba(37,99,235,0.08)" }, data: [[{ xAxis: fmtYm(p.forecastFrom) }, { xAxis: x[x.length - 1] }]] };
    }
    series.push(base);
    if (s.band) {
      series.push({ name: `${s.name} 구간`, type: "line", data: s.band.lower, lineStyle: { opacity: 0 }, stack: `${s.name}-band`, symbol: "none", silent: true },
                  { name: `${s.name} 구간`, type: "line", data: s.band.upper.map((u, i) => u - s.band!.lower[i]), lineStyle: { opacity: 0 }, areaStyle: { color: SERIES_COLOR[s.role], opacity: 0.12 }, stack: `${s.name}-band`, symbol: "none", silent: true });
    }
  }
  return {
    tooltip: { trigger: "axis", valueFormatter: (v: any) => (v == null ? "-" : Number(v).toLocaleString("ko-KR")) },
    legend: { top: 0, type: "scroll" },
    grid: { left: 48, right: 24, top: 40, bottom: 60 },
    xAxis: { type: "category", data: x, boundaryGap: !!p.bars?.length },
    yAxis: { type: "value", name: p.yName },
    dataZoom: [{ type: "inside" }, { type: "slider", height: 18, bottom: 8 }],
    series,
  };
}
```
`web/components/charts/TimeSeriesChart.tsx`: `"use client"`; `ReactECharts` (echarts-for-react) 를 `next/dynamic` 로 ssr:false 로드; `onEvents={{ click: (e) => onPointClick?.(months[e.dataIndex], e.seriesName) }}`; 높이 기본 320.
`web/components/tables/DataGrid.tsx`: `"use client"`; `useReactTable({ getCoreRowModel, getSortedRowModel, getFilteredRowModel })`, `useVirtualizer` 로 행 가상화(rowHeight 36), 헤더 클릭 정렬, 상단 툴바(전역 검색 Input, 컬럼 표시 토글 DropdownMenu, CSV 다운로드 버튼 — `rows` 를 `Papa`-없이 직접 CSV 문자열로 만들어 Blob 다운로드), `onRowClick`.
`web/components/tables/TreeGrid.tsx`: `"use client"`; 재귀 평탄화 + `expanded: Set<string>` 상태(기본 전부 펼침), 첫 열 sticky, 월 열은 `pastUntil` 이하이면 `bg-muted/40`, 이후 `bg-blue-50/40`; `editable` 셀은 클릭 시 `<input type=number>` → blur/Enter 시 `onCellEdit`; 접기 버튼은 `aria-label={label}` 인 `<button>`.

- [ ] **Step 4: 통과 확인** — `npm test` → 전부 passed

- [ ] **Step 5: 커밋** — `git commit -m "feat(web): DrillCard, ECharts 시계열 래퍼, DataGrid, TreeGrid"`

---

### Task 9: 대시보드 (카드 6개, 전부 드릴다운)

**Files:**
- Create: `web/lib/queries/dashboard.ts`, `web/app/(app)/dashboard/page.tsx`, `web/app/(app)/dashboard/DashboardCards.tsx`
- Test: `web/tests/unit/dashboardCards.test.ts`

**Interfaces:**
- `fetchDashboardSummary(sb): Promise<DashboardSummary>` — `app.fn_dashboard_summary` RPC. 타입 `{ items_by_category: Record<string,number>; dummy_ratio: number|null; pending_approvals: number; last_upload: {file_name,uploaded_at,ok_count,error_count}|null; snapshot_date: string|null; missing_target_dos: number }`
- `cardsFromSummary(s: DashboardSummary): {label,value,hint?,href,tone?}[]` — 순수 함수(테스트 대상). href:
  1. 품목 수 → `/items` (hint: 카테고리별 수) 
  2. 더미 설정 비율 → `/items?dummy=true`
  3. 승인 대기 → `/approvals?status=pending`
  4. 최근 업로드 → `/upload?tab=log` (오류>0 이면 tone warn)
  5. 재고 스냅샷 기준일 → `/items?sort=snap_date` (30일 이상 오래되면 warn)
  6. 목표 DoS 미설정 → `/items?target_dos=missing` (>0 이면 danger)

- [ ] **Step 1: 테스트**

`web/tests/unit/dashboardCards.test.ts`:
```ts
import { cardsFromSummary } from "@/lib/queries/dashboard";
const s = { items_by_category: { PART: 6001, SUPPLY: 634, OPTION: 3070, SW: 520 }, dummy_ratio: 1, pending_approvals: 2,
  last_upload: { file_name: "inv.csv", uploaded_at: "2026-09-13T10:00:00Z", ok_count: 10, error_count: 2 }, snapshot_date: "2026-08-31", missing_target_dos: 0 };
it("every card has href and drill filters", () => {
  const cards = cardsFromSummary(s as any);
  expect(cards).toHaveLength(6);
  cards.forEach(c => expect(c.href.startsWith("/")).toBe(true));
  expect(cards[2].href).toBe("/approvals?status=pending");
  expect(cards[3].tone).toBe("warn");
  expect(cards[5].href).toBe("/items?target_dos=missing");
  expect(cards[0].value).toBe("10,225");   // SW 제외 합
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현**

`web/lib/queries/dashboard.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { drillHref } from "@/lib/drill";
import { fmtInt, fmtPct, fmtDate } from "@/lib/format";
export type DashboardSummary = { items_by_category: Record<string, number>; dummy_ratio: number | null; pending_approvals: number;
  last_upload: { file_name: string; uploaded_at: string; ok_count: number; error_count: number } | null; snapshot_date: string | null; missing_target_dos: number };
export async function fetchDashboardSummary(sb: SupabaseClient<any, "app">): Promise<DashboardSummary> {
  const { data, error } = await sb.schema("app").rpc("fn_dashboard_summary");
  if (error) throw error;
  return data as DashboardSummary;
}
export type CardSpec = { label: string; value: string; hint?: string; href: string; tone?: "default" | "warn" | "danger" };
export function cardsFromSummary(s: DashboardSummary): CardSpec[] {
  const cat = s.items_by_category ?? {};
  const total = Object.entries(cat).filter(([k]) => k !== "SW").reduce((a, [, v]) => a + v, 0);
  const staleDays = s.snapshot_date ? Math.floor((Date.now() - Date.parse(s.snapshot_date)) / 86_400_000) : Infinity;
  return [
    { label: "예측 대상 품목", value: fmtInt(total), hint: ["PART", "SUPPLY", "OPTION"].map(k => `${k} ${fmtInt(cat[k] ?? 0)}`).join(" · "), href: drillHref("/items", {}) },
    { label: "더미 설정 비율", value: fmtPct(s.dummy_ratio), hint: "실데이터 업로드 시 감소", href: drillHref("/items", { dummy: true }), tone: (s.dummy_ratio ?? 0) > 0.5 ? "warn" : "default" },
    { label: "승인 대기", value: fmtInt(s.pending_approvals), href: drillHref("/approvals", { status: "pending" }), tone: s.pending_approvals > 0 ? "warn" : "default" },
    { label: "최근 업로드", value: s.last_upload ? `${fmtInt(s.last_upload.ok_count)}건` : "-", hint: s.last_upload ? `${s.last_upload.file_name} · 오류 ${s.last_upload.error_count}` : "업로드 이력 없음", href: drillHref("/upload", { tab: "log" }), tone: (s.last_upload?.error_count ?? 0) > 0 ? "warn" : "default" },
    { label: "재고 스냅샷 기준일", value: fmtDate(s.snapshot_date), hint: isFinite(staleDays) ? `${staleDays}일 전` : undefined, href: drillHref("/items", { sort: "snap_date" }), tone: staleDays > 30 ? "warn" : "default" },
    { label: "목표 DoS 미설정", value: fmtInt(s.missing_target_dos), hint: "발주 확정 차단 대상 (R-OQ-03)", href: drillHref("/items", { target_dos: "missing" }), tone: s.missing_target_dos > 0 ? "danger" : "default" },
  ];
}
```
`web/app/(app)/dashboard/page.tsx`: 서버 컴포넌트. `createServerSupabase()` → `fetchDashboardSummary` → `cardsFromSummary` → `<DashboardCards cards />` (grid 3열). 상단 제목 "대시보드", 부제 "카드를 클릭하면 상세 데이터로 이동합니다".
`DashboardCards.tsx`: `cards.map(c => <DrillCard key={c.label} {...c} />)`.

- [ ] **Step 4: 통과·수동 확인** — `npm test`; 브라우저에서 6개 카드 클릭 시 각 URL 로 이동(404 여도 됨 — 다음 Task 에서 구현).

- [ ] **Step 5: 커밋** — `git commit -m "feat(web): 대시보드 요약 카드 + 드릴다운"`

---

### Task 10: 품목 목록 · 상세

**Files:**
- Create: `web/lib/queries/items.ts`, `web/app/(app)/items/page.tsx`, `web/app/(app)/items/ItemsTable.tsx`, `web/app/(app)/items/[code]/page.tsx`, `web/app/(app)/items/[code]/ItemDetail.tsx`
- Test: `web/tests/unit/itemsQuery.test.ts`

**Interfaces:**
- `ItemFilters = { category?: string; q?: string; dummy?: boolean; target_dos?: "missing"; sort?: string; page?: number }`; `parseItemFilters(searchParams: Record<string,string|undefined>): ItemFilters`
- `applyItemFilters(query, f)` — supabase 쿼리 빌더에 `.eq/.ilike/.is` 적용 (순수 함수, 빌더 mock 으로 테스트)
- `fetchItems(sb, f): Promise<{rows: ItemMasterRow[], count: number}>` — `analytics.v_item_master`, `.range()` 200행, `count: 'exact'`
- `fetchItemDetail(sb, code): Promise<{ master: ItemMasterRow; monthly: {ym,qty}[]; xcn: {related_item}[]; models: {model_base, link_source}[]; setting: ItemSettingRow|null; inbound: InboundRow[]; snapshots: SnapshotRow[] }>`

- [ ] **Step 1: 테스트**

`web/tests/unit/itemsQuery.test.ts`:
```ts
import { parseItemFilters, applyItemFilters } from "@/lib/queries/items";
it("parses drill params", () => {
  expect(parseItemFilters({ category: "PART", dummy: "true", target_dos: "missing", page: "2" }))
    .toEqual({ category: "PART", dummy: true, target_dos: "missing", page: 2, q: undefined, sort: undefined });
});
it("applies filters to builder", () => {
  const calls: string[] = [];
  const b: any = new Proxy({}, { get: (_, k) => (...a: any[]) => { calls.push(`${String(k)}(${a.join(",")})`); return b; } });
  applyItemFilters(b, { category: "SUPPLY", dummy: true, target_dos: "missing", q: "toner" });
  expect(calls).toEqual(["eq(category,SUPPLY)", "eq(setting_is_dummy,true)", "is(target_dos_days,null)", "or(key_code.ilike.%toner%,description.ilike.%toner%)"]);
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현**

`web/lib/queries/items.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
export type ItemFilters = { category?: string; q?: string; dummy?: boolean; target_dos?: "missing"; sort?: string; page?: number };
export const PAGE = 200;
export function parseItemFilters(sp: Record<string, string | undefined>): ItemFilters {
  return { category: sp.category || undefined, q: sp.q || undefined, dummy: sp.dummy === "true" ? true : undefined,
    target_dos: sp.target_dos === "missing" ? "missing" : undefined, sort: sp.sort || undefined, page: sp.page ? Number(sp.page) : undefined };
}
export function applyItemFilters(q: any, f: ItemFilters) {
  if (f.category) q = q.eq("category", f.category);
  if (f.dummy) q = q.eq("setting_is_dummy", true);
  if (f.target_dos === "missing") q = q.is("target_dos_days", null);
  if (f.q) q = q.or(`key_code.ilike.%${f.q}%,description.ilike.%${f.q}%`);
  return q;
}
export async function fetchItems(sb: SupabaseClient<any>, f: ItemFilters) {
  const page = f.page ?? 1;
  let q: any = sb.schema("analytics").from("v_item_master").select("*", { count: "exact" });
  q = applyItemFilters(q, f);
  const [col, dir] = (f.sort ?? "total_12m.desc").split(".");
  q = q.order(col, { ascending: dir !== "desc", nullsFirst: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}
export async function fetchItemDetail(sb: SupabaseClient<any>, code: string) {
  const [master, monthly, xcn, models, setting, inbound, snapshots] = await Promise.all([
    sb.schema("analytics").from("v_item_master").select("*").eq("key_code", code).single(),
    sb.schema("analytics").from("v_item_monthly").select("ym,qty").eq("key_code", code).order("ym"),
    sb.schema("core").from("v_part_linkage").select("related_item").eq("hoc_item", code),
    sb.schema("core").from("v_option_model_link").select("model_base,link_source").eq("item_code", code),
    sb.schema("app").from("v_item_setting").select("*").eq("item_code", code).maybeSingle(),
    sb.schema("app").from("inbound").select("*").eq("item_code", code).order("planned_date"),
    sb.schema("app").from("inventory_snapshot").select("snap_date,qty,stock_class,is_dummy").eq("item_code", code).order("snap_date", { ascending: false }).limit(12),
  ]);
  if (master.error) throw master.error;
  return { master: master.data, monthly: monthly.data ?? [], xcn: xcn.data ?? [], models: models.data ?? [], setting: setting.data, inbound: inbound.data ?? [], snapshots: snapshots.data ?? [] };
}
```
`core` 스키마 노출: Supabase 대시보드 → Settings → API → "Exposed schemas" 에 `app, analytics, core` 추가 (supabase-js 가 `.schema()` 로 접근하려면 필수). 이 설정은 `docs/05-data-catalog.md` 에 기록.
`items/page.tsx`: 서버 컴포넌트, `searchParams` → `parseItemFilters` → `fetchItems` → `<ItemsTable rows count filters />`. 상단: 카테고리 탭(전체/PART/SUPPLY/OPTION/SW → `drillHref` 로 링크), 검색 폼(GET), 활성 필터 배지(클릭 시 제거).
`ItemsTable.tsx`: `DataGrid` 컬럼 — 코드, 설명, 카테고리, 제품군, 6M평균, 12M합, 현재고, 입고예정, DoS, 목표DoS, MOQ, 설정상태(더미 배지), 최근출고월. `onRowClick` → `router.push('/items/'+code)`. 페이지네이션(이전/다음 링크).
`items/[code]/page.tsx` + `ItemDetail.tsx`: 헤더(코드·설명·카테고리·제품군), 4개 `DrillCard`(현재고→`/items/[code]#snapshots`, 입고예정→`#inbound`, DoS, 목표DoS→`/admin/item-settings?item=code`), `TimeSeriesChart`(실제 출고, role actual), `TreeGrid`(1행 "월별 출고", pastUntil=마지막 월) — SP3 에서 전개 행 추가, XCN 연계 코드 배지 목록(PART), 연결 기종 배지(OPTION, link_source 표시), 재고 스냅샷/입고예정 표(더미는 회색 배지).

- [ ] **Step 4: 통과·수동 확인** — `npm test`; `/items?category=PART` 6,001건, 검색·정렬 동작, 행 클릭 → 상세, 상세에 차트 표시. 드릴다운 `/items?target_dos=missing` 은 0건(시드 후).

- [ ] **Step 5: 커밋** — `git commit -m "feat(web): 품목 목록/상세 (필터·드릴다운·차트)"`

---

### Task 11: 관리자 화면 (시스템 설정 · 공급처 · 품목 설정+승인 요청 · 공휴일 · EOL/EOS)

**Files:**
- Create: `web/lib/queries/admin.ts`, `web/app/(app)/admin/settings/page.tsx` + `SettingsForm.tsx`, `admin/suppliers/page.tsx` + `SupplierTable.tsx`, `admin/item-settings/page.tsx` + `ItemSettingForm.tsx`, `admin/holidays/page.tsx`, `admin/eol/page.tsx`, `web/app/(app)/admin/actions.ts`
- Test: `web/tests/unit/adminActions.test.ts`

**Interfaces:**
- 서버 액션 (`admin/actions.ts`, 모두 `getProfile()` 로 역할 검사 후 supabase 호출, 실패 시 `{ok:false,error}`):
  - `updateSystemSetting(key: string, value: unknown)` — admin 만
  - `upsertSupplier(row: SupplierInput)`, `deleteSupplier(id)` — admin/item_manager
  - `requestItemSettingApproval(item_code, payload: {target_dos_days?, moq?, unit_price?, allocation_mode?}, reason)` → `fn_request_approval('item_setting', 'app.item_setting', item_code, payload, reason)`
  - `upsertHoliday(date, name)`, `deleteHoliday(date)`, `upsertEol(model_base, launch_date, eol_date, eos_date)`
- `validateItemSettingPayload(p): {ok:true} | {ok:false, error:string}` — target_dos 1~365, moq ≥1 정수, unit_price ≥0, 사유 필수(빈 문자열 불가). 순수 함수.

- [ ] **Step 1: 테스트**

`web/tests/unit/adminActions.test.ts`:
```ts
import { validateItemSettingPayload } from "@/lib/queries/admin";
it("rejects bad values", () => {
  expect(validateItemSettingPayload({ target_dos_days: 0 }, "이유")).toEqual({ ok: false, error: "목표 DoS 는 1~365 일이어야 합니다" });
  expect(validateItemSettingPayload({ moq: 1.5 }, "이유").ok).toBe(false);
  expect(validateItemSettingPayload({ moq: 10 }, "").ok).toBe(false);
});
it("accepts valid", () => {
  expect(validateItemSettingPayload({ target_dos_days: 45, moq: 10, unit_price: 1000, allocation_mode: "manual" }, "기종 특성상 45일").ok).toBe(true);
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현**

`web/lib/queries/admin.ts` (validate + 조회 함수 `fetchSettings`, `fetchSuppliers`, `fetchItemSetting(code)`, `fetchHolidays(year)`, `fetchEol()`):
```ts
export type ItemSettingPayload = { target_dos_days?: number; moq?: number; unit_price?: number; allocation_mode?: "auto" | "manual" };
export function validateItemSettingPayload(p: ItemSettingPayload, reason: string): { ok: true } | { ok: false; error: string } {
  if (p.target_dos_days !== undefined && !(Number.isInteger(p.target_dos_days) && p.target_dos_days >= 1 && p.target_dos_days <= 365)) return { ok: false, error: "목표 DoS 는 1~365 일이어야 합니다" };
  if (p.moq !== undefined && !(Number.isInteger(p.moq) && p.moq >= 1)) return { ok: false, error: "MOQ 는 1 이상 정수여야 합니다" };
  if (p.unit_price !== undefined && !(p.unit_price >= 0)) return { ok: false, error: "단가는 0 이상이어야 합니다" };
  if (!reason || !reason.trim()) return { ok: false, error: "변경 사유를 입력하세요" };
  return { ok: true };
}
```
화면:
- `/admin/settings`: `system_settings` 전체를 표로, 각 행 value(jsonb) 를 텍스트로 편집 → `updateSystemSetting`. `flex_ranges` 는 offset/pct 표 편집기. 저장 후 `router.refresh()` + toast.
- `/admin/suppliers`: `DataGrid` + 추가/편집 Dialog(code, name, country, prep_days, lead_time_days). 더미 배지.
- `/admin/item-settings?item=CODE`: 상단 품목 검색(자동완성 → `/items` 검색 재사용), 선택 시 현재 값(v_item_setting) + 편집 폼(목표 DoS, MOQ, 단가, 배정방식) + **사유 필수** → "승인 요청" 버튼 → `requestItemSettingApproval`. 상태 pending 이면 폼 잠금 + "승인 대기 중" 배지. 하단에 이 품목의 `audit_log` 최근 20건(before/after diff 표시).
- `/admin/holidays`: 연도 선택, 표 + 추가/삭제.
- `/admin/eol`: `v_model`(core) 기종 목록 + launch/eol/eos 날짜 인라인 편집 → `upsertEol`.

- [ ] **Step 4: 통과·수동 확인** — `npm test`; manager@scm.test 로 품목 설정 변경 → 승인 요청 → `app.approval` pending 1행, lead 계정 알림 1건 생성 확인(`select * from app.notification`).

- [ ] **Step 5: 커밋** — `git commit -m "feat(web): 관리자 화면 (설정·공급처·품목설정 승인요청·공휴일·EOL)"`

---

### Task 12: 승인함 · 알림

**Files:**
- Create: `web/lib/queries/approvals.ts`, `web/lib/queries/notifications.ts`, `web/app/(app)/approvals/page.tsx` + `ApprovalList.tsx` + `actions.ts`, `web/app/(app)/notifications/page.tsx` + `NotificationList.tsx`
- Test: `web/tests/unit/approvals.test.ts`

**Interfaces:**
- `fetchApprovals(sb, {status?: 'pending'|'approved'|'rejected'})` — `app.v_my_approvals`
- 서버 액션 `decideApproval(id, decision: 'approved'|'rejected', comment)` → `fn_decide_approval`; 반려 시 comment 필수 (클라이언트 검증 `validateDecision`).
- `fetchNotifications(sb, {unreadOnly})`, 서버 액션 `markRead(ids: number[])` → `fn_mark_read`
- `describeApproval(a): string` — kind·payload 를 한국어 문장으로 ("품목 556K59129 목표 DoS 30 → 45, MOQ 1 → 10")

- [ ] **Step 1: 테스트**

`web/tests/unit/approvals.test.ts`:
```ts
import { describeApproval, validateDecision } from "@/lib/queries/approvals";
it("describes item_setting payload", () => {
  const s = describeApproval({ kind: "item_setting", target_pk: "556K59129", payload: { target_dos_days: 45, moq: 10 } } as any, { target_dos_days: 30, moq: 1 });
  expect(s).toBe("품목 556K59129: 목표 DoS 30 → 45, MOQ 1 → 10");
});
it("requires comment on reject", () => {
  expect(validateDecision("rejected", "")).toEqual({ ok: false, error: "반려 사유를 입력하세요" });
  expect(validateDecision("approved", "").ok).toBe(true);
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현**

`web/lib/queries/approvals.ts`:
```ts
const LABEL: Record<string, string> = { target_dos_days: "목표 DoS", moq: "MOQ", unit_price: "단가", allocation_mode: "배정방식" };
export function describeApproval(a: { kind: string; target_pk: string; payload: Record<string, unknown> }, current?: Record<string, unknown>): string {
  const parts = Object.entries(a.payload ?? {}).map(([k, v]) => `${LABEL[k] ?? k} ${current?.[k] ?? "-"} → ${v}`);
  const subject = a.kind === "item_setting" ? `품목 ${a.target_pk}` : `${a.kind} ${a.target_pk}`;
  return `${subject}: ${parts.join(", ")}`;
}
export function validateDecision(d: "approved" | "rejected", comment: string) {
  if (d === "rejected" && !comment.trim()) return { ok: false as const, error: "반려 사유를 입력하세요" };
  return { ok: true as const };
}
```
화면:
- `/approvals?status=pending`: 상태 탭(대기/승인/반려 — `drillHref`), 목록 카드: 요청자·시각·`describeApproval`(현재값은 `v_item_setting` 조회)·사유. 팀장/관리자에게만 승인/반려 버튼(Dialog 에 의견 입력). 처리 후 `router.refresh()`.
- `/notifications`: 미읽음 우선 목록, 클릭 시 `payload.approval_id` 있으면 `/approvals?status=pending` 로 이동 + `markRead`. "모두 읽음" 버튼. Topbar 배지는 TanStack Query `invalidateQueries(['unread'])`.

- [ ] **Step 4: 통과·수동 확인** — Task 11 의 pending 건을 lead 로 승인 → `item_setting.status='approved'`, `target_dos_days` 반영, `audit_log` 에 UPDATE 행, manager 에 알림 도착. 반려 경로도 1회.

- [ ] **Step 5: 커밋** — `git commit -m "feat(web): 승인함, 알림"`

---

### Task 13: 업로드 파이프라인

**Files:**
- Create: `web/lib/upload/templates.ts`, `parse.ts`, `validate.ts`, `apply.ts`, `web/components/upload/UploadWizard.tsx`, `ColumnMapper.tsx`, `web/app/(app)/upload/page.tsx` + `actions.ts`, `web/public/templates/*.csv` (대상별 헤더 템플릿 8개)
- Test: `web/tests/unit/upload.test.ts`, `web/tests/fixtures/inventory_sample.csv`

**Interfaces:**
- `UPLOAD_TARGETS: Record<TargetKey, { label: string; columns: { key: string; label: string; required: boolean; type: 'text'|'int'|'number'|'date'|'ym'|'enum'; enum?: string[] }[]; mode: 'upsert'|'replace' }>` — TargetKey = inventory_snapshot | inbound | item_setting | attach_rate | supplier | eol_eos | holiday | shipment_extra
- `parseFile(file: File): Promise<{ headers: string[]; rows: Record<string,string>[] }>` — SheetJS, 첫 시트, 문자열 그대로
- `autoMap(headers: string[], target: TargetKey): Record<string /*key*/, string | undefined /*header*/>` — 동일/유사 이름 자동 매핑 (소문자·공백 제거 비교, 한국어 라벨도 비교)
- `normalizeRows(rows, mapping, target): { rows: Record<string,unknown>[]; errors: {row:number; message:string}[] }` — 타입 변환(int/number/date 'YYYY-MM-DD'/ym 'YYYY-MM')·필수 검사·enum 검사. 오류 행은 제외.
- 서버 액션 `applyUpload(target, rows, fileName)` → `fn_apply_upload(target, rows, mode, fileName)` → 결과 + `fn_refresh_matviews()` 호출 → `revalidatePath('/items')`.

- [ ] **Step 1: 테스트**

`web/tests/fixtures/inventory_sample.csv`:
```
품목코드,기준일,수량,재고구분
556K59129,2026-09-10,120,normal
BAD-CODE,2026-09-10,5,normal
556K59129,2026-09-10,abc,normal
```
`web/tests/unit/upload.test.ts`:
```ts
import { autoMap, normalizeRows } from "@/lib/upload/validate";
it("auto-maps korean headers", () => {
  expect(autoMap(["품목코드", "기준일", "수량", "재고구분"], "inventory_snapshot")).toEqual({ item_code: "품목코드", snap_date: "기준일", qty: "수량", stock_class: "재고구분" });
});
it("normalizes and reports row errors", () => {
  const mapping = { item_code: "품목코드", snap_date: "기준일", qty: "수량", stock_class: "재고구분" };
  const rows = [{ 품목코드: "556K59129", 기준일: "2026-09-10", 수량: "120", 재고구분: "normal" }, { 품목코드: "556K59129", 기준일: "2026-09-10", 수량: "abc", 재고구분: "normal" }, { 품목코드: "", 기준일: "2026/09/10", 수량: "1", 재고구분: "x" }];
  const r = normalizeRows(rows, mapping, "inventory_snapshot");
  expect(r.rows).toEqual([{ item_code: "556K59129", snap_date: "2026-09-10", qty: 120, stock_class: "normal" }]);
  expect(r.errors.map(e => e.row)).toEqual([2, 3]);
  expect(r.errors[1].message).toMatch(/품목코드/);
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현**

`templates.ts`: 8개 대상 정의. 예:
```ts
inventory_snapshot: { label: "재고 스냅샷", mode: "replace", columns: [
  { key: "item_code", label: "품목코드", required: true, type: "text" },
  { key: "snap_date", label: "기준일", required: true, type: "date" },
  { key: "qty", label: "수량", required: true, type: "number" },
  { key: "stock_class", label: "재고구분", required: false, type: "enum", enum: ["normal","inspection","defect","service_center","partner","in_transit"] } ] },
inbound: 품목코드, 공급처코드(supplier_code), PO번호(po_no), 수량, 계획입고일(planned_date), 실제입고일(actual_date), 상태(enum ordered/shipped/received)
item_setting: 품목코드, 목표DoS(target_dos_days,int), MOQ(int), 단가(unit_price), 배정방식(enum auto/manual)
attach_rate: 기종(model_base), 옵션코드(option_item_code), 장착률(rate, number 0~1), 적용월(effective_ym, ym)
supplier: 코드(code), 이름(name), 국가(country), 출항준비일(prep_days,int), 리드타임일(lead_time_days,int)
eol_eos: 기종(model_base), 출시일, EOL일, EOS일 (date)
holiday: 날짜(date), 이름(name), 국가(country)
shipment_extra: 품목코드, 월(ym), 수량(qty), 품목유형(item_type enum PART/SUPPLY/OPTION)
```
`validate.ts`:
```ts
import { UPLOAD_TARGETS, type TargetKey } from "./templates";
const norm = (s: string) => s.toLowerCase().replace(/[\s_\-()]/g, "");
export function autoMap(headers: string[], target: TargetKey) {
  const out: Record<string, string | undefined> = {};
  for (const c of UPLOAD_TARGETS[target].columns) {
    out[c.key] = headers.find(h => norm(h) === norm(c.key) || norm(h) === norm(c.label));
  }
  return out;
}
const DATE = /^\d{4}-\d{2}-\d{2}$/, YM = /^\d{4}-\d{2}$/;
export function normalizeRows(rows: Record<string, string>[], mapping: Record<string, string | undefined>, target: TargetKey) {
  const cols = UPLOAD_TARGETS[target].columns; const out: Record<string, unknown>[] = []; const errors: { row: number; message: string }[] = [];
  rows.forEach((r, i) => {
    const o: Record<string, unknown> = {}; const errs: string[] = [];
    for (const c of cols) {
      const raw = mapping[c.key] ? (r[mapping[c.key]!] ?? "").toString().trim() : "";
      if (!raw) { if (c.required) errs.push(`${c.label} 필수`); continue; }
      switch (c.type) {
        case "int": Number.isInteger(Number(raw)) ? (o[c.key] = Number(raw)) : errs.push(`${c.label} 정수 아님: ${raw}`); break;
        case "number": isNaN(Number(raw)) ? errs.push(`${c.label} 숫자 아님: ${raw}`) : (o[c.key] = Number(raw)); break;
        case "date": DATE.test(raw) ? (o[c.key] = raw) : errs.push(`${c.label} 날짜 형식(YYYY-MM-DD) 아님: ${raw}`); break;
        case "ym": YM.test(raw) ? (o[c.key] = raw) : errs.push(`${c.label} 월 형식(YYYY-MM) 아님: ${raw}`); break;
        case "enum": c.enum!.includes(raw) ? (o[c.key] = raw) : errs.push(`${c.label} 허용값 아님: ${raw}`); break;
        default: o[c.key] = raw;
      }
    }
    if (errs.length) errors.push({ row: i + 1, message: errs.join("; ") }); else out.push(o);
  });
  return { rows: out, errors };
}
```
`parse.ts`: `XLSX.read(await file.arrayBuffer(), { type: "array", raw: false, cellDates: true })` → `sheet_to_json(ws, { header: 1, defval: "" })` → 첫 행 헤더, 날짜 셀은 `XLSX.SSF.format("yyyy-mm-dd")`.
`UploadWizard.tsx` 4단계: ① 대상 선택 + 템플릿 다운로드 링크 + 파일 드롭 → ② `ColumnMapper`(대상 컬럼별 select, autoMap 초기값, 미리보기 50행) → ③ 검증 결과 카드 2개(`DrillCard` 스타일: 정상 N건 / 오류 N건 → 클릭 시 아래 표 필터) + 오류 CSV 다운로드 → ④ "반영" → `applyUpload` → 결과(서버 오류 행 포함) + upload_log 링크.
`upload/page.tsx?tab=log`: 탭 "업로드" / "이력"(upload_log DataGrid, 행 클릭 시 errors 펼침).

- [ ] **Step 4: 통과·수동 확인** — `npm test`; fixtures CSV 업로드 → 정상 1 / 클라이언트 오류 1(abc) / 서버 오류 1(BAD-CODE → UNKNOWN_ITEM) → `/items/556K59129` 현재고 120, snap_date 2026-09-10, 더미 배지 사라짐.

- [ ] **Step 5: 커밋** — `git commit -m "feat(web): 업로드 위저드 (파싱·매핑·검증·반영·이력)"`

---

### Task 14: E2E · 성능 측정 · 문서 마감

**Files:**
- Create: `web/playwright.config.ts`, `web/tests/e2e/smoke.spec.ts`, `web/tests/e2e/perf.spec.ts`, `docs/reports/sp1-verification.md`
- Modify: `docs/05-data-catalog.md`, `docs/03-decisions.md`, `docs/04-open-questions.md`, `CLAUDE.md`(실행 명령 섹션)

- [ ] **Step 1: Playwright 설정** — `npx playwright install chromium`; config: `baseURL: http://localhost:3000`, `webServer: { command: 'npm run dev', port: 3000, reuseExistingServer: true }`, 환경변수 `E2E_PASSWORD`(기본 Scm!2026test).

- [ ] **Step 2: smoke.spec.ts**

```ts
import { test, expect } from "@playwright/test";
const PW = process.env.E2E_PASSWORD ?? "Scm!2026test";
async function login(page, email: string) {
  await page.goto("/login"); await page.fill("input[name=email]", email); await page.fill("input[name=password]", PW);
  await page.click("button[type=submit]"); await page.waitForURL("**/dashboard");
}
test("품목담당자: 업로드 → 설정 승인요청, 팀장: 승인", async ({ page }) => {
  await login(page, "manager@scm.test");
  // 대시보드 카드 6개 전부 링크
  const cards = page.locator("a[aria-label$='상세 보기']"); await expect(cards).toHaveCount(6);
  // 업로드
  await page.goto("/upload"); await page.selectOption("select[name=target]", "inventory_snapshot");
  await page.setInputFiles("input[type=file]", "tests/fixtures/inventory_sample.csv");
  await page.click("text=다음"); await page.click("text=검증"); await expect(page.locator("text=정상 1건")).toBeVisible();
  await page.click("text=반영"); await expect(page.locator("text=반영 완료")).toBeVisible();
  await page.goto("/items/556K59129"); await expect(page.locator("text=120")).toBeVisible();
  // 설정 변경 승인 요청
  await page.goto("/admin/item-settings?item=556K59129");
  await page.fill("input[name=target_dos_days]", "45"); await page.fill("textarea[name=reason]", "E2E 테스트");
  await page.click("text=승인 요청"); await expect(page.locator("text=승인 대기 중")).toBeVisible();
  // 팀장 승인
  await page.context().clearCookies(); await login(page, "lead@scm.test");
  await page.goto("/approvals?status=pending"); await page.click("text=승인 >> nth=0"); await page.click("text=확인");
  await page.goto("/items/556K59129"); await expect(page.locator("text=45")).toBeVisible();
});
test("영업 역할은 관리자 메뉴가 없다", async ({ page }) => {
  await login(page, "sales@scm.test");
  await expect(page.locator("nav a")).toHaveCount(3);
  await page.goto("/admin/settings"); await expect(page).toHaveURL(/dashboard|403/);
});
```

- [ ] **Step 3: perf.spec.ts** — 로그인 후 `/dashboard → /items → /items/[code] → /approvals → /notifications` 순회하며 각 전환의 `performance.now()` 차이(클릭 → `networkidle`)를 측정, **각 1,000ms 미만** 단언, 결과를 콘솔 표로 출력.

- [ ] **Step 4: 실행** — `npm run build && npm start` (프로덕션 모드로 측정) 후 `npm run test:e2e`. 실패 시 원인 수정(초기 데이터 서버 동봉, 물리화 뷰 인덱스, `select` 컬럼 축소).

- [ ] **Step 5: 검증 리포트·문서**

`docs/reports/sp1-verification.md`: 완료 기준 6개(spec §10) 각각 증거(명령·출력 요약·스크린샷 경로). `uv run engine verify --target postgres` 결과 포함.
`docs/05-data-catalog.md`: app 테이블·뷰·RPC 등록, "Exposed schemas 설정" 기록.
`CLAUDE.md`: "## 실행" 섹션 — migrate/load-raw/seed-app/gen:types/dev/test 명령.
`docs/03-decisions.md`: 구현 중 변경한 결정 D-nnn 추가. `04-open-questions.md` 갱신.

- [ ] **Step 6: 커밋·푸시** — `git add -A && git commit -m "test: SP1 E2E·성능 측정, 검증 리포트, 문서 마감" && git push`

---

## 셀프 리뷰 결과

- **Spec 커버리지**: §2 레포(T1) · §3.1 이관/뷰 수정(T4) · §3.2~3.6 app 스키마/뷰/설정/시드/RLS(T5,T6) · §4 업로드(T13) · §5 웹 라우트 전부(T7~T13) · §6 엔진(T2,T3,T6) · §7 오류처리(RPC 예외 코드 T5, 업로드 행 격리 T5/T13) · §8 테스트(각 Task + T14) · §9 환경(T1,T7) · §10 완료 기준(T14).
- **타입 일관성**: `key_code`(v_item_master/v_item_monthly) ↔ 화면 `code` 파라미터, `fn_*` RPC 명 T5 ↔ T9/T11/T12/T13 호출 일치, `DrillCard.href` 필수 ↔ `cardsFromSummary` 전 항목 href.
- **미정 항목**: 없음. `fn_decide_approval` 의 order_plan/priority_alloc/bulkdeal 분기는 SP3/SP4 범위로 명시.
