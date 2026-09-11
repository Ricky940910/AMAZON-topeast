import { describe, expect, it } from "vitest";
import { calculateCargoDeclaration } from "./cargoDeclaration";

describe("cargo declaration calculator", () => {
  it("compares all carton rotations and calculates product declaration amount", () => {
    const result = calculateCargoDeclaration({
      boxLength: 60,
      boxWidth: 40,
      boxHeight: 40,
      dimensionUnit: "cm",
      unitsPerCarton: 10,
      declarationBase: 10000,
    });

    expect(result.cartonsPerContainer).toBe(600);
    expect(result.productsPerContainer).toBe(6000);
    expect(result.declarationBase).toBe(10000);
    expect(result.declarationPerProduct).toBeCloseTo(10000 / 6000, 8);
    expect(result.bestOrientation?.placementLabel).toContain("→柜长");
  });

  it("converts inch inputs before checking the container", () => {
    const result = calculateCargoDeclaration({
      boxLength: 23.62,
      boxWidth: 15.75,
      boxHeight: 15.75,
      dimensionUnit: "in",
      unitsPerCarton: 10,
      declarationBase: 7856,
    });

    expect(result.boxDimensionsCm[0]).toBeCloseTo(60.0, 1);
    expect(result.cartonsPerContainer).toBe(600);
  });

  it("keeps empty input blank in the calculation result", () => {
    const result = calculateCargoDeclaration({
      boxLength: 0,
      boxWidth: 0,
      boxHeight: 0,
      dimensionUnit: "cm",
      unitsPerCarton: 0,
      declarationBase: 0,
    });

    expect(result.valid).toBe(false);
    expect(result.cartonsPerContainer).toBe(0);
    expect(result.productsPerContainer).toBe(0);
    expect(result.declarationPerProduct).toBe(0);
    expect(result.warnings).toContain("请填写大于 0 的整柜申报基数，系统才能计算单个产品申报金额。");
  });
});
