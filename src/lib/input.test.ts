import { describe, expect, it } from "vitest";
import { numberInputValue } from "./input";

describe("numberInputValue", () => {
  it("renders zero and missing numeric values as an empty input", () => {
    expect(numberInputValue(0)).toBe("");
    expect(numberInputValue(null)).toBe("");
    expect(numberInputValue(undefined)).toBe("");
  });

  it("keeps valid non-zero numbers", () => {
    expect(numberInputValue(12.34)).toBe(12.34);
  });
});
