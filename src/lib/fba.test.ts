import { describe, expect, it } from "vitest";
import {
  calculateFba,
  calculateFulfillmentFee,
  classifySizeTier,
  convertLength,
  convertLiquid,
  convertVolume,
  getPriceBand,
} from "./fba";

describe("unit conversion", () => {
  it("normalizes the provided metric example without early rounding", () => {
    expect(convertLength(32, "cm")).toBeCloseTo(12.5984, 4);
    expect(convertVolume(1, "m3").cuft).toBeCloseTo(35.3147, 4);
    expect(convertLiquid(1, "l").ml).toBe(1000);
  });
});

describe("2026 size tier rules", () => {
  it("uses actual weight only for Small Standard fee shipping weight", () => {
    const result = classifySizeTier([15, 12, 0.75], 0.5);
    expect(result.tier).toBe("Small Standard");
    expect(result.feeShippingWeight).toBe(0.5);
  });

  it("separates Small Bulky and Large Bulky", () => {
    expect(classifySizeTier([37, 20, 5], 10).tier).toBe("Small Bulky");
    expect(classifySizeTier([38, 20, 5], 10).tier).toBe("Large Bulky");
  });

  it("flags Extra Large Overmax products", () => {
    const result = classifySizeTier([97, 10, 10], 20);
    expect(result.tier).toContain("Extra Large");
    expect(result.overmax).toBe(true);
  });

  it("applies the 2 inch minimum to bulky dimensional weight", () => {
    const result = classifySizeTier([40, 25, 1], 4.5);
    expect(result.tier).toBe("Large Bulky");
    expect(result.adjustedDimensionalWeight).toBeCloseTo(14.388, 3);
  });
});

describe("2026 fulfillment fee matching", () => {
  it("places 2.18 lb in the 2.00–2.25 lb tier", () => {
    const classification = classifySizeTier([12, 10, 2], 2.18);
    const fee = calculateFulfillmentFee(classification, 29.99, "general", "2026-07-28", false);
    expect(fee.weightTierLabel).toBe("2.00+–2.25 lb");
    expect(fee.baseFee).toBe(5.92);
  });

  it("keeps $10 and $50 in the middle price band", () => {
    expect(getPriceBand(9.99)).toBe("low");
    expect(getPriceBand(10)).toBe("mid");
    expect(getPriceBand(50)).toBe("mid");
    expect(getPriceBand(50.01)).toBe("high");
  });

  it("adds the 3.5% surcharge independently", () => {
    const input = {
      length: 32,
      width: 18,
      height: 15,
      lengthUnit: "cm" as const,
      weight: 560,
      weightUnit: "g" as const,
      price: 29.99,
      productType: "general" as const,
      feeDate: "2026-07-28",
      includeSurcharge: true,
    };
    const result = calculateFba(input);
    expect(result.classification.adjustedDimensionalWeight).toBeCloseTo(3.7931, 3);
    expect(result.fee.surcharge).toBeCloseTo(result.fee.baseFee * 0.035, 8);
    expect(result.fee.totalFee).toBeCloseTo(result.fee.baseFee * 1.035, 8);
  });
});
