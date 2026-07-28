export type InventorySizeTier = "standard" | "oversize";
export type DecisionAction = "continue" | "promote" | "remove" | "liquidate";

export interface InventoryInput {
  sku: string;
  asin: string;
  productName: string;
  currentInventory: number;
  unitVolumeCuFt: number;
  averageDailySales: number;
  inboundDate: string;
  currentDate: string;
  sizeTier: InventorySizeTier;
  dangerousGoods: boolean;
  utilizationEligible: boolean;
  utilizationWeeks: number;
  customStorageRate: number | null;
  customAgedRate: number | null;
  removalQuantity: number;
  unitWeightLb: number;
  customRemovalFee: number | null;
  liquidationQuantity: number;
  unitCost: number;
  recoveryRate: number;
  forecastMonths: number;
}

export interface StorageRateResult {
  baseRate: number;
  utilizationRate: number;
  totalRate: number;
  season: "offPeak" | "peak";
}

export interface AgedRateResult {
  ageBand: string;
  volumeRate: number;
  minimumPerUnit: number;
}

export interface ForecastRow {
  month: string;
  openingInventory: number;
  closingInventory: number;
  averageInventory: number;
  ageDays: number;
  storageFee: number;
  agedFee: number;
  totalFee: number;
}

export interface InventoryResult {
  inventoryAgeDays: number;
  daysOfSupply: number;
  totalVolume: number;
  storageRates: StorageRateResult;
  monthlyBaseStorageFee: number;
  monthlyUtilizationSurcharge: number;
  monthlyStorageFee: number;
  agedRates: AgedRateResult;
  agedInventoryQuantity: number;
  agedVolumeFee: number;
  agedMinimumFee: number;
  agedInventoryFee: number;
  removalFeePerUnit: number;
  removalTotalFee: number;
  liquidationProcessingFeePerUnit: number;
  liquidationProductCost: number;
  liquidationGrossRecovery: number;
  liquidationReferralFee: number;
  liquidationProcessingFee: number;
  liquidationNetRecovery: number;
  liquidationLoss: number;
  combinedStressCost: number;
  remainingInventoryValue: number;
  forecast: ForecastRow[];
  projectedHoldingCost: number;
  decision: DecisionAction;
  decisionTitle: string;
  decisionReason: string;
  warnings: string[];
}

const MS_PER_DAY = 86_400_000;

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateInventoryAge(inboundDate: string, currentDate: string): number {
  const inbound = parseDate(inboundDate);
  const current = parseDate(currentDate);
  if (!inbound || !current || current < inbound) return 0;
  return Math.floor((current.getTime() - inbound.getTime()) / MS_PER_DAY);
}

export function getStorageRates(
  currentDate: string,
  sizeTier: InventorySizeTier,
  dangerousGoods: boolean,
  utilizationEligible: boolean,
  utilizationWeeks: number,
  inventoryAgeDays: number,
  customStorageRate: number | null = null,
): StorageRateResult {
  const date = parseDate(currentDate) ?? new Date();
  const month = date.getUTCMonth() + 1;
  const season = month >= 10 ? "peak" : "offPeak";
  const baseRates = dangerousGoods
    ? season === "peak" ? { standard: 3.63, oversize: 2.43 } : { standard: 0.99, oversize: 0.78 }
    : season === "peak" ? { standard: 2.40, oversize: 1.40 } : { standard: 0.78, oversize: 0.56 };
  const baseRate = customStorageRate === null ? baseRates[sizeTier] : Math.max(0, customStorageRate);

  let utilizationRate = 0;
  if (!dangerousGoods && utilizationEligible && inventoryAgeDays > 30) {
    if (utilizationWeeks >= 52) utilizationRate = sizeTier === "standard" ? 1.88 : 1.26;
    else if (utilizationWeeks >= 44) utilizationRate = sizeTier === "standard" ? 1.58 : 0.76;
    else if (utilizationWeeks >= 36) utilizationRate = sizeTier === "standard" ? 1.16 : 0.63;
    else if (utilizationWeeks >= 28) utilizationRate = sizeTier === "standard" ? 0.76 : 0.46;
    else if (utilizationWeeks >= 22) utilizationRate = sizeTier === "standard" ? 0.44 : 0.23;
  }

  return { baseRate, utilizationRate, totalRate: baseRate + utilizationRate, season };
}

export function getAgedInventoryRate(ageDays: number, customRate: number | null = null): AgedRateResult {
  if (customRate !== null) return { ageBand: "手动费率", volumeRate: Math.max(0, customRate), minimumPerUnit: 0 };
  if (ageDays < 181) return { ageBand: "0–180 天", volumeRate: 0, minimumPerUnit: 0 };
  if (ageDays <= 210) return { ageBand: "181–210 天", volumeRate: 0.50, minimumPerUnit: 0 };
  if (ageDays <= 240) return { ageBand: "211–240 天", volumeRate: 1.00, minimumPerUnit: 0 };
  if (ageDays <= 270) return { ageBand: "241–270 天", volumeRate: 1.50, minimumPerUnit: 0 };
  if (ageDays <= 300) return { ageBand: "271–300 天", volumeRate: 5.45, minimumPerUnit: 0 };
  if (ageDays <= 330) return { ageBand: "301–330 天", volumeRate: 5.70, minimumPerUnit: 0 };
  if (ageDays <= 365) return { ageBand: "331–365 天", volumeRate: 5.90, minimumPerUnit: 0 };
  if (ageDays <= 455) return { ageBand: "366–455 天", volumeRate: 6.90, minimumPerUnit: 0.30 };
  return { ageBand: "456 天以上", volumeRate: 7.90, minimumPerUnit: 0.35 };
}

export function calculateRemovalFeePerUnit(sizeTier: InventorySizeTier, unitWeightLb: number): number {
  const weight = Math.max(0, unitWeightLb);
  if (sizeTier === "standard") {
    if (weight <= 0.5) return 0.84;
    if (weight <= 1) return 1.53;
    if (weight <= 2) return 2.27;
    return 2.89 + Math.ceil(weight - 2 - Number.EPSILON) * 1.06;
  }
  if (weight <= 1) return 3.12;
  if (weight <= 2) return 4.30;
  if (weight <= 4) return 6.36;
  if (weight <= 10) return 10.04;
  return 14.32 + Math.ceil(weight - 10 - Number.EPSILON) * 1.06;
}

export function calculateLiquidationProcessingFee(sizeTier: InventorySizeTier, unitWeightLb: number): number {
  const weight = Math.max(0, unitWeightLb);
  if (sizeTier === "standard") {
    if (weight <= 0.5) return 0.25;
    if (weight <= 1) return 0.30;
    if (weight <= 2) return 0.35;
    return 0.40 + Math.ceil(weight - 2 - Number.EPSILON) * 0.20;
  }
  if (weight <= 1) return 0.60;
  if (weight <= 2) return 0.70;
  if (weight <= 4) return 0.90;
  if (weight <= 10) return 1.45;
  return 1.90 + Math.ceil(weight - 10 - Number.EPSILON) * 0.20;
}

function shiftMonth(dateString: string, offset: number): string {
  const date = parseDate(dateString) ?? new Date();
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  return shifted.toISOString().slice(0, 10);
}

function forecastHoldingCosts(input: InventoryInput, currentAgeDays: number): ForecastRow[] {
  const rows: ForecastRow[] = [];
  let inventory = Math.max(0, Math.floor(input.currentInventory));
  const monthlySales = Math.max(0, input.averageDailySales) * 30;
  const months = Math.min(24, Math.max(1, Math.floor(input.forecastMonths)));

  for (let index = 0; index < months && inventory > 0; index += 1) {
    const openingInventory = inventory;
    const closingInventory = Math.max(0, openingInventory - monthlySales);
    const averageInventory = (openingInventory + closingInventory) / 2;
    const ageDays = currentAgeDays + index * 30 + 15;
    const monthDate = shiftMonth(input.currentDate, index);
    const storageRates = getStorageRates(monthDate, input.sizeTier, input.dangerousGoods, input.utilizationEligible, input.utilizationWeeks, ageDays, input.customStorageRate);
    const storageFee = averageInventory * input.unitVolumeCuFt * storageRates.totalRate;
    const agedRates = getAgedInventoryRate(ageDays, input.customAgedRate);
    const agedVolumeFee = averageInventory * input.unitVolumeCuFt * agedRates.volumeRate;
    const agedFee = Math.max(agedVolumeFee, averageInventory * agedRates.minimumPerUnit);
    rows.push({
      month: monthDate.slice(0, 7),
      openingInventory,
      closingInventory,
      averageInventory,
      ageDays,
      storageFee,
      agedFee,
      totalFee: storageFee + agedFee,
    });
    inventory = closingInventory;
  }
  return rows;
}

function chooseDecision(
  inventoryAgeDays: number,
  daysOfSupply: number,
  projectedHoldingCost: number,
  removalTotalFee: number,
  liquidationLoss: number,
  averageDailySales: number,
  currentInventory: number,
  removalQuantity: number,
  liquidationQuantity: number,
): { decision: DecisionAction; decisionTitle: string; decisionReason: string } {
  if (averageDailySales > 0 && daysOfSupply <= 90 && inventoryAgeDays < 181) {
    return { decision: "continue", decisionTitle: "继续销售", decisionReason: `预计 ${Math.ceil(daysOfSupply)} 天可售完，且尚未进入 181 天库龄附加费区间。` };
  }
  const holdingCostPerUnit = currentInventory > 0 ? projectedHoldingCost / currentInventory : 0;
  const comparedRemovalHoldingCost = holdingCostPerUnit * removalQuantity;
  const comparedLiquidationHoldingCost = holdingCostPerUnit * liquidationQuantity;
  if (comparedRemovalHoldingCost > 0 && removalTotalFee > 0 && comparedRemovalHoldingCost > removalTotalFee && removalTotalFee <= liquidationLoss) {
    return { decision: "remove", decisionTitle: "优先评估移除", decisionReason: `所选 ${removalQuantity} 件的预测持有成本 $${comparedRemovalHoldingCost.toFixed(2)} 高于移除费 $${removalTotalFee.toFixed(2)}，移除后仍可保留货值。` };
  }
  if (comparedLiquidationHoldingCost > liquidationLoss && liquidationLoss > 0) {
    return { decision: "liquidate", decisionTitle: "优先评估批量清货", decisionReason: `所选 ${liquidationQuantity} 件的清货损失 $${liquidationLoss.toFixed(2)} 低于对应预测持有成本 $${comparedLiquidationHoldingCost.toFixed(2)}。` };
  }
  return {
    decision: "promote",
    decisionTitle: "降价促销并观察",
    decisionReason: inventoryAgeDays >= 181
      ? `当前库龄 ${inventoryAgeDays} 天，已进入老化库存费用区间，但退出成本仍高于预测持有成本。`
      : `库存周转偏慢，建议先提升销量，再根据下一计费节点复核。`,
  };
}

export function calculateInventoryCosts(input: InventoryInput): InventoryResult {
  const currentInventory = Math.max(0, Math.floor(input.currentInventory));
  const unitVolume = Math.max(0, input.unitVolumeCuFt);
  const inventoryAgeDays = calculateInventoryAge(input.inboundDate, input.currentDate);
  const daysOfSupply = input.averageDailySales > 0 ? currentInventory / input.averageDailySales : Number.POSITIVE_INFINITY;
  const totalVolume = currentInventory * unitVolume;
  const storageRates = getStorageRates(input.currentDate, input.sizeTier, input.dangerousGoods, input.utilizationEligible, input.utilizationWeeks, inventoryAgeDays, input.customStorageRate);
  const monthlyBaseStorageFee = totalVolume * storageRates.baseRate;
  const monthlyUtilizationSurcharge = inventoryAgeDays > 30 ? totalVolume * storageRates.utilizationRate : 0;
  const monthlyStorageFee = monthlyBaseStorageFee + monthlyUtilizationSurcharge;

  const agedRates = getAgedInventoryRate(inventoryAgeDays, input.customAgedRate);
  const agedInventoryQuantity = inventoryAgeDays >= 181 || input.customAgedRate !== null ? currentInventory : 0;
  const agedVolumeFee = agedInventoryQuantity * unitVolume * agedRates.volumeRate;
  const agedMinimumFee = agedInventoryQuantity * agedRates.minimumPerUnit;
  const agedInventoryFee = Math.max(agedVolumeFee, agedMinimumFee);

  const removalFeePerUnit = input.customRemovalFee === null
    ? calculateRemovalFeePerUnit(input.sizeTier, input.unitWeightLb)
    : Math.max(0, input.customRemovalFee);
  const removalQuantity = Math.min(currentInventory, Math.max(0, Math.floor(input.removalQuantity)));
  const removalTotalFee = removalQuantity * removalFeePerUnit;

  const liquidationQuantity = Math.min(currentInventory, Math.max(0, Math.floor(input.liquidationQuantity)));
  const liquidationProcessingFeePerUnit = calculateLiquidationProcessingFee(input.sizeTier, input.unitWeightLb);
  const liquidationProductCost = liquidationQuantity * Math.max(0, input.unitCost);
  const liquidationGrossRecovery = liquidationProductCost * Math.min(1, Math.max(0, input.recoveryRate));
  const liquidationReferralFee = liquidationGrossRecovery * 0.15;
  const liquidationProcessingFee = liquidationQuantity * liquidationProcessingFeePerUnit;
  const liquidationNetRecovery = Math.max(0, liquidationGrossRecovery - liquidationReferralFee - liquidationProcessingFee);
  const liquidationLoss = Math.max(0, liquidationProductCost - liquidationNetRecovery);
  const combinedStressCost = monthlyStorageFee + agedInventoryFee + removalTotalFee + liquidationLoss;
  const remainingInventoryValue = currentInventory * Math.max(0, input.unitCost);
  const forecast = forecastHoldingCosts(input, inventoryAgeDays);
  const projectedHoldingCost = forecast.reduce((sum, row) => sum + row.totalFee, 0);
  const decision = chooseDecision(
    inventoryAgeDays,
    daysOfSupply,
    projectedHoldingCost,
    removalTotalFee,
    liquidationLoss,
    input.averageDailySales,
    currentInventory,
    removalQuantity,
    liquidationQuantity,
  );
  const warnings: string[] = [];
  if (input.currentDate < input.inboundDate) warnings.push("当前日期早于入仓日期，库龄按 0 天处理。");
  if (input.removalQuantity > currentInventory) warnings.push("移除数量超过当前库存，计算已按当前库存截断。");
  if (input.liquidationQuantity > currentInventory) warnings.push("清货数量超过当前库存，计算已按当前库存截断。");
  if (!input.dangerousGoods && input.utilizationEligible) warnings.push("Storage Utilization Surcharge 仅对符合 Amazon 资格且库龄超过 30 天的库存适用。");
  warnings.push("实际费用以 Amazon 记录的平均每日库存、库龄分布、尺寸重量与下单时费率为准。");

  return {
    inventoryAgeDays,
    daysOfSupply,
    totalVolume,
    storageRates,
    monthlyBaseStorageFee,
    monthlyUtilizationSurcharge,
    monthlyStorageFee,
    agedRates,
    agedInventoryQuantity,
    agedVolumeFee,
    agedMinimumFee,
    agedInventoryFee,
    removalFeePerUnit,
    removalTotalFee,
    liquidationProcessingFeePerUnit,
    liquidationProductCost,
    liquidationGrossRecovery,
    liquidationReferralFee,
    liquidationProcessingFee,
    liquidationNetRecovery,
    liquidationLoss,
    combinedStressCost,
    remainingInventoryValue,
    forecast,
    projectedHoldingCost,
    ...decision,
    warnings,
  };
}
