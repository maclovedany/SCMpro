"""회계연도 헬퍼 (D-015, R-FC-08). 기본 4월 시작 — 실제 값은 app.system_settings.fiscal_year_start_month."""
from __future__ import annotations

DEFAULT_FY_START = 4

def fy_of(ym: str, start: int = DEFAULT_FY_START) -> int:
    y, m = int(ym[:4]), int(ym[5:7])
    return y if m >= start else y - 1

def fy_label(ym: str, start: int = DEFAULT_FY_START) -> str:
    return f"FY{str(fy_of(ym, start))[2:]}"

def fy_range(fy: int, start: int = DEFAULT_FY_START) -> tuple[str, str]:
    end_m = 12 if start == 1 else start - 1
    end_y = fy if start == 1 else fy + 1
    return f"{fy}-{start:02d}", f"{end_y}-{end_m:02d}"

def fy_months(fy: int, start: int = DEFAULT_FY_START) -> list[str]:
    out = []
    for i in range(12):
        m = start + i
        out.append(f"{fy + (m - 1) // 12}-{((m - 1) % 12) + 1:02d}")
    return out
