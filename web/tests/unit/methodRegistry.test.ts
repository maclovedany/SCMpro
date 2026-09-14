import { describe, it, expect } from "vitest";
import { encodeMethodParams, describeMethodParams, PARAM_SPECS, METHOD_INFO } from "@/lib/forecast/methodRegistry";
describe("예측 기법 파라미터 레지스트리 (D-053)", () => {
  it("검증·인코딩: 범위, 정수, 선택, 불리언, 고급 키 보존", () => {
    expect(encodeMethodParams("ma12", { window: "12" })).toEqual({ ok: true, params: { window: 12 } });
    expect(encodeMethodParams("ma12", { window: "30" }).ok).toBe(false);
    expect(encodeMethodParams("croston", { alpha: "0.25" })).toEqual({ ok: true, params: { alpha: 0.25 } });
    expect(encodeMethodParams("hw", { period: "12", seasonal: "mul" })).toEqual({ ok: true, params: { period: 12, seasonal: "mul" } });
    expect(encodeMethodParams("holt", { damped: false })).toEqual({ ok: true, params: { damped: false } });
    expect(encodeMethodParams("lgbm", { lags: "18", n_estimators: "900", learning_rate: "0.03" }, { lags: 12, n_estimators: 600, learning_rate: 0.04, custom_flag: 1 })).toEqual({ ok: true, params: { lags: 18, n_estimators: 900, learning_rate: 0.03, custom_flag: 1 } });
  });
  it("사람이 읽는 요약", () => {
    expect(describeMethodParams("ma12", { window: 9 })).toBe("평균 기간 9개월");
    expect(describeMethodParams("holt", { damped: true })).toBe("추세 감쇠 완만하게");
    expect(describeMethodParams("hw", { period: 12, seasonal: "add" })).toBe("계절 주기 12개월 (연간) · 계절 방식 가법 — 계절 변동폭이 일정");
    expect(describeMethodParams("ses", {})).toBe("조정할 설정 없음 (자동 추정)");
  });
  it("13개 기법 모두 설명·스펙이 있다", () => { for (const k of ["baseline6","ma3","ma12","snaive","ses","holt","hw","croston","sba","arima","prophet","lgbm","ol_bias"]) { expect(METHOD_INFO[k]).toBeTruthy(); expect(PARAM_SPECS[k]).toBeTruthy(); } });
});
