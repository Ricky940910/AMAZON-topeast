import { describe, expect, it } from "vitest";
import { calculateFirstMile, type FirstMileInput } from "./firstMile";

const input: FirstMileInput = {
  sku: "SKU-FIRST-MILE",
  asin: "B000000000",
  originCountry: "中国",
  destination: "US",
  amazonWarehouse: "ONT8",
  shipDate: "2026-07-01",
  estimatedArrivalDate: "2026-07-31",
  totalUnits: 1000,
  unitWeightKg: 0.5,
  unitLengthCm: 20,
  unitWidthCm: 15,
  unitHeightCm: 5,
  unitsPerCarton: 20,
  cartonCount: 50,
  cartonLengthCm: 50,
  cartonWidthCm: 40,
  cartonHeightCm: 30,
  cartonGrossWeightKg: 11,
  transportMode: "air-delivery",
  ratePerChargeUnit: 40,
  minimumChargeable: 21,
  billingIncrement: 0.5,
  volumeWeightDivisor: 6000,
  fees: [
    { id: "pickup", name: "提货费", category: "origin", amount: 500 },
    { id: "customs", name: "清关费", category: "destination", amount: 800 },
    { id: "duty", name: "关税", category: "tax", amount: 1200 },
  ],
  insuranceEnabled: true,
  cargoValueCny: 50_000,
  insuranceRate: 0.3,
  minimumInsurancePremium: 100,
  salePrice: 29.99,
  exchangeRateCnyPerCurrency: 7.2,
};

describe("first mile engine", () => {
  it("calculates shipment weight, volume and carton validation", () => {
    const result = calculateFirstMile(input);
    expect(result.expectedCartonCount).toBe(50);
    expect(result.grossWeightKg).toBe(550);
    expect(result.totalVolumeCbm).toBeCloseTo(3, 8);
    expect(result.dimensionalWeightKg).toBe(500);
    expect(result.rawChargeableWeightKg).toBe(550);
    expect(result.billedQuantity).toBe(550);
  });

  it("uses dimensional weight and rounds the billable quantity", () => {
    const result = calculateFirstMile({ ...input, cartonGrossWeightKg: 8.01, billingIncrement: 0.5 });
    expect(result.grossWeightKg).toBeCloseTo(400.5, 8);
    expect(result.dimensionalWeightKg).toBe(500);
    expect(result.billedQuantity).toBe(500);
    expect(result.dimensionalWeightApplied).toBe(true);
  });

  it("uses the express divisor independently from air freight", () => {
    const result = calculateFirstMile({ ...input, transportMode: "express", volumeWeightDivisor: 5000 });
    expect(result.expressDimensionalWeightKg).toBe(600);
    expect(result.dimensionalWeightKg).toBe(600);
    expect(result.billedQuantity).toBe(600);
  });

  it("separates import taxes from logistics cost for profit linkage", () => {
    const result = calculateFirstMile(input);
    expect(result.freightCost).toBe(22_000);
    expect(result.nonTaxAdditionalFees).toBe(1300);
    expect(result.importTaxes).toBe(1200);
    expect(result.insuranceFee).toBe(150);
    expect(result.logisticsCostBeforeImportTaxes).toBe(23_450);
    expect(result.totalFirstMileCost).toBe(24_650);
    expect(result.unitLogisticsCostBeforeImportTaxes).toBeCloseTo(23.45, 8);
    expect(result.unitImportTax).toBeCloseTo(1.2, 8);
  });

  it("treats the insurance rate input as a percentage", () => {
    const result = calculateFirstMile({ ...input, cargoValueCny: 50_000, insuranceRate: 0.3, minimumInsurancePremium: 0 });
    expect(result.insuranceFee).toBe(150);
  });

  it("applies minimum volume billing to sea freight", () => {
    const result = calculateFirstMile({
      ...input,
      totalUnits: 100,
      unitsPerCarton: 20,
      cartonCount: 5,
      transportMode: "sea-fast",
      ratePerChargeUnit: 1000,
      minimumChargeable: 1,
      billingIncrement: 0.01,
    });
    expect(result.totalVolumeCbm).toBeCloseTo(0.3, 8);
    expect(result.billedQuantity).toBe(1);
    expect(result.freightCost).toBe(1000);
  });

  it("calculates transit days", () => {
    const result = calculateFirstMile(input);
    expect(result.transitDays).toBe(30);
  });

  it("warns about inconsistent cartons and impossible weights", () => {
    const result = calculateFirstMile({ ...input, cartonCount: 40, cartonGrossWeightKg: 5 });
    expect(result.warnings.some((warning) => warning.includes("应为 50 箱"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("低于产品净重"))).toBe(true);
  });
});
