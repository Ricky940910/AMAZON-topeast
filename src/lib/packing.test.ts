import { describe, expect, it } from "vitest";
import {
  buildShipmentRows,
  buildMatrixShipmentRows,
  calculateCapacity,
  calculateCommonCartonCount,
  calculateMultiSku,
  calculateOrientation,
  calculateRecommendedQuantity,
  createCleanPackingPlan,
  createGroupedPackingPlan,
  createIdenticalPackingPlan,
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

describe("multi SKU carton matrix", () => {
  const row = (id: string, sku: string, totalQty: number, cartonCount = 0, productWeight = 0) => ({
    id, sku, totalQty, cartonCount, productWeight, productDimensions: [0, 0, 0] as [number, number, number],
  });

  it("builds a fixed-group mixed plan with identical cartons inside every group", () => {
    const plan = createGroupedPackingPlan([
      row("a", "A", 20), row("b", "B", 20), row("d", "D", 15), row("c", "C", 18),
      row("e", "E", 18), row("f", "F", 14), row("s", "S", 14),
    ], [5, 5, 6, 7]);

    expect(plan.errors).toEqual([]);
    expect(plan.totalCartons).toBe(23);
    expect(plan.rows.map((item) => item.packedQty)).toEqual([20, 20, 15, 18, 18, 14, 14]);
    expect(Math.max(...plan.cartons.map((carton) => carton.totalQuantity))).toBeLessThanOrEqual(6);
    for (const group of plan.groups) {
      const signatures = Array.from({ length: group.cartonCount }, (_, index) =>
        plan.rows.map((item) => item.allocations[group.startCarton - 1 + index]).join("/"),
      );
      expect(new Set(signatures).size).toBe(1);
    }
  });

  it("uses the greatest common divisor for a fully identical mixed plan", () => {
    expect(calculateCommonCartonCount([38, 19, 114, 57])).toBe(19);
    const plan = createIdenticalPackingPlan([
      row("a", "A", 38), row("b", "B", 19), row("d", "D", 114), row("c", "C", 57),
    ]);
    expect(plan.totalCartons).toBe(19);
    expect(plan.distinctConfigurations).toBe(1);
    expect(plan.rows.map((item) => item.allocations[0])).toEqual([2, 1, 6, 3]);
  });

  it("keeps every SKU in its own continuous carton group for clean packing", () => {
    const plan = createCleanPackingPlan([
      row("a", "A", 25, 5), row("b", "B", 25, 5), row("d", "D", 25, 5), row("c", "C", 25, 5),
    ], 5);
    expect(plan.totalCartons).toBe(20);
    expect(plan.mixedCartonCount).toBe(0);
    expect(plan.rows[0].allocations.slice(0, 5)).toEqual([5, 5, 5, 5, 5]);
    expect(plan.rows[1].allocations.slice(5, 10)).toEqual([5, 5, 5, 5, 5]);
  });

  it("reports quantities that cannot be represented by the selected groups", () => {
    const plan = createGroupedPackingPlan([row("a", "A", 12)], [5]);
    expect(plan.errors[0]).toContain("无法由箱组");
  });

  it("generates shipment rows from non-empty matrix cells", () => {
    const plan = createIdenticalPackingPlan([row("a", "A", 10, 0, 0.5), row("b", "B", 5, 0, 1)]);
    const shipment = buildMatrixShipmentRows(plan, [60, 40, 40]);
    expect(shipment).toHaveLength(10);
    expect(shipment[0]["Weight (kg)"]).toBe(2);
  });
});

describe("replenishment", () => {
  it("rounds recommended unit quantities up to a whole unit", () => {
    expect(calculateRecommendedQuantity(25, 30, 15)).toBe(1125);
    expect(calculateRecommendedQuantity(2.5, 10, 5)).toBe(38);
  });
});
