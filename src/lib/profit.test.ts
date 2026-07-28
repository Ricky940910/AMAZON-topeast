import { describe, expect, it } from "vitest";
import { calculateProfit, calculateScenarios, type ProfitInput } from "./profit";

const input: ProfitInput = {
  productName: "示例产品",
  asinSku: "SKU-PROFIT",
  category: "Home & Kitchen",
  salesSite: "US",
  currency: "USD",
  lifecycle: "new",
  listingPrice: 29.99,
  targetMonthlyOrders: 900,
  monthlyGrowthRate: 0.08,
  couponRate: 0.10,
  couponOrderShare: 0.25,
  dealRate: 0.15,
  dealOrderShare: 0.10,
  adOrderShare: 0.45,
  adSalesShare: 0.48,
  acos: 0.28,
  targetTacos: 0.15,
  cpc: 1.10,
  adBudget: 4000,
  purchaseCost: 5.20,
  packagingCost: 0.45,
  accessoryCost: 0.30,
  domesticShippingCost: 0.35,
  otherProductCost: 0.20,
  firstMileCost: 1.10,
  lastMileCost: 0,
  referralFee: 4.50,
  fbaFee: 4.85,
  storageFee: 0.18,
  otherAmazonFee: 0.12,
  returnRate: 0.06,
  unsellableRate: 0.35,
  returnProcessingCost: 0.60,
};

describe("profit engine", () => {
  it("calculates weighted promotion revenue without double counting discounts", () => {
    const result = calculateProfit(input);
    expect(result.couponLoss).toBeCloseTo(674.775, 6);
    expect(result.dealLoss).toBeCloseTo(404.865, 6);
    expect(result.netSalesRevenue).toBeCloseTo(25911.36, 6);
    expect(result.averageSellingPrice).toBeCloseTo(28.7904, 6);
  });

  it("calculates cost, advertising and return economics", () => {
    const result = calculateProfit(input);
    expect(result.productCostPerUnit).toBeCloseTo(6.5, 6);
    expect(result.logisticsCostPerUnit).toBeCloseTo(1.1, 6);
    expect(result.amazonFeePerUnit).toBeCloseTo(9.65, 6);
    expect(result.adSpend).toBeCloseTo(3482.486784, 6);
    expect(result.returnLoss).toBeCloseTo(155.25, 6);
    expect(result.unitProfit).toBeCloseTo(7.49847, 5);
    expect(result.naturalContributionProfit).toBeGreaterThan(0);
  });

  it("calculates break-even price and advertising safety lines", () => {
    const result = calculateProfit(input);
    expect(result.breakEvenPrice).toBeGreaterThan(20);
    expect(result.breakEvenAcos).toBeGreaterThan(result.actualAcos);
    expect(result.maxAffordableAdSpend).toBeCloseTo(result.grossProfit, 6);
    expect(result.maxAffordableCpc).toBeGreaterThan(input.cpc);
  });

  it("caps overlapping coupon and deal order shares", () => {
    const result = calculateProfit({ ...input, couponOrderShare: 0.8, dealOrderShare: 0.5 });
    expect(result.couponOrders + result.dealOrders + result.regularOrders).toBeCloseTo(input.targetMonthlyOrders, 6);
    expect(result.warnings.some((warning) => warning.includes("超过 100%"))).toBe(true);
  });

  it("creates conservative, normal and aggressive scenarios", () => {
    const scenarios = calculateScenarios(input);
    expect(scenarios).toHaveLength(3);
    expect(scenarios[0].result.monthlyOrders).toBe(720);
    expect(scenarios[1].result.monthlyOrders).toBe(900);
    expect(scenarios[2].result.monthlyOrders).toBe(1215);
  });

  it("warns when the planned budget cannot support the requested advertising structure", () => {
    const result = calculateProfit({ ...input, adBudget: 1000 });
    expect(result.budgetCoverage).toBeLessThan(1);
    expect(result.warnings.some((warning) => warning.includes("预算只能覆盖"))).toBe(true);
  });

  it("marks a loss-making SKU for elimination", () => {
    const result = calculateProfit({ ...input, listingPrice: 12, acos: 0.6 });
    expect(result.profitMargin).toBeLessThan(0);
    expect(result.grade).toBe("eliminate");
  });
});
