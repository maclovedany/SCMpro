import { it, expect } from "vitest";
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
