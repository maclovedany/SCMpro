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

forecast_app = typer.Typer(help="예측 엔진 (SP2)")
app.add_typer(forecast_app, name="forecast")

@forecast_app.command("backtest")
def fc_backtest(eval_fy: int = 2025, n_jobs: int = 3, heavy_limit: int = None, item_limit: int = None):
    """FY 롤링 백테스트 (R-FC-40). 학습 ~ eval_fy-1, 평가 eval_fy."""
    import logging; logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    from .forecast import runner
    rid = runner.backtest(_pg(), eval_fy, n_jobs=n_jobs, heavy_limit=heavy_limit, item_limit=item_limit)
    typer.echo(f"run_id={rid}")

@forecast_app.command("run")
def fc_run(horizon: int = None, n_jobs: int = 3, heavy_limit: int = None):
    """프로덕션 예측 (최신 백테스트 챔피언 사용)."""
    import logging; logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    from .forecast import runner
    rid = runner.production(_pg(), horizon, n_jobs=n_jobs, heavy_limit=heavy_limit)
    typer.echo(f"run_id={rid}")

@forecast_app.command("pending")
def fc_pending(n_jobs: int = 3):
    """웹에서 요청된(requested) 런 처리."""
    import logging; logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    from .forecast import runner
    for rid in runner.process_pending(_pg(), n_jobs=n_jobs):
        typer.echo(f"done {rid}")

@forecast_app.command("tune")
def fc_tune(run_id: str = None, model: str = None):
    """gpt-5-nano 로 최신(또는 지정) 백테스트 런의 오차를 분석해 조정안 저장 (R-FC-42)."""
    from dotenv import load_dotenv; load_dotenv(ENGINE_DIR / ".env")
    from .forecast import ai_tuning
    db = _pg()
    if not run_id:
        run_id = db.read_df("select id from app.forecast_run where run_type='backtest' and status='done' order by finished_at desc limit 1").iloc[0, 0]
    pid = ai_tuning.tune(db, str(run_id), model)
    typer.echo(f"proposal_id={pid} (run {run_id})")

@app.command("tick")
def tick_cmd():
    """주기 작업 (pg_cron 대안): 배정 만료·예고·반복 알림 + 제출 마감 알림 + 이메일 발송."""
    from dotenv import load_dotenv; load_dotenv(ENGINE_DIR / ".env")
    from . import notify
    from .forecast import auto_run
    db = _pg()
    res = db.read_df("select app.fn_tick() as r").iloc[0, 0]
    auto = auto_run.maybe_run(db)          # 월 1회 자동 백테스트·프로덕션 (D-041) — 설정 off 면 즉시 반환
    from . import agent
    ag = agent.run(db)                     # 자율 모드 감시 (D-042) — agent_mode off 면 즉시 반환
    from .forecast import runner, store
    n_jobs = int(store.load_settings(db).get("engine_n_jobs", 3))
    pend = runner.process_pending(db, n_jobs=n_jobs)   # 웹 요청 런·AI 분석 요청 처리 (D-052)
    mail = notify.send_pending(db)
    typer.echo(f"tick={res} auto_run={auto} agent={ag} pending={len(pend)} email={mail}")

@app.command("agent")
def agent_cmd(mode: str = None, no_llm: bool = False):
    """AI 감시 1회 실행 (D-042). --mode off|dryrun|notify|propose 로 설정을 덮어쓰고, --no-llm 이면 규칙 판단만."""
    from dotenv import load_dotenv; load_dotenv(ENGINE_DIR / ".env")
    from . import agent
    typer.echo(str(agent.run(_pg(), mode_override=mode, use_llm=not no_llm)))

@app.command("notify")
def notify_cmd(dry_run: bool = False):
    """이메일 채널 미발송 알림 발송 (SMTP 미설정 시 skipped)."""
    from dotenv import load_dotenv; load_dotenv(ENGINE_DIR / ".env")
    from . import notify
    typer.echo(str(notify.send_pending(_pg(), dry_run=dry_run)))
