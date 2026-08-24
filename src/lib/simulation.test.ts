import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROMOTION_PHASES,
  DEFAULT_SCENARIOS,
  calculateMonthEconomics,
  calculateSimulation,
  compareScenarios,
  resolveMonthlyPlan,
  validateSimulationInput,
  type SimulationInput,
} from "./simulation";

const input: SimulationInput = {
  product: {
    asin: "B0TEST1234",
    sku: "SIM-001",
    name: "Test product",
    salesSite: "US",
    category: "Home & Kitchen",
    referralCategory: "home-kitchen",
    lifecycle: "new",
    plannedMonths: 6,
  },
  sales: {
    listPrice: 29.99,
    monthlyOrders: 1000,
    couponRate: 0.1,
    couponOrderShare: 0.5,
    dealRate: 0,
    dealOrderShare: 0,
    promotionEnabled: false,
    promotionRate: 0,
    promotionOrderShare: 0,
    promotionStacking: "prevent",
    adOrderShare: 0.5,
    advertisingMode: "acos",
    acos: 0.3,
    monthlyAdSpend: 0,
  },
  costs: {
    productCost: 6,
    packagingCost: 0.5,
    firstMileCost: 1.2,
    fbaFee: 4.8,
    storageFee: 0.2,
    otherAmazonFee: 0.1,
    returnRate: 0.05,
    refundWithoutReturnRate: 0.01,
    unsellableReturnRate: 0.3,
    averageReturnLoss: 1,
    otherAfterSalesLossPerOrder: 0.1,
    otherPromotionCost: 100,
    fixedOperatingCost: 500,
  },
  targets: { targetProfitMargin: 0.15, targetMonthlyProfit: 5000, maximumAllowedLoss: 10000 },
  phases: DEFAULT_PROMOTION_PHASES,
  monthlyPlans: [
    { month: 1, orders: 500, acos: 0.5 },
    { month: 2, orders: 700, acos: 0.4 },
    { month: 3, orders: 900, acos: 0.35 },
    { month: 4 },
    { month: 5, orders: 1200, acos: 0.25 },
    { month: 6, orders: 1400, acos: 0.2 },
  ],
};

describe("profit simulation engine", () => {
  it("inherits base values while keeping monthly overrides independent", () => {
    expect(resolveMonthlyPlan(input, 1).orders).toBe(500);
    expect(resolveMonthlyPlan(input, 1).listPrice).toBe(29.99);
    expect(resolveMonthlyPlan(input, 4).orders).toBe(1000);
  });

  it("does not deduct Coupon twice from profit", () => {
    const plan = resolveMonthlyPlan(input, 4);
    const result = calculateMonthEconomics(input, plan);
    expect(result.netSales).toBeLessThan(result.grossListingSales);
    expect(result.grossProfit).toBeCloseTo(result.netSales - result.amazonCost - result.productCostTotal - result.logisticsCostTotal, 8);
  });

  it("uses automatic category referral fees at actual promotional prices", () => {
    const result = calculateMonthEconomics(input, resolveMonthlyPlan(input, 4));
    expect(result.referralFee).toBeGreaterThan(0);
    expect(result.referralFee).toBeLessThan(input.sales.listPrice * input.sales.monthlyOrders * 0.15);
  });

  it("supports direct spend and ACOS advertising modes", () => {
    const plan = { ...resolveMonthlyPlan(input, 4), adSpend: 3200 };
    const direct = calculateMonthEconomics({ ...input, sales: { ...input.sales, advertisingMode: "spend" } }, plan);
    const acos = calculateMonthEconomics(input, plan);
    expect(direct.advertisingCost).toBe(3200);
    expect(acos.advertisingCost).toBeCloseTo(acos.adSales * plan.acos, 8);
  });

  it("tracks monthly profit, cumulative profit and maximum funding gap", () => {
    const result = calculateSimulation(input);
    expect(result.months).toHaveLength(6);
    expect(result.months[5].cumulativeProfit).toBeCloseTo(result.totalOperatingProfit, 8);
    expect(result.maximumFundingGap).toBe(Math.max(0, -Math.min(...result.months.map((month) => month.cumulativeProfit))));
  });

  it("calculates price, ACOS, Coupon and order reverse targets", () => {
    const result = calculateSimulation(input);
    expect(result.reverse.minimumSellingPrice).toBeGreaterThan(0);
    expect(result.reverse.maximumAcos).toBeGreaterThanOrEqual(0);
    expect(result.reverse.maximumCouponRate).toBeGreaterThanOrEqual(0);
    expect(result.reverse.requiredMonthlyOrders).toBeGreaterThan(0);
    expect(result.reverse.maximumMonthlyAdBudget).toBeGreaterThanOrEqual(0);
  });

  it("calculates payback only when cumulative profit reaches zero", () => {
    const lossInput = {
      ...input,
      costs: { ...input.costs, fixedOperatingCost: 100000 },
    };
    const result = calculateSimulation(lossInput);
    expect(result.monthlyBreakEvenMonth).toBeNull();
    expect(result.paybackMonth).toBeNull();
    expect(result.maximumCumulativeLoss).toBeGreaterThan(0);
  });

  it("does not report break-even for an empty project", () => {
    const empty = calculateSimulation({
      ...input,
      sales: { ...input.sales, listPrice: 0, monthlyOrders: 0 },
      costs: { ...input.costs, fixedOperatingCost: 0 },
    });
    expect(empty.monthlyBreakEvenMonth).toBeNull();
    expect(empty.paybackMonth).toBeNull();
    expect(empty.decision.statusText).toContain("尚未开始推演");
  });

  it("selects a scenario using loss, target, payback and capital priority", () => {
    const comparisons = compareScenarios(input, DEFAULT_SCENARIOS);
    expect(comparisons).toHaveLength(3);
    expect(comparisons.filter((scenario) => scenario.recommended)).toHaveLength(1);
    expect(comparisons.find((scenario) => scenario.recommended)?.reason.length).toBeGreaterThan(0);
  });

  it("returns clear schema validation errors", () => {
    const errors = validateSimulationInput({
      ...input,
      product: { ...input.product, asin: "", name: "", category: "" },
      sales: { ...input.sales, listPrice: 0 },
    });
    expect(errors).toContain("ASIN 为必填项");
    expect(errors).toContain("产品名称为必填项");
    expect(errors).toContain("请选择产品类目");
    expect(errors).toContain("售价必须大于 0");
  });
});
