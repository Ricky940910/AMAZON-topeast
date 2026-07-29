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
  ratePerKg: 40,
  ratePerCbm: 0,
  minimumChargeable: 21,
  billingIncrement: 0.5,
  volumeWeightDivisor: 6000,
  fees: [
    { id: "pickup", name: "提货费", category: "origin", amount: 500 },
    { id: "customs", name: "清关费", category: "destination", amount: 800 },
    { id: "duty", name: "关税", category: "tax", amount: 1200 },
  ],
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
    expect(result.logisticsCostBeforeImportTaxes).toBe(23_300);
    expect(result.totalFirstMileCost).toBe(24_500);
    expect(result.unitLogisticsCostBeforeImportTaxes).toBeCloseTo(23.3, 8);
    expect(result.unitImportTax).toBeCloseTo(1.2, 8);
  });

  it("applies minimum volume billing to sea freight", () => {
    const result = calculateFirstMile({
      ...input,
      totalUnits: 100,
      unitsPerCarton: 20,
      cartonCount: 5,
      transportMode: "sea-fast",
      ratePerKg: 0,
      ratePerCbm: 1000,
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

  it("uses chargeable kilograms for AGL air and reports the weight source", () => {
    const result = calculateFirstMile({ ...input, transportMode: "agl-air", cartonGrossWeightKg: 8, ratePerKg: 38, ratePerCbm: 900 });
    expect(result.chargeBasis).toBe("weight");
    expect(result.weightChargeSource).toBe("dimensional");
    expect(result.billedQuantity).toBe(500);
    expect(result.appliedRate).toBe(38);
    expect(result.freightCost).toBe(19_000);
  });

  it("uses CBM pricing for AGL sea even when a kilogram quote is present", () => {
    const result = calculateFirstMile({ ...input, transportMode: "agl-sea", ratePerKg: 8, ratePerCbm: 920, minimumChargeable: 1, billingIncrement: 0.01 });
    expect(result.chargeBasis).toBe("volume");
    expect(result.billedQuantity).toBe(3);
    expect(result.appliedRate).toBe(920);
    expect(result.freightCost).toBe(2760);
  });

  it("warns about inconsistent cartons and impossible weights", () => {
    const result = calculateFirstMile({ ...input, cartonCount: 40, cartonGrossWeightKg: 5 });
    expect(result.warnings.some((warning) => warning.includes("应为 50 箱"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("低于产品净重"))).toBe(true);
  });
});
