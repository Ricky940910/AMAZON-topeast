import { describe, expect, it } from "vitest";
import { calculateAdvertisingEstimate, type CalibrationSample, type AdvertisingTarget } from "./advertisingEstimate";

const sample: CalibrationSample = {
  id: "sample-1",
  name: "文档演示样本",
  adScore: 4000,
  organicScore: 2000,
  adClicks: 3200,
  adSpend: 3456,
  cpcProxy: 1.2,
  totalOrders: 600,
  adOrders: 300,
};

const target: AdvertisingTarget = {
  asin: "DEMO",
  adScore: 6000,
  organicScore: 4000,
  cpcProxy: 1.3,
  totalOrders: 700,
  observationDays: 30,
};

describe("calculateAdvertisingEstimate", () => {
  it("reproduces the method document demonstration", () => {
    const result = calculateAdvertisingEstimate([sample], target);

    expect(result.scales.clickScale).toBeCloseTo(0.8, 10);
    expect(result.scales.cpcScale).toBeCloseTo(0.9, 10);
    expect(result.scales.orderTendency).toBeCloseTo(0.5, 10);
    expect(result.target.estimatedClicks).toBeCloseTo(4800, 10);
    expect(result.target.estimatedCpc).toBeCloseTo(1.17, 10);
    expect(result.target.estimatedSpend).toBeCloseTo(5616, 10);
    expect(result.target.estimatedDailySpend).toBeCloseTo(187.2, 10);
    expect(result.target.adOrderShare).toBeCloseTo(3 / 7, 10);
    expect(result.target.estimatedAdOrders).toBeCloseTo(300, 10);
    expect(result.target.estimatedNonAdOrders).toBeCloseTo(400, 10);
  });

  it("excludes boundary samples from lambda calibration", () => {
    const result = calculateAdvertisingEstimate([
      sample,
      { ...sample, id: "zero-ad", adOrders: 0 },
      { ...sample, id: "all-ad", adOrders: sample.totalOrders },
    ], target);

    expect(result.observations.orderTendency).toHaveLength(1);
    expect(result.scales.orderTendency).toBeCloseTo(0.5, 10);
  });

  it("does not invent order counts when target total orders are missing", () => {
    const result = calculateAdvertisingEstimate([sample], { ...target, totalOrders: null });

    expect(result.target.adOrderShare).toBeCloseTo(3 / 7, 10);
    expect(result.target.estimatedAdOrders).toBeNull();
    expect(result.target.estimatedNonAdOrders).toBeNull();
    expect(result.warnings.some((warning) => warning.includes("未输入竞品总订单"))).toBe(true);
  });

  it("ignores an empty template row instead of treating zero as a calibration", () => {
    const result = calculateAdvertisingEstimate([
      { ...sample, id: "empty", name: "空白样本", adScore: 0, organicScore: 0, adClicks: 0, adSpend: 0, cpcProxy: 0, totalOrders: 0, adOrders: 0 },
    ], target);

    expect(result.scales.clickScale).toBeNull();
    expect(result.scales.cpcScale).toBeNull();
    expect(result.scales.orderTendency).toBeNull();
    expect(result.target.estimatedSpend).toBeNull();
  });

  it("does not treat a zero target ad score as confirmed zero spend", () => {
    const result = calculateAdvertisingEstimate([sample], { ...target, adScore: 0 });

    expect(result.target.trafficShare).toBeNull();
    expect(result.target.estimatedClicks).toBeNull();
    expect(result.target.estimatedSpend).toBeNull();
    expect(result.target.adOrderShare).toBeNull();
  });

  it("does not emit order counts when the target total order value is zero", () => {
    const result = calculateAdvertisingEstimate([sample], { ...target, totalOrders: 0 });

    expect(result.target.adOrderShare).toBeCloseTo(3 / 7, 10);
    expect(result.target.estimatedAdOrders).toBeNull();
    expect(result.target.estimatedNonAdOrders).toBeNull();
    expect(result.warnings.some((warning) => warning.includes("不把它当作可靠 Q"))).toBe(true);
  });
});
