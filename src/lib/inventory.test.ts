import { describe, expect, it } from "vitest";
import {
  calculateInventoryAge,
  calculateInventoryCosts,
  calculateLiquidationProcessingFee,
  calculateRemovalFeePerUnit,
  getAgedInventoryRate,
  getStorageRates,
  type InventoryInput,
} from "./inventory";

const input: InventoryInput = {
  sku: "SKU-AGING",
  asin: "B000000000",
  productName: "示例产品",
  currentInventory: 420,
  unitVolumeCuFt: 0.12,
  averageDailySales: 2.5,
  inboundDate: "2025-06-15",
  currentDate: "2026-07-28",
  sizeTier: "standard",
  dangerousGoods: false,
  utilizationEligible: false,
  utilizationWeeks: 18,
  customStorageRate: null,
  customAgedRate: null,
  removalQuantity: 420,
  unitWeightLb: 1.2,
  customRemovalFee: null,
  liquidationQuantity: 420,
  unitCost: 8,
  recoveryRate: 0.08,
  forecastMonths: 12,
};

describe("inventory age and rate cards", () => {
  it("calculates inventory age using calendar dates", () => {
    expect(calculateInventoryAge("2026-01-01", "2026-07-01")).toBe(181);
  });

  it("matches monthly storage season and size tier", () => {
    expect(getStorageRates("2026-07-28", "standard", false, false, 0, 100).baseRate).toBe(0.78);
    expect(getStorageRates("2026-11-01", "oversize", false, false, 0, 100).baseRate).toBe(1.40);
    expect(getStorageRates("2026-11-01", "standard", true, false, 0, 100).baseRate).toBe(3.63);
  });

  it("matches storage utilization surcharge tiers", () => {
    expect(getStorageRates("2026-07-28", "standard", false, true, 25, 100).utilizationRate).toBe(0.44);
    expect(getStorageRates("2026-07-28", "oversize", false, true, 54, 100).utilizationRate).toBe(1.26);
  });

  it("uses the 2026 minimum aged fee for 12 to 15 month inventory", () => {
    expect(getAgedInventoryRate(400)).toEqual({ ageBand: "366–455 天", volumeRate: 6.90, minimumPerUnit: 0.30 });
    expect(getAgedInventoryRate(500)).toEqual({ ageBand: "456 天以上", volumeRate: 7.90, minimumPerUnit: 0.35 });
  });
});

describe("removal and liquidation", () => {
  it("matches 2026 removal fee weight bands", () => {
    expect(calculateRemovalFeePerUnit("standard", 0.4)).toBe(0.84);
    expect(calculateRemovalFeePerUnit("standard", 1.2)).toBe(2.27);
    expect(calculateRemovalFeePerUnit("oversize", 12)).toBe(16.44);
  });

  it("matches liquidation processing fee bands", () => {
    expect(calculateLiquidationProcessingFee("standard", 1.2)).toBe(0.35);
    expect(calculateLiquidationProcessingFee("oversize", 12)).toBe(2.30);
  });
});

describe("complete inventory scenario", () => {
  it("calculates storage, aged, removal and net liquidation economics", () => {
    const result = calculateInventoryCosts(input);
    expect(result.totalVolume).toBeCloseTo(50.4, 6);
    expect(result.monthlyStorageFee).toBeCloseTo(39.312, 6);
    expect(result.agedInventoryFee).toBeCloseTo(347.76, 6);
    expect(result.removalTotalFee).toBeCloseTo(953.4, 6);
    expect(result.liquidationGrossRecovery).toBeCloseTo(268.8, 6);
    expect(result.liquidationNetRecovery).toBeCloseTo(81.48, 6);
    expect(result.liquidationLoss).toBeCloseTo(3278.52, 6);
    expect(result.forecast.length).toBe(6);
  });

  it("uses the minimum per-unit aged fee when it is higher than the volume fee", () => {
    const result = calculateInventoryCosts({ ...input, unitVolumeCuFt: 0.01, inboundDate: "2025-01-01", currentDate: "2026-07-28" });
    expect(result.agedRates.ageBand).toBe("456 天以上");
    expect(result.agedVolumeFee).toBeCloseTo(33.18, 6);
    expect(result.agedMinimumFee).toBeCloseTo(147, 6);
    expect(result.agedInventoryFee).toBeCloseTo(147, 6);
  });

  it("recommends continuing for healthy young inventory", () => {
    const result = calculateInventoryCosts({ ...input, currentInventory: 90, averageDailySales: 3, inboundDate: "2026-06-01", removalQuantity: 90, liquidationQuantity: 90 });
    expect(result.decision).toBe("continue");
  });

  it("compares partial exit plans against the matching share of holding cost", () => {
    const result = calculateInventoryCosts({ ...input, sizeTier: "oversize", removalQuantity: 1, liquidationQuantity: 1 });
    expect(result.decision).toBe("promote");
  });
});
