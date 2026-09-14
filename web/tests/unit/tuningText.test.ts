import { describe, it, expect } from "vitest";
import { describePatch, describeProposal, humanize } from "@/lib/forecast/tuningText";
describe("AI 제안 사람 말 (D-052)", () => {
  it("파라미터 패치: 라벨·단위·현재→제안", () => {
    expect(describePatch({ window: 12 }, { window: 9 })).toBe("평균 기간 9개월 → 12개월");
    expect(describePatch({ lags: 18, n_estimators: 900, learning_rate: 0.03 }, { lags: 12, n_estimators: 600, learning_rate: 0.04 })).toBe("과거 참조 기간 12개월 → 18개월, 트리 수 600 → 900, 학습률 0.04 → 0.03");
    expect(describeProposal({ method_key: "ma12", param_patch: { window: 12 }, enabled: null, scope: "global" }, { window: 9 })).toBe("이동평균 12M: 평균 기간 9개월 → 12개월");
    expect(describeProposal({ method_key: "prophet", param_patch: {}, enabled: false, scope: "all" })).toBe("Prophet: 기법 끔");
  });
  it("근거 문장의 키·소수를 사람 말로", () => {
    expect(humanize("SCM OL 편향(scm_ol_bias) 0.3645 (scm_ol_bias: 0.36449574058807366, scm_ol_wape: 0.4824402308326463, item_scm_ol_n: 0)"))
      .toBe("SCM OL 편향(SCM OL Bias) 0.3645 (SCM OL Bias 36.4%, SCM OL WAPE 48.2%, 제출 OL 채점 월수 0)");
    expect(humanize("(methods.ma12.params.window: 9)")).toBe("(이동평균 12M의 평균 기간 9)");
    expect(humanize("ma12 윈도우 설정 이슈")).toBe("이동평균 12M 윈도우 설정 이슈");
  });
});
