import { describe, expect, it } from "vitest";
import {
  buildShipmentRows,
  calculateCapacity,
  calculateMultiSku,
  calculateOrientation,
  calculateRecommendedQuantity,
  distributeAverage,
  distributeByCapacity,
  maxQuantityDifference,
  validateCartons,
} from "./packing";

describe("average packing", () => {
  it("distributes 257 units across 8 cartons with a maximum difference of one", () => {
    const cartons = distributeAverage(257, 8);
    expect(cartons.map((carton) => carton.quantity)).toEqual([33, 32, 32, 32, 32, 32, 32, 32]);
    expect(maxQuantityDifference(cartons)).toBe(1);
    expect(validateCartons(cartons, 257)).toEqual([]);
  });

  it("rejects carton counts that would create empty cartons", () => {
    expect(() => distributeAverage(3, 4)).toThrow("空箱");
  });
});

describe("capacity packing", () => {
  it("fills cartons to the specified capacity and leaves a partial final carton", () => {
    expect(distributeByCapacity(257, 30).map((carton) => carton.quantity)).toEqual([30, 30, 30, 30, 30, 30, 30, 30, 17]);
  });

  it("uses the stricter weight or dimension capacity", () => {
    const capacity = calculateCapacity(0.65, 22, [35, 25, 8], [60, 40, 40]);
    expect(capacity.weightCapacity).toBe(33);
    expect(capacity.dimensionCapacity).toBe(10);
    expect(capacity.effectiveCapacity).toBe(10);
    expect(capacity.limitingFactor).toBe("dimensions");
  });

  it("finds the best of six product orientations", () => {
    const result = calculateOrientation([35, 25, 8], [60, 40, 40]);
    expect(result.capacity).toBe(10);
    expect(result.counts).toEqual([2, 1, 5]);
  });

  it("reports products that cannot fit", () => {
    expect(calculateOrientation([70, 50, 50], [60, 40, 40]).fits).toBe(false);
  });
});

describe("multi SKU and shipment data", () => {
  it("calculates each SKU independently", () => {
    const result = calculateMultiSku([
      { id: "a", sku: "A", totalQty: 245, cartonCount: 8, productWeight: 0, productDimensions: [0, 0, 0] },
      { id: "b", sku: "B", totalQty: 128, cartonCount: 4, productWeight: 0, productDimensions: [0, 0, 0] },
      { id: "c", sku: "C", totalQty: 67, cartonCount: 3, productWeight: 0, productDimensions: [0, 0, 0] },
    ], 22, [60, 40, 40]);
    expect(result[0].cartons.map((carton) => carton.quantity)).toEqual([31, 31, 31, 31, 31, 30, 30, 30]);
    expect(result[1].cartons.map((carton) => carton.quantity)).toEqual([32, 32, 32, 32]);
    expect(result[2].cartons.map((carton) => carton.quantity)).toEqual([23, 22, 22]);
    expect(buildShipmentRows(result)).toHaveLength(15);
  });
});

describe("replenishment", () => {
  it("rounds recommended unit quantities up to a whole unit", () => {
    expect(calculateRecommendedQuantity(25, 30, 15)).toBe(1125);
    expect(calculateRecommendedQuantity(2.5, 10, 5)).toBe(38);
  });
});
