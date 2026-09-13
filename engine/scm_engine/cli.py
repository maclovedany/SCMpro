from __future__ import annotations
from datetime import date
from pathlib import Path
import typer
from .config import Settings, ENGINE_DIR
from .db.sqlite import SQLiteDB
from .db.postgres import PostgresDB
from . import export_raw, verify

app = typer.Typer(help="SCM 엔진 CLI")
ROOT = ENGINE_DIR.parent

def _sqlite() -> SQLiteDB:
    return SQLiteDB(Settings.load().sqlite_path)

def _pg() -> PostgresDB:
    s = Settings.load()
    if not s.db_url:
        raise typer.BadParameter("engine/.env 의 SUPABASE_DB_URL 이 비어 있습니다")
    return PostgresDB(s.db_url)

@app.command("export-raw")
def export_raw_cmd(out: Path = ROOT / "data" / "export"):
    counts = export_raw.export_all(_sqlite(), out)
    for t, n in counts.items():
        typer.echo(f"{t:24} {n:>8}")

@app.command("verify")
def verify_cmd(target: str = "postgres", report_dir: Path = ROOT / "docs" / "reports"):
    src = _sqlite()
    dst = _pg() if target == "postgres" else src
    counts = verify.compare_counts(src, dst)
    multi = verify.xcn_multi_hoc_report(src)
    mism = verify.hoc_mismatch_report(src)
    report_dir.mkdir(parents=True, exist_ok=True)
    p = report_dir / f"verify-{date.today():%Y%m%d}.md"
    p.write_text(
        f"# 검증 리포트 ({date.today()}, target={target})\n\n## 행수 대조 (src=scm.db)\n"
        + counts.to_markdown(index=False)
        + f"\n\n## XCN 다중 HOC 귀속 (R-XCN-08) — {len(multi)}건 (상위 50)\n" + multi.head(50).to_markdown(index=False)
        + f"\n\n## CSV HOC vs XCN 불일치 (R-XCN-07) — {len(mism)}건 (상위 50)\n" + mism.head(50).to_markdown(index=False) + "\n",
        encoding="utf-8")
    typer.echo(counts.to_string(index=False))
    typer.echo(f"리포트: {p}")
    raise typer.Exit(code=0 if bool(counts["ok"].all()) else 1)

if __name__ == "__main__":
    app()

@app.command("seed-app")
def seed_app_cmd(snap_date: str = "2026-08-31", target: str = "postgres",
                 out: Path = ROOT / "supabase" / "seed" / "app_seed.sql"):
    """더미 시드 SQL 생성 (D-007). 키 집합은 Postgres(core 뷰 최신 규칙) 기준이 정본."""
    from . import seed_app
    db = _pg() if target == "postgres" else _sqlite()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(seed_app.build_seed_sql(db, snap_date), encoding="utf-8")
    typer.echo(f"생성: {out}")

@app.command("gen-types")
def gen_types_cmd(out: Path = ROOT / "web" / "lib" / "types" / "database.ts"):
    """web/lib/types/database.ts 생성 (app, analytics, core)."""
    from . import gen_types
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("// 자동 생성: engine gen-types — 수정 금지\n" + gen_types.generate(_pg()), encoding="utf-8")
    typer.echo(f"생성: {out}")
