"""수요 패턴(SBC, R-FC-30) + ABC-XYZ (R-FC-35)."""
from __future__ import annotations
import numpy as np
import pandas as pd

def sbc_pattern(y: np.ndarray) -> tuple[str, float | None, float | None]:
    """Syntetos-Boylan-Croston: ADI = n/nonzero, CV² of nonzero demand sizes."""
    y = np.asarray(y, dtype=float)
    nz = y[y > 0]
    if len(nz) == 0:
        return "dead", None, None
    adi = len(y) / len(nz)
    cv2 = float((nz.std() / nz.mean()) ** 2) if len(nz) > 1 else 0.0
    if adi < 1.32 and cv2 < 0.49:
        p = "smooth"
    elif adi < 1.32:
        p = "erratic"
    elif cv2 < 0.49:
        p = "intermittent"
    else:
        p = "lumpy"
    return p, float(adi), cv2

def xyz_class(y: np.ndarray) -> tuple[str, float | None]:
    y = np.asarray(y, dtype=float)
    if y.mean() <= 0:
        return "Z", None
    cv = float(y.std() / y.mean())
    return ("X" if cv <= 0.5 else "Y" if cv <= 1.0 else "Z"), cv

def abc_class(values: pd.Series) -> pd.Series:
    """누적 기여도 80/95/100 → A/B/C. values: index=key, 12개월 금액(또는 수량)."""
    v = values.fillna(0).clip(lower=0).sort_values(ascending=False)
    tot = v.sum()
    if tot <= 0:
        return pd.Series("C", index=values.index)
    cum = v.cumsum() / tot
    cls = pd.Series(np.where(cum <= 0.80, "A", np.where(cum <= 0.95, "B", "C")), index=v.index)
    # 첫 품목이 80% 를 넘어도 A
    cls.iloc[0] = "A"
    return cls.reindex(values.index).fillna("C")

def classify_items(monthly: pd.DataFrame, prices: pd.Series | None = None, recent_months: int = 24) -> pd.DataFrame:
    """monthly: DataFrame[key_code, category, ym, qty] (0채움). 반환: key_code 별 pattern/abc/xyz/adi/cv2/cv/value_12m/share."""
    months = sorted(monthly["ym"].unique())
    recent = months[-recent_months:]
    last12 = months[-12:]
    rows = []
    for key, g in monthly.groupby("key_code", sort=False):
        g = g.set_index("ym")["qty"].reindex(months, fill_value=0.0)
        y = g.loc[recent].to_numpy()
        pat, adi, cv2 = sbc_pattern(y)
        xyz, cv = xyz_class(y)
        q12 = float(g.loc[last12].sum())
        rows.append({"key_code": key, "pattern": pat, "adi": adi, "cv2": cv2, "xyz": xyz, "cv": cv, "qty_12m": q12})
    df = pd.DataFrame(rows)
    cat = monthly.groupby("key_code")["category"].first()
    df["category"] = df["key_code"].map(cat)
    price = prices.reindex(df["key_code"]).fillna(0).to_numpy() if prices is not None else np.zeros(len(df))
    df["value_12m"] = np.where(price > 0, df["qty_12m"] * price, df["qty_12m"])
    # ABC 는 카테고리별로 (부품/소모품/옵션 규모 차이 보정)
    df["abc"] = "C"
    for c, idx in df.groupby("category").groups.items():
        sub = df.loc[idx]
        df.loc[idx, "abc"] = abc_class(sub.set_index("key_code")["value_12m"]).to_numpy()
    tot = df["value_12m"].sum()
    df["share"] = df["value_12m"] / tot if tot > 0 else 0.0
    return df
