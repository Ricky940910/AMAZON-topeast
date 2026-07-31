export type TransportMode = "sea-fast" | "sea-slow" | "air-delivery" | "air" | "express" | "rail" | "truck-eu" | "agl-air" | "agl-sea";
export type ChargeBasis = "volume" | "weight";
export type WeightChargeSource = "actual" | "dimensional";
export type DestinationCode = "US" | "CA" | "UK" | "DE" | "JP";
export type FeeCategory = "origin" | "carrier" | "destination" | "tax" | "other";

export interface TransportModeConfig {
  label: string;
  basis: ChargeBasis;
  defaultRatePerKg: number;
  defaultRatePerCbm: number;
  defaultMinimum: number;
  defaultIncrement: number;
  defaultDivisor: number;
  unitLabel: string;
}

export const TRANSPORT_MODE_CONFIG: Record<TransportMode, TransportModeConfig> = {
  "sea-fast": { label: "海运快船", basis: "volume", defaultRatePerKg: 0, defaultRatePerCbm: 0, defaultMinimum: 0, defaultIncrement: 0, defaultDivisor: 6000, unitLabel: "CBM" },
  "sea-slow": { label: "海运慢船", basis: "volume", defaultRatePerKg: 0, defaultRatePerCbm: 0, defaultMinimum: 0, defaultIncrement: 0, defaultDivisor: 6000, unitLabel: "CBM" },
  "air-delivery": { label: "空派", basis: "weight", defaultRatePerKg: 0, defaultRatePerCbm: 0, defaultMinimum: 0, defaultIncrement: 0, defaultDivisor: 6000, unitLabel: "KG" },
  air: { label: "空运", basis: "weight", defaultRatePerKg: 0, defaultRatePerCbm: 0, defaultMinimum: 0, defaultIncrement: 0, defaultDivisor: 6000, unitLabel: "KG" },
  express: { label: "国际快递", basis: "weight", defaultRatePerKg: 0, defaultRatePerCbm: 0, defaultMinimum: 0, defaultIncrement: 0, defaultDivisor: 5000, unitLabel: "KG" },
  rail: { label: "铁路", basis: "volume", defaultRatePerKg: 0, defaultRatePerCbm: 0, defaultMinimum: 0, defaultIncrement: 0, defaultDivisor: 6000, unitLabel: "CBM" },
  "truck-eu": { label: "卡航（欧洲）", basis: "volume", defaultRatePerKg: 0, defaultRatePerCbm: 0, defaultMinimum: 0, defaultIncrement: 0, defaultDivisor: 6000, unitLabel: "CBM" },
  "agl-air": { label: "AGL 空运", basis: "weight", defaultRatePerKg: 0, defaultRatePerCbm: 0, defaultMinimum: 0, defaultIncrement: 0, defaultDivisor: 6000, unitLabel: "KG" },
  "agl-sea": { label: "AGL 海运", basis: "volume", defaultRatePerKg: 0, defaultRatePerCbm: 0, defaultMinimum: 0, defaultIncrement: 0, defaultDivisor: 6000, unitLabel: "CBM" },
};

export const DESTINATION_CONFIG: Record<DestinationCode, { label: string; currency: "USD" | "CAD" | "GBP" | "EUR" | "JPY"; symbol: string; defaultExchangeRate: number }> = {
  US: { label: "美国", currency: "USD", symbol: "$", defaultExchangeRate: 7.20 },
  CA: { label: "加拿大", currency: "CAD", symbol: "C$", defaultExchangeRate: 5.25 },
  UK: { label: "英国", currency: "GBP", symbol: "£", defaultExchangeRate: 9.25 },
  DE: { label: "德国 / 欧盟", currency: "EUR", symbol: "€", defaultExchangeRate: 7.85 },
  JP: { label: "日本", currency: "JPY", symbol: "¥", defaultExchangeRate: 0.049 },
};

export interface AdditionalFeeItem {
  id: string;
  name: string;
  category: FeeCategory;
  amount: number;
}

export interface FirstMileInput {
  sku: string;
  asin: string;
  originCountry: string;
  destination: DestinationCode;
  amazonWarehouse: string;
  shipDate: string;
  estimatedArrivalDate: string;
  totalUnits: number;
  unitWeightKg: number;
  unitLengthCm: number;
  unitWidthCm: number;
  unitHeightCm: number;
  unitsPerCarton: number;
  cartonCount: number;
  cartonLengthCm: number;
  cartonWidthCm: number;
  cartonHeightCm: number;
  cartonGrossWeightKg: number;
  transportMode: TransportMode;
  ratePerKg: number;
  ratePerCbm: number;
  minimumChargeable: number;
  billingIncrement: number;
  volumeWeightDivisor: number;
  fees: AdditionalFeeItem[];
  salePrice: number;
  exchangeRateCnyPerCurrency: number;
}

export interface FirstMileResult {
  expectedCartonCount: number;
  cartonCapacityUnits: number;
  netProductWeightKg: number;
  grossWeightKg: number;
  totalVolumeCbm: number;
  productVolumeCbm: number;
  cartonSpaceUtilization: number;
  dimensionalWeightKg: number;
  airDimensionalWeightKg: number;
  expressDimensionalWeightKg: number;
  rawChargeableWeightKg: number;
  rawBillingQuantity: number;
  billedQuantity: number;
  appliedRate: number;
  chargeBasis: ChargeBasis;
  weightChargeSource: WeightChargeSource;
  chargeUnitLabel: string;
  freightCost: number;
  originFees: number;
  carrierFees: number;
  destinationFees: number;
  importTaxes: number;
  otherFees: number;
  nonTaxAdditionalFees: number;
  additionalFeesTotal: number;
  logisticsCostBeforeImportTaxes: number;
  totalFirstMileCost: number;
  unitLogisticsCostBeforeImportTaxes: number;
  unitImportTax: number;
  unitFirstMileCostCny: number;
  unitFirstMileCostSalesCurrency: number;
  salePriceCny: number;
  firstMileShareOfSalePrice: number;
  transitDays: number | null;
  dimensionalWeightApplied: boolean;
  warnings: string[];
}

const positive = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

function roundUp(value: number, increment: number): number {
  if (value <= 0) return 0;
  const safeIncrement = increment > 0 ? increment : 0.01;
  return Math.ceil((value - 1e-9) / safeIncrement) * safeIncrement;
}

function dateDifference(start: string, end: string): number | null {
  if (!start || !end) return null;
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
  return Math.round((endTime - startTime) / 86_400_000);
}

function sumFees(fees: AdditionalFeeItem[], category: FeeCategory): number {
  return fees.filter((fee) => fee.category === category).reduce((sum, fee) => sum + positive(fee.amount), 0);
}

export function calculateFirstMile(input: FirstMileInput): FirstMileResult {
  const mode = TRANSPORT_MODE_CONFIG[input.transportMode];
  const totalUnits = Math.floor(positive(input.totalUnits));
  const cartonCount = Math.floor(positive(input.cartonCount));
  const unitsPerCarton = Math.floor(positive(input.unitsPerCarton));
  const expectedCartonCount = unitsPerCarton > 0 ? Math.ceil(totalUnits / unitsPerCarton) : 0;
  const cartonCapacityUnits = cartonCount * unitsPerCarton;

  const netProductWeightKg = totalUnits * positive(input.unitWeightKg);
  const grossWeightKg = cartonCount * positive(input.cartonGrossWeightKg);
  const cartonVolumeCm3 = positive(input.cartonLengthCm) * positive(input.cartonWidthCm) * positive(input.cartonHeightCm);
  const totalVolumeCbm = cartonVolumeCm3 * cartonCount / 1_000_000;
  const productVolumeCbm = positive(input.unitLengthCm) * positive(input.unitWidthCm) * positive(input.unitHeightCm) * totalUnits / 1_000_000;
  const cartonSpaceUtilization = totalVolumeCbm > 0 ? productVolumeCbm / totalVolumeCbm : 0;

  const divisor = positive(input.volumeWeightDivisor) || mode.defaultDivisor;
  const dimensionalWeightKg = divisor > 0 ? cartonVolumeCm3 * cartonCount / divisor : 0;
  const airDimensionalWeightKg = cartonVolumeCm3 * cartonCount / 6000;
  const expressDimensionalWeightKg = cartonVolumeCm3 * cartonCount / 5000;
  const rawChargeableWeightKg = Math.max(grossWeightKg, dimensionalWeightKg);
  const rawBillingQuantity = mode.basis === "weight" ? rawChargeableWeightKg : totalVolumeCbm;
  const billedQuantity = roundUp(Math.max(rawBillingQuantity, positive(input.minimumChargeable)), positive(input.billingIncrement));
  const appliedRate = mode.basis === "weight" ? positive(input.ratePerKg) : positive(input.ratePerCbm);
  const freightCost = billedQuantity * appliedRate;
  const weightChargeSource: WeightChargeSource = dimensionalWeightKg > grossWeightKg ? "dimensional" : "actual";

  const originFees = sumFees(input.fees, "origin");
  const carrierFees = sumFees(input.fees, "carrier");
  const destinationFees = sumFees(input.fees, "destination");
  const importTaxes = sumFees(input.fees, "tax");
  const otherFees = sumFees(input.fees, "other");
  const nonTaxAdditionalFees = originFees + carrierFees + destinationFees + otherFees;
  const additionalFeesTotal = nonTaxAdditionalFees + importTaxes;
  const logisticsCostBeforeImportTaxes = freightCost + nonTaxAdditionalFees;
  const totalFirstMileCost = logisticsCostBeforeImportTaxes + importTaxes;
  const unitLogisticsCostBeforeImportTaxes = totalUnits > 0 ? logisticsCostBeforeImportTaxes / totalUnits : 0;
  const unitImportTax = totalUnits > 0 ? importTaxes / totalUnits : 0;
  const unitFirstMileCostCny = totalUnits > 0 ? totalFirstMileCost / totalUnits : 0;
  const exchangeRate = positive(input.exchangeRateCnyPerCurrency);
  const unitFirstMileCostSalesCurrency = exchangeRate > 0 ? unitFirstMileCostCny / exchangeRate : 0;
  const salePriceCny = positive(input.salePrice) * exchangeRate;
  const firstMileShareOfSalePrice = salePriceCny > 0 ? unitFirstMileCostCny / salePriceCny : 0;
  const transitDays = dateDifference(input.shipDate, input.estimatedArrivalDate);
  const warnings: string[] = [];

  if (totalUnits === 0) warnings.push("总件数为 0，无法计算有效的单件头程成本。");
  if (cartonCount === 0) warnings.push("箱数必须大于 0，否则无法计算整票重量和体积。");
  if (unitsPerCarton === 0) warnings.push("单箱装箱数必须大于 0，无法校验箱数。");
  if (cartonVolumeCm3 === 0) warnings.push("外箱尺寸不完整，当前总体积与体积重无效。");
  if (grossWeightKg === 0) warnings.push("单箱毛重或箱数为 0，当前实际毛重无效。");
  if (appliedRate === 0) warnings.push(`当前${mode.basis === "weight" ? "每公斤" : "每立方"}报价为 0，请填写承运商实际报价。`);
  if (exchangeRate === 0) warnings.push("汇率为 0，无法换算利润测算器使用的销售币种成本。");
  if (expectedCartonCount > 0 && cartonCount !== expectedCartonCount) warnings.push(`按总件数与装箱数应为 ${expectedCartonCount} 箱，当前填写 ${cartonCount} 箱。`);
  if (cartonCapacityUnits < totalUnits) warnings.push(`当前 ${cartonCount} 箱最多装 ${cartonCapacityUnits} 件，少于计划发货 ${totalUnits} 件。`);
  if (grossWeightKg > 0 && grossWeightKg < netProductWeightKg) warnings.push("整票毛重低于产品净重，请检查单件重量、箱数或单箱毛重。");
  if (cartonSpaceUtilization > 1.02) warnings.push("产品总体积超过外箱总体积，请检查产品尺寸、装箱数或箱规。");
  if (mode.basis === "weight" && dimensionalWeightKg > grossWeightKg) warnings.push(`当前采用体积重计费，体积重比实际毛重高 ${(dimensionalWeightKg - grossWeightKg).toFixed(2)} kg。`);
  if (input.transportMode === "express" && divisor !== 5000) warnings.push("国际快递体积重除数因承运商而异，当前已使用自定义除数，请以物流商账单为准。");
  if (input.transportMode === "agl-air" || input.transportMode === "agl-sea") warnings.push("AGL 报价会随航线、仓库、货型和出运日期变化，请以 Seller Central 当前报价为准。");
  if (transitDays !== null && transitDays < 0) warnings.push("预计到仓日期早于发货日期，请检查日期。");
  if (importTaxes > 0) warnings.push("关税/VAT 已包含在含税头程总成本中；同步时会拆分写入物流与进口税字段，避免重复扣除。");
  warnings.push("物流单价、体积重除数、最低计费量和进位规则属于承运商报价参数，并非 Amazon 官方费率。");

  return {
    expectedCartonCount,
    cartonCapacityUnits,
    netProductWeightKg,
    grossWeightKg,
    totalVolumeCbm,
    productVolumeCbm,
    cartonSpaceUtilization,
    dimensionalWeightKg,
    airDimensionalWeightKg,
    expressDimensionalWeightKg,
    rawChargeableWeightKg,
    rawBillingQuantity,
    billedQuantity,
    appliedRate,
    chargeBasis: mode.basis,
    weightChargeSource,
    chargeUnitLabel: mode.unitLabel,
    freightCost,
    originFees,
    carrierFees,
    destinationFees,
    importTaxes,
    otherFees,
    nonTaxAdditionalFees,
    additionalFeesTotal,
    logisticsCostBeforeImportTaxes,
    totalFirstMileCost,
    unitLogisticsCostBeforeImportTaxes,
    unitImportTax,
    unitFirstMileCostCny,
    unitFirstMileCostSalesCurrency,
    salePriceCny,
    firstMileShareOfSalePrice,
    transitDays,
    dimensionalWeightApplied: mode.basis === "weight" && dimensionalWeightKg > grossWeightKg,
    warnings,
  };
}
