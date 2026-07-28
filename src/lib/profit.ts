export type ProductLifecycle = "new" | "mature";
export type SalesSite = "US" | "CA" | "UK" | "DE" | "JP";
export type ProfitGrade = "S" | "A" | "B" | "watch" | "eliminate";
export type ScenarioMode = "conservative" | "normal" | "aggressive";

export interface ProfitInput {
  productName: string;
  asinSku: string;
  category: string;
  salesSite: SalesSite;
  currency: "USD";
  lifecycle: ProductLifecycle;
  listingPrice: number;
  targetMonthlyOrders: number;
  monthlyGrowthRate: number;
  couponRate: number;
  couponOrderShare: number;
  dealRate: number;
  dealOrderShare: number;
  adOrderShare: number;
  adSalesShare: number;
  acos: number;
  targetTacos: number;
  cpc: number;
  adBudget: number;
  purchaseCost: number;
  packagingCost: number;
  accessoryCost: number;
  domesticShippingCost: number;
  otherProductCost: number;
  firstMileCost: number;
  lastMileCost: number;
  referralFee: number;
  fbaFee: number;
  storageFee: number;
  otherAmazonFee: number;
  returnRate: number;
  unsellableRate: number;
  returnProcessingCost: number;
}

export interface ProfitResult {
  monthlyOrders: number;
  dailyOrders: number;
  adOrders: number;
  naturalOrders: number;
  couponOrders: number;
  dealOrders: number;
  regularOrders: number;
  couponAmountPerOrder: number;
  dealAmountPerOrder: number;
  couponLoss: number;
  dealLoss: number;
  promotionLoss: number;
  grossListingRevenue: number;
  netSalesRevenue: number;
  averageSellingPrice: number;
  adSalesRevenue: number;
  naturalSalesRevenue: number;
  naturalContributionProfit: number;
  discountSalesRevenue: number;
  productCostPerUnit: number;
  logisticsCostPerUnit: number;
  amazonFeePerUnit: number;
  totalProductCost: number;
  totalLogisticsCost: number;
  totalAmazonFees: number;
  requiredAdSpend: number;
  adSpend: number;
  adCostPerOrder: number;
  budgetGap: number;
  budgetCoverage: number;
  estimatedClicks: number;
  impliedConversionRate: number;
  returnQuantity: number;
  unsellableQuantity: number;
  returnLoss: number;
  returnLossPerUnit: number;
  grossProfit: number;
  grossMargin: number;
  netProfit: number;
  unitProfit: number;
  profitMargin: number;
  actualAcos: number;
  actualTacos: number;
  breakEvenPrice: number;
  breakEvenAcos: number;
  breakEvenTacos: number;
  maxAffordableAdSpend: number;
  maxAffordableCpc: number;
  grade: ProfitGrade;
  gradeTitle: string;
  recommendation: string;
  warnings: string[];
}

export interface ScenarioResult {
  mode: ScenarioMode;
  label: string;
  description: string;
  input: ProfitInput;
  result: ProfitResult;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
const positive = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

function gradeProfit(profitMargin: number, tacos: number, growthRate: number): Pick<ProfitResult, "grade" | "gradeTitle" | "recommendation"> {
  if (profitMargin < 0) {
    return { grade: "eliminate", gradeTitle: "淘汰产品", recommendation: "停止新增投入，优先排查售价、广告和成本结构，并制定清库存方案。" };
  }
  if (profitMargin >= 0.15 && tacos <= 0.20 && growthRate >= 0) {
    return { grade: "S", gradeTitle: "S 级产品", recommendation: "利润和广告效率健康，可增加库存并在安全线内提高广告预算。" };
  }
  if (profitMargin >= 0.10 && tacos <= 0.25) {
    return { grade: "A", gradeTitle: "A 级产品", recommendation: "具备持续运营价值，重点优化转化率和广告结构以扩大净利润。" };
  }
  if (profitMargin >= 0.05) {
    return { grade: "B", gradeTitle: "B 级产品", recommendation: "利润空间偏薄，优先降低采购、物流或促销成本，再扩大流量。" };
  }
  return { grade: "watch", gradeTitle: "观察产品", recommendation: "当前仍有微利，但抗风险能力不足，建议小预算运行并设定明确止损线。" };
}

export function calculateProfit(input: ProfitInput): ProfitResult {
  const monthlyOrders = positive(Math.floor(input.targetMonthlyOrders));
  const dailyOrders = monthlyOrders / 30;
  const listingPrice = positive(input.listingPrice);
  const couponRate = clamp(input.couponRate);
  const dealRate = clamp(input.dealRate);
  const requestedCouponShare = clamp(input.couponOrderShare);
  const requestedDealShare = clamp(input.dealOrderShare);
  const couponShare = requestedCouponShare;
  const dealShare = Math.min(requestedDealShare, 1 - couponShare);
  const regularShare = Math.max(0, 1 - couponShare - dealShare);
  const adOrderShare = clamp(input.adOrderShare);
  const naturalOrderShare = 1 - adOrderShare;
  const adSalesShare = clamp(input.adSalesShare);

  const adOrders = monthlyOrders * adOrderShare;
  const naturalOrders = monthlyOrders * naturalOrderShare;
  const couponOrders = monthlyOrders * couponShare;
  const dealOrders = monthlyOrders * dealShare;
  const regularOrders = monthlyOrders * regularShare;
  const couponAmountPerOrder = listingPrice * couponRate;
  const dealAmountPerOrder = listingPrice * dealRate;
  const couponLoss = couponAmountPerOrder * couponOrders;
  const dealLoss = dealAmountPerOrder * dealOrders;
  const promotionLoss = couponLoss + dealLoss;
  const grossListingRevenue = listingPrice * monthlyOrders;
  const netSalesRevenue = Math.max(0, grossListingRevenue - promotionLoss);
  const averageSellingPrice = monthlyOrders > 0 ? netSalesRevenue / monthlyOrders : 0;
  const adSalesRevenue = netSalesRevenue * adSalesShare;
  const naturalSalesRevenue = netSalesRevenue - adSalesRevenue;
  const discountSalesRevenue = couponOrders * (listingPrice - couponAmountPerOrder) + dealOrders * (listingPrice - dealAmountPerOrder);

  const productCostPerUnit = positive(input.purchaseCost) + positive(input.packagingCost) + positive(input.accessoryCost) + positive(input.domesticShippingCost) + positive(input.otherProductCost);
  const logisticsCostPerUnit = positive(input.firstMileCost) + positive(input.lastMileCost);
  const amazonFeePerUnit = positive(input.referralFee) + positive(input.fbaFee) + positive(input.storageFee) + positive(input.otherAmazonFee);
  const totalProductCost = productCostPerUnit * monthlyOrders;
  const totalLogisticsCost = logisticsCostPerUnit * monthlyOrders;
  const totalAmazonFees = amazonFeePerUnit * monthlyOrders;

  const requiredAdSpend = adSalesRevenue * clamp(input.acos);
  const adSpend = requiredAdSpend;
  const adCostPerOrder = adOrders > 0 ? adSpend / adOrders : 0;
  const adBudget = positive(input.adBudget);
  const budgetGap = adBudget - requiredAdSpend;
  const budgetCoverage = requiredAdSpend > 0 ? adBudget / requiredAdSpend : 1;
  const cpc = positive(input.cpc);
  const estimatedClicks = cpc > 0 ? adSpend / cpc : 0;
  const impliedConversionRate = estimatedClicks > 0 ? adOrders / estimatedClicks : 0;

  const returnRate = clamp(input.returnRate);
  const unsellableRate = clamp(input.unsellableRate);
  const returnQuantity = monthlyOrders * returnRate;
  const unsellableQuantity = returnQuantity * unsellableRate;
  const returnLoss = unsellableQuantity * productCostPerUnit + returnQuantity * positive(input.returnProcessingCost);
  const returnLossPerUnit = monthlyOrders > 0 ? returnLoss / monthlyOrders : 0;

  const grossProfit = netSalesRevenue - totalProductCost - totalLogisticsCost - totalAmazonFees - returnLoss;
  const grossMargin = netSalesRevenue > 0 ? grossProfit / netSalesRevenue : 0;
  const netProfit = grossProfit - adSpend;
  const unitProfit = monthlyOrders > 0 ? netProfit / monthlyOrders : 0;
  const profitMargin = netSalesRevenue > 0 ? netProfit / netSalesRevenue : 0;
  const actualAcos = adSalesRevenue > 0 ? adSpend / adSalesRevenue : 0;
  const actualTacos = netSalesRevenue > 0 ? adSpend / netSalesRevenue : 0;

  const promotionFactor = 1 - couponRate * couponShare - dealRate * dealShare;
  const adCostFactor = adSalesShare * clamp(input.acos);
  const nonAdCostPerUnit = productCostPerUnit + logisticsCostPerUnit + amazonFeePerUnit + returnLossPerUnit;
  const retainedRevenueFactor = promotionFactor * Math.max(0, 1 - adCostFactor);
  const breakEvenPrice = retainedRevenueFactor > 0 ? nonAdCostPerUnit / retainedRevenueFactor : Number.POSITIVE_INFINITY;
  const maxAffordableAdSpend = Math.max(0, grossProfit);
  const breakEvenAcos = adSalesRevenue > 0 ? maxAffordableAdSpend / adSalesRevenue : Number.POSITIVE_INFINITY;
  const breakEvenTacos = netSalesRevenue > 0 ? maxAffordableAdSpend / netSalesRevenue : Number.POSITIVE_INFINITY;
  const maxAffordableCpc = estimatedClicks > 0 ? maxAffordableAdSpend / estimatedClicks : 0;
  const nonAdOperatingCost = totalProductCost + totalLogisticsCost + totalAmazonFees + returnLoss;
  const naturalContributionProfit = naturalSalesRevenue - nonAdOperatingCost * naturalOrderShare;
  const grade = gradeProfit(profitMargin, actualTacos, input.monthlyGrowthRate);
  const warnings: string[] = [];

  if (requestedCouponShare + requestedDealShare > 1) warnings.push("Coupon 与 Deal 订单占比合计超过 100%，Deal 占比已按剩余订单自动截断。");
  if (adBudget > 0 && budgetCoverage < 1) warnings.push(`当前预算只能覆盖预计广告花费的 ${(budgetCoverage * 100).toFixed(1)}%，目标订单结构可能无法实现。`);
  if (clamp(input.acos) >= breakEvenAcos && Number.isFinite(breakEvenAcos)) warnings.push("当前 ACOS 已达到或超过盈亏平衡 ACOS。" );
  if (clamp(input.targetTacos) > 0 && actualTacos > clamp(input.targetTacos)) warnings.push("预计 TACOS 高于目标 TACOS，请降低广告成本或提升自然销售占比。" );
  if (monthlyOrders === 0) warnings.push("目标销量为 0，利润和广告效率指标仅供结构检查。" );
  warnings.push("Coupon/Deal 已作为成交收入折减处理，不会在净利润中重复扣除。" );
  warnings.push("退货模型不含退款佣金返还、FBA 退货处理费差异及可二次销售库存回流。" );

  return {
    monthlyOrders,
    dailyOrders,
    adOrders,
    naturalOrders,
    couponOrders,
    dealOrders,
    regularOrders,
    couponAmountPerOrder,
    dealAmountPerOrder,
    couponLoss,
    dealLoss,
    promotionLoss,
    grossListingRevenue,
    netSalesRevenue,
    averageSellingPrice,
    adSalesRevenue,
    naturalSalesRevenue,
    naturalContributionProfit,
    discountSalesRevenue,
    productCostPerUnit,
    logisticsCostPerUnit,
    amazonFeePerUnit,
    totalProductCost,
    totalLogisticsCost,
    totalAmazonFees,
    requiredAdSpend,
    adSpend,
    adCostPerOrder,
    budgetGap,
    budgetCoverage,
    estimatedClicks,
    impliedConversionRate,
    returnQuantity,
    unsellableQuantity,
    returnLoss,
    returnLossPerUnit,
    grossProfit,
    grossMargin,
    netProfit,
    unitProfit,
    profitMargin,
    actualAcos,
    actualTacos,
    breakEvenPrice,
    breakEvenAcos,
    breakEvenTacos,
    maxAffordableAdSpend,
    maxAffordableCpc,
    ...grade,
    warnings,
  };
}

export function calculateScenarios(input: ProfitInput): ScenarioResult[] {
  const scenarios: Array<{ mode: ScenarioMode; label: string; description: string; update: Partial<ProfitInput> }> = [
    {
      mode: "conservative",
      label: "保守模式",
      description: "销量 -20%，ACOS +20%，CPC +15%，退货率 +30%，Coupon 增加 3 个百分点。",
      update: {
        targetMonthlyOrders: Math.round(input.targetMonthlyOrders * 0.8),
        acos: input.acos * 1.2,
        cpc: input.cpc * 1.15,
        returnRate: input.returnRate * 1.3,
        couponRate: input.couponRate + 0.03,
        couponOrderShare: input.couponOrderShare + 0.10,
        adOrderShare: input.adOrderShare + 0.10,
        adSalesShare: input.adSalesShare + 0.10,
      },
    },
    { mode: "normal", label: "正常模式", description: "使用当前输入，作为正常运营预期。", update: {} },
    {
      mode: "aggressive",
      label: "激进模式",
      description: "销量 +35%，广告占比 +10 个百分点，ACOS +10%，Coupon 增加 5 个百分点。",
      update: {
        targetMonthlyOrders: Math.round(input.targetMonthlyOrders * 1.35),
        acos: input.acos * 1.1,
        couponRate: input.couponRate + 0.05,
        couponOrderShare: input.couponOrderShare + 0.15,
        adOrderShare: input.adOrderShare + 0.10,
        adSalesShare: input.adSalesShare + 0.10,
      },
    },
  ];

  return scenarios.map((scenario) => {
    const scenarioInput = { ...input, ...scenario.update };
    return { ...scenario, input: scenarioInput, result: calculateProfit(scenarioInput) };
  });
}
