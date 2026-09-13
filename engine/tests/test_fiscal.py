from scm_engine.fiscal import fy_of, fy_label, fy_range, fy_months

def test_fy_april_start():
    assert fy_of("2025-04") == 2025 and fy_of("2026-03") == 2025 and fy_of("2026-04") == 2026
    assert fy_label("2026-03") == "FY25"
    assert fy_range(2025) == ("2025-04", "2026-03")
    ms = fy_months(2025)
    assert ms[0] == "2025-04" and ms[-1] == "2026-03" and len(ms) == 12

def test_custom_start():
    assert fy_of("2025-03", start=1) == 2025
