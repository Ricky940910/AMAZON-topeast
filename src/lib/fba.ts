export type LengthUnit = "mm" | "cm" | "m" | "in" | "inch" | "ft" | "feet";
export type WeightUnit = "g" | "kg" | "oz" | "lb";
export type VolumeUnit = "cm3" | "m3" | "cbm" | "cuft";
export type LiquidUnit = "ml" | "l" | "oz";
export type ProductType = "general" | "apparel" | "dangerous";
export type PriceBand = "low" | "mid" | "high";
export type FeePeriod = "nonPeak" | "peak";
export type SizeTier =
  | "Small Standard"
  | "Large Standard"
  | "Small Bulky"
  | "Large Bulky"
  | "Extra Large 0–50 lb"
  | "Extra Large 50+–70 lb"
  | "Extra Large 70+–150 lb"
  | "Extra Large 150+ lb";

export interface FbaInput {
  length: number;
  width: number;
  height: number;
  lengthUnit: LengthUnit;
  weight: number;
  weightUnit: WeightUnit;
  price: number;
  productType: ProductType;
  feeDate: string;
  includeSurcharge: boolean;
}

export interface SizeClassification {
  tier: SizeTier;
  longest: number;
  median: number;
  shortest: number;
  girth: number;
  lengthPlusGirth: number;
  rawDimensionalWeight: number;
  adjustedDimensionalWeight: number;
  tierWeight: number;
  feeShippingWeight: number;
  dimensionalWeightUsedForFee: boolean;
  minimumTwoInchesApplied: boolean;
  overmax: boolean;
}

export interface FeeResult {
  baseFee: number;
  surcharge: number;
  totalFee: number;
  period: FeePeriod;
  priceBand: PriceBand;
  weightTierLabel: string;
  rateExplanation: string;
}

export interface PackagingSuggestion {
  dimensionLabel: "最长边" | "中边" | "短边";
  reduction: number;
  projectedDimension: number;
  projectedDimensionalWeight: number;
  projectedTier: SizeTier;
  projectedFee: number;
  savings: number;
}

export interface FbaResult {
  input: FbaInput;
  dimensionsIn: [number, number, number];
  dimensionsCm: [number, number, number];
  actualWeightLb: number;
  actualWeightKg: number;
  classification: SizeClassification;
  fee: FeeResult;
  suggestion: PackagingSuggestion | null;
  warnings: string[];
}

type FeeTriple = [number, number, number];
type StandardRow = { maxLb: number; label: string; fees: FeeTriple };
type StandardRates = { small: StandardRow[]; large: StandardRow[]; heavyBase: FeeTriple };
type PeriodRates = Record<ProductType, StandardRates>;

const SMALL_MAXES = [2, 4, 6, 8, 10, 12, 14, 16].map((oz) => oz / 16);
const SMALL_LABELS = ["≤2 oz", "2+–4 oz", "4+–6 oz", "6+–8 oz", "8+–10 oz", "10+–12 oz", "12+–14 oz", "14+–16 oz"];
const LARGE_MAXES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];
const LARGE_LABELS = ["≤4 oz", "4+–8 oz", "8+–12 oz", "12+–16 oz", "1+–1.25 lb", "1.25+–1.50 lb", "1.50+–1.75 lb", "1.75+–2.00 lb", "2.00+–2.25 lb", "2.25+–2.50 lb", "2.50+–2.75 lb", "2.75+–3.00 lb"];

function standardRates(smallFees: FeeTriple[], largeFees: FeeTriple[], heavyBase: FeeTriple): StandardRates {
  return {
    small: SMALL_MAXES.map((maxLb, index) => ({ maxLb, label: SMALL_LABELS[index], fees: smallFees[index] })),
    large: LARGE_MAXES.map((maxLb, index) => ({ maxLb, label: LARGE_LABELS[index], fees: largeFees[index] })),
    heavyBase,
  };
}

const NON_PEAK_RATES: PeriodRates = {
  general: standardRates(
    [[2.43, 3.32, 3.58], [2.49, 3.42, 3.68], [2.56, 3.45, 3.71], [2.66, 3.54, 3.80], [2.77, 3.68, 3.94], [2.82, 3.78, 4.04], [2.92, 3.91, 4.17], [2.95, 3.96, 4.22]],
    [[2.91, 3.73, 3.99], [3.13, 3.95, 4.21], [3.38, 4.20, 4.46], [3.78, 4.60, 4.86], [4.22, 5.04, 5.30], [4.60, 5.42, 5.68], [4.75, 5.57, 5.83], [5.00, 5.82, 6.08], [5.10, 5.92, 6.18], [5.28, 6.10, 6.36], [5.44, 6.26, 6.52], [5.85, 6.67, 6.93]],
    [6.15, 6.97, 7.23],
  ),
  apparel: standardRates(
    [[2.62, 3.51, 3.77], [2.64, 3.54, 3.80], [2.68, 3.59, 3.85], [2.81, 3.69, 3.95], [3.00, 3.91, 4.17], [3.10, 4.09, 4.35], [3.20, 4.20, 4.46], [3.30, 4.25, 4.51]],
    [[3.48, 4.30, 4.56], [3.68, 4.50, 4.76], [3.90, 4.72, 4.98], [4.35, 5.17, 5.43], [5.05, 5.87, 6.13], [5.22, 6.04, 6.30], [5.32, 6.14, 6.40], [5.43, 6.25, 6.51], [5.78, 6.60, 6.86], [5.90, 6.72, 6.98], [5.95, 6.77, 7.03], [6.08, 6.90, 7.16]],
    [6.15, 6.97, 7.23],
  ),
  dangerous: standardRates(
    [[3.40, 4.29, 4.55], [3.43, 4.36, 4.62], [3.48, 4.37, 4.63], [3.55, 4.43, 4.69], [3.64, 4.55, 4.81], [3.65, 4.61, 4.87], [3.73, 4.72, 4.98], [3.77, 4.78, 5.04]],
    [[3.73, 4.55, 4.81], [3.94, 4.76, 5.02], [4.17, 4.99, 5.25], [4.37, 5.19, 5.45], [4.82, 5.64, 5.90], [5.20, 6.02, 6.28], [5.35, 6.17, 6.43], [5.49, 6.31, 6.57], [5.56, 6.38, 6.64], [5.74, 6.56, 6.82], [5.90, 6.72, 6.98], [6.31, 7.13, 7.39]],
    [6.61, 7.43, 7.69],
  ),
};

const PEAK_RATES: PeriodRates = {
  general: standardRates(
    [[2.62, 3.51, 3.77], [2.68, 3.61, 3.87], [2.76, 3.65, 3.91], [2.86, 3.74, 4.00], [2.98, 3.89, 4.15], [3.03, 3.99, 4.25], [3.14, 4.13, 4.39], [3.17, 4.18, 4.44]],
    [[3.15, 3.97, 4.23], [3.39, 4.21, 4.47], [3.66, 4.48, 4.74], [4.07, 4.89, 5.15], [4.52, 5.34, 5.60], [4.91, 5.73, 5.99], [5.07, 5.89, 6.15], [5.33, 6.15, 6.41], [5.47, 6.29, 6.55], [5.67, 6.49, 6.75], [5.84, 6.66, 6.92], [6.26, 7.08, 7.34]],
    [6.69, 7.51, 7.77],
  ),
  apparel: standardRates(
    [[2.85, 3.74, 4.00], [2.87, 3.77, 4.03], [2.93, 3.84, 4.10], [3.06, 3.94, 4.20], [3.27, 4.18, 4.44], [3.37, 4.36, 4.62], [3.49, 4.49, 4.75], [3.59, 4.54, 4.80]],
    [[3.79, 4.61, 4.87], [4.00, 4.82, 5.08], [4.23, 5.05, 5.31], [4.69, 5.51, 5.77], [5.42, 6.24, 6.50], [5.59, 6.41, 6.67], [5.71, 6.53, 6.79], [5.82, 6.64, 6.90], [6.22, 7.04, 7.30], [6.34, 7.16, 7.42], [6.41, 7.23, 7.49], [6.54, 7.36, 7.62]],
    [6.82, 7.64, 7.90],
  ),
  dangerous: standardRates(
    [[3.74, 4.63, 4.89], [3.80, 4.73, 4.99], [3.88, 4.77, 5.03], [3.98, 4.86, 5.12], [4.10, 5.01, 5.27], [4.14, 5.10, 5.36], [4.25, 5.24, 5.50], [4.32, 5.33, 5.59]],
    [[4.32, 5.14, 5.40], [4.56, 5.38, 5.64], [4.82, 5.64, 5.90], [5.04, 5.86, 6.12], [5.51, 6.33, 6.59], [5.91, 6.73, 6.99], [6.08, 6.90, 7.16], [6.24, 7.06, 7.32], [6.33, 7.15, 7.41], [6.53, 7.35, 7.61], [6.70, 7.52, 7.78], [7.12, 7.94, 8.20]],
    [7.51, 8.33, 8.59],
  ),
};

const BULKY_BASES: Record<FeePeriod, Record<ProductType, Record<SizeTier, FeeTriple>>> = {
  nonPeak: {
    general: {
      "Small Bulky": [6.78, 7.55, 7.55], "Large Bulky": [8.58, 9.35, 9.35], "Extra Large 0–50 lb": [25.56, 26.33, 26.33], "Extra Large 50+–70 lb": [36.55, 37.32, 37.32], "Extra Large 70+–150 lb": [50.55, 51.32, 51.32], "Extra Large 150+ lb": [194.18, 194.95, 194.95], "Small Standard": [0, 0, 0], "Large Standard": [0, 0, 0],
    },
    apparel: {
      "Small Bulky": [6.78, 7.55, 7.55], "Large Bulky": [8.58, 9.35, 9.35], "Extra Large 0–50 lb": [25.56, 26.33, 26.33], "Extra Large 50+–70 lb": [36.55, 37.32, 37.32], "Extra Large 70+–150 lb": [50.55, 51.32, 51.32], "Extra Large 150+ lb": [194.18, 194.95, 194.95], "Small Standard": [0, 0, 0], "Large Standard": [0, 0, 0],
    },
    dangerous: {
      "Small Bulky": [7.50, 8.27, 8.27], "Large Bulky": [9.30, 10.07, 10.07], "Extra Large 0–50 lb": [27.67, 28.44, 28.44], "Extra Large 50+–70 lb": [39.76, 40.53, 40.53], "Extra Large 70+–150 lb": [57.68, 58.45, 58.45], "Extra Large 150+ lb": [218.76, 219.53, 219.53], "Small Standard": [0, 0, 0], "Large Standard": [0, 0, 0],
    },
  },
  peak: {
    general: {
      "Small Bulky": [7.82, 8.59, 8.59], "Large Bulky": [9.62, 10.39, 10.39], "Extra Large 0–50 lb": [28.29, 29.06, 29.06], "Extra Large 50+–70 lb": [39.36, 40.13, 40.13], "Extra Large 70+–150 lb": [54.97, 55.74, 55.74], "Extra Large 150+ lb": [202.69, 203.46, 203.46], "Small Standard": [0, 0, 0], "Large Standard": [0, 0, 0],
    },
    apparel: {
      "Small Bulky": [7.82, 8.59, 8.59], "Large Bulky": [9.62, 10.39, 10.39], "Extra Large 0–50 lb": [28.29, 29.06, 29.06], "Extra Large 50+–70 lb": [39.36, 40.13, 40.13], "Extra Large 70+–150 lb": [54.97, 55.74, 55.74], "Extra Large 150+ lb": [202.69, 203.46, 203.46], "Small Standard": [0, 0, 0], "Large Standard": [0, 0, 0],
    },
    dangerous: {
      "Small Bulky": [9.06, 9.83, 9.83], "Large Bulky": [10.86, 11.63, 11.63], "Extra Large 0–50 lb": [31.71, 32.48, 32.48], "Extra Large 50+–70 lb": [43.86, 44.63, 44.63], "Extra Large 70+–150 lb": [64.04, 64.81, 64.81], "Extra Large 150+ lb": [230.84, 231.61, 231.61], "Small Standard": [0, 0, 0], "Large Standard": [0, 0, 0],
    },
  },
};

const PRICE_BAND_INDEX: Record<PriceBand, number> = { low: 0, mid: 1, high: 2 };

export function convertLength(value: number, unit: LengthUnit): number {
  const factors: Record<LengthUnit, number> = { mm: 1 / 25.4, cm: 1 / 2.54, m: 100 / 2.54, in: 1, inch: 1, ft: 12, feet: 12 };
  return value * factors[unit];
}

export function convertWeight(value: number, unit: WeightUnit): number {
  const factors: Record<WeightUnit, number> = { g: 1 / 453.592, kg: 2.20462, oz: 1 / 16, lb: 1 };
  return value * factors[unit];
}

export function convertVolume(value: number, unit: VolumeUnit): { cbm: number; cuft: number } {
  const cbm = unit === "cm3" ? value / 1_000_000 : unit === "cuft" ? value * 0.0283168 : value;
  return { cbm, cuft: cbm * 35.3147 };
}

export function convertLiquid(value: number, unit: LiquidUnit): { ml: number; oz: number } {
  const ml = unit === "l" ? value * 1000 : unit === "oz" ? value * 29.5735 : value;
  return { ml, oz: ml / 29.5735 };
}

export function getPriceBand(price: number): PriceBand {
  if (price < 10) return "low";
  if (price <= 50) return "mid";
  return "high";
}

export function getFeePeriod(feeDate: string): FeePeriod {
  return feeDate >= "2026-10-15" && feeDate <= "2027-01-14" ? "peak" : "nonPeak";
}

export function shouldAutoApplySurcharge(feeDate: string): boolean {
  return feeDate >= "2026-04-17" && feeDate <= "2027-01-14";
}

export function classifySizeTier(dimensionsIn: [number, number, number], actualWeightLb: number): SizeClassification {
  const [longest, median, shortest] = [...dimensionsIn].sort((a, b) => b - a) as [number, number, number];
  const girth = 2 * (median + shortest);
  const lengthPlusGirth = longest + girth;
  const rawDimensionalWeight = (longest * median * shortest) / 139;
  const adjustedDimensionalWeight = (longest * Math.max(median, 2) * Math.max(shortest, 2)) / 139;
  const standardTierWeight = Math.max(actualWeightLb, rawDimensionalWeight);
  const bulkyTierWeight = Math.max(actualWeightLb, adjustedDimensionalWeight);

  let tier: SizeTier;
  if (standardTierWeight <= 1 && longest <= 15 && median <= 12 && shortest <= 0.75) {
    tier = "Small Standard";
  } else if (standardTierWeight <= 20 && longest <= 18 && median <= 14 && shortest <= 8) {
    tier = "Large Standard";
  } else if (bulkyTierWeight <= 50 && longest <= 37 && median <= 28 && shortest <= 20 && lengthPlusGirth <= 130) {
    tier = "Small Bulky";
  } else if (bulkyTierWeight <= 50 && longest <= 59 && median <= 33 && shortest <= 33 && lengthPlusGirth <= 130) {
    tier = "Large Bulky";
  } else if (bulkyTierWeight <= 50) {
    tier = "Extra Large 0–50 lb";
  } else if (bulkyTierWeight <= 70) {
    tier = "Extra Large 50+–70 lb";
  } else if (bulkyTierWeight <= 150) {
    tier = "Extra Large 70+–150 lb";
  } else {
    tier = "Extra Large 150+ lb";
  }

  const minimumTwoInchesApplied = tier.includes("Bulky") || tier.includes("Extra Large");
  const dimensionalWeight = minimumTwoInchesApplied ? adjustedDimensionalWeight : rawDimensionalWeight;
  const actualOnly = tier === "Small Standard" || tier === "Extra Large 150+ lb";
  const feeShippingWeight = actualOnly ? actualWeightLb : Math.max(actualWeightLb, dimensionalWeight);
  const tierWeight = minimumTwoInchesApplied ? bulkyTierWeight : standardTierWeight;
  const overmax = tier.includes("Extra Large") && tier !== "Extra Large 150+ lb" && (longest > 96 || lengthPlusGirth > 130);

  return {
    tier,
    longest,
    median,
    shortest,
    girth,
    lengthPlusGirth,
    rawDimensionalWeight,
    adjustedDimensionalWeight: dimensionalWeight,
    tierWeight,
    feeShippingWeight,
    dimensionalWeightUsedForFee: !actualOnly && dimensionalWeight > actualWeightLb,
    minimumTwoInchesApplied,
    overmax,
  };
}

function selectFee(fees: FeeTriple, priceBand: PriceBand): number {
  return fees[PRICE_BAND_INDEX[priceBand]];
}

function intervalLabel(start: number, interval: number, count: number): string {
  const lower = start + Math.max(0, count - 1) * interval;
  const upper = start + count * interval;
  return `${lower.toFixed(2)}+–${upper.toFixed(2)} lb`;
}

export function calculateFulfillmentFee(
  classification: SizeClassification,
  price: number,
  productType: ProductType,
  feeDate: string,
  includeSurcharge: boolean,
): FeeResult {
  const period = getFeePeriod(feeDate);
  const priceBand = getPriceBand(price);
  const shippingWeight = classification.feeShippingWeight;
  const rates = (period === "peak" ? PEAK_RATES : NON_PEAK_RATES)[productType];
  let baseFee: number;
  let weightTierLabel: string;
  let rateExplanation: string;

  if (classification.tier === "Small Standard") {
    const row = rates.small.find((candidate) => shippingWeight <= candidate.maxLb + Number.EPSILON) ?? rates.small.at(-1)!;
    baseFee = selectFee(row.fees, priceBand);
    weightTierLabel = row.label;
    rateExplanation = "Small Standard 按实际重量匹配 2 oz 阶梯";
  } else if (classification.tier === "Large Standard" && shippingWeight <= 3) {
    const row = rates.large.find((candidate) => shippingWeight <= candidate.maxLb + Number.EPSILON) ?? rates.large.at(-1)!;
    baseFee = selectFee(row.fees, priceBand);
    weightTierLabel = row.label;
    rateExplanation = "Large Standard 取实际重量与体积重量较大值匹配阶梯";
  } else if (classification.tier === "Large Standard") {
    const interval = productType === "apparel" ? 0.5 : 0.25;
    const increment = productType === "apparel" ? 0.16 : 0.08;
    const count = Math.ceil((shippingWeight - 3 - Number.EPSILON) / interval);
    baseFee = selectFee(rates.heavyBase, priceBand) + count * increment;
    weightTierLabel = intervalLabel(3, interval, count);
    rateExplanation = productType === "apparel" ? "首 3 lb 后每 0.5 lb 加收 $0.16" : "首 3 lb 后每 4 oz 加收 $0.08";
  } else {
    const base = selectFee(BULKY_BASES[period][productType][classification.tier], priceBand);
    if (classification.tier === "Small Bulky" || classification.tier === "Large Bulky" || classification.tier === "Extra Large 0–50 lb") {
      const count = Math.ceil(Math.max(0, shippingWeight - 1 - Number.EPSILON));
      baseFee = base + count * 0.38;
      weightTierLabel = count === 0 ? "0–1 lb" : intervalLabel(1, 1, count);
      rateExplanation = "首 1 lb 后每 1 lb 区间加收 $0.38";
    } else if (classification.tier === "Extra Large 50+–70 lb") {
      const count = Math.ceil(Math.max(0, shippingWeight - 51 - Number.EPSILON));
      baseFee = base + count * 0.75;
      weightTierLabel = count === 0 ? "50+–51 lb" : intervalLabel(51, 1, count);
      rateExplanation = "51 lb 后每 1 lb 区间加收 $0.75";
    } else if (classification.tier === "Extra Large 70+–150 lb") {
      const count = Math.ceil(Math.max(0, shippingWeight - 71 - Number.EPSILON));
      baseFee = base + count * 0.75;
      weightTierLabel = count === 0 ? "70+–71 lb" : intervalLabel(71, 1, count);
      rateExplanation = "71 lb 后每 1 lb 区间加收 $0.75";
    } else {
      const count = Math.ceil(Math.max(0, shippingWeight - 151 - Number.EPSILON));
      baseFee = base + count * 0.19;
      weightTierLabel = count === 0 ? "150+–151 lb" : intervalLabel(151, 1, count);
      rateExplanation = "Extra Large 150+ 仅用实际重量，151 lb 后每 1 lb 加收 $0.19";
    }
  }

  const surcharge = includeSurcharge ? baseFee * 0.035 : 0;
  return {
    baseFee,
    surcharge,
    totalFee: baseFee + surcharge,
    period,
    priceBand,
    weightTierLabel,
    rateExplanation,
  };
}

function findPackagingSuggestion(
  dimensionsIn: [number, number, number],
  actualWeightLb: number,
  input: FbaInput,
  currentFee: number,
): PackagingSuggestion | null {
  const sorted = [...dimensionsIn].sort((a, b) => b - a) as [number, number, number];
  const labels = ["最长边", "中边", "短边"] as const;
  const candidates: PackagingSuggestion[] = [];

  sorted.forEach((side, index) => {
    const maxReduction = Math.min(side * 0.4, 12);
    for (let reduction = 0.25; reduction <= maxReduction + Number.EPSILON; reduction += 0.25) {
      const candidateDimensions = [...sorted] as [number, number, number];
      candidateDimensions[index] = Math.max(0.1, side - reduction);
      const classification = classifySizeTier(candidateDimensions, actualWeightLb);
      const fee = calculateFulfillmentFee(classification, input.price, input.productType, input.feeDate, input.includeSurcharge);
      if (fee.totalFee < currentFee - 0.004) {
        candidates.push({
          dimensionLabel: labels[index],
          reduction,
          projectedDimension: candidateDimensions[index],
          projectedDimensionalWeight: classification.adjustedDimensionalWeight,
          projectedTier: classification.tier,
          projectedFee: fee.totalFee,
          savings: currentFee - fee.totalFee,
        });
        break;
      }
    }
  });

  return candidates.sort((a, b) => a.reduction - b.reduction || b.savings - a.savings)[0] ?? null;
}

export function calculateFba(input: FbaInput): FbaResult {
  const dimensionsIn: [number, number, number] = [input.length, input.width, input.height].map((value) => convertLength(value, input.lengthUnit)) as [number, number, number];
  const dimensionsCm = dimensionsIn.map((value) => value * 2.54) as [number, number, number];
  const actualWeightLb = convertWeight(input.weight, input.weightUnit);
  const actualWeightKg = actualWeightLb / 2.20462;
  const classification = classifySizeTier(dimensionsIn, actualWeightLb);
  const fee = calculateFulfillmentFee(classification, input.price, input.productType, input.feeDate, input.includeSurcharge);
  const suggestion = findPackagingSuggestion(dimensionsIn, actualWeightLb, input, fee.totalFee);
  const warnings: string[] = [];

  if (input.feeDate < "2026-01-15" || input.feeDate > "2027-01-14") {
    warnings.push("计费日期超出本版官方费率有效期，当前仍按 2026 非旺季费率预估。");
  }
  if (classification.overmax) {
    warnings.push("该产品符合 Overmax 条件，结果未包含额外 Overmax handling fee。");
  }
  warnings.push("结果未包含 SIPP、低库存、锂电池、入库配置及其他独立费用或折扣。");

  return { input, dimensionsIn, dimensionsCm, actualWeightLb, actualWeightKg, classification, fee, suggestion, warnings };
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}
