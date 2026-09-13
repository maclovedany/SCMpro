"""기법 공통 인터페이스. 모든 기법: fit_predict(y, h, params) -> Forecast. y = 과거 월 수요(float, 0 채움, 음수 없음)."""
from __future__ import annotations
from dataclasses import dataclass, field
import numpy as np

@dataclass
class Forecast:
    point: np.ndarray
    lower: np.ndarray | None = None
    upper: np.ndarray | None = None
    meta: dict = field(default_factory=dict)

    def clipped(self) -> "Forecast":
        self.point = np.clip(np.nan_to_num(self.point, nan=0.0), 0, None)
        if self.lower is not None:
            self.lower = np.clip(np.nan_to_num(self.lower, nan=0.0), 0, None)
        if self.upper is not None:
            self.upper = np.clip(np.nan_to_num(self.upper, nan=0.0), 0, None)
        return self

def flat(v: float, h: int) -> np.ndarray:
    return np.full(h, float(max(v, 0.0)))
