import { z } from "zod";
import { calculateProfit, MARKETPLACE_CONFIG, type PromotionStackingSetting, type SalesSite } from "./profit";

export type SimulationLifecycle = "new" | "growth" | "mature" | "decline";
export type AdvertisingInputMode = "acos" | "spend";
export type RiskLevel = "safe" | "watch" | "high" | "critical";
export type MonthProfitStatus = "loss" | "monthly-break-even" | "cumulative-profit";

export interface SimulationProduct {
  asin: string;
  sku: string;
  name: string;
  salesSite: SalesSite;
  category: string;
  referralCategory: string;
  lifecycle: SimulationLifecycle;
  plannedMonths: number;
}

export interface SalesModel {
  listPrice: number;
  monthlyOrders: number;
  couponRate: number;
  couponOrderShare: number;
  dealRate: number;
  dealOrderShare: number;
  promotionEnabled: boolean;
  promotionRate: number;
  promotionOrderShare: number;
  promotionStacking: PromotionStackingSetting;
  adOrderShare: number;
  advertisingMode: AdvertisingInputMode;
  acos: number;
  monthlyAdSpend: number;
}

export interface SimulationCostModel {
  productCost: number;
  packagingCost: number;
  firstMileCost: number;
  fbaFee: number;
  storageFee: number;
  otherAmazonFee: number;
  returnRate: number;
  refundWithoutReturnRate: number;
  unsellableReturnRate: number;
  averageReturnLoss: number;
  otherAfterSalesLossPerOrder: number;
  otherPromotionCost: number;
  fixedOperatingCost: number;
}

export interface DecisionTargets {
  targetProfitMargin: number;
  targetMonthlyProfit: number;
  maximumAllowedLoss: number;
}

export interface PromotionPhase {
  id: string;
  name: string;
  endDay: number | null;
  objective: string;
}

export interface MonthlyPlanOverride {
  month: number;
  listPrice?: number;
  orders?: number;
  couponRate?: number;
  adOrderShare?: number;
  acos?: number;
  adSpend?: number;
  returnRate?: number;
  otherPromotionCost?: number;
}

export interface SimulationInput {
  product: SimulationProduct;
  sales: SalesModel;
  costs: SimulationCostModel;
  targets: DecisionTargets;
  phases: PromotionPhase[];
  monthlyPlans: MonthlyPlanOverride[];
}

export interface ResolvedMonthlyPlan {
  month: number;
  listPrice: number;
  orders: number;
  couponRate: number;
  adOrderShare: number;
  acos: number;
  adSpend: number;
  returnRate: number;
  fbaFee: number;
  productCostPerUnit: number;
  logisticsCostPerUnit: number;
  otherPromotionCost: number;
}

export interface MonthlySimulationResult extends ResolvedMonthlyPlan {
  stage: string;
  actualSellingPrice: number;
  grossListingSales: number;
  netSales: number;
  discountCost: number;
  adOrders: number;
  organicOrders: number;
  adSales: number;
  referralFee: number;
  amazonCost: number;
  productCostTotal: number;
  logisticsCostTotal: number;
  advertisingCost: number;
  afterSalesLoss: number;
  grossProfit: number;
  contributionProfit: number;
  operatingProfit: number;
  unitProfit: number;
  profitMargin: number;
  actualAcos: number;
  tacos: number;
  cumulativeProfit: number;
  cumulativePromotionSpend: number;
  cumulativeRecovery: number;
  status: MonthProfitStatus;
}

export interface ReverseTargets {
  minimumSellingPrice: number;
  priceSafetySpace: number;
  maximumAcos: number;
  maximumAdSpend: number;
  maximumCouponRate: number;
  recommendedCouponRate: number;
  requiredMonthlyOrders: number;
  requiredDailyOrders: number;
  maximumMonthlyAdBudget: number;
}

export interface SimulationDecision {
  currentStage: string;
  riskLevel: RiskLevel;
  riskLabel: string;
  statusText: string;
  pressureFactors: string[];
  recommendations: string[];
}

export interface SimulationResult {
  months: MonthlySimulationResult[];
  totalGrossListingSales: number;
  totalNetSales: number;
  totalOperatingProfit: number;
  finalProfitMargin: number;
  totalAdSpend: number;
  totalPromotionInvestment: number;
  projectRoi: number;
  maximumCumulativeLoss: number;
  maximumLossMonth: number | null;
  maximumFundingGap: number;
  monthlyBreakEvenMonth: number | null;
  paybackMonth: number | null;
  stableProfitMonth: number | null;
  reverse: ReverseTargets;
  decision: SimulationDecision;
}

export interface ScenarioAdjustment {
  id: string;
  name: string;
  description: string;
  priceMultiplier: number;
  couponDelta: number;
  ordersMultiplier: number;
  acosMultiplier: number;
  adOrderShareDelta: number;
  returnRateMultiplier: number;
  months: number;
}

export interface ScenarioComparison {
  scenario: ScenarioAdjustment;
  result: Omit<SimulationResult, "reverse">;
  recommended: boolean;
  reason: string;
}

const nonNegative = z.number().finite().min(0, "不能小于 0");
const percentage = z.number().finite().min(0, "不能小于 0%").max(0.999999, "必须小于 100%");

export const SimulationInputSchema = z.object({
  product: z.object({
    asin: z.string().trim().min(1, "ASIN 为必填项"),
    sku: z.string(),
    name: z.string().trim().min(1, "产品名称为必填项"),
    salesSite: z.enum(["US", "CA", "UK", "DE", "JP"]),
    category: z.string().trim().min(1, "请选择产品类目"),
    referralCategory: z.string().trim().min(1, "请选择 Referral Fee 类目"),
    lifecycle: z.enum(["new", "growth", "mature", "decline"]),
    plannedMonths: z.number().int().min(1, "推广周期至少为 1 个月").max(12, "V1 最多推演 12 个月"),
  }),
  sales: z.object({
    listPrice: z.number().finite().gt(0, "售价必须大于 0"),
    monthlyOrders: nonNegative,
    couponRate: percentage,
    couponOrderShare: percentage,
    dealRate: percentage,
    dealOrderShare: percentage,
    promotionEnabled: z.boolean(),
    promotionRate: percentage,
    promotionOrderShare: percentage,
    promotionStacking: z.enum(["allow", "prevent"]),
    adOrderShare: percentage,
    advertisingMode: z.enum(["acos", "spend"]),
    acos: nonNegative,
    monthlyAdSpend: nonNegative,
  }),
  costs: z.object({
    productCost: nonNegative,
    packagingCost: nonNegative,
    firstMileCost: nonNegative,
    fbaFee: nonNegative,
    storageFee: nonNegative,
    otherAmazonFee: nonNegative,
    returnRate: percentage,
    refundWithoutReturnRate: percentage,
    unsellableReturnRate: percentage,
    averageReturnLoss: nonNegative,
    otherAfterSalesLossPerOrder: nonNegative,
    otherPromotionCost: nonNegative,
    fixedOperatingCost: nonNegative,
  }),
  targets: z.object({
    targetProfitMargin: percentage,
    targetMonthlyProfit: nonNegative,
    maximumAllowedLoss: nonNegative,
  }),
  phases: z.array(z.object({ id: z.string(), name: z.string().min(1), endDay: z.number().positive().nullable(), objective: z.string() })).min(1),
  monthlyPlans: z.array(z.object({
    month: z.number().int().min(1).max(12),
    listPrice: nonNegative.optional(),
    orders: nonNegative.optional(),
    couponRate: percentage.optional(),
    adOrderShare: percentage.optional(),
    acos: nonNegative.optional(),
    adSpend: nonNegative.optional(),
    returnRate: percentage.optional(),
    otherPromotionCost: nonNegative.optional(),
  })).max(12),
});

const positive = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
const clampRate = (value: number) => Math.min(0.999999, positive(value));
const clampShare = (value: number) => Math.min(1, positive(value));
const finiteOrInfinity = (value: number) => Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;

export const DEFAULT_PROMOTION_PHASES: PromotionPhase[] = [
  { id: "cold-start", name: "冷启动期", endDay: 20, objective: "获取流量、测试转化率" },
  { id: "scaling", name: "放量期", endDay: 35, objective: "扩大有效订单" },
  { id: "ranking", name: "排名期", endDay: 45, objective: "推动核心词突破" },
  { id: "stabilizing", name: "稳定期", endDay: 60, objective: "降低亏损与波动" },
  { id: "profit-transition", name: "盈利过渡期", endDay: 105, objective: "接近目标利润" },
  { id: "mature-profit", name: "成熟盈利期", endDay: null, objective: "稳定盈利与资金回收" },
];

export const DEFAULT_SCENARIOS: ScenarioAdjustment[] = [
  { id: "aggressive", name: "激进推广", description: "高广告、高销量，优先抢占增长速度。", priceMultiplier: 1, couponDelta: 0.05, ordersMultiplier: 1.4, acosMultiplier: 1.2, adOrderShareDelta: 0.15, returnRateMultiplier: 1.15, months: 6 },
  { id: "balanced", name: "平衡推广", description: "保持当前参数，平衡回本速度与资金占用。", priceMultiplier: 1, couponDelta: 0, ordersMultiplier: 1, acosMultiplier: 1, adOrderShareDelta: 0, returnRateMultiplier: 1, months: 6 },
  { id: "steady", name: "稳健推广", description: "降低广告依赖和折扣，优先控制最大资金缺口。", priceMultiplier: 1, couponDelta: -0.03, ordersMultiplier: 0.75, acosMultiplier: 0.8, adOrderShareDelta: -0.12, returnRateMultiplier: 0.85, months: 6 },
];

export function validateSimulationInput(input: SimulationInput): string[] {
  const result = SimulationInputSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
}

export function getProductCostPerUnit(costs: SimulationCostModel): number {
  return positive(costs.productCost) + positive(costs.packagingCost);
}

export function getLogisticsCostPerUnit(costs: SimulationCostModel): number {
  return positive(costs.firstMileCost);
}

export function resolveMonthlyPlan(input: SimulationInput, month: number): ResolvedMonthlyPlan {
  const override = input.monthlyPlans.find((item) => item.month === month);
  return {
    month,
    listPrice: positive(override?.listPrice ?? input.sales.listPrice),
    orders: positive(override?.orders ?? input.sales.monthlyOrders),
    couponRate: clampRate(override?.couponRate ?? input.sales.couponRate),
    adOrderShare: clampShare(override?.adOrderShare ?? input.sales.adOrderShare),
    acos: positive(override?.acos ?? input.sales.acos),
    adSpend: positive(override?.adSpend ?? input.sales.monthlyAdSpend),
    returnRate: clampRate(override?.returnRate ?? input.costs.returnRate),
    fbaFee: positive(input.costs.fbaFee),
    productCostPerUnit: getProductCostPerUnit(input.costs),
    logisticsCostPerUnit: getLogisticsCostPerUnit(input.costs),
    otherPromotionCost: positive(override?.otherPromotionCost ?? input.costs.otherPromotionCost),
  };
}

function getStage(phases: PromotionPhase[], month: number): string {
  const ordered = [...phases].sort((a, b) => (a.endDay ?? Number.POSITIVE_INFINITY) - (b.endDay ?? Number.POSITIVE_INFINITY));
  const monthStart = (month - 1) * 30 + 1;
  const monthEnd = month * 30;
  let phaseStart = 1;
  const overlapping: string[] = [];
  for (const phase of ordered) {
    const phaseEnd = phase.endDay ?? Number.POSITIVE_INFINITY;
    if (phaseStart <= monthEnd && phaseEnd >= monthStart) overlapping.push(phase.name);
    phaseStart = phaseEnd + 1;
  }
  return overlapping.join(" → ") || ordered.at(-1)?.name || "未设置阶段";
}

interface MonthCalculationOptions {
  fixedOperatingCost?: number;
  advertisingMode?: AdvertisingInputMode;
}

export function calculateMonthEconomics(input: SimulationInput, monthPlan: ResolvedMonthlyPlan, options: MonthCalculationOptions = {}): Omit<MonthlySimulationResult, "cumulativeProfit" | "cumulativePromotionSpend" | "cumulativeRecovery" | "status"> {
  const orders = Math.floor(positive(monthPlan.orders));
  const seed = calculateProfit({
    productName: input.product.name,
    asinSku: input.product.asin || input.product.sku,
    category: input.product.category,
    referralCategory: input.product.referralCategory,
    salesSite: input.product.salesSite,
    currency: MARKETPLACE_CONFIG[input.product.salesSite].currency,
    lifecycle: input.product.lifecycle === "new" ? "new" : "mature",
    listingPrice: monthPlan.listPrice,
    targetMonthlyOrders: orders,
    monthlyGrowthRate: 0,
    couponRate: monthPlan.couponRate,
    couponOrderShare: clampShare(input.sales.couponOrderShare),
    dealRate: clampRate(input.sales.dealRate),
    dealOrderShare: clampShare(input.sales.dealOrderShare),
    dealType: "lightning-deal",
    sellerPromotionEnabled: input.sales.promotionEnabled,
    sellerPromotionType: "percentage-off",
    sellerPromotionRate: clampRate(input.sales.promotionRate),
    sellerPromotionOrderShare: clampShare(input.sales.promotionOrderShare),
    sellerPromotionBuyQuantity: 1,
    sellerPromotionFreeQuantity: 0,
    couponPromotionStacking: input.sales.promotionStacking,
    adOrderShare: monthPlan.adOrderShare,
    adSalesShare: monthPlan.adOrderShare,
    acos: 0,
    targetTacos: 0,
    cpc: 0,
    adBudget: 0,
    purchaseCost: monthPlan.productCostPerUnit,
    packagingCost: 0,
    accessoryCost: 0,
    domesticShippingCost: 0,
    otherProductCost: 0,
    firstMileCost: monthPlan.logisticsCostPerUnit,
    lastMileCost: 0,
    customsDuty: 0,
    referralFee: 0,
    manualReferralFee: false,
    fbaFee: monthPlan.fbaFee,
    storageFee: positive(input.costs.storageFee),
    otherAmazonFee: positive(input.costs.otherAmazonFee),
    returnRate: 0,
    unsellableRate: 0,
    returnProcessingCost: 0,
  });

  const advertisingMode = options.advertisingMode ?? input.sales.advertisingMode;
  const adSales = seed.netSalesRevenue * monthPlan.adOrderShare;
  const advertisingCost = advertisingMode === "spend" ? monthPlan.adSpend : adSales * positive(monthPlan.acos);
  const actualAcos = adSales > 0 ? advertisingCost / adSales : advertisingCost > 0 ? Number.POSITIVE_INFINITY : 0;
  const tacos = seed.netSalesRevenue > 0 ? advertisingCost / seed.netSalesRevenue : advertisingCost > 0 ? Number.POSITIVE_INFINITY : 0;
  const returnedOrders = orders * monthPlan.returnRate;
  const refundOnlyOrders = orders * (1 - monthPlan.returnRate) * clampRate(input.costs.refundWithoutReturnRate);
  const unsellableReturns = returnedOrders * clampRate(input.costs.unsellableReturnRate);
  const afterSalesLoss = returnedOrders * positive(input.costs.averageReturnLoss)
    + unsellableReturns * monthPlan.productCostPerUnit
    + refundOnlyOrders * seed.averageSellingPrice
    + orders * positive(input.costs.otherAfterSalesLossPerOrder);
  const grossProfit = seed.netSalesRevenue - seed.totalAmazonFees - seed.totalProductCost - seed.totalLogisticsCost;
  const contributionProfit = grossProfit - advertisingCost - afterSalesLoss - monthPlan.otherPromotionCost;
  const operatingProfit = contributionProfit - positive(options.fixedOperatingCost ?? input.costs.fixedOperatingCost);

  return {
    ...monthPlan,
    orders,
    stage: getStage(input.phases, monthPlan.month),
    actualSellingPrice: seed.averageSellingPrice,
    grossListingSales: seed.grossListingRevenue,
    netSales: seed.netSalesRevenue,
    discountCost: seed.promotionLoss,
    adOrders: orders * monthPlan.adOrderShare,
    organicOrders: orders * (1 - monthPlan.adOrderShare),
    adSales,
    referralFee: seed.referralFeeTotal,
    amazonCost: seed.totalAmazonFees,
    productCostTotal: seed.totalProductCost,
    logisticsCostTotal: seed.totalLogisticsCost,
    advertisingCost,
    afterSalesLoss,
    grossProfit,
    contributionProfit,
    operatingProfit,
    unitProfit: orders > 0 ? operatingProfit / orders : 0,
    profitMargin: seed.netSalesRevenue > 0 ? operatingProfit / seed.netSalesRevenue : 0,
    actualAcos,
    tacos,
  };
}

interface CoreSimulationResult extends Omit<SimulationResult, "reverse"> {}

function runSimulationCore(input: SimulationInput): CoreSimulationResult {
  const monthCount = Math.min(12, Math.max(1, Math.floor(positive(input.product.plannedMonths) || 1)));
  let cumulativeProfit = 0;
  let cumulativePromotionSpend = 0;
  let cumulativeRecovery = 0;
  const months: MonthlySimulationResult[] = [];

  for (let month = 1; month <= monthCount; month += 1) {
    const calculated = calculateMonthEconomics(input, resolveMonthlyPlan(input, month));
    cumulativeProfit += calculated.operatingProfit;
    cumulativePromotionSpend += calculated.advertisingCost + calculated.otherPromotionCost + calculated.discountCost;
    cumulativeRecovery += Math.max(0, calculated.operatingProfit);
    const hasSales = calculated.netSales > 0;
    const status: MonthProfitStatus = hasSales && cumulativeProfit >= 0
      ? "cumulative-profit"
      : hasSales && calculated.operatingProfit >= 0 ? "monthly-break-even" : "loss";
    months.push({ ...calculated, cumulativeProfit, cumulativePromotionSpend, cumulativeRecovery, status });
  }

  const totalGrossListingSales = months.reduce((sum, month) => sum + month.grossListingSales, 0);
  const totalNetSales = months.reduce((sum, month) => sum + month.netSales, 0);
  const totalOperatingProfit = months.reduce((sum, month) => sum + month.operatingProfit, 0);
  const totalAdSpend = months.reduce((sum, month) => sum + month.advertisingCost, 0);
  const totalPromotionInvestment = months.reduce((sum, month) => sum + month.advertisingCost + month.otherPromotionCost + month.discountCost, 0);
  const totalCashCost = months.reduce((sum, month) => sum + month.amazonCost + month.productCostTotal + month.logisticsCostTotal + month.advertisingCost + month.afterSalesLoss + month.otherPromotionCost + positive(input.costs.fixedOperatingCost), 0);
  const lowestMonth = months.reduce<MonthlySimulationResult | null>((lowest, month) => !lowest || month.cumulativeProfit < lowest.cumulativeProfit ? month : lowest, null);
  const maximumCumulativeLoss = Math.max(0, -(lowestMonth?.cumulativeProfit ?? 0));
  const hasProjectSales = totalNetSales > 0;
  const monthlyBreakEvenMonth = months.find((month) => month.netSales > 0 && month.operatingProfit >= 0)?.month ?? null;
  const paybackMonth = months.find((month) => month.netSales > 0 && month.cumulativeProfit >= 0)?.month ?? null;
  const stableProfitIndex = months.findIndex((month, index) => month.netSales > 0 && month.operatingProfit >= 0 && (index === months.length - 1 || months[index + 1].operatingProfit >= 0));
  const stableProfitMonth = stableProfitIndex >= 0 ? months[stableProfitIndex].month : null;
  const finalProfitMargin = totalNetSales > 0 ? totalOperatingProfit / totalNetSales : 0;
  const projectRoi = totalCashCost > 0 ? totalOperatingProfit / totalCashCost : 0;
  const current = months.at(-1);
  const targetMargin = clampRate(input.targets.targetProfitMargin);
  const allowedLoss = positive(input.targets.maximumAllowedLoss);
  let riskLevel: RiskLevel;
  if (!hasProjectSales) riskLevel = "watch";
  else if (maximumCumulativeLoss > allowedLoss) riskLevel = "critical";
  else if ((current?.profitMargin ?? 0) < 0) riskLevel = "high";
  else if ((current?.profitMargin ?? 0) < targetMargin) riskLevel = "watch";
  else riskLevel = "safe";
  const riskLabels: Record<RiskLevel, string> = { safe: "安全", watch: "观察", high: "高风险", critical: "严重风险" };

  const pressurePool = [
    { label: "广告成本", amount: totalAdSpend },
    { label: "折扣让利", amount: months.reduce((sum, month) => sum + month.discountCost, 0) },
    { label: "Amazon 费用", amount: months.reduce((sum, month) => sum + month.amazonCost, 0) },
    { label: "产品成本", amount: months.reduce((sum, month) => sum + month.productCostTotal, 0) },
    { label: "物流成本", amount: months.reduce((sum, month) => sum + month.logisticsCostTotal, 0) },
    { label: "售后损耗", amount: months.reduce((sum, month) => sum + month.afterSalesLoss, 0) },
  ].sort((a, b) => b.amount - a.amount);
  const pressureFactors = pressurePool.slice(0, 3).map((item) => `${item.label}占折后销售额 ${totalNetSales > 0 ? (item.amount / totalNetSales * 100).toFixed(1) : "0.0"}%`);
  const recommendations: string[] = [];
  if (!hasProjectSales) recommendations.push("先完成产品、售价、销量和成本输入，再建立 M1-M12 推广曲线。");
  if (hasProjectSales && maximumCumulativeLoss > allowedLoss) recommendations.push("当前方案超过最大亏损承受线，应先降低前期广告预算或拆分放量节奏。");
  if (paybackMonth === null) recommendations.push("推演周期内未累计回本，需提高成交价、自然单占比或单位贡献利润。");
  if ((current?.profitMargin ?? 0) < targetMargin) recommendations.push("末月利润率未达到目标，优先处理占比最高的成本项，再扩大销量。");
  if ((current?.actualAcos ?? 0) > 0.4) recommendations.push("末月 ACOS 偏高，建议收紧低转化词并把预算转向可形成自然排名的核心词。");
  if (recommendations.length === 0) recommendations.push("当前利润率与资金缺口均在目标范围内，可按阶段逐步增加有效预算并持续复核转化率。");
  if (recommendations.length < 3) recommendations.push("每月用实际售价、退款和 FBA 账单回填模型，避免预测口径与结算口径偏离。");
  if (recommendations.length < 3) recommendations.push("设置月度止损复盘点，只有销量和自然单占比同步改善时才继续加码。");

  const previous = months.at(-2);
  const currentStage = !hasProjectSales
    ? "未开始"
    : (current?.operatingProfit ?? 0) < 0
      ? previous && current && current.operatingProfit > previous.operatingProfit ? "亏损收窄期" : "持续亏损期"
      : (current?.cumulativeProfit ?? 0) < 0
        ? "盈利过渡期"
        : stableProfitMonth !== null ? "稳定盈利期" : "单月转正期";

  const statusText = !hasProjectSales
    ? "尚未开始推演，请先完成售价、销量与成本输入。"
    : totalOperatingProfit >= 0
    ? `项目周期预计累计盈利，末月利润率 ${(current?.profitMargin ?? 0) * 100 >= 0 ? ((current?.profitMargin ?? 0) * 100).toFixed(1) : "0.0"}%。`
    : monthlyBreakEvenMonth !== null
      ? "单月已经转正，但项目累计投入尚未完全收回。"
      : "当前周期仍处于经营亏损，需要调整价格、广告或成本结构。";

  return {
    months,
    totalGrossListingSales,
    totalNetSales,
    totalOperatingProfit,
    finalProfitMargin,
    totalAdSpend,
    totalPromotionInvestment,
    projectRoi,
    maximumCumulativeLoss,
    maximumLossMonth: maximumCumulativeLoss > 0 ? lowestMonth?.month ?? null : null,
    maximumFundingGap: maximumCumulativeLoss,
    monthlyBreakEvenMonth,
    paybackMonth,
    stableProfitMonth,
    decision: {
      currentStage,
      riskLevel,
      riskLabel: riskLabels[riskLevel],
      statusText,
      pressureFactors,
      recommendations: recommendations.slice(0, 3),
    },
  };
}

function withMonthPlan(input: SimulationInput, plan: ResolvedMonthlyPlan, fixedOperatingCost = input.costs.fixedOperatingCost) {
  return calculateMonthEconomics(input, plan, { fixedOperatingCost });
}

export function calculateReverseTargets(input: SimulationInput, core = runSimulationCore(input)): ReverseTargets {
  const basePlan = resolveMonthlyPlan(input, 1);
  const orders = Math.floor(basePlan.orders);
  const targetMargin = clampRate(input.targets.targetProfitMargin);
  const evaluatePrice = (price: number) => withMonthPlan(input, { ...basePlan, listPrice: price, orders: Math.max(1, orders) });
  let minimumSellingPrice = Number.POSITIVE_INFINITY;
  if (orders > 0) {
    let low = 0;
    let high = Math.max(1, basePlan.listPrice);
    while (high < 1_000_000_000 && evaluatePrice(high).profitMargin < targetMargin) high *= 2;
    if (evaluatePrice(high).profitMargin >= targetMargin) {
      for (let iteration = 0; iteration < 70; iteration += 1) {
        const middle = (low + high) / 2;
        if (evaluatePrice(middle).profitMargin >= targetMargin) high = middle;
        else low = middle;
      }
      minimumSellingPrice = high;
    }
  }

  const noAdMonth = calculateMonthEconomics(input, { ...basePlan, acos: 0, adSpend: 0 }, { advertisingMode: "acos" });
  const targetProfit = noAdMonth.netSales * targetMargin;
  const maximumAdSpend = Math.max(0, noAdMonth.operatingProfit - targetProfit);
  const maximumAcos = noAdMonth.adSales > 0 ? maximumAdSpend / noAdMonth.adSales : Number.POSITIVE_INFINITY;
  const evaluateCoupon = (couponRate: number) => withMonthPlan(input, { ...basePlan, couponRate, orders: Math.max(1, orders) });
  let maximumCouponRate = 0;
  if (orders > 0 && evaluateCoupon(0).profitMargin >= targetMargin) {
    let low = 0;
    let high = 0.999999;
    if (evaluateCoupon(high).profitMargin >= targetMargin) maximumCouponRate = high;
    else {
      for (let iteration = 0; iteration < 70; iteration += 1) {
        const middle = (low + high) / 2;
        if (evaluateCoupon(middle).profitMargin >= targetMargin) low = middle;
        else high = middle;
      }
      maximumCouponRate = low;
    }
  }

  const oneOrder = calculateMonthEconomics(input, { ...basePlan, orders: 1 }, { fixedOperatingCost: 0 });
  const requiredMonthlyOrders = oneOrder.operatingProfit > 0
    ? Math.ceil((positive(input.targets.targetMonthlyProfit) + positive(input.costs.fixedOperatingCost)) / oneOrder.operatingProfit)
    : Number.POSITIVE_INFINITY;

  const allowedLoss = positive(input.targets.maximumAllowedLoss);
  const budgetGapAt = (budget: number) => {
    const clone: SimulationInput = {
      ...input,
      sales: { ...input.sales, advertisingMode: "spend" },
      monthlyPlans: Array.from({ length: input.product.plannedMonths }, (_, index) => ({
        ...resolveMonthlyPlan(input, index + 1),
        month: index + 1,
        adSpend: budget,
      })),
    };
    return runSimulationCore(clone).maximumFundingGap;
  };
  let maximumMonthlyAdBudget = 0;
  if (budgetGapAt(0) <= allowedLoss) {
    let low = 0;
    let high = Math.max(100, input.sales.monthlyAdSpend, basePlan.listPrice * Math.max(1, orders));
    while (high < 1_000_000_000 && budgetGapAt(high) <= allowedLoss) high *= 2;
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const middle = (low + high) / 2;
      if (budgetGapAt(middle) <= allowedLoss) low = middle;
      else high = middle;
    }
    maximumMonthlyAdBudget = low;
  }

  return {
    minimumSellingPrice: finiteOrInfinity(minimumSellingPrice),
    priceSafetySpace: Number.isFinite(minimumSellingPrice) ? basePlan.listPrice - minimumSellingPrice : Number.NEGATIVE_INFINITY,
    maximumAcos: finiteOrInfinity(maximumAcos),
    maximumAdSpend,
    maximumCouponRate,
    recommendedCouponRate: maximumCouponRate * 0.8,
    requiredMonthlyOrders: finiteOrInfinity(requiredMonthlyOrders),
    requiredDailyOrders: Number.isFinite(requiredMonthlyOrders) ? requiredMonthlyOrders / 30 : Number.POSITIVE_INFINITY,
    maximumMonthlyAdBudget,
  };
}

export function calculateSimulation(input: SimulationInput): SimulationResult {
  const core = runSimulationCore(input);
  return { ...core, reverse: calculateReverseTargets(input, core) };
}

function applyScenario(input: SimulationInput, scenario: ScenarioAdjustment): SimulationInput {
  const months = Math.min(12, Math.max(1, Math.floor(scenario.months)));
  return {
    ...input,
    product: { ...input.product, plannedMonths: months },
    monthlyPlans: Array.from({ length: months }, (_, index) => {
      const month = resolveMonthlyPlan(input, Math.min(index + 1, input.product.plannedMonths));
      return {
        month: index + 1,
        listPrice: month.listPrice * positive(scenario.priceMultiplier),
        orders: month.orders * positive(scenario.ordersMultiplier),
        couponRate: clampRate(month.couponRate + scenario.couponDelta),
        adOrderShare: clampShare(month.adOrderShare + scenario.adOrderShareDelta),
        acos: month.acos * positive(scenario.acosMultiplier),
        adSpend: month.adSpend * positive(scenario.acosMultiplier),
        returnRate: clampRate(month.returnRate * positive(scenario.returnRateMultiplier)),
        otherPromotionCost: month.otherPromotionCost,
      };
    }),
  };
}

function compareScenarioPriority(a: ScenarioComparison, b: ScenarioComparison, input: SimulationInput): number {
  const allowed = positive(input.targets.maximumAllowedLoss);
  const aSafe = a.result.maximumFundingGap <= allowed;
  const bSafe = b.result.maximumFundingGap <= allowed;
  if (aSafe !== bSafe) return aSafe ? -1 : 1;
  const aTarget = (a.result.months.at(-1)?.operatingProfit ?? 0) >= positive(input.targets.targetMonthlyProfit)
    && (a.result.months.at(-1)?.profitMargin ?? 0) >= clampRate(input.targets.targetProfitMargin);
  const bTarget = (b.result.months.at(-1)?.operatingProfit ?? 0) >= positive(input.targets.targetMonthlyProfit)
    && (b.result.months.at(-1)?.profitMargin ?? 0) >= clampRate(input.targets.targetProfitMargin);
  if (aTarget !== bTarget) return aTarget ? -1 : 1;
  const monthValue = (value: number | null) => value ?? Number.POSITIVE_INFINITY;
  if (monthValue(a.result.monthlyBreakEvenMonth) !== monthValue(b.result.monthlyBreakEvenMonth)) return monthValue(a.result.monthlyBreakEvenMonth) - monthValue(b.result.monthlyBreakEvenMonth);
  if (monthValue(a.result.paybackMonth) !== monthValue(b.result.paybackMonth)) return monthValue(a.result.paybackMonth) - monthValue(b.result.paybackMonth);
  if (a.result.maximumFundingGap !== b.result.maximumFundingGap) return a.result.maximumFundingGap - b.result.maximumFundingGap;
  return b.result.totalOperatingProfit - a.result.totalOperatingProfit;
}

export function compareScenarios(input: SimulationInput, scenarios: ScenarioAdjustment[]): ScenarioComparison[] {
  const comparisons = scenarios.map((scenario) => ({ scenario, result: runSimulationCore(applyScenario(input, scenario)), recommended: false, reason: "" }));
  const ranked = [...comparisons].sort((a, b) => compareScenarioPriority(a, b, input));
  const winner = ranked[0];
  return comparisons.map((comparison) => {
    const recommended = comparison.scenario.id === winner?.scenario.id;
    const withinLoss = comparison.result.maximumFundingGap <= positive(input.targets.maximumAllowedLoss);
    const reason = recommended
      ? withinLoss
        ? "在亏损上限内，综合回本速度、资金占用和利润目标后优先级最高。"
        : "所有方案均超过亏损上限，当前方案的资金缺口相对最低。"
      : withinLoss ? "方案可运行，但回本速度、资金占用或目标利润优先级低于推荐方案。" : "预计最大资金缺口超过设定上限。";
    return { ...comparison, recommended, reason };
  });
}
