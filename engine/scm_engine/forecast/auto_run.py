"""자동 런 스케줄 (D-041, R-FC-43): 관리자 설정(auto_run_*)에 따라 매월 지정일·시각 이후 첫 tick 에서
백테스트(최근 완결 FY) → 프로덕션 예측 → (옵션) AI 오차 분석을 실행하고, 결과를 SCM팀장·품목담당자·관리자에게 알린다.
한 달에 한 번만(app.auto_run_log.month), 동시 실행은 advisory lock 으로 막는다."""
from __future__ import annotations
import json, logging
from datetime import datetime, timedelta, timezone
import pandas as pd
from ..fiscal import fy_of, fy_range

log = logging.getLogger(__name__)
KST = timezone(timedelta(hours=9))
LOCK_KEY = "scm-auto-run"

def eval_fy_for(last_actual_ym: str, fy_start: int = 4) -> int:
    """백테스트 평가 FY = 실적이 끝까지 있는 가장 최근 회계연도. 진행 중인 FY 는 전년도를 평가."""
    fy = fy_of(last_actual_ym, fy_start)
    return fy if last_actual_ym >= fy_range(fy, fy_start)[1] else fy - 1

def due(settings: dict, now_kst: datetime, done_month: str | None) -> tuple[bool, str]:
    """이번 달 실행 시점이 지났고 아직 안 돌았으면 True. (활성화, 실행일, 실행 시각 은 관리자 설정)"""
    if not settings.get("auto_run_enabled", False):
        return False, "disabled"
    day = int(settings.get("auto_run_day", 5)); hour = int(settings.get("auto_run_hour", 2))
    month = now_kst.strftime("%Y-%m")
    if done_month == month:
        return False, "already_ran"
    sched = now_kst.replace(day=min(day, 28), hour=hour, minute=0, second=0, microsecond=0)
    if now_kst < sched:
        return False, f"scheduled {sched:%Y-%m-%d %H:%M}"
    return True, "due"

def maybe_run(db, now: datetime | None = None, *, n_jobs: int = 6, runner=None, tuner=None) -> dict:
    """tick 에서 호출. 실행하면 {'ran': True, 'month', 'backtest', 'production', 'tune'}."""
    from . import store
    from . import runner as _runner
    runner = runner or _runner
    settings = store.load_settings(db)
    now_kst = (now or datetime.now(tz=KST)).astimezone(KST)
    last = db.read_df("select month from app.auto_run_log order by month desc limit 1")
    done_month = None if last.empty else str(last.iloc[0, 0])
    ok, why = due(settings, now_kst, done_month)
    if not ok:
        return {"ran": False, "reason": why}
    got = db.read_df("select pg_try_advisory_lock(hashtext(%s)) as ok", (LOCK_KEY,)).iloc[0, 0]
    if not got:
        return {"ran": False, "reason": "locked"}
    month = now_kst.strftime("%Y-%m")
    out: dict = {"ran": True, "month": month, "backtest": None, "production": None, "tune": None}
    db.execute("insert into app.auto_run_log(month, started_at) values (%s, now()) on conflict (month) do update set started_at = now(), finished_at = null, error = null", (month,))
    try:
        fy_start = int(settings.get("fiscal_year_start_month", 4))
        last_actual = db.read_df("select max(ym) as ym from analytics.v_item_monthly where qty > 0").iloc[0, 0]
        eval_fy = eval_fy_for(str(last_actual), fy_start)
        extra = {"auto_month": month}
        n_jobs = int(settings.get("engine_n_jobs", n_jobs))   # DB 부하 제한 (D-045)
        bt = runner.backtest(db, eval_fy, n_jobs=n_jobs, extra_params=extra) if settings.get("auto_run_backtest", True) else None
        pr = runner.production(db, None, n_jobs=n_jobs, extra_params=extra)
        out.update(backtest=bt, production=pr)
        if bt and settings.get("auto_run_tune", True):
            try:
                from . import ai_tuning
                out["tune"] = (tuner or ai_tuning.tune)(db, bt)
            except Exception as e:   # AI 키 없음 등 — 런 자체는 성공으로 둔다
                log.warning("auto tune skipped: %s", e); out["tune"] = f"skipped: {type(e).__name__}"
        summ = db.read_df("select summary from app.forecast_run where id = %s", (bt,)).iloc[0, 0] if bt else {}
        summ = summ if isinstance(summ, dict) else {}
        db.execute("update app.auto_run_log set finished_at = now(), backtest_run_id = %s, production_run_id = %s, summary = %s where month = %s",
                   (bt, pr, json.dumps({**out, "item_wape": summ.get("item_wape"), "model_wape": summ.get("model_wape"), "regressed": summ.get("regressed")}, default=str), month))
        _notify(db, month, bt, pr, summ)
    except Exception as e:
        db.execute("update app.auto_run_log set finished_at = now(), error = %s where month = %s", (f"{type(e).__name__}: {e}", month))
        _notify_error(db, month, e)
        raise
    finally:
        db.read_df("select pg_advisory_unlock(hashtext(%s))", (LOCK_KEY,))
    return out

def _pct(v):
    return "-" if v is None else f"{float(v) * 100:.1f}%"

def _notify(db, month: str, bt: str | None, pr: str, summ: dict):
    reg = bool(summ.get("regressed"))
    delta = (summ.get("vs_prev") or {}).get("item_wape_delta")
    title = f"[자동 런] {month} 예측 갱신 완료" + (" — 정확도 회귀 주의" if reg else "")
    body = (f"백테스트 FY{str(summ.get('eval_fy', ''))[2:]}: 품목 WAPE {_pct(summ.get('item_wape'))}"
            + (f" (직전 대비 {float(delta) * 100:+.1f}%p)" if delta is not None else "") + f" · 기종 WAPE {_pct(summ.get('model_wape'))}. "
            if bt else "백테스트 생략. ") + "프로덕션 예측이 갱신되어 다음 발주 계획 생성부터 반영됩니다. 예측 › 런 에서 상세 확인."
    payload = json.dumps({"month": month, "backtest_run_id": bt, "production_run_id": pr, "regressed": reg})
    for role in ("scm_lead", "item_manager", "admin"):
        db.execute("select app.notify_role(%s::app.role, %s, %s, %s, %s::jsonb)", (role, "auto_run_regressed" if reg else "auto_run", title, body, payload))

def _notify_error(db, month: str, e: Exception):
    for role in ("scm_lead", "admin"):
        db.execute("select app.notify_role(%s::app.role, %s, %s, %s, %s::jsonb)", (role, "auto_run_failed", f"[자동 런] {month} 실패", f"{type(e).__name__}: {e}"[:400], json.dumps({"month": month})))
